/**
 * @license Copyright (c) 2003-2016, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import ClassicTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/classictesteditor';
import ContextualBalloon from '../../../src/panel/balloon/contextualballoon';
import BalloonPanelView from '../../../src/panel/balloon/balloonpanelview';
import View from '../../../src/view';
import CKEditorError from '@ckeditor/ckeditor5-utils/src/ckeditorerror';
import Plugin from '@ckeditor/ckeditor5-core/src/plugin';

/* global document, Event */

describe( 'ContextualBalloon', () => {
	let editor, editorElement, balloon, viewA, viewB;

	beforeEach( () => {
		editorElement = document.createElement( 'div' );
		document.body.appendChild( editorElement );

		return ClassicTestEditor.create( editorElement, {
			plugins: [ ContextualBalloon ]
		} )
		.then( newEditor => {
			editor = newEditor;
			balloon = editor.plugins.get( ContextualBalloon );

			// We don't need to execute BalloonPanel pin and attachTo methods
			// it's enough to check if was called with the proper data.
			sinon.stub( balloon.view, 'attachTo', () => {} );
			sinon.stub( balloon.view, 'pin', () => {} );

			viewA = new View();
			viewB = new View();

			// Add viewA to the pane and init viewB.
			balloon.add( {
				view: viewA,
				position: { target: 'fake' }
			} );

			viewB.init();
		} );
	} );

	afterEach( () => {
		editor.destroy();
	} );

	it( 'should create a plugin instance', () => {
		expect( balloon ).to.instanceof( Plugin );
		expect( balloon ).to.instanceof( ContextualBalloon );
	} );

	describe( 'pluginName', () => {
		it( 'should return plugin by name', () => {
			expect( editor.plugins.get( 'ContextualBalloon' ) ).to.equal( balloon );
		} );
	} );

	describe( 'init()', () => {
		it( 'should create a plugin instance with properties', () => {
			expect( balloon.view ).to.instanceof( BalloonPanelView );
		} );

		it( 'should add balloon panel view to editor `body` collection', () => {
			expect( editor.ui.view.body.getIndex( balloon.view ) ).to.above( -1 );
		} );

		it( 'should register balloon panel element in editor.ui#focusTracker', () => {
			editor.ui.focusTracker.isfocused = false;

			balloon.add( {
				view: viewB,
				position: { target: 'fake' }
			} );

			balloon.view.element.dispatchEvent( new Event( 'focus' ) );

			expect( editor.ui.focusTracker.isFocused ).to.true;
		} );
	} );

	describe( 'hasView()', () => {
		it( 'should return true when given view is in stack', () => {
			expect( balloon.hasView( viewA ) ).to.true;
		} );

		it( 'should return true when given view is in stack but is not visible', () => {
			balloon.add( {
				view: viewB,
				position: { target: 'fake' }
			} );

			expect( balloon.visibleView ).to.equal( viewB );
			expect( balloon.hasView( viewA ) ).to.true;
		} );

		it( 'should return false when given view is not in stack', () => {
			expect( balloon.hasView( viewB ) ).to.false;
		} );
	} );

	describe( 'add()', () => {
		it( 'should add view to the stack and display in balloon attached using given position options', () => {
			expect( balloon.view.content.length ).to.equal( 1 );
			expect( balloon.view.content.get( 0 ) ).to.deep.equal( viewA );
			expect( balloon.view.pin.calledOnce ).to.true;
			expect( balloon.view.pin.firstCall.args[ 0 ] ).to.deep.equal( { target: 'fake' } );
		} );

		it( 'should pin balloon to the target element', () => {
			sinon.assert.calledOnce( balloon.view.pin );
		} );

		it( 'should throw an error when try to add the same view more than once', () => {
			expect( () => {
				balloon.add( {
					view: viewA,
					position: { target: 'fake' }
				} );
			} ).to.throw( CKEditorError, /^contextualballoon-add-view-exist/ );
		} );

		it( 'should add multiple views to he stack and display last one', () => {
			balloon.add( {
				view: viewB,
				position: { target: 'fake' }
			} );

			expect( balloon.view.content.length ).to.equal( 1 );
			expect( balloon.view.content.get( 0 ) ).to.deep.equal( viewB );
		} );

		it( 'should keep balloon at the same position after adding next view', () => {
			balloon.add( {
				view: viewB,
				position: { target: 'other' }
			} );

			expect( balloon.view.pin.calledTwice ).to.true;

			expect( balloon.view.pin.firstCall.args[ 0 ] ).to.deep.equal( {
				target: 'fake'
			} );

			expect( balloon.view.pin.secondCall.args[ 0 ] ).to.deep.equal( {
				target: 'fake'
			} );
		} );

		it( 'should set additional css class of visible view to BalloonPanelView', () => {
			const view = new View();

			balloon.add( {
				view,
				position: { target: 'fake' },
				balloonClassName: 'foo'
			} );

			expect( balloon.view.className ).to.equal( 'foo' );

			balloon.add( {
				view: viewB,
				position: { target: 'fake' },
				balloonClassName: 'bar'
			} );

			expect( balloon.view.className ).to.equal( 'bar' );
		} );
	} );

	describe( 'visibleView', () => {
		it( 'should return data of currently visible view', () => {
			expect( balloon.visibleView ).to.equal( viewA );
		} );

		it( 'should return data of currently visible view when there is more than one in the stack', () => {
			balloon.add( {
				view: viewB,
				position: { target: 'fake' }
			} );

			expect( balloon.visibleView ).to.equal( viewB );
		} );

		it( 'should return `null` when the stack is empty', () => {
			balloon.remove( viewA );
			expect( balloon.visibleView ).to.null;
		} );
	} );

	describe( 'remove()', () => {
		it( 'should remove given view and hide balloon when there is no other view to display', () => {
			balloon.view.isVisible = true;

			balloon.remove( viewA );

			expect( balloon.visibleView ).to.null;
			expect( balloon.view.isVisible ).to.false;
		} );

		it( 'should remove given view and set preceding in the stack as visible when removed view was visible', () => {
			balloon.add( {
				view: viewB,
				position: { target: 'fake' }
			} );

			balloon.remove( viewB );

			expect( balloon.visibleView ).to.equal( viewA );
		} );

		it( 'should remove given view from the stack when view is not visible', () => {
			balloon.add( {
				view: viewB,
				position: { target: 'fake' }
			} );

			balloon.remove( viewA );

			expect( balloon.visibleView ).to.equal( viewB );
		} );

		it( 'should throw an error when there is no given view in the stack', () => {
			expect( () => {
				balloon.remove( viewB );
			} ).to.throw( CKEditorError, /^contextualballoon-remove-view-not-exist/ );
		} );

		it( 'should set additional css class of visible view to BalloonPanelView', () => {
			const view = new View();

			balloon.add( {
				view,
				position: { target: 'fake' },
				balloonClassName: 'foo'
			} );

			balloon.add( {
				view: viewB,
				position: { target: 'fake' },
				balloonClassName: 'bar'
			} );

			balloon.remove( viewB );

			expect( balloon.view.className ).to.equal( 'foo' );
		} );
	} );

	describe( 'clear()', () => {
		it( 'should remove all views', () => {
			balloon.add( {
				view: viewB,
				position: { target: 'fake' }
			} );

			balloon.clear();

			expect( balloon.visibleView ).to.null;
			expect( balloon.view.isVisible ).to.false;
		} );
	} );

	describe( 'updatePosition()', () => {
		it( 'should attach balloon to the target using position option from the first view in the stack', () => {
			balloon.add( {
				view: viewB,
				position: {
					target: 'other'
				}
			} );

			balloon.view.attachTo.reset();

			balloon.updatePosition();

			expect( balloon.view.attachTo.calledOnce );
			expect( balloon.view.attachTo.firstCall.args[ 0 ] ).to.deep.equal( { target: 'fake' } );
		} );

		it( 'should attach balloon to the target using new position options', () => {
			balloon.view.attachTo.reset();

			balloon.updatePosition( { target: 'new' } );

			expect( balloon.view.attachTo.calledOnce );
			expect( balloon.view.attachTo.firstCall.args[ 0 ] ).to.deep.equal( { target: 'new' } );

			balloon.updatePosition();

			expect( balloon.view.attachTo.calledTwice );
			expect( balloon.view.attachTo.firstCall.args[ 0 ] ).to.deep.equal( { target: 'new' } );
		} );

		it( 'should throw an error when there is no given view in the stack', () => {
			expect( () => {
				balloon.remove( viewB );
			} ).to.throw( CKEditorError, /^contextualballoon-remove-view-not-exist/ );
		} );
	} );

	describe( 'destroy()', () => {
		it( 'can be called multiple times', () => {
			expect( () => {
				balloon.destroy();
				balloon.destroy();
			} ).to.not.throw();
		} );

		it( 'should not touch the DOM', () => {
			balloon.destroy();

			expect( editor.ui.view.body.getIndex( balloon.view ) ).to.not.equal( -1 );
		} );
	} );
} );
