import { Fragment, memo, useEffect, useMemo } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useSelector, shallowEqual } from 'react-redux';

import { useSourceData } from '../hooks';

const mapItemKeysToTitles = (keys, selectedItemsKeys = [], items) =>
	keys.reduce((acc, ik) => {
		if (!items || !(ik in items)) {
			return acc;
		}
		const title = items[ik][Symbol.for('derived')]?.title;
		const checked = selectedItemsKeys.includes(ik);
		acc[ik] = { title, checked };

		return acc;
	}, {});

const ZoteroConnectorNotifier = () => {
	const libraryKey = useSelector(state => state.current.libraryKey);
	const collectionKey = useSelector(state => state.current.collectionKey);
	const selectedItemKey = useSelector(state => state.current.itemKey);
	const selectedItemsKeys = useSelector(state => state.current.itemKeys, shallowEqual);
	const tags = useSelector(state => state.current.tags, shallowEqual);
	const { keys: itemKeysCurrentSource } = useSourceData();
	const items = useSelector(state => state.libraries?.[libraryKey]?.items, shallowEqual);
	const itemTitles = useMemo(
		() => mapItemKeysToTitles((itemKeysCurrentSource || []), selectedItemsKeys, items),
		[itemKeysCurrentSource, items, selectedItemsKeys]
	);
	const item = items && selectedItemKey in items ? items[selectedItemKey] : null;

	const debouncedNotify = useDebouncedCallback(() => {
		document.dispatchEvent(new Event('ZoteroItemUpdated', {
			bubbles: true,
			cancelable: true
		}));
	}, 250);

	useEffect(() => { debouncedNotify(); }, [collectionKey, debouncedNotify, itemTitles, libraryKey, tags]);

	return (
        <Fragment>
		<script id="translator-items-list" type="application/vnd.zotero.data+json">
			{ JSON.stringify(itemTitles) }
		</script>
		{ item && (
			<script id="translator-current-item" key={ item.key } type="application/vnd.zotero.data+json">
				{ JSON.stringify(item) }
			</script>
		) }
		</Fragment>
    );
}

export default memo(ZoteroConnectorNotifier);
