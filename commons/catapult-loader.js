// <nowiki>
//    ______      __                    ____
//   / ____/___ _/ /_____ _____  __  __/ / /_
//  / /   / __ `/ __/ __ `/ __ \/ / / / / __/
// / /___/ /_/ / /_/ /_/ / /_/ / /_/ / / /_
// \____/\__,_/\__/\__,_/ .___/\__,_/_/\__/
//                     /_/
// Catapult.js
// @author Vera de Kok ([[User:1Veertje]])
// @version 2026-06-24.1
// License: GNU General Public License
//
// Catapult helps propel data from Wikidata to Wikimedia Commons
// by assisting with the creation and disambiguation of Commons categories.
//
// Sitelink move ordering and T221571 delay follow the Wikidata Move gadget.
// https://github.com/VDK/Catapult
( function ( mw, $ ) {
	'use strict';

	var VERSION = '2026-06-24.1';
	var BASE_PAGE = 'User:1VeertjeBot/catapult/';

	function rawUrl( page, contentType ) {
		return mw.util.getUrl( BASE_PAGE + page, {
			action: 'raw',
			ctype: contentType,
			version: VERSION
		} );
	}

	function showLoadError() {
		mw.notify(
			'Catapult ' + VERSION + ' could not be loaded. Reload the page or check ' + BASE_PAGE + 'app.js.',
			{
				title: 'Catapult',
				type: 'error'
			}
		);
	}

	function verifyAppVersion() {
		if ( !window.catapult || window.catapult.appVersion !== VERSION ) {
			throw new Error( 'Catapult bootstrap/app version mismatch' );
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
