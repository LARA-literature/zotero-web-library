import { createItems, fetchItemTemplate, updateMultipleItems } from '.';

const excludeKeys = ['dateModified', 'dateCreated'];
const mapAnnotationFromReader = (annotationFromReader, annotationItem, isNewItem = false) => {
	const annotationPatch = isNewItem ? { ...annotationItem } : { };
	annotationPatch.key = annotationFromReader.id;

	Object.keys(annotationItem).forEach(key => {
		if (excludeKeys.includes(key)) {
			return;
		}
		const shortKey = key.startsWith('annotation') ?
			key.slice(10, 11).toLowerCase() + key.slice(11) :
			null;
		const targetKey = (shortKey !== null && shortKey in annotationFromReader) ? shortKey : key;
		const targetValue = key === 'annotationPosition' ?
			JSON.stringify(annotationFromReader[targetKey]) :
			annotationFromReader[targetKey];

		if (targetKey in annotationFromReader && annotationItem[key] !== targetValue) {
			annotationPatch[key] = targetValue;
		}
	});

	return annotationPatch;
}

// TODO: deal with a potential scenario where reader wants to update an annotation that web library is not yet aware of
export const postAnnotationsFromReader = (annotationsFromReader, parentItemKey) => {
	return async (dispatch, getState) => {
		const state = getState();
		const libraryKey = state.current.libraryKey;
		const items = state.libraries[libraryKey]?.items ?? {};
		let annotationTypes = new Set();
		let itemsToUpdate = [], itemsToCreate = [];

		annotationsFromReader.forEach(annotationFromReader => {
			if(annotationFromReader.id in items) {
				// update existing annotation
				itemsToUpdate.push(
					mapAnnotationFromReader(annotationFromReader, items[annotationFromReader.id])
				);
			} else {
				annotationTypes.add(annotationFromReader.type);
				itemsToCreate.push(annotationFromReader);
			}
		});

		if(itemsToUpdate.length > 0) {
			dispatch(updateMultipleItems(itemsToUpdate));
		}

		annotationTypes = Array.from(annotationTypes);

		if (annotationTypes.length > 0) {
			let templates = await Promise.all(
				annotationTypes
					.map(async annotationType =>
						dispatch(fetchItemTemplate('annotation', annotationType))
					)
			);
			templates = Object.fromEntries(
				annotationTypes.map((_, i) => [annotationTypes[i], templates[i]])
			);

			itemsToCreate = itemsToCreate.map(annotationFromReader => {
				const template = templates[annotationFromReader.type];
				return mapAnnotationFromReader(
					annotationFromReader, { ...template, version: 0, parentItem: parentItemKey }, true
				);
			});

			dispatch(createItems(itemsToCreate));
		}
	};
};
