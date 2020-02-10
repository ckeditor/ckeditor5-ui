/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/* globals window, document, console:false */

import ClassicEditor from '@ckeditor/ckeditor5-editor-classic/src/classiceditor';
import InlineEditor from '@ckeditor/ckeditor5-editor-inline/src/inlineeditor';
import BalloonEditor from '@ckeditor/ckeditor5-editor-balloon/src/ballooneditor';
import ArticlePluginSet from '@ckeditor/ckeditor5-core/tests/_utils/articlepluginset';

const EDITOR_CONFIG = {
	plugins: [ ArticlePluginSet ],
	toolbar: [
		'heading',
		'|',
		'bold',
		'italic',
		'link',
		'|',
		'bulletedList',
		'numberedList',
		'blockQuote',
		'insertTable',
		'mediaEmbed',
		'|',
		'undo',
		'redo'
	],
	image: {
		toolbar: [ 'imageStyle:full', 'imageStyle:side', '|', 'imageTextAlternative' ]
	},
	table: {
		contentToolbar: [
			'tableColumn',
			'tableRow',
			'mergeTableCells'
		]
	}
};

ClassicEditor
	.create( document.querySelector( '#editor-classic' ), EDITOR_CONFIG )
	.then( editor => {
		window.classicEditor = editor;
	} )
	.catch( err => {
		console.error( err.stack );
	} );

InlineEditor
	.create( document.querySelector( '#editor-inline' ), EDITOR_CONFIG )
	.then( editor => {
		window.inlineEditor = editor;
	} )
	.catch( err => {
		console.error( err.stack );
	} );

BalloonEditor
	.create( document.querySelector( '#editor-balloon' ), EDITOR_CONFIG )
	.then( editor => {
		window.balloonEditor = editor;
	} )
	.catch( err => {
		console.error( err.stack );
	} );

document.querySelector( '#btn-readonly' ).addEventListener( 'click', () => {
	window.classicEditor.isReadOnly = !window.classicEditor.isReadOnly;
	window.inlineEditor.isReadOnly = !window.inlineEditor.isReadOnly;
	window.balloonEditor.isReadOnly = !window.balloonEditor.isReadOnly;
} );
