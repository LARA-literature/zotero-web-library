'use strict';

import {
    RECEIVE_ADD_ITEMS_TO_COLLECTION,
    RECEIVE_CHILD_ITEMS,
    RECEIVE_COLLECTIONS_IN_LIBRARY,
    RECEIVE_CREATE_ITEM,
    RECEIVE_CREATE_ITEMS,
    RECEIVE_DELETE_ITEMS,
    RECEIVE_FETCH_ITEMS,
    RECEIVE_ITEMS_IN_COLLECTION,
    RECEIVE_MOVE_ITEMS_TRASH,
    RECEIVE_PUBLICATIONS_ITEMS,
    RECEIVE_RECOVER_ITEMS_TRASH,
    RECEIVE_REMOVE_ITEMS_FROM_COLLECTION,
    RECEIVE_TOP_ITEMS,
    RECEIVE_TRASH_ITEMS,
    RECEIVE_UPDATE_ITEM,
} from '../../constants/actions.js';

const version = (state = 0, action) => {
	switch(action.type) {
		case RECEIVE_ADD_ITEMS_TO_COLLECTION:
		case RECEIVE_CHILD_ITEMS:
		case RECEIVE_COLLECTIONS_IN_LIBRARY:
		case RECEIVE_CREATE_ITEM:
		case RECEIVE_CREATE_ITEMS:
		case RECEIVE_DELETE_ITEMS:
		case RECEIVE_FETCH_ITEMS:
		case RECEIVE_ITEMS_IN_COLLECTION:
		case RECEIVE_MOVE_ITEMS_TRASH:
		case RECEIVE_PUBLICATIONS_ITEMS:
		case RECEIVE_RECOVER_ITEMS_TRASH:
		case RECEIVE_REMOVE_ITEMS_FROM_COLLECTION:
		case RECEIVE_TOP_ITEMS:
		case RECEIVE_TRASH_ITEMS:
		case RECEIVE_UPDATE_ITEM:
			return parseInt(action.response.response.headers.get('Last-Modified-Version'), 10);
		default:
			return state;
	}
};

export default version;
