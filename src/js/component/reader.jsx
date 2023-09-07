import { saveAs } from 'file-saver';
import { useSelector, useDispatch } from 'react-redux';
import deepEqual from 'deep-equal';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePrevious } from 'web-common/hooks';
import { Spinner } from 'web-common/components';

import { annotationItemToJSON } from '../common/annotations.js';
import { ERROR_PROCESSING_ANNOTATIONS } from '../constants/actions';
import { fetchChildItems, fetchItemDetails, navigate, tryGetAttachmentURL } from '../actions';
import { pdfWorker } from '../common/pdf-worker.js';
import { useFetchingState } from '../hooks';
import { strings } from '../constants/strings.js';

const PAGE_SIZE = 100;
const READER_CONTENT_TYPES = {
	'application/pdf': 'pdf',
	'application/epub+zip': 'epub',
	'text/html': 'snapshot',
};

const Reader = () => {
	const dispatch = useDispatch();
	const iframeRef = useRef(null);
	const libraryKey = useSelector(state => state.current.libraryKey);
	const attachmentKey = useSelector(state => {
		if(state.current.attachmentKey) {
			return state.current.attachmentKey;
		} else if (state.current.itemKey) {
			return state.current.itemKey;
		} else {
			return null
		}
	});
	const attachmentItem = useSelector(state => state.libraries[libraryKey]?.items[attachmentKey]);
	const isFetchingUrl = useSelector(state => state.libraries[libraryKey]?.attachmentsUrl[attachmentKey]?.isFetching ?? false);
	const url = useSelector(state => state.libraries[libraryKey]?.attachmentsUrl[attachmentKey]?.url);
	const timestamp = useSelector(state => state.libraries[libraryKey]?.attachmentsUrl[attachmentKey]?.timestamp ?? 0);
	const allItems = useSelector(state => state.libraries[libraryKey].items);
	const prevAttachmentItem = usePrevious(attachmentItem);
	const currentUserID = useSelector(state => state.config.userId);
	const currentUserSlug = useSelector(state => state.config.userSlug);
	const tagColors = useSelector(state => state.libraries[libraryKey]?.tagColors?.value ?? {});
	const { isGroup, isReadOnly } = useSelector(state => state.config.libraries.find(l => l.key === libraryKey));
	const pdfReaderURL = useSelector(state => state.config.pdfReaderURL);
	const lastFetchItemDetailsNoResults = useSelector(state => {
		const { libraryKey: requestLK, totalResults, queryOptions = {} } = state.traffic?.['FETCH_ITEM_DETAILS']?.last ?? {};
		return totalResults === 0 && requestLK === libraryKey && queryOptions.itemKey === attachmentKey;
	});

	const [dataState, setDataState] = useState({ isReady: false, data: null, isFetchingData: false, processedAnnotations: [], importedAnnotations: [] });

	const { isFetching, isFetched, pointer, keys } = useFetchingState(
		['libraries', libraryKey, 'itemsByParent', attachmentKey]
	);
	const urlIsFresh = !!(url && (Date.now() - timestamp) < 60000);
	const isAllFetched = isFetched && urlIsFresh && dataState.data;
	const wasAllFetched = usePrevious(isAllFetched);

	const annotations = (isFetched && keys ? keys : [])
		.map(childItemKey => allItems[childItemKey])
		.filter(item => !item.deleted && item.itemType === 'annotation');
	const prevAnnotations = usePrevious(annotations);

	const currentUser = useMemo(() => (
		{ id: currentUserID, username: currentUserSlug }
	), [currentUserID, currentUserSlug]);

	const getProcessedAnnotations = useCallback(() => {
		const tagColorsMap = new Map(tagColors.map(
			({ name, color }, position) => ([name, { tag: name, color, position }]))
		);
		try {
			return annotations.map(a => {
				const { createdByUser, lastModifiedByUser } = a?.[Symbol.for('meta')] ?? {};
				return annotationItemToJSON(a, { attachmentItem, createdByUser, currentUser, isGroup, isReadOnly,
					lastModifiedByUser, libraryKey, tagColors: tagColorsMap });
			});
		} catch (e) {
			dispatch({
				type: ERROR_PROCESSING_ANNOTATIONS,
				error: "Failed to process annotations"
			});
			console.error(e);
		}
	}, [annotations, attachmentItem, currentUser, dispatch, isGroup, isReadOnly, libraryKey, tagColors]);

	const getData = useCallback(async () => {
		setDataState(dataState => ({ ...dataState, isFetchingData: true, data }));
		const data = await(await fetch(url)).arrayBuffer();
		setDataState(dataState => ({ ...dataState, isFetchingData: false, data }));
	}, [url]);

	// const handleIframeMessage = useCallback(async (event) => {
	// 	if (event.source !== iframeRef.current.contentWindow) {
	// 		return;
	// 	}
	// 	const message = event.data;
	// 	switch (message.action) {
	// 		case 'initialized': {
	// 			return;
	// 		}
	// 		case 'loadExternalAnnotations': {
	// 			const importedAnnotations = (await pdfWorker.import(message.buf)).map(
	// 				ia => annotationItemToJSON(ia, { attachmentItem })
	// 			);
	// 			const allAnnotations = [...dataState.processedAnnotations, ...importedAnnotations];
	// 			iframeRef.current.contentWindow.postMessage({
	// 				action: 'setAnnotations',
	// 				annotations: allAnnotations
	// 			}, "*");
	// 			setDataState({ ...dataState, importedAnnotations });
	// 			return;
	// 		}
	// 		case 'save': {
	// 			const buf = await pdfWorker.export(message.buf, annotations);
	// 			const blob = new Blob([buf], { type: "application/pdf" });
	// 			const blobUrl = URL.createObjectURL(blob);
	// 			const fileName = attachmentItem?.filename || 'file.pdf';
	// 			saveAs(blobUrl, fileName);
	// 			return;
	// 		}
	// 		case 'setState': {
	// 			// message.state;
	// 			return;
	// 		}
	// 	}
	// }, [annotations, dataState, attachmentItem]);

	const handleIframeLoaded = useCallback(() => {
		console.log('create reader');
		iframeRef.current.contentWindow.createReader({
			type: READER_CONTENT_TYPES[attachmentItem.contentType],
			data: { buf: dataState.data, baseURI: url },
			annotations: dataState.processedAnnotations,
			state: null,  // Do we want to save PDF reader view state?
			secondaryViewState: null,
			location: null, // Navigate to specific PDF part when opening it
			readOnly: isReadOnly,
			authorName: isGroup ? currentUserSlug : '',
			showItemPaneToggle: true, //  ???
			sidebarWidth: 240,
			sidebarOpen: true, // Save sidebar open/close state?
			bottomPlaceholderHeight: 0, /// ???
			rtl: false, // TODO: ?
			localizedStrings: strings,
			showAnnotations: true,
			onOpenContextMenu: (...args) => {
				console.log('onOpenContextMenu', args);
			},
			onSaveAnnotations: (...args) => {
				console.log('onSaveAnnotations', args);
			},
			onDeleteAnnotations: (...args) => {
				console.log('onDeleteAnnotations', args);
			},
			onChangeViewState: (...args) => {
				console.log('onChangeViewState', args);
			},
			onOpenTagsPopup: (...args) => {
				console.log('onOpenTagsPopup', args);
			},
			onClosePopup: (...args) => {
				console.log('onClosePopup', args);
			},
			onOpenLink: (...args) => {
				console.log('onOpenLink', args);
			},
			onToggleSidebar: (...args) => {
				console.log('onToggleSidebar', args);
			},
			onChangeSidebarWidth: (...args) => {
				console.log('onChangeSidebarWidth', args);
			},
			onFocusSplitButton: (...args) => {
				console.log('onFocusSplitButton', args);
			},
			onFocusContextPane: (...args) => {
				console.log('onFocusContextPane', args);
			},
			onSetDataTransferAnnotations: (...args) => {
				console.log('onSetDataTransferAnnotations', args);
			},
			onConfirm: (...args) => {
				console.log('onConfirm', args);
			},
			onCopyImage: (...args) => {
				console.log('onCopyImage', args);
			},
			onSaveImageAs: (...args) => {
				console.log('onSaveImageAs', args);
			},
			onRotatePages: (...args) => {
				console.log('onRotatePages', args);
			},
			onDeletePages: (...args) => {
				console.log('onDeletePages', args);
			},
		});
	}, [attachmentItem, dataState.data, dataState.processedAnnotations, url, isReadOnly, isGroup, currentUserSlug])

	useEffect(() => {
		if(attachmentKey && !attachmentItem) {
			dispatch(fetchItemDetails(attachmentKey));
		}
	}, []);// eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if(!isFetching && !isFetched) {
			const start = pointer || 0;
			const limit = PAGE_SIZE;
			dispatch(fetchChildItems(attachmentKey, { start, limit }));
		}
	}, [dispatch, attachmentKey, isFetching, isFetched, pointer]);

	useEffect(() => {
		if(!urlIsFresh && !isFetchingUrl) {
			dispatch(tryGetAttachmentURL(attachmentKey));
		}
	}, [attachmentKey, attachmentItem, dispatch, isFetchingUrl, prevAttachmentItem, urlIsFresh, dataState.data, getData]);

	useEffect(() => {
		if (urlIsFresh && !dataState.isFetchingData && !dataState.data) {
			getData();
		}
	}, [dataState.data, dataState.isFetchingData, getData, urlIsFresh]);

	useEffect(() => {
		if(!dataState.isReady && isAllFetched && !wasAllFetched) {
			// pdf reader not yet loaded so we store processed annotations and begin pdf-reader loading
			setDataState({
				...dataState,
				processedAnnotations: getProcessedAnnotations(),
				isReady: true
			});
		}
		if(dataState.isReady && ((isAllFetched && !wasAllFetched) || !deepEqual(prevAnnotations, annotations))) {
			// pdf reader already loaded so just send updated annotations
			const processedAnnotations = getProcessedAnnotations();
			const allAnnotations = [...processedAnnotations, ...dataState.importedAnnotations];
			iframeRef.current.contentWindow.postMessage({
				action: 'setAnnotations',
				annotations: allAnnotations
			}, "*");
			setDataState({ ...dataState, processedAnnotations });
		}
	}, [annotations, dataState, isAllFetched, getProcessedAnnotations, prevAnnotations, wasAllFetched])

	useEffect(() => {
		if (attachmentItem && !prevAttachmentItem
			&& (attachmentItem.itemType !== 'attachment' || !Object.keys(READER_CONTENT_TYPES).includes(attachmentItem.contentType))
		) {
			dispatch(navigate({ view: 'item-details' }));
		}
	}, [dispatch, attachmentItem, prevAttachmentItem]);

	useEffect(() => {
		if (lastFetchItemDetailsNoResults) {
			dispatch(navigate({ items: null, attachmentKey: null, noteKey: null, view: 'item-list' }));
		}
	}, [dispatch, lastFetchItemDetailsNoResults]);

	return (
		<section className="reader-wrapper">
			{ dataState.isReady ?
				<iframe onLoad={ handleIframeLoaded } ref={ iframeRef } src={ pdfReaderURL } /> :
				<div className="spinner-wrapper">
					<Spinner />
				</div>
			}
		</section>
	);
};

export default memo(Reader);
