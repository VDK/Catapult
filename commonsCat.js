// <nowiki>
//    ______      __                    ____ 
//   / ____/___ _/ /_____ _____  __  __/ / /_
//  / /   / __ `/ __/ __ `/ __ \/ / / / / __/
// / /___/ /_/ / /_/ /_/ / /_/ / /_/ / / /_  
// \____/\__,_/\__/\__,_/ .___/\__,_/_/\__/  
//                     /_/                    
// commonsCat.js
// Bootstrap for User:1VeertjeBot/commonsCat/app.js
( function ( mw, $ ) {
	'use strict';

	var VERSION = '2026-06-21.1';
	var BASE_PAGE = 'User:1VeertjeBot/commonsCat/';

	function rawUrl( page, contentType ) {
		return mw.util.getUrl( BASE_PAGE + page, {
			action: 'raw',
			ctype: contentType,
			version: VERSION
		} );
	}

	function showLoadError() {
		mw.notify(
			'commonsCat ' + VERSION + ' could not be loaded. Reload the page or check User:1VeertjeBot/commonsCat/app.js.',
			{
				title: 'commonsCat',
				type: 'error'
			}
		);
	}

	function verifyAppVersion() {
		if ( !window.commonsCat || window.commonsCat.appVersion !== VERSION ) {
			throw new Error( 'commonsCat bootstrap/app version mismatch' );
		}
	}

	$.when(
		$.ready,
		mw.loader.using( [ 'mediawiki.util', 'mediawiki.notification' ] )
	).then( function () {
		mw.loader.load( rawUrl( 'styles.css', 'text/css' ), 'text/css' );
		return mw.loader.getScript( rawUrl( 'app.js', 'text/javascript' ) );
	} ).then( verifyAppVersion ).then( null, showLoadError );
}( mediaWiki, jQuery ) );
// </nowiki>
