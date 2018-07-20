/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/**
 * @module ui/toolbar/balloon/balloontoolbar
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import ContextualBalloon from '../../panel/balloon/contextualballoon';
import ToolbarView from '../toolbarview';
import BalloonPanelView from '../../panel/balloon/balloonpanelview.js';
import FocusTracker from '@ckeditor/ckeditor5-utils/src/focustracker';
import debounce from '@ckeditor/ckeditor5-utils/src/lib/lodash/debounce';
import Rect from '@ckeditor/ckeditor5-utils/src/dom/rect';
import normalizeToolbarConfig from '../normalizetoolbarconfig';

/**
 * The contextual toolbar.
 *
 * It uses the {@link module:ui/panel/balloon/contextualballoon~ContextualBalloon contextual balloon plugin}.
 *
 * @extends module:core/plugin~Plugin
 */
export default class BalloonToolbar extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'BalloonToolbar';
	}

	/**
	 * @inheritDoc
	 */
	static get requires() {
		return [ ContextualBalloon ];
	}

	/**
	 * @inheritDoc
	 */
	constructor( editor ) {
		super( editor );

		/**
		 * The toolbar view displayed in the balloon.
		 *
		 * @type {module:ui/toolbar/toolbarview~ToolbarView}
		 */
		this.toolbarView = this._createToolbarView();

		/**
		 * Tracks the focus of the {@link module:ui/editableui/editableuiview~EditableUIView#editableElement}
		 * and the {@link #toolbarView}. When both are blurred then the toolbar should hide.
		 *
		 * @readonly
		 * @type {module:utils:focustracker~FocusTracker}
		 */
		this.focusTracker = new FocusTracker();

		// Wait for the EditorUI#init. EditableElement is not available before.
		editor.once( 'uiReady', () => {
			this.focusTracker.add( editor.ui.view.editableElement );
			this.focusTracker.add( this.toolbarView.element );
		} );

		/**
		 * The contextual balloon plugin instance.
		 *
		 * @private
		 * @type {module:ui/panel/balloon/contextualballoon~ContextualBalloon}
		 */
		this._balloon = editor.plugins.get( ContextualBalloon );

		/**
		 * A helper flag used by {@link #_fireToggleVisibilityDebounced} to indicate that there is
		 * a {@link #event:_toggleVisibilityDebounced} event pending (being debounced).
		 *
		 * @private
		 * @type {Boolean}
		 */
		this._isVisibilityTogglePending = false;

		/**
		 * Fires {@link #event:_selectionChangeDebounced} event using `lodash#debounce`.
		 *
		 * This function is stored as a plugin property to make possible to cancel
		 * trailing debounced invocation on destroy.
		 *
		 * @private
		 * @type {Function}
		 */
		this._fireSelectionChangeDebounced = debounce( () => {
			this.fire( '_selectionChangeDebounced' );
		}, 200 );

		/**
		 * A helper function used by {@link #_fireToggleVisibilityDebounced} to fire
		 * {@link #event:_toggleVisibilityDebounced}.
		 *
		 * This function is stored as a plugin property to make possible to cancel
		 * trailing debounced invocation on destroy.
		 *
		 * @private
		 * @type {Function}
		 */
		this._toggleVisibilityDebounced = debounce( ( eventName, data ) => {
			this.fire( '_toggleVisibilityDebounced', eventName, data );
		}, 10 );

		/**
		 * Fires {@link #event:_toggleVisibilityDebounced} event using `lodash#debounce`. Once executed,
		 * it sets the {@link #_isVisibilityTogglePending} flag `true` to notify other pieces of code
		 * that debouncing is in progress.
		 */
		this._fireToggleVisibilityDebounced = ( eventName, data ) => {
			// Let the position updater know that showing/hiding is pending.
			this._isVisibilityTogglePending = true;

			this._toggleVisibilityDebounced( eventName, data );
		};

		// The appearance of the BalloonToolbar method is event–driven.
		// It is possible to stop the #show event and this prevent the toolbar from showing up.
		this.decorate( 'show' );
	}

	/**
	 * @inheritDoc
	 */
	init() {
		const editor = this.editor;
		const selection = editor.model.document.selection;

		this.listenTo( this.focusTracker, 'change:isFocused', ( evt, name, isFocused ) => {
			this._fireToggleVisibilityDebounced( 'change:isFocused', isFocused );
		} );

		this.listenTo( selection, 'change:range', ( evt, data ) => {
			this._fireSelectionChangeDebounced();
			this._fireToggleVisibilityDebounced( 'change:range', data );
		} );

		this.listenTo( this, '_selectionChangeDebounced', () => {
			this._fireToggleVisibilityDebounced( '_selectionChangeDebounced' );
		} );

		this.listenTo( this, '_toggleVisibilityDebounced', ( evt, eventName, data ) => {
			// Hide the toolbar when the selection is changed by a direct change or has changed to collapsed.
			if ( eventName == 'change:range' ) {
				if ( data.directChange || selection.isCollapsed ) {
					this.hide();
				}
			}

			// Show/hide the toolbar on editable focus/blur.
			else if ( eventName == 'change:isFocused' ) {
				const isFocused = data;

				if ( !isFocused && this._isToolbarVisible ) {
					this.hide();
				} else if ( isFocused ) {
					this.show();
				}
			}

			// _selectionChangeDebounced Show the toolbar when the selection stops changing.
			else if ( this.focusTracker.isFocused ) {
				this.show();
			}

			// Let the position updater know that no showing/hiding is pending.
			this._isVisibilityTogglePending = false;
		} );
	}

	/**
	 * Creates toolbar components based on given configuration.
	 * This needs to be done when all plugins are ready.
	 *
	 * @inheritDoc
	 */
	afterInit() {
		const config = normalizeToolbarConfig( this.editor.config.get( 'balloonToolbar' ) );
		const factory = this.editor.ui.componentFactory;

		this.toolbarView.fillFromConfig( config.items, factory );
	}

	/**
	 * Returns `true` when the {@link #toolbarView} is the visible view of the contextual balloon.
	 *
	 * @protected
	 * @returns {Boolean}
	 */
	get _isToolbarVisible() {
		return this._balloon.visibleView === this.toolbarView;
	}

	/**
	 * Creates the toolbar view instance.
	 *
	 * @private
	 * @returns {module:ui/toolbar/toolbarview~ToolbarView}
	 */
	_createToolbarView() {
		const toolbarView = new ToolbarView( this.editor.locale );

		toolbarView.extendTemplate( {
			attributes: {
				class: [ 'ck-toolbar_floating' ]
			}
		} );

		toolbarView.render();

		return toolbarView;
	}

	/**
	 * Shows the toolbar and attaches it to the selection.
	 *
	 * Fires {@link #event:show} event which can be stopped to prevent the toolbar from showing up.
	 */
	show() {
		const editor = this.editor;

		// Do not add the toolbar to the balloon stack twice.
		if ( this._balloon.hasView( this.toolbarView ) ) {
			return;
		}

		// Do not show the toolbar when the selection is collapsed.
		if ( editor.model.document.selection.isCollapsed ) {
			return;
		}

		// Don not show the toolbar when all components inside are disabled
		// see https://github.com/ckeditor/ckeditor5-ui/issues/269.
		if ( Array.from( this.toolbarView.items ).every( item => item.isEnabled !== undefined && !item.isEnabled ) ) {
			return;
		}

		// Update the toolbar position when the editor ui should be refreshed.
		this.listenTo( this.editor.ui, 'update', () => {
			// Don't reposition the toolbar when awaiting visibility toggle. It may cause unnecessary
			// movement just before it disappears as a result of the toggle.
			if ( this._isVisibilityTogglePending ) {
				this.once( '_toggleVisibilityDebounced', () => {
					// The toolbar could be hidden upon #_toggleVisibilityDebounced.
					// In such case, don't re-position an invisible toolbar.
					if ( this._isToolbarVisible ) {
						this._updatePosition();
					}
				} );
			} else {
				this._updatePosition();
			}
		} );

		// Add the toolbar to the common editor contextual balloon.
		this._balloon.add( {
			view: this.toolbarView,
			position: this._getBalloonPositionData(),
			balloonClassName: 'ck-toolbar-container'
		} );
	}

	/**
	 * Hides the toolbar.
	 */
	hide() {
		if ( this._balloon.hasView( this.toolbarView ) ) {
			this.stopListening( this.editor.ui, 'update' );
			this._balloon.remove( this.toolbarView );
		}
	}

	/**
	 * Updates the position of the toolbar.
	 *
	 * @private
	 */
	_updatePosition() {
		this._balloon.updatePosition( this._getBalloonPositionData() );
	}

	/**
	 * Returns positioning options for the {@link #_balloon}. They control the way balloon is attached
	 * to the selection.
	 *
	 * @private
	 * @returns {module:utils/dom/position~Options}
	 */
	_getBalloonPositionData() {
		const editor = this.editor;
		const view = editor.editing.view;
		const viewDocument = view.document;
		const viewSelection = viewDocument.selection;

		// Get direction of the selection.
		const isBackward = viewDocument.selection.isBackward;

		return {
			// Because the target for BalloonPanelView is a Rect (not DOMRange), it's geometry will stay fixed
			// as the window scrolls. To let the BalloonPanelView follow such Rect, is must be continuously
			// computed and hence, the target is defined as a function instead of a static value.
			// https://github.com/ckeditor/ckeditor5-ui/issues/195
			target: () => {
				const range = isBackward ? viewSelection.getFirstRange() : viewSelection.getLastRange();
				const rangeRects = Rect.getDomRangeRects( view.domConverter.viewRangeToDom( range ) );

				// Select the proper range rect depending on the direction of the selection.
				if ( isBackward ) {
					return rangeRects[ 0 ];
				} else {
					// Ditch the zero-width "orphan" rect in the next line for the forward selection if there's
					// another one preceding it. It is not rendered as a selection by the web browser anyway.
					// https://github.com/ckeditor/ckeditor5-ui/issues/308
					if ( rangeRects.length > 1 && rangeRects[ rangeRects.length - 1 ].width === 0 ) {
						rangeRects.pop();
					}

					return rangeRects[ rangeRects.length - 1 ];
				}
			},
			positions: getBalloonPositions( isBackward )
		};
	}

	/**
	 * @inheritDoc
	 */
	destroy() {
		this._fireSelectionChangeDebounced.cancel();
		this._toggleVisibilityDebounced.cancel();
		this.stopListening();
		super.destroy();
	}

	/**
	 * This is internal plugin event which is fired 200ms after model selection last change
	 * ({@link module:engine/model/selection~Selection#event:change:range}).
	 *
	 * This is to makes easy test debounced action without need to use `setTimeout`.
	 *
	 *
	 *	                               _selectionChangeDebounced                 _selectionChangeDebounced
	 *	                                           ^                                        ^
	 *	  change:range -----------\                |        change:range --\                |
	 *	  change:range ----\      |                |                       |                |
	 *	                   |      |                |                       |                |
	 *	                   v      v                |                       v                |
	 *	|------------------x------x----------------x-----------------------x----------------x----> [time]
	 *	                   |------|----------------|                       |----------------|
	 *	                    <200ms      200ms                                     200ms
	 *
	 * @protected
	 * @event _selectionChangeDebounced
	 */

	/**
	 * This is internal plugin event which is fired 10ms after the last occurrence of either:
	 *
	 * * {@link module:engine/model/selection~Selection#event:change:range} event,
	 * * change of {@link module:utils/focustracker~FocusTracker#isFocused},
	 * * {@link #event:_selectionChangeDebounced}
	 *
	 * This event results in either {@link #show showing} or {@link #hide hiding} of the toolbar.
	 *
	 * It aggregates other (async) events and thus works as a buffer. Thanks to that, the UI reacts to
	 * just a single event, which is fired no sooner than 10ms, which ensures there's no UI flashing
	 * such as when it shows up and disappears quickly when multiple (async) triggers are
	 * used e.g.:
	 *
	 * * if the editor is blurred when the selection was *not* collapsed (toolbar was visible) and
	 * it gets re-focused again, the toolbar may show up for a short while (`change:isFocused`) before
	 * `change:range` is fired carrying information about collapsed selection and making the toolbar disappear,
	 * * if the toolbar is about to disappear (e.g. due to editor focus loss), don't update its position
	 * because otherwise it will reposition just for a fraction of the second before it is gone.
	 *
	 * **Note**: When fired, this event carries data (e.g. event name) of the last trigger only.
	 *
	 *
	 *	                   change:isFocused ------\
	 *	                       change:range ------|-----------> _toggleVisibilityDebounced
	 *	          _selectionChangeDebounced ------/
	 *
	 *
	 *	                   _toggleVisibilityDebounced (isFocused)              _toggleVisibilityDebounced (_sCD)
	 *	                                   ^                                               ^
	 *	  change:isFocused -----\          |        _selectionChangeDebounced --\          |
	 *	  change:range ----\    |          |                                    |          |
	 *	                   |    |          |                                    |          |
	 *	                   v    v          |                                    v          |
	 *	|------------------x----x----------x------------------------------------x----------x-----> [time]
	 *	                   |----|----------|                                    |----------|
	 *	                   <10ms    10ms                                            10ms
	 *
	 *	                   \---------------/                                    \----------/
	 *	                           |                                                  |
	 *	                           +------------------------|-------------------------+
	 *	                                                    v
	 *	                            Don't update toolbar position in those time slots
	 *	                                  (it may disappear at the end of either)
	 *
	 * @protected
	 * @event _toggleVisibilityDebounced
	 */
}

// Returns toolbar positions for the given direction of the selection.
//
// @private
// @param {Boolean} isBackward
// @returns {Array.<module:utils/dom/position~Position>}
function getBalloonPositions( isBackward ) {
	const defaultPositions = BalloonPanelView.defaultPositions;

	return isBackward ? [
		defaultPositions.northWestArrowSouth,
		defaultPositions.northWestArrowSouthWest,
		defaultPositions.northWestArrowSouthEast,
		defaultPositions.southWestArrowNorth,
		defaultPositions.southWestArrowNorthWest,
		defaultPositions.southWestArrowNorthEast
	] : [
		defaultPositions.southEastArrowNorth,
		defaultPositions.southEastArrowNorthEast,
		defaultPositions.southEastArrowNorthWest,
		defaultPositions.northEastArrowSouth,
		defaultPositions.northEastArrowSouthEast,
		defaultPositions.northEastArrowSouthWest
	];
}

/**
 * Contextual toolbar configuration. Used by the {@link module:ui/toolbar/balloon/balloontoolbar~BalloonToolbar}
 * feature.
 *
 *		const config = {
 *			balloonToolbar: [ 'bold', 'italic', 'undo', 'redo' ]
 *		};
 *
 * You can also use `'|'` to create a separator between groups of items:
 *
 *		const config = {
 *			balloonToolbar: [ 'bold', 'italic', | 'undo', 'redo' ]
 *		};
 *
 * Read also about configuring the main editor toolbar in {@link module:core/editor/editorconfig~EditorConfig#toolbar}.
 *
 * @member {Array.<String>|Object} module:core/editor/editorconfig~EditorConfig#balloonToolbar
 */
