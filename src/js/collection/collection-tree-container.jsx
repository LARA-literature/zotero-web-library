'use strict';

import React from 'react';
import { connect } from 'react-redux';
import CollectionTree from './collection-tree';
import { fetchCollectionsIfNeeded } from '../actions';


const mapTreePath = (selectedKey, collections, curPath) => {
	if(!curPath) {
		curPath = [];
	}
	
	for(let col of collections) {
		if(col.key === selectedKey) {
			return curPath.concat(col.key);
		} else if(col.children.length) {
			let maybePath = mapTreePath(selectedKey, col.children, curPath.concat(col.key));
			if(maybePath.includes(selectedKey)) {
				return maybePath;
			}
		}
	}

	return curPath;
};

const applyTreePath = (collections, path, reopen) => {
	return collections.map(c => {
		let index = path.indexOf(c.key);
		c.isSelected = index >= 0 && index === path.length - 1;
		if(reopen) {
			c.isOpen = index >= 0 && index < path.length - 1;
		}
		return c;
	});
};

class CollectionTreeContainer extends React.Component {
	constructor(props) {
		super();
		let path = mapTreePath(props.selected, props.collections.filter(c => c.nestingDepth === 1));
		this.state = {
			collections: applyTreePath(props.collections, path, props.reopen)
		};
	}

	toggleOpenCollection(collectionKey) {
		this.setState({
			collections: this.state.collections.map(c => {
				if(c.key === collectionKey) {
					c.isOpen = !c.isOpen;
				}
				return c;
			})
		});
	}

	componentWillReceiveProps(nextProps) {
		if(nextProps.library && nextProps.library != this.props.library) {
			this.props.dispatch(
				fetchCollectionsIfNeeded(nextProps.library)
			);
		}
		
		if('selected' in nextProps && nextProps.selected != this.props.selected ||
			'collections' in nextProps && nextProps.collections != this.props.collections) {
			let path = mapTreePath(nextProps.selected, nextProps.collections.filter(c => c.nestingDepth === 1));
			this.setState({
				collections: applyTreePath(nextProps.collections, path, nextProps.reopen)
			});
		}
	}

	render() {
		return <CollectionTree 
			collections={this.state.collections}
			path={this.state.path}
			isFetching={this.props.isFetching}
			onCollectionOpened={ collectionKey => this.toggleOpenCollection(collectionKey) }
		/>;
	}
}

const mapStateToProps = state => {
	return {
		library: state.library,
		collections: state.library && state.collections[state.library.libraryString] ? state.collections[state.library.libraryString].collections : [],
		isFetching: state.library && state.collections[state.library.libraryString] ? state.collections[state.library.libraryString].isFetching : false,
		selected: 'collection' in state.router.params ? state.router.params.collection : null,
		reopen: state.router && state.router.location.action != 'PUSH'
	};
};

const mapDispatchToProps = (dispatch) => {
	return {
		dispatch
	};
};

CollectionTreeContainer.propTypes = {
	library: React.PropTypes.object,
	collections: React.PropTypes.array,
	isFetching: React.PropTypes.bool.isRequired,
	dispatch: React.PropTypes.func.isRequired,
	selected: React.PropTypes.string,
	reopen: React.PropTypes.bool
};

CollectionTree.defaultProps = {
	collections: [],
	selected: ''
};

export default connect(
	mapStateToProps,
	mapDispatchToProps
)(CollectionTreeContainer);