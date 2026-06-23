// <nowiki>
// Catapult/app.js
// License: GNU General Public License
// Author: Vera de Kok (1Veertje)
// Date: 2026-06-05
// Wikidata gadget for creating Commons person categories from Wikidata data.
// Sitelink move ordering and T221571 delay follow the Wikidata Move gadget.
( function ( mw, $ ) {
	'use strict';

	var CONFIG = {
		properties: {
			instanceOf: 'P31',
			sexOrGender: 'P21',
			dateOfBirth: 'P569',
			dateOfDeath: 'P570',
			depicts: 'P180',
			occupation: 'P106',
			employer: 'P108',
			fieldOfWork: 'P101',
			countryOfCitizenship: 'P27',
			commonsCategory: 'P373',
			image: 'P18',
			shortName: 'P1813',
			subclassOf: 'P279',
			categoryContains: 'P4224',
			categoryCombinesTopics: 'P971'
		},
		mappingPage: 'User:1Veertje/Catapult/mappings.json',
		items: {
			human: 'Q5',
			male: 'Q6581097',
			female: 'Q6581072',
			wikimediaCategory: 'Q4167836',
			categoryDisambiguationPage: 'Q15407973'
		},
		occupationCategoryByQid: {
		},
		occupationCategoryByRelatedQid: {
		},
		occupationDisambiguationByQid: {
		},
		occupationCategoryReplacements: {
		},
		countryPhraseByQid: {
		},
		countryNameReplacements: {
		},
		maxOccupationCount: 8,
		maxCountryCount: 6,
		lateCandidateCheckTimeout: 1200,
		version: '2026-06-24.1',
		summary: 'Creating Commons category from Wikidata using [[User:1Veertje/Catapult/app.js|Catapult]]',
		debug: window.location.search.indexOf( 'catapultDebug=1' ) !== -1
	};

	window.catapult = window.catapult || {};
	window.catapult.appVersion = CONFIG.version;

	var model = createModel();
	var state = createStateFacade( model );

	function createModel() {
		return {
			services: {
				localApi: null,
				commonsApi: null
			},
			subject: {
				entity: null,
				relatedEntities: {},
				hasPersonCommonsCategory: false,
				hasCommonsSitelink: false
			},
			discovery: {
				facultyCategoryNames: [],
				baseCategory: {
					title: null,
					exists: false,
					redirect: false,
					wikibaseItem: null,
					linkKind: 'none'
				},
				personCategoryExists: false,
				personCategoryRedirect: false,
				personCategoryWikibaseItem: null,
				personCategoryWikibaseEntity: null,
				personCategoryExistingParents: [],
				personCategoryThumbnails: [],
				personCategoryThumbnailsLoaded: false,
				personCategoryMoveTargetExists: false,
				targetCategoryConflictEntity: null,
				targetCategoryMoveTargetExists: false,
				existingBaseDisambiguationTitles: [],
				baseCategoryRedirectTarget: null,
				baseCategoryWasDisambiguation: false,
				baseCategoryText: ''
			},
			suggestions: {
				candidates: [],
				disambiguationOptions: [],
				unlinkedDisambiguationOptions: []
			},
			choices: {
				parentCategorySelections: {},
				selectedCandidate: null,
				selectedDisambiguationOption: null,
				selectedUnlinkedDisambiguationOption: null,
				unlinkedDisambiguationTitle: '',
				selectedCurrentItemDisambiguationOption: null,
				currentItemDisambiguationExtra: '',
				currentItemDisambiguationTitle: '',
				linkedMoveTargetTitle: '',
				linkedDisambiguationTitle: '',
				targetCategoryMoveTargetTitle: '',
				targetCategoryCurrentTitle: '',
				disambiguateUnlinkedExistingCategory: false,
				mergeLinkedExistingCategory: false,
				mergeTargetCategoryConflict: false
			},
			workflow: {
				phase: 'idle',
				disambiguationHub: null,
				originalPersonCategory: null,
				personCategory: null,
				originalPersonCategoryWikibaseItem: null,
				personCategoryMoveTarget: null,
				targetCategoryConflictOption: null,
				targetCategoryMoveTarget: null,
				pendingBaseDisambiguation: null,
				disambiguationNeeded: false,
				disambiguationCategoryItem: null,
				activePlan: null
			},
			execution: {
				progressTitle: null,
				progressSteps: []
			},
			ui: {
				primaryActionButton: null,
				primaryActionElement: null
			}
		};
	}

	function createStateFacade( targetModel ) {
		var facade = {};
		var fields = {
			localApi: [ 'services', 'localApi' ],
			commonsApi: [ 'services', 'commonsApi' ],
			entity: [ 'subject', 'entity' ],
			relatedEntities: [ 'subject', 'relatedEntities' ],
			hasPersonCommonsCategory: [ 'subject', 'hasPersonCommonsCategory' ],
			hasCommonsSitelink: [ 'subject', 'hasCommonsSitelink' ],
			facultyCategoryNames: [ 'discovery', 'facultyCategoryNames' ],
			personCategoryExists: [ 'discovery', 'personCategoryExists' ],
			personCategoryRedirect: [ 'discovery', 'personCategoryRedirect' ],
			personCategoryWikibaseItem: [ 'discovery', 'personCategoryWikibaseItem' ],
			personCategoryWikibaseEntity: [ 'discovery', 'personCategoryWikibaseEntity' ],
			personCategoryExistingParents: [ 'discovery', 'personCategoryExistingParents' ],
			personCategoryThumbnails: [ 'discovery', 'personCategoryThumbnails' ],
			personCategoryThumbnailsLoaded: [ 'discovery', 'personCategoryThumbnailsLoaded' ],
			personCategoryMoveTargetExists: [ 'discovery', 'personCategoryMoveTargetExists' ],
			targetCategoryConflictEntity: [ 'discovery', 'targetCategoryConflictEntity' ],
			targetCategoryMoveTargetExists: [ 'discovery', 'targetCategoryMoveTargetExists' ],
			existingBaseDisambiguationTitles: [ 'discovery', 'existingBaseDisambiguationTitles' ],
			baseCategoryRedirectTarget: [ 'discovery', 'baseCategoryRedirectTarget' ],
			baseCategoryWasDisambiguation: [ 'discovery', 'baseCategoryWasDisambiguation' ],
			baseCategoryText: [ 'discovery', 'baseCategoryText' ],
			candidates: [ 'suggestions', 'candidates' ],
			disambiguationOptions: [ 'suggestions', 'disambiguationOptions' ],
			unlinkedDisambiguationOptions: [ 'suggestions', 'unlinkedDisambiguationOptions' ],
			parentCategorySelections: [ 'choices', 'parentCategorySelections' ],
			selectedCandidate: [ 'choices', 'selectedCandidate' ],
			selectedDisambiguationOption: [ 'choices', 'selectedDisambiguationOption' ],
			selectedUnlinkedDisambiguationOption: [ 'choices', 'selectedUnlinkedDisambiguationOption' ],
			unlinkedDisambiguationTitle: [ 'choices', 'unlinkedDisambiguationTitle' ],
			selectedCurrentItemDisambiguationOption: [ 'choices', 'selectedCurrentItemDisambiguationOption' ],
			currentItemDisambiguationExtra: [ 'choices', 'currentItemDisambiguationExtra' ],
			currentItemDisambiguationTitle: [ 'choices', 'currentItemDisambiguationTitle' ],
			linkedMoveTargetTitle: [ 'choices', 'linkedMoveTargetTitle' ],
			linkedDisambiguationTitle: [ 'choices', 'linkedDisambiguationTitle' ],
			targetCategoryMoveTargetTitle: [ 'choices', 'targetCategoryMoveTargetTitle' ],
			targetCategoryCurrentTitle: [ 'choices', 'targetCategoryCurrentTitle' ],
			disambiguateUnlinkedExistingCategory: [ 'choices', 'disambiguateUnlinkedExistingCategory' ],
			mergeLinkedExistingCategory: [ 'choices', 'mergeLinkedExistingCategory' ],
			mergeTargetCategoryConflict: [ 'choices', 'mergeTargetCategoryConflict' ],
			originalPersonCategory: [ 'workflow', 'originalPersonCategory' ],
			personCategory: [ 'workflow', 'personCategory' ],
			originalPersonCategoryWikibaseItem: [ 'workflow', 'originalPersonCategoryWikibaseItem' ],
			personCategoryMoveTarget: [ 'workflow', 'personCategoryMoveTarget' ],
			targetCategoryConflictOption: [ 'workflow', 'targetCategoryConflictOption' ],
			targetCategoryMoveTarget: [ 'workflow', 'targetCategoryMoveTarget' ],
			pendingBaseDisambiguation: [ 'workflow', 'pendingBaseDisambiguation' ],
			disambiguationNeeded: [ 'workflow', 'disambiguationNeeded' ],
			disambiguationCategoryItem: [ 'workflow', 'disambiguationCategoryItem' ],
			progressTitle: [ 'execution', 'progressTitle' ],
			progressSteps: [ 'execution', 'progressSteps' ],
			primaryActionButton: [ 'ui', 'primaryActionButton' ],
			primaryActionElement: [ 'ui', 'primaryActionElement' ]
		};

		Object.keys( fields ).forEach( function ( field ) {
			var path = fields[ field ];

			Object.defineProperty( facade, field, {
				enumerable: true,
				get: function () {
					return targetModel[ path[ 0 ] ][ path[ 1 ] ];
				},
				set: function ( value ) {
					targetModel[ path[ 0 ] ][ path[ 1 ] ] = value;
				}
			} );
		} );

		return facade;
	}

	var Workflow = {
		currentMode: function () {
			return deriveWorkflowMode( model );
		},

		baseCategoryNeedsDisambiguationPage: function () {
			return discoveryNeedsDisambiguationPage( model.discovery );
		},

		shouldOfferLinkOrDisambiguate: function () {
			return shouldOfferExistingCategoryChoice( model );
		},

		selectedCategoryTiedToOtherItem: function () {
			return selectedCategoryBelongsToOtherItem( model );
		},

		canDisambiguateUnlinkedExistingCategory: function () {
			return !!(
				model.choices.disambiguateUnlinkedExistingCategory &&
				model.discovery.baseCategory.exists &&
				!selectedCategoryBelongsToOtherItem( model ) &&
				validateWorkflowPlan(
					buildWorkflowPlan( 'disambiguate-unlinked-existing' )
				).valid
			);
		}
	};

	function deriveWorkflowMode( currentModel ) {
		var discovery = currentModel.discovery;
		var baseCategory = discovery.baseCategory;
		var choices = currentModel.choices;
		var workflow = currentModel.workflow;

		if ( baseCategory.exists && currentModel.subject.hasCommonsSitelink ) {
				return 'open-existing';
			}
		if ( workflow.disambiguationNeeded && choices.mergeLinkedExistingCategory ) {
				return 'linked-base-merge';
			}
		if ( workflow.disambiguationNeeded ) {
				return 'linked-base-disambiguate';
			}
		if ( workflow.targetCategoryConflictOption && choices.mergeTargetCategoryConflict ) {
				return 'target-conflict-merge';
			}
		if ( workflow.targetCategoryConflictOption ) {
				return 'target-conflict-disambiguate';
			}
		if ( discoveryNeedsDisambiguationPage( discovery ) ) {
				return 'base-already-disambiguation';
			}
		if ( choices.disambiguateUnlinkedExistingCategory ) {
				return 'disambiguate-unlinked-existing';
			}
		if ( shouldOfferExistingCategoryChoice( currentModel ) ) {
				return 'link-or-disambiguate-existing';
			}
		if ( baseCategory.exists ) {
				return 'link-existing';
			}
		return 'create';
	}

	function discoveryNeedsDisambiguationPage( discovery ) {
		return !!( discovery.baseCategoryWasDisambiguation || discovery.baseCategoryRedirectTarget );
	}

	function shouldOfferExistingCategoryChoice( currentModel ) {
		return !!(
			currentModel.discovery.baseCategory.exists &&
			!currentModel.discovery.baseCategory.wikibaseItem &&
			!currentModel.discovery.baseCategoryRedirectTarget &&
			!currentModel.discovery.baseCategoryWasDisambiguation
		);
	}

	function selectedCategoryBelongsToOtherItem( currentModel ) {
		return !!(
			currentModel.discovery.personCategoryExists &&
			currentModel.discovery.personCategoryWikibaseItem &&
			currentModel.discovery.personCategoryWikibaseItem !== mw.config.get( 'wbEntityId' )
		);
	}

	function buildWorkflowPlan( mode ) {
		var plan = {
			mode: mode || deriveWorkflowMode( model ),
			subjectItemId: mw.config.get( 'wbEntityId' ),
			baseCategory: {
				title: model.discovery.baseCategory.title,
				exists: model.discovery.baseCategory.exists,
				wikibaseItem: model.discovery.baseCategory.wikibaseItem,
				linkKind: model.discovery.baseCategory.linkKind,
				redirectTarget: model.discovery.baseCategoryRedirectTarget,
				wasDisambiguation: model.discovery.baseCategoryWasDisambiguation
			},
			currentPerson: {
				itemId: mw.config.get( 'wbEntityId' ),
				targetCategory: model.workflow.personCategory
			},
			existingPerson: null,
			disambiguationCategory: null,
			pendingBaseDisambiguation: model.workflow.pendingBaseDisambiguation
		};

		if ( plan.mode === 'linked-base-disambiguate' ) {
			plan.existingPerson = {
				itemId: model.workflow.originalPersonCategoryWikibaseItem,
				sourceCategory: model.workflow.originalPersonCategory,
				targetCategory: selectedLinkedMoveTarget()
			};
			plan.currentPerson.targetCategory = selectedLinkedDisambiguationTarget();
			plan.disambiguationCategory = model.workflow.originalPersonCategory;
		} else if ( plan.mode === 'disambiguate-unlinked-existing' ) {
			plan.existingPerson = {
				itemId: null,
				sourceCategory: model.workflow.originalPersonCategory,
				targetCategory: selectedUnlinkedDisambiguationTarget()
			};
			plan.currentPerson.targetCategory = selectedCurrentItemDisambiguationTarget();
			plan.disambiguationCategory = model.workflow.originalPersonCategory;
		} else if ( plan.mode === 'target-conflict-disambiguate' ) {
			plan.pendingBaseDisambiguation = discoveryNeedsDisambiguationPage( model.discovery ) ? {
				title: model.workflow.originalPersonCategory,
				text: model.discovery.baseCategoryText,
				redirectTarget: model.discovery.baseCategoryRedirectTarget,
				wasDisambiguation: model.discovery.baseCategoryWasDisambiguation
			} : null;
			plan.existingPerson = {
				itemId: model.workflow.targetCategoryConflictOption &&
					model.workflow.targetCategoryConflictOption.wikibaseItem,
				sourceCategory: model.workflow.targetCategoryConflictOption &&
					model.workflow.targetCategoryConflictOption.title,
				targetCategory: selectedTargetConflictMoveTarget()
			};
			plan.currentPerson.targetCategory = selectedCurrentItemTargetForTargetConflict();
			plan.disambiguationCategory = plan.existingPerson.sourceCategory;
		}

		return plan;
	}

	function validateWorkflowPlan( plan ) {
		var errors = [];

		if ( !plan || !plan.mode ) {
			errors.push( 'Workflow mode is missing.' );
			return { valid: false, errors: errors };
		}

		if (
			plan.mode === 'linked-base-disambiguate' ||
			plan.mode === 'disambiguate-unlinked-existing' ||
			plan.mode === 'target-conflict-disambiguate'
		) {
			if ( !plan.existingPerson || !plan.existingPerson.sourceCategory ) {
				errors.push( 'The existing Commons category is missing.' );
			}
			if ( !plan.existingPerson || !plan.existingPerson.targetCategory ) {
				errors.push( 'The move target for the existing category is missing.' );
			}
			if ( !plan.currentPerson.targetCategory ) {
				errors.push( 'The Commons category for the current item is missing.' );
			}
			if ( !disambiguationTargetsAreDistinct(
				plan.existingPerson && plan.existingPerson.targetCategory,
				plan.currentPerson.targetCategory
			) ) {
				errors.push( 'The two disambiguation targets must have different labels.' );
			}
		}

		if (
			plan.mode === 'linked-base-disambiguate' ||
			plan.mode === 'target-conflict-disambiguate'
		) {
			if ( !plan.existingPerson || !plan.existingPerson.itemId ) {
				errors.push( 'The Wikidata item linked to the existing category is missing.' );
			}
		}

		return {
			valid: !errors.length,
			errors: errors
		};
	}

	function activateWorkflowPlan( plan ) {
		var validation = validateWorkflowPlan( plan );

		if ( !validation.valid ) {
			renderPanel( validation.errors.join( ' ' ) );
			return false;
		}

		model.workflow.activePlan = plan;
		model.workflow.phase = 'executing';
		return true;
	}

	$.when(
		$.ready,
		mw.loader.using( [
			'mediawiki.util',
			'mediawiki.api',
			'mediawiki.ForeignApi',
			'oojs-ui',
			'oojs-ui.styles.icons-interactions'
		] )
	).then( function () {
		if ( mw.config.get( 'wgDBname' ) !== 'wikidatawiki' ||
			mw.config.get( 'wgNamespaceNumber' ) !== 0 ||
			!mw.config.get( 'wbEntityId' )
		) {
			return;
		}

		state.localApi = new mw.Api();
		state.commonsApi = new mw.ForeignApi( 'https://commons.wikimedia.org/w/api.php', {
			anonymous: false
		} );
		loadMappings().then( function () {
			return loadEntity();
		} ).then( function () {
			state.hasCommonsSitelink = entityHasCommonsSitelink( state.entity );

			if (
				( !isHuman( state.entity ) && !isCategoryDisambiguationItem( state.entity ) ) ||
				state.hasCommonsSitelink
			) {
				return;
			}

			addPortletLink();
			addMultilingualSitesButton();
		} );
	} );

	function addPortletLink() {
		var categoryDisambiguation = isCategoryDisambiguationItem( state.entity );
		var node = mw.util.addPortletLink(
			'p-cactions',
			'#',
			'new category',
			'catapultCreate',
			categoryDisambiguation ?
				'Create or update the Commons category disambiguation page' :
				'Create or inspect a Commons category for this person'
		);

		$( node ).on( 'click', 'a', function ( event ) {
			event.preventDefault();
			openPanel();
		} );
	}

	function openPanel() {
		model.workflow.phase = 'discovering';
		renderPanel( 'Loading Wikidata data...' );
		loadEntity().then( function () {
			if ( isCategoryDisambiguationItem( state.entity ) ) {
				return buildCategoryDisambiguationHub().then( renderCategoryDisambiguationHub );
			}
			if ( !isHuman( state.entity ) ) {
				renderPanel( 'This item is not a human (Q5).' );
				return;
			}
			return buildSuggestions().then( renderSuggestions );
		}, function () {
			renderPanel( 'Could not load this Wikidata item.' );
		} );
	}

	function entityHasCommonsSitelink( entity ) {
		return !!commonsSitelinkTitle( entity );
	}

	function commonsSitelinkTitle( entity ) {
		return entity &&
			entity.sitelinks &&
			entity.sitelinks.commonswiki &&
			entity.sitelinks.commonswiki.title || '';
	}

	function addMultilingualSitesButton() {
		var attempts = 0;
		var interval;

		if ( !currentPageLooksHuman() ) {
			return;
		}

		interval = window.setInterval( function () {
			attempts++;

			if ( insertMultilingualSitesButton() || attempts > 20 ) {
				window.clearInterval( interval );
			}
		}, 250 );
	}

	function currentPageLooksHuman() {
		var entity = mw.config.get( 'wbEntity' );

		if ( typeof entity === 'string' ) {
			try {
				entity = JSON.parse( entity );
			} catch ( e ) {
				entity = null;
			}
		}

		return !entity || (
			( isHuman( entity ) || isCategoryDisambiguationItem( entity ) ) &&
			!entityHasCommonsSitelink( entity )
		);
	}

	function insertMultilingualSitesButton() {
		var $group = findMultilingualSitesGroup();
		var $heading;
		var $button;

		if (
			state.hasCommonsSitelink ||
			!$group.length ||
			$( '#CatapultMultilingualSitesButton' ).length
		) {
			return !!$group.length;
		}

		$heading = $group.find(
			'.wikibase-sitelinkgroupview-heading, .wikibase-sitelinkgroupview-header, h2, h3'
		).first();

		if ( !$heading.length ) {
			$heading = $group;
		}

		$button = makeButton( {
			id: 'CatapultMultilingualSitesButton',
			label: 'new category',
			title: isCategoryDisambiguationItem( state.entity ) ?
				'Create or update the Commons category disambiguation page' :
				'Create or inspect a Commons category for this person',
			framed: true,
			flags: [ 'progressive' ],
			classes: [ 'catapult-sitelink-button', 'catapult-commons-logo-button' ]
		}, function ( event ) {
			if ( event && event.preventDefault ) {
				event.preventDefault();
			}
			if ( event && event.stopPropagation ) {
				event.stopPropagation();
			}
			openPanel();
		} ).css( {
			float: 'right',
			fontSize: '0.875em',
			margin: '6px 10px 4px 12px'
		} );

		styleCommonsLogoButton( $button );
		$heading.css( 'position', 'relative' ).append( $button );

		return true;
	}

	function styleCommonsLogoButton( $button ) {
		var $target = $button.find( '.oo-ui-buttonElement-button' ).first();

		if ( !$target.length ) {
			$target = $button;
		}

		$target.css( {
			alignItems: 'center',
			backgroundColor: '#f8f9fa',
			backgroundImage: 'url(https://upload.wikimedia.org/wikipedia/commons/4/4a/Commons-logo.svg)',
			backgroundPosition: '12px center',
			backgroundRepeat: 'no-repeat',
			backgroundSize: '18px 24px',
			border: '1px solid #a2a9b1',
			borderRadius: '2px',
			boxShadow: 'inset 0 0 0 1px #fff',
			color: '#202122',
			display: 'inline-flex',
			minHeight: '32px',
			paddingBottom: '6px',
			paddingLeft: '38px',
			paddingRight: '14px',
			paddingTop: '6px'
		} );

		$target.on( 'mouseenter', function () {
			$( this ).css( {
				backgroundColor: '#fff',
				borderColor: '#72777d'
			} );
		} ).on( 'mouseleave', function () {
			$( this ).css( {
				backgroundColor: '#f8f9fa',
				borderColor: '#a2a9b1'
			} );
		} ).on( 'focus', function () {
			$( this ).css( {
				borderColor: '#36c',
				boxShadow: 'inset 0 0 0 1px #fff, 0 0 0 2px #36c'
			} );
		} ).on( 'blur', function () {
			$( this ).css( {
				borderColor: '#a2a9b1',
				boxShadow: 'inset 0 0 0 1px #fff'
			} );
		} );
	}

	function loadMappings() {
		var deferred = $.Deferred();

		state.localApi.get( {
			action: 'query',
			titles: CONFIG.mappingPage,
			prop: 'revisions',
			rvprop: 'content',
			rvslots: 'main',
			formatversion: 2,
			format: 'json'
		} ).then( function ( data ) {
			var page = data.query && data.query.pages && data.query.pages[ 0 ];
			var revision = page && page.revisions && page.revisions[ 0 ];
			var slot = revision && revision.slots && revision.slots.main;

			applyMappings( slot && slot.content );
			deferred.resolve();
		}, function ( code, data ) {
			debugWarn( 'Could not load mappings', code, data );
			deferred.resolve();
		} );

		return deferred.promise();
	}

	function applyMappings( text ) {
		var mappings;
		var keys = [
			'occupationCategoryByQid',
			'occupationCategoryByRelatedQid',
			'occupationDisambiguationByQid',
			'occupationCategoryReplacements',
			'countryPhraseByQid',
			'countryNameReplacements',
			'items'
		];

		if ( !text ) {
			return;
		}

		try {
			mappings = JSON.parse( text );
		} catch ( e ) {
			debugWarn( 'Could not parse mappings JSON', e );
			return;
		}

		keys.forEach( function ( key ) {
			if ( mappings[ key ] && typeof mappings[ key ] === 'object' ) {
				CONFIG[ key ] = $.extend( {}, CONFIG[ key ], mappings[ key ] );
			}
		} );
	}

	function loadEntity() {
		var deferred = $.Deferred();
		var entity = mw.config.get( 'wbEntity' );

		if ( typeof entity === 'string' ) {
			try {
				entity = JSON.parse( entity );
			} catch ( e ) {
				entity = null;
			}
		}

		if ( entity && entity.claims && entity.sitelinks ) {
			state.entity = entity;
			deferred.resolve();
			return deferred.promise();
		}

		state.localApi.get( {
			action: 'wbgetentities',
			ids: mw.config.get( 'wbEntityId' ),
			props: 'labels|claims|sitelinks',
			languages: 'en',
			languagefallback: 1,
			format: 'json'
		} ).then( function ( data ) {
			state.entity = data.entities && data.entities[ mw.config.get( 'wbEntityId' ) ];
			deferred.resolve();
		}, deferred.reject );

		return deferred.promise();
	}

	function resetSuggestionModel( categoryTitle, personPage, relatedEntities ) {
		model.subject.relatedEntities = relatedEntities || {};
		model.subject.hasPersonCommonsCategory =
			!!getStringClaim( model.subject.entity, CONFIG.properties.commonsCategory );
		model.subject.hasCommonsSitelink = entityHasCommonsSitelink( model.subject.entity );

		model.discovery.facultyCategoryNames = [];
		model.discovery.baseCategory = {
			title: categoryTitle,
			exists: !!( personPage && personPage.exists ),
			redirect: !!( personPage && personPage.redirect ),
			wikibaseItem: personPage && personPage.wikibaseItem || null,
			linkKind: personPage && personPage.wikibaseItem ?
				( personPage.wikibaseItem === mw.config.get( 'wbEntityId' ) ? 'person' : 'unknown' ) :
				'none'
		};
		model.discovery.personCategoryExists = !!( personPage && personPage.exists );
		model.discovery.personCategoryRedirect = !!( personPage && personPage.redirect );
		model.discovery.personCategoryWikibaseItem = personPage && personPage.wikibaseItem || null;
		model.discovery.personCategoryWikibaseEntity = null;
		model.discovery.personCategoryExistingParents = [];
		model.discovery.personCategoryThumbnails = [];
		model.discovery.personCategoryThumbnailsLoaded = false;
		model.discovery.personCategoryMoveTargetExists = false;
		model.discovery.targetCategoryConflictEntity = null;
		model.discovery.targetCategoryMoveTargetExists = false;
		model.discovery.existingBaseDisambiguationTitles = [];
		model.discovery.baseCategoryRedirectTarget = null;
		model.discovery.baseCategoryWasDisambiguation = false;
		model.discovery.baseCategoryText = '';

		model.suggestions.candidates = [];
		model.suggestions.disambiguationOptions = [];
		model.suggestions.unlinkedDisambiguationOptions = [];

		model.choices.selectedCandidate = null;
		model.choices.selectedDisambiguationOption = null;
		model.choices.selectedUnlinkedDisambiguationOption = null;
		model.choices.unlinkedDisambiguationTitle = '';
		model.choices.selectedCurrentItemDisambiguationOption = null;
		model.choices.currentItemDisambiguationExtra = '';
		model.choices.currentItemDisambiguationTitle = '';
		model.choices.linkedMoveTargetTitle = '';
		model.choices.linkedDisambiguationTitle = '';
		model.choices.targetCategoryMoveTargetTitle = '';
		model.choices.targetCategoryCurrentTitle = '';
		model.choices.disambiguateUnlinkedExistingCategory = false;
		model.choices.mergeLinkedExistingCategory = false;
		model.choices.mergeTargetCategoryConflict = false;

		model.workflow.originalPersonCategory = categoryTitle;
		model.workflow.phase = 'discovering';
		model.workflow.personCategory = categoryTitle;
		model.workflow.originalPersonCategoryWikibaseItem =
			model.discovery.personCategoryWikibaseItem;
		model.workflow.personCategoryMoveTarget = null;
		model.workflow.targetCategoryConflictOption = null;
		model.workflow.targetCategoryMoveTarget = null;
		model.workflow.pendingBaseDisambiguation = null;
		model.workflow.disambiguationNeeded = !!(
			model.discovery.personCategoryExists &&
			model.discovery.personCategoryWikibaseItem &&
			model.discovery.personCategoryWikibaseItem !== mw.config.get( 'wbEntityId' )
		);
		model.workflow.disambiguationCategoryItem = null;
		model.workflow.activePlan = null;

		model.ui.primaryActionButton = null;
		model.ui.primaryActionElement = null;
	}

	function buildSuggestions() {
		var relatedIds = uniqueIds(
			claimValueIds( state.entity, CONFIG.properties.occupation ).slice( 0, CONFIG.maxOccupationCount )
				.concat( claimValueIds( state.entity, CONFIG.properties.fieldOfWork ).slice( 0, CONFIG.maxOccupationCount ) )
				.concat( claimValueIds( state.entity, CONFIG.properties.employer ).slice( 0, CONFIG.maxOccupationCount ) )
				.concat( claimValueIds( state.entity, CONFIG.properties.countryOfCitizenship ).slice( 0, CONFIG.maxCountryCount ) )
				.concat( claimValueIds( state.entity, CONFIG.properties.sexOrGender ) )
		);

		var categoryTitle = getPersonCategoryTitle();

		return $.when(
			loadRelatedEntities( relatedIds ),
			checkCommonsPages( [ categoryTitle ] )
		).then( function ( related, personPages ) {
			var personPage = personPages[ categoryTitle ];

			resetSuggestionModel( categoryTitle, personPage, related );

			if ( state.disambiguationNeeded || shouldOfferLinkOrDisambiguate() ) {
				state.disambiguationOptions = makeDisambiguationOptions();
			}

			return loadExistingPersonCategoryParents().then( function () {
				if ( baseCategoryNeedsDisambiguationPage() ) {
					state.mergeLinkedExistingCategory = false;
					if ( !state.disambiguationOptions.length ) {
						state.disambiguationOptions = makeDisambiguationOptions();
					}
					state.selectedDisambiguationOption = firstAvailableDisambiguationOption();
					state.selectedCurrentItemDisambiguationOption = state.selectedDisambiguationOption;
				}
				return loadOccupationParentEntities();
			} ).then( function () {
				return $.when(
					loadConflictingCategoryEntity(),
					shouldLoadEmployerFacultyCategories() ?
						loadEmployerFacultyCategories() :
						$.Deferred().resolve().promise()
				);
			} ).then( function () {
				state.candidates = makeCategoryCandidates();
				return searchExistingDisambiguationCategories();
			} ).then( function ( existingDisambiguations ) {
				state.existingBaseDisambiguationTitles = existingDisambiguations || [];
				if ( !state.baseCategoryWasDisambiguation ) {
					existingDisambiguations.forEach( function ( title ) {
						addDisambiguationOption( title, title.replace( /^Category:[^(]+\((.*)\)$/i, '$1' ), 'commons' );
					} );
				}
				state.selectedDisambiguationOption = firstAvailableDisambiguationOption();
				state.selectedCurrentItemDisambiguationOption = state.selectedDisambiguationOption;
				if ( ( state.disambiguationNeeded || baseCategoryNeedsDisambiguationPage() ) && state.selectedDisambiguationOption ) {
					state.personCategory = state.selectedDisambiguationOption.title;
				}

				return $.when(
					checkCandidateCommonsPages(),
					checkCommonsPages( state.disambiguationOptions.map( function ( option ) {
						return option.title;
					} ) )
				);
			} );
		} ).then( function ( existingPages, disambiguationPages ) {
			state.candidates.forEach( function ( candidate ) {
				var page = existingPages[ candidateCategoryTitle( candidate ) ];
				candidate.exists = !!( page && page.exists );
			} );
			state.disambiguationOptions.forEach( function ( option ) {
				var page = disambiguationPages[ option.title ];

				option.exists = !!( page && page.exists );
				option.wikibaseItem = page && page.wikibaseItem || null;
				option.redirect = !!( page && page.redirect );
			} );
			if ( ( state.disambiguationNeeded || baseCategoryNeedsDisambiguationPage() ) && state.selectedDisambiguationOption ) {
				selectDisambiguationOption( firstAvailableDisambiguationOption() );
				if ( !state.currentItemDisambiguationTitle ) {
					state.selectedCurrentItemDisambiguationOption = state.selectedDisambiguationOption;
				}
			}
			return loadSelectedTargetCategoryConflict().then( function () {
				state.selectedCandidate = firstExistingCandidate( state.candidates );
				initializeParentCategorySelections();
				model.workflow.phase = 'review';
			} );
		} );
	}

	function buildCategoryDisambiguationHub() {
		var label = englishLabel( state.entity );
		var baseTitle;

		model.workflow.disambiguationHub = null;
		if ( !/^Category:\S/i.test( label ) ) {
			return $.Deferred().resolve( {
				action: 'stop',
				message: 'The English label must start with "Category:".'
			} ).promise();
		}

		baseTitle = normalizeCategoryTitle( label );
		return $.when(
			checkCommonsPages( [ baseTitle ] ),
			searchSuffixedCategories( baseTitle )
		).then( function ( pages, suffixedTitles ) {
			var page = pages[ baseTitle ] || {};
			var hub = {
				action: '',
				baseTitle: baseTitle,
				baseExists: !!page.exists,
				baseWikibaseItem: page.wikibaseItem || null,
				baseText: '',
				baseRedirectTarget: null,
				baseWasDisambiguation: false,
				existingEntity: null,
				existingEntityIsDisambiguation: false,
				parentCategories: [],
				moveOptions: [],
				selectedMoveTarget: '',
				suffixedTitles: uniqueIds( suffixedTitles || [] ),
				message: ''
			};

			model.workflow.disambiguationHub = hub;
			if ( !hub.baseExists ) {
				hub.action = hub.suffixedTitles.length >= 2 ? 'create' : 'stop';
				hub.message = hub.action === 'stop' ?
					'The base category does not exist and fewer than two suffixed categories were found.' :
					'Create a disambiguation category linking the existing suffixed categories.';
				return hub;
			}

			return readCommonsPageText( baseTitle ).then( function ( text ) {
				hub.baseText = text;
				hub.baseRedirectTarget = categoryRedirectTarget( text );
				hub.baseWasDisambiguation = isDisambiguationCategoryText( text );
				hub.parentCategories = categoryLinksFromText( text );

				if ( !hub.baseWasDisambiguation && !hub.suffixedTitles.length ) {
					hub.action = 'stop';
					hub.message = 'No existing suffixed category was found, so there is not enough evidence to create a disambiguation page.';
					return hub;
				}
				if ( hub.baseWasDisambiguation ) {
					if (
						hub.baseWikibaseItem &&
						hub.baseWikibaseItem !== mw.config.get( 'wbEntityId' )
					) {
						hub.action = 'stop';
						hub.message = 'The Commons page is already a disambiguation category but is tied to another Wikidata item.';
					} else {
						hub.action = 'update';
					}
					return hub;
				}
				if ( hub.baseRedirectTarget && !hub.baseWikibaseItem ) {
					hub.action = 'update';
					return hub;
				}
				if ( !hub.baseWikibaseItem ) {
					hub.action = 'move-unlinked';
					hub.moveOptions = unlinkedDisambiguationOptionsFromParents(
						baseTitle,
						hub.parentCategories
					);
					hub.selectedMoveTarget = hub.moveOptions[ 0 ] &&
						hub.moveOptions[ 0 ].title || '';
					return hub;
				}

				return loadEntityById( hub.baseWikibaseItem ).then( function ( entity ) {
					var occupationIds;

					if ( !entity ) {
						hub.action = 'stop';
						hub.message = 'The Wikidata item tied to the base category could not be loaded.';
						return hub;
					}
					hub.existingEntity = entity;
					hub.existingEntityIsDisambiguation = isCategoryDisambiguationItem( entity );
					if ( hub.existingEntityIsDisambiguation ) {
						if ( hub.baseWikibaseItem === mw.config.get( 'wbEntityId' ) ) {
							hub.action = 'update';
						} else {
							hub.action = 'stop';
							hub.message = 'The base category is tied to a different category-disambiguation item.';
						}
						return hub;
					}

					if ( hub.baseRedirectTarget ) {
						hub.action = 'redirect-linked';
						hub.selectedMoveTarget = hub.baseRedirectTarget;
						return hub;
					}

					occupationIds = claimValueIds( entity, CONFIG.properties.occupation )
						.slice( 0, CONFIG.maxOccupationCount );
					return loadRelatedEntities( occupationIds ).then( function ( related ) {
						$.extend( state.relatedEntities, related || {} );
						hub.action = 'move-linked';
						hub.moveOptions = uniqueOptionsByTitle(
							entityDisambiguationOptions( entity, baseTitle ).concat(
								unlinkedDisambiguationOptionsFromParents(
									baseTitle,
									hub.parentCategories
								)
							)
						);
						hub.selectedMoveTarget = hub.moveOptions[ 0 ] &&
							hub.moveOptions[ 0 ].title || '';
						return hub;
					} );
				} );
			} );
		} );
	}

	function renderCategoryDisambiguationHub( hub ) {
		var $panel;

		if ( !hub ) {
			renderPanel( 'Could not inspect the Commons categories.' );
			return;
		}

		renderPanel( sentence(
			commonsCategoryLink( hub.baseTitle ),
			hub.baseExists ? ' exists on Commons.' : ' does not exist on Commons.'
		) );
		$panel = $( '#CatapultPanelBody' );
		if ( hub.suffixedTitles.length ) {
			$panel.append(
				$( '<strong>' ).text( 'Existing disambiguated categories' ),
				$( '<ul>' ).append( hub.suffixedTitles.map( function ( title ) {
					return $( '<li>' ).append( commonsCategoryLink( title ) );
				} ) )
			);
		}

		if ( hub.action === 'stop' ) {
			$panel.append( $( '<p>' ).text( hub.message ) );
			appendVersionAndCloseActions();
			return;
		}

		if ( hub.action === 'move-linked' || hub.action === 'move-unlinked' ) {
			$panel.append(
				$( '<div>' ).css( {
					background: '#f8f9fa',
					border: '1px solid #c8ccd1',
					padding: '8px'
				} ).append(
					hub.action === 'move-linked' ?
						$( '<p>' ).append(
							'The base category is tied to ',
							wikidataItemLabelLink( hub.baseWikibaseItem, hub.existingEntity ),
							'.'
						) :
						$( '<p>' ).text(
							'The base category is not tied to a Wikidata item. Suggestions are based on its parent categories.'
						),
					$( '<strong>' ).text( 'Move existing content to: ' ),
					buildCategoryDisambiguationMoveInput( hub ),
					buildCategoryDisambiguationTargetWarning( hub )
				)
			);
		} else if ( hub.action === 'redirect-linked' ) {
			$panel.append( $( '<p>' ).append(
				'The linked item will be updated to ',
				commonsCategoryLink( hub.baseRedirectTarget ),
				', after which the base redirect will become the disambiguation category.'
			) );
		} else {
			$panel.append( $( '<p>' ).text( hub.message ||
				'The base page will be written as a disambiguation category.' ) );
		}

		appendCategoryDisambiguationActions( hub );
	}

	function buildCategoryDisambiguationMoveInput( hub ) {
		var options = hub.moveOptions.map( function ( option ) {
			return {
				data: option.title,
				label: option.title.replace( /^Category:/i, '' )
			};
		} );
		var currentValue = hub.selectedMoveTarget;
		var comboBox;

		function updateValue( value ) {
			hub.selectedMoveTarget = normalizeCategoryTitle( value );
			refreshCategoryDisambiguationAction( hub );
			refreshCategoryDisambiguationTargetWarning( hub );
		}

		if ( window.OO && OO.ui && OO.ui.ComboBoxInputWidget && OO.ui.MenuOptionWidget ) {
			comboBox = new OO.ui.ComboBoxInputWidget( {
				value: currentValue,
				menu: {
					filterFromInput: true,
					filterMode: 'substring',
					items: options.map( function ( option ) {
						return new OO.ui.MenuOptionWidget( option );
					} )
				}
			} );
			comboBox.on( 'change', updateValue );
			return comboBox.$element.css( {
				minWidth: '360px',
				maxWidth: '100%'
			} );
		}

		return $( '<input>', {
			type: 'text',
			value: currentValue
		} ).on( 'input', function () {
			updateValue( this.value );
		} );
	}

	function buildCategoryDisambiguationTargetWarning( hub ) {
		return $( '<p>', {
			id: 'CatapultDisambiguationTargetWarning'
		} ).css( {
			color: '#72777d',
			margin: '6px 0 0'
		} ).text( categoryDisambiguationTargetWarning( hub ) );
	}

	function refreshCategoryDisambiguationTargetWarning( hub ) {
		$( '#CatapultDisambiguationTargetWarning' ).text(
			categoryDisambiguationTargetWarning( hub )
		);
	}

	function categoryDisambiguationTargetWarning( hub ) {
		if (
			!isValidCategoryMoveTarget( hub.baseTitle, hub.selectedMoveTarget ) ||
			isRecognizedDisambiguationTarget( hub.baseTitle, hub.selectedMoveTarget )
		) {
			return '';
		}

		return 'Warning: this does not look like a parenthetical label or an inserted-initial name variant. Check the category name before continuing.';
	}

	function appendCategoryDisambiguationActions( hub ) {
		var $shell = $( '#CatapultPanel' );
		var $actions = $( '<div>', {
			id: 'CatapultPanelActions'
		} ).css( {
			borderTop: '1px solid #eaecf0',
			display: 'flex',
			justifyContent: 'flex-end',
			padding: '8px 12px'
		} );

		$actions.append( makeButton( {
			id: 'CatapultPrimaryAction',
			label: hub.action === 'create' ? 'create' : 'disambiguate',
			icon: 'articles',
			flags: [ 'primary', 'progressive' ],
			disabled: !canExecuteCategoryDisambiguationHub( hub )
		}, function () {
			executeCategoryDisambiguationHub( hub );
		} ) );
		$( '#CatapultVersion' ).detach();
		$shell.append( $actions, buildVersionFooter() );
	}

	function appendVersionAndCloseActions() {
		var $shell = $( '#CatapultPanel' );

		$( '#CatapultVersion' ).detach();
		$shell.append( buildVersionFooter() );
	}

	function refreshCategoryDisambiguationAction( hub ) {
		var disabled = !canExecuteCategoryDisambiguationHub( hub );

		if ( state.primaryActionButton ) {
			state.primaryActionButton.setDisabled( disabled );
		} else if ( state.primaryActionElement ) {
			state.primaryActionElement.prop( 'disabled', disabled );
		}
	}

	function canExecuteCategoryDisambiguationHub( hub ) {
		if ( hub.action === 'create' ) {
			return hub.suffixedTitles.length >= 2;
		}
		if ( hub.action === 'update' ) {
			return true;
		}
		if ( hub.action === 'redirect-linked' ) {
			return !!hub.baseRedirectTarget;
		}
		if ( hub.action === 'move-linked' || hub.action === 'move-unlinked' ) {
			return isValidCategoryMoveTarget(
				hub.baseTitle,
				hub.selectedMoveTarget
			);
		}
		return false;
	}

	function isValidCategoryMoveTarget( baseTitle, targetTitle ) {
		var normalizedBase = normalizeCategoryTitle( baseTitle );
		var normalizedTarget = normalizeCategoryTitle( targetTitle );

		return !!(
			targetTitle &&
			normalizedTarget !== normalizedBase &&
			!/\(\s*\)\s*$/.test( normalizedTarget )
		);
	}

	function isRecognizedDisambiguationTarget( baseTitle, targetTitle ) {
		var normalizedBase = normalizeCategoryTitle( baseTitle );
		var normalizedTarget = normalizeCategoryTitle( targetTitle );
		var baseName = normalizedBase.replace( /^Category:/i, '' );
		var pattern = new RegExp(
			'^Category:' + escapeRegExp( baseName ) + '\\s+\\(([^()]*)\\)$',
			'i'
		);
		var match = normalizedTarget.match( pattern );

		return !!(
			( match && match[ 1 ].replace( /\s+/g, ' ' ).trim() ) ||
			isInitialNameVariant( baseName, normalizedTarget.replace( /^Category:/i, '' ) )
		);
	}

	function isInitialNameVariant( baseName, variantName ) {
		var baseParts = String( baseName || '' ).trim().split( /\s+/ );
		var variantParts = String( variantName || '' ).trim().split( /\s+/ );
		var baseIndex = 0;
		var insertedInitials = 0;

		if (
			baseParts.length < 2 ||
			variantParts.length <= baseParts.length ||
			variantParts[ 0 ].toLowerCase() !== baseParts[ 0 ].toLowerCase() ||
			variantParts[ variantParts.length - 1 ].toLowerCase() !==
				baseParts[ baseParts.length - 1 ].toLowerCase()
		) {
			return false;
		}

		variantParts.forEach( function ( part ) {
			if ( baseIndex < 0 ) {
				return;
			}
			if (
				baseIndex < baseParts.length &&
				part.toLowerCase() === baseParts[ baseIndex ].toLowerCase()
			) {
				baseIndex++;
				return;
			}
			if ( /^[A-Z]\.?$/.test( part ) ) {
				insertedInitials++;
				return;
			}
			baseIndex = -1;
		} );

		return baseIndex === baseParts.length && insertedInitials > 0;
	}

	function executeCategoryDisambiguationHub( hub ) {
		var links;

		if ( !canExecuteCategoryDisambiguationHub( hub ) ) {
			renderPanel(
				'Enter a non-empty disambiguation label or an initial name variant, for example Category:Name (writer) or Category:Richard N. Griffith.'
			);
			return;
		}

		links = categoryDisambiguationHubLinks( hub );
		if ( hub.action === 'move-linked' || hub.action === 'move-unlinked' ) {
			checkCommonsPages( [ hub.selectedMoveTarget ] ).then( function ( pages ) {
				var target = pages[ normalizeCategoryTitle( hub.selectedMoveTarget ) ];

				if ( target && target.exists ) {
					renderPanel( sentence(
						commonsCategoryLink( hub.selectedMoveTarget ),
						' already exists. Choose another label before moving the base category.'
					) );
					return;
				}
				executePreparedCategoryDisambiguationHub( hub, links );
			} );
			return;
		}

		executePreparedCategoryDisambiguationHub( hub, links );
	}

	function executePreparedCategoryDisambiguationHub( hub, links ) {
		var chain = $.Deferred().resolve().promise();

		$( '#CatapultPanel button' ).prop( 'disabled', true );
		renderProgressPanel( 'Working on ' + hub.baseTitle + '...', [
			{ label: 'Prepare existing category', status: 'working' },
			{ label: 'Write Commons disambiguation category', status: 'waiting' },
			{ label: 'Set Commons sitelink on Wikidata item', status: 'waiting' }
		] );

		if ( hub.action === 'move-linked' || hub.action === 'move-unlinked' ) {
			chain = moveCommonsCategory( hub.baseTitle, hub.selectedMoveTarget );
		}
		chain = chain.then( function () {
			if ( hub.action !== 'move-linked' && hub.action !== 'redirect-linked' ) {
				return;
			}
			return updateEntityAfterCategoryMove(
				hub.baseWikibaseItem,
				hub.existingEntity,
				hub.selectedMoveTarget,
				hub.action === 'move-linked' ? hub.baseTitle : null
			).then( waitForSitelinkPropagation );
		} ).then( function () {
			markProgressLabelDone( 'Prepare existing category' );
			return writeCategoryDisambiguationHubPage( hub, links );
		} ).then( function () {
			markProgressLabelDone( 'Write Commons disambiguation category' );
			return setCurrentItemCommonsSitelink( hub.baseTitle );
		} ).then( function () {
			markProgressLabelDone( 'Set Commons sitelink on Wikidata item' );
			model.workflow.phase = 'complete';
			state.hasCommonsSitelink = true;
			$( '#CatapultMultilingualSitesButton' ).remove();
			renderPanel( sentence(
				'Created or updated ',
				commonsCategoryLink( hub.baseTitle ),
				' and linked it to this category-disambiguation item.'
			) );
		}, function ( code, data ) {
			model.workflow.phase = 'error';
			debugWarn( 'Category-disambiguation hub failed', code, data );
			renderPanel( sentence(
				'Could not complete ',
				commonsCategoryLink( hub.baseTitle ),
				'. Check the Commons and Wikidata changes before retrying.'
			) );
		} );
	}

	function categoryDisambiguationHubLinks( hub ) {
		var existingLinks = hub.baseWasDisambiguation ?
			existingDisambiguationLinks( hub.baseText ) :
			[];

		return uniqueIds(
			existingLinks
				.concat( hub.suffixedTitles )
				.concat( [ hub.selectedMoveTarget, hub.baseRedirectTarget ] )
				.filter( Boolean )
				.map( normalizeCategoryTitle )
				.filter( function ( title ) {
					return title !== normalizeCategoryTitle( hub.baseTitle );
				} )
		);
	}

	function writeCategoryDisambiguationHubPage( hub, links ) {
		var params = {
			action: 'edit',
			title: hub.baseTitle,
			text: buildDisambiguationCategoryText( hub.baseText, links ),
			summary: 'Creating or updating Commons category disambiguation page using [[User:1Veertje/Catapult/app.js|Catapult]]',
			format: 'json'
		};

		if ( !hub.baseExists ) {
			params.createonly = 1;
		}
		return state.commonsApi.postWithToken( 'csrf', params );
	}

	function moveCommonsCategory( fromTitle, toTitle ) {
		return state.commonsApi.postWithToken( 'csrf', {
			action: 'move',
			from: fromTitle,
			to: normalizeCategoryTitle( toTitle ),
			reason: 'Disambiguating Commons category using [[User:1Veertje/Catapult/app.js|Catapult]]',
			movetalk: 1,
			format: 'json'
		} );
	}

	function updateEntityAfterCategoryMove( itemId, entity, targetTitle, sourceTitle ) {
		var imageTitle = imageFileTitleForEntity( entity );
		var target = normalizeCategoryTitle( targetTitle );
		var recategorize = $.Deferred().resolve().promise();

		if ( sourceTitle ) {
			recategorize = filesInCategoryDepictingItem( sourceTitle, itemId ).then( function ( files ) {
				if ( imageTitle && files.indexOf( imageTitle ) === -1 ) {
					files.push( imageTitle );
				}
				return recategorizeFiles( uniqueIds( files ), sourceTitle, target );
			} );
		}

		return recategorize.then( function () {
			return setItemCommonsSitelink( itemId, target );
		} ).then( function () {
			return setItemCommonsCategoryStatement( itemId, entity, target );
		} );
	}

	function filesInCategoryDepictingItem( categoryTitle, itemId ) {
		return categoryFileMembers( categoryTitle ).then( function ( files ) {
			return files.length ? filesDepictingItem( files, itemId ) : [];
		} );
	}

	function setItemCommonsSitelink( itemId, title ) {
		return state.localApi.postWithToken( 'csrf', {
			action: 'wbsetsitelink',
			id: itemId,
			assertuser: mw.config.get( 'wgUserName' ),
			linksite: 'commonswiki',
			linktitle: normalizeCategoryTitle( title ),
			summary: 'Updating Commons category after disambiguation by catapult',
			format: 'json'
		} );
	}

	function setItemCommonsCategoryStatement( itemId, entity, title ) {
		var claim = bestClaims( entity, CONFIG.properties.commonsCategory )[ 0 ];
		var categoryName = normalizeCategoryTitle( title ).replace( /^Category:/i, '' );

		if ( claim && claim.id ) {
			return state.localApi.postWithToken( 'csrf', {
				action: 'wbsetclaimvalue',
				claim: claim.id,
				snaktype: 'value',
				value: JSON.stringify( categoryName ),
				summary: 'Updating Commons category after category move by catapult',
				format: 'json'
			} );
		}

		return state.localApi.postWithToken( 'csrf', {
			action: 'wbcreateclaim',
			entity: itemId,
			property: CONFIG.properties.commonsCategory,
			snaktype: 'value',
			value: JSON.stringify( categoryName ),
			summary: 'Adding moved Commons category after disambiguation by catapult',
			format: 'json'
		} );
	}

	function setCurrentItemCommonsSitelink( title ) {
		return setItemCommonsSitelink( mw.config.get( 'wbEntityId' ), title );
	}

	function loadRelatedEntities( ids ) {
		var deferred = $.Deferred();

		if ( !ids.length ) {
			return deferred.resolve( {} ).promise();
		}

		state.localApi.get( {
			action: 'wbgetentities',
			ids: ids.join( '|' ),
			props: 'labels|claims',
			languages: 'en',
			languagefallback: 1,
			format: 'json'
		} ).then( function ( data ) {
			deferred.resolve( data.entities || {} );
		}, function () {
			deferred.resolve( {} );
		} );

		return deferred.promise();
	}

	function loadEntityById( id ) {
		var deferred = $.Deferred();

		if ( !id ) {
			return deferred.resolve( null ).promise();
		}

		state.localApi.get( {
			action: 'wbgetentities',
			ids: id,
			props: 'labels|descriptions|claims|sitelinks',
			languages: 'en',
			languagefallback: 1,
			format: 'json'
		} ).then( function ( data ) {
			deferred.resolve( data.entities && data.entities[ id ] || null );
		}, function () {
			deferred.resolve( null );
		} );

		return deferred.promise();
	}

	function loadConflictingCategoryEntity() {
		if ( !state.disambiguationNeeded ) {
			return $.Deferred().resolve().promise();
		}

		return loadEntityById( state.personCategoryWikibaseItem ).then( function ( entity ) {
			var occupationIds;

			state.personCategoryWikibaseEntity = entity;
			if ( hasClaimValue(
				entity,
				CONFIG.properties.instanceOf,
				CONFIG.items.categoryDisambiguationPage
			) ) {
				model.discovery.baseCategory.linkKind = 'category-disambiguation';
				state.disambiguationNeeded = false;
				state.personCategoryWikibaseItem = null;
				state.personCategoryWikibaseEntity = null;
				return;
			}

			model.discovery.baseCategory.linkKind = 'person';
			occupationIds = claimValueIds( entity, CONFIG.properties.occupation )
				.slice( 0, CONFIG.maxOccupationCount );

			return loadRelatedEntities( occupationIds ).then( function ( occupationEntities ) {
				$.extend( state.relatedEntities, occupationEntities || {} );
				state.personCategoryMoveTarget = suggestedDisambiguatedTitleForEntity(
					entity,
					state.personCategoryWikibaseItem
				);
				return checkCommonsPages( [ state.personCategoryMoveTarget ] );
			} ).then( function ( pages ) {
				state.personCategoryMoveTargetExists = !!(
					pages[ state.personCategoryMoveTarget ] &&
					pages[ state.personCategoryMoveTarget ].exists
				);
			} );
		} );
	}

	function loadSelectedTargetCategoryConflict() {
		var option = state.selectedCurrentItemDisambiguationOption ||
			state.selectedDisambiguationOption;

		state.targetCategoryConflictOption = null;
		state.targetCategoryConflictEntity = null;
		state.targetCategoryMoveTarget = null;
		state.targetCategoryMoveTargetTitle = '';
		state.targetCategoryCurrentTitle = '';
		state.targetCategoryMoveTargetExists = false;
		state.mergeTargetCategoryConflict = false;

		if ( !option ||
			!option.exists ||
			!option.wikibaseItem ||
			option.wikibaseItem === mw.config.get( 'wbEntityId' )
		) {
			return $.Deferred().resolve().promise();
		}

		state.targetCategoryConflictOption = option;

		return loadEntityById( option.wikibaseItem ).then( function ( entity ) {
			var occupationIds;

			state.targetCategoryConflictEntity = entity;
			occupationIds = claimValueIds( entity, CONFIG.properties.occupation )
				.slice( 0, CONFIG.maxOccupationCount );

			return loadRelatedEntities( occupationIds ).then( function ( occupationEntities ) {
				$.extend( state.relatedEntities, occupationEntities || {} );
				state.targetCategoryMoveTarget = suggestedDisambiguatedTitleForEntity(
					entity,
					option.wikibaseItem
				);
				return checkCommonsPages( [ state.targetCategoryMoveTarget ] );
			} ).then( function ( pages ) {
				state.targetCategoryMoveTargetExists = !!(
					pages[ state.targetCategoryMoveTarget ] &&
					pages[ state.targetCategoryMoveTarget ].exists
				);
				if ( !state.targetCategoryCurrentTitle ) {
					state.targetCategoryCurrentTitle = preferredCurrentItemTargetAfterTargetConflict();
				}
			} );
		} );
	}

	function loadExistingPersonCategoryParents() {
		if ( !state.personCategoryExists ) {
			return $.Deferred().resolve().promise();
		}

		return readCommonsPageText( state.personCategory ).then( function ( text ) {
			state.baseCategoryText = text;
			state.baseCategoryWasDisambiguation = isDisambiguationCategoryText( text );
			state.baseCategoryRedirectTarget = categoryRedirectTarget( text );
			state.personCategoryExistingParents = categoryLinksFromText( text );
			if ( !state.personCategoryWikibaseItem ) {
				state.unlinkedDisambiguationOptions = makeUnlinkedDisambiguationOptions();
				state.selectedUnlinkedDisambiguationOption = state.unlinkedDisambiguationOptions[ 0 ] || null;
			}
		}, function () {
			state.personCategoryExistingParents = [];
			if ( !state.personCategoryWikibaseItem ) {
				state.unlinkedDisambiguationOptions = makeUnlinkedDisambiguationOptions();
				state.selectedUnlinkedDisambiguationOption = state.unlinkedDisambiguationOptions[ 0 ] || null;
			}
		} );
	}

	function categoryLinksFromText( text ) {
		var links = [];
		var regex = /\[\[\s*Category\s*:\s*([^\]|#]+)(?:[|#][^\]]*)?\]\]/ig;
		var match;

		while ( ( match = regex.exec( text ) ) !== null ) {
			links.push( 'Category:' + match[ 1 ].replace( /\s+/g, ' ' ).trim() );
		}

		return uniqueIds( links );
	}

	function makeUnlinkedDisambiguationOptions() {
		var options = unlinkedDisambiguationOptionsFromParents(
			state.originalPersonCategory,
			state.personCategoryExistingParents
		);

		if ( !options.length ) {
			options = makeDisambiguationOptions();
		}

		return uniqueOptionsByTitle( options );
	}

	function unlinkedDisambiguationOptionsFromParents( baseTitle, parentCategories ) {
		var baseName = normalizeCategoryTitle( baseTitle ).replace( /^Category:/i, '' );
		var options = [];

		parentCategories.forEach( function ( title ) {
			var occupation = occupationFromParentCategory( title );

			if ( occupation ) {
				options.push( {
					source: title,
					occupation: occupation,
					title: 'Category:' + baseName + ' (' + occupation + ')'
				} );
			}
		} );

		return uniqueOptionsByTitle( options );
	}

	function occupationFromParentCategory( title ) {
		var name = title.replace( /^Category:/i, '' ).replace( /\s+by name$/i, '' );
		var match = name.match( /^(?:\d+(?:st|nd|rd|th)-century\s+)?(?:male\s+|female\s+)?(.+?)\s+from\s+.+$/i );
		var occupation;

		if ( !match ) {
			return '';
		}

		occupation = match[ 1 ].replace( /\s+/g, ' ' ).trim();
		return singularizeOccupation( lcfirst( occupation ) );
	}

	function singularizeOccupation( occupation ) {
		if ( /^businesswomen$/i.test( occupation ) ) {
			return occupation.replace( /women$/i, 'woman' );
		}
		if ( /^businessmen$/i.test( occupation ) ) {
			return occupation.replace( /men$/i, 'man' );
		}
		if ( /^businesspeople$/i.test( occupation ) ) {
			return occupation.replace( /people$/i, 'person' );
		}
		if ( /women$/i.test( occupation ) ) {
			return occupation.replace( /women$/i, 'woman' );
		}
		if ( /men$/i.test( occupation ) ) {
			return occupation.replace( /men$/i, 'man' );
		}
		if ( /people$/i.test( occupation ) ) {
			return occupation.replace( /people$/i, 'person' );
		}
		if ( /ies$/i.test( occupation ) ) {
			return occupation.replace( /ies$/i, 'y' );
		}
		if ( /s$/i.test( occupation ) ) {
			return occupation.replace( /s$/i, '' );
		}
		return occupation;
	}

	function uniqueOptionsByTitle( options ) {
		var seen = {};

		return options.filter( function ( option ) {
			if ( !option.title || seen[ option.title ] ) {
				return false;
			}
			seen[ option.title ] = true;
			return true;
		} );
	}

	function loadOccupationParentEntities() {
		var parentIds = [];

		claimValueIds( state.entity, CONFIG.properties.occupation )
			.slice( 0, CONFIG.maxOccupationCount )
			.forEach( function ( qid ) {
				var entity = state.relatedEntities[ qid ];

				parentIds = parentIds.concat(
					claimValueIds( entity, CONFIG.properties.subclassOf ),
					claimValueIds( entity, CONFIG.properties.instanceOf )
				);
			} );
		parentIds = parentIds.concat(
			claimValueIds( state.entity, CONFIG.properties.fieldOfWork )
				.slice( 0, CONFIG.maxOccupationCount )
		);

		parentIds = uniqueIds( parentIds );

		if ( !parentIds.length ) {
			return $.Deferred().resolve().promise();
		}

		return loadRelatedEntities( parentIds ).then( function ( entities ) {
			$.extend( state.relatedEntities, entities || {} );
		} );
	}

	function loadEmployerFacultyCategories() {
		var employerIds = claimValueIds( state.entity, CONFIG.properties.employer )
			.slice( 0, CONFIG.maxOccupationCount );
		var guessedNames = employerFacultyCategoryGuesses( employerIds );
		var query;

		state.facultyCategoryNames = guessedNames;

		if ( !employerIds.length ) {
			return $.Deferred().resolve().promise();
		}

		query = [
			'SELECT DISTINCT ?categoryName WHERE {',
			'  VALUES ?employer { ' + employerIds.map( function ( qid ) {
				return 'wd:' + qid;
			} ).join( ' ' ) + ' }',
			'  ?category wdt:' + CONFIG.properties.instanceOf + ' wd:' + CONFIG.items.wikimediaCategory + ' .',
			'  ?category wdt:' + CONFIG.properties.categoryContains + ' wd:' + CONFIG.items.human + ' .',
			'  { ?category wdt:' + CONFIG.properties.categoryCombinesTopics + ' ?employer . }',
			'  UNION',
			'  { ?category wdt:' + CONFIG.properties.employer + ' ?employer . }',
			'  ?category wdt:' + CONFIG.properties.commonsCategory + ' ?categoryName .',
			'  FILTER( STRSTARTS( LCASE( STR( ?categoryName ) ), "faculty of " ) )',
			'}'
		].join( '\n' );

		return $.ajax( {
			url: 'https://query.wikidata.org/sparql',
			data: {
				query: query,
				format: 'json',
				origin: '*'
			},
			dataType: 'json',
			timeout: CONFIG.lateCandidateCheckTimeout
		} ).then( function ( data ) {
			state.facultyCategoryNames = uniqueIds(
				guessedNames.concat(
					( data.results && data.results.bindings || [] ).map( function ( row ) {
						return row.categoryName && row.categoryName.value;
					} ).filter( Boolean ).map( function ( name ) {
						return name.replace( /^Category:/i, '' ).trim();
					} )
				)
			);
		}, function () {
			state.facultyCategoryNames = guessedNames;
		} );
	}

	function employerFacultyCategoryGuesses( employerIds ) {
		var names = [];

		employerIds.forEach( function ( qid ) {
			var entity = state.relatedEntities[ qid ];
			var baseName = getStringClaim( entity, CONFIG.properties.commonsCategory ) ||
				getEnglishMonolingualTextClaim( entity, CONFIG.properties.shortName ) ||
				englishLabel( entity );

			baseName = String( baseName || '' ).replace( /^Category:/i, '' ).trim();

			if ( baseName ) {
				names.push( 'Faculty of ' + baseName );
				if ( !/^the\s+/i.test( baseName ) ) {
					names.push( 'Faculty of the ' + baseName );
				}
			}
		} );

		return uniqueIds( names );
	}

	function shouldLoadEmployerFacultyCategories() {
		return claimValueIds( state.entity, CONFIG.properties.occupation )
			.slice( 0, CONFIG.maxOccupationCount )
			.some( function ( qid ) {
				return occupationNameEntries( qid ).some( function ( entry ) {
					return /^university teachers$/i.test( entry.name );
				} );
			} );
	}

	function suggestedDisambiguatedTitleForEntity( entity, fallbackQid ) {
		var label = englishLabel( entity ) ||
			state.originalPersonCategory.replace( /^Category:/i, '' );
		var occupation = firstOccupationDisambiguationName( entity ) || fallbackQid;
		var years = disambiguationYearSuffixForEntity( entity );

		return normalizeCategoryTitle(
			label + ' (' + occupation + ( years ? ', ' + years : '' ) + ')'
		);
	}

	function firstOccupationDisambiguationName( entity ) {
		return claimValueIds( entity, CONFIG.properties.occupation )
			.map( occupationDisambiguationName )
			.filter( Boolean )[ 0 ] || null;
	}

	function entityDisambiguationOptions( entity, baseTitle ) {
		var baseName = normalizeCategoryTitle( baseTitle ).replace( /^Category:/i, '' );
		var yearSuffix = disambiguationYearSuffixForEntity( entity );
		var options = [];
		var yearOptions = [];

		uniqueIds(
			claimValueIds( entity, CONFIG.properties.occupation )
				.slice( 0, CONFIG.maxOccupationCount )
				.map( occupationDisambiguationName )
				.filter( Boolean )
		).sort( compareDisambiguationLabels ).forEach( function ( occupation ) {
			options.push( disambiguationOption(
				'Category:' + baseName + ' (' + occupation + ')',
				occupation,
				'occupation'
			) );
		} );

		uniqueIds(
			claimValueIds( entity, CONFIG.properties.occupation )
				.slice( 0, CONFIG.maxOccupationCount )
				.map( occupationDisambiguationName )
				.filter( Boolean )
		).forEach( function ( occupation ) {
			if ( yearSuffix ) {
				yearOptions.push( disambiguationOption(
					'Category:' + baseName + ' (' + occupation + ', ' + yearSuffix + ')',
					occupation + ', ' + yearSuffix,
					'occupation-year'
				) );
			}
		} );

		options = options.concat( yearOptions );

		return uniqueOptionsByTitle( options );
	}

	function checkCommonsPages( titles ) {
		var deferred = $.Deferred();
		var result = {};
		var batches = [];
		var promises;

		titles = uniqueIds( titles.filter( Boolean ) );

		if ( !titles.length ) {
			return deferred.resolve( result ).promise();
		}

		while ( titles.length ) {
			batches.push( titles.splice( 0, 50 ) );
		}

		promises = batches.map( function ( batch ) {
			return state.commonsApi.get( {
				action: 'query',
				prop: 'info|pageprops',
				titles: batch.join( '|' ),
				formatversion: 2,
				format: 'json'
			} ).then( function ( data ) {
				var normalized = {};

				( data.query && data.query.normalized || [] ).forEach( function ( item ) {
					normalized[ item.to ] = item.from;
				} );
				( data.query && data.query.pages || [] ).forEach( function ( page ) {
					if ( page && page.missing === undefined ) {
						result[ page.title ] = {
							exists: true,
							wikibaseItem: page.pageprops && page.pageprops.wikibase_item || null,
							redirect: !!page.redirect
						};
						if ( normalized[ page.title ] ) {
							result[ normalized[ page.title ] ] = result[ page.title ];
						}
					}
				} );
			}, function () {} );
		} );

		$.when.apply( $, promises ).then( function () {
			populateMissingCommonsWikibaseItems( result ).then( function () {
				deferred.resolve( result );
			} );
		} );

		return deferred.promise();
	}

	function populateMissingCommonsWikibaseItems( pages ) {
		var titles = Object.keys( pages ).filter( function ( title ) {
			return pages[ title ].exists && !pages[ title ].wikibaseItem;
		} );
		var batches = [];
		var promises;

		if ( !titles.length ) {
			return $.Deferred().resolve().promise();
		}

		while ( titles.length ) {
			batches.push( titles.splice( 0, 50 ) );
		}

		promises = batches.map( function ( batch ) {
			var pagesByTitle = {};

			batch.forEach( function ( title ) {
				pagesByTitle[ normalizeCategoryTitle( title ) ] = pages[ title ];
			} );

			return state.localApi.get( {
				action: 'wbgetentities',
				sites: 'commonswiki',
				titles: batch.join( '|' ),
				props: 'sitelinks',
				redirects: 'yes',
				format: 'json'
			} ).then( function ( data ) {
				Object.keys( data.entities || {} ).forEach( function ( id ) {
					var entity = data.entities[ id ];
					var title = commonsSitelinkTitle( entity );
					var page = title && pagesByTitle[ normalizeCategoryTitle( title ) ];

					if ( page && !entity.missing ) {
						page.wikibaseItem = entity.id || id;
					}
				} );
			}, function () {} );
		} );

		return $.when.apply( $, promises );
	}

	function checkCandidateCommonsPages() {
		var checkedTitles = {};
		var result = {};
		var firstPass = state.candidates.filter( shouldCheckCandidateInFirstPass );

		return checkCandidateBatch( firstPass, checkedTitles, result ).then( function () {
			var directMatches = directOccupationMatchMap( state.candidates );
			var foundCountrySpecificCategory = countrySpecificCandidateExists( state.candidates );

			state.candidates = state.candidates.filter( function ( candidate ) {
				return !candidateCanBeSkippedAfterDirectCountryMatch( candidate, directMatches );
			} );

			var remaining = state.candidates.filter( function ( candidate ) {
				var title = candidateCategoryTitle( candidate );

				if ( checkedTitles[ title ] ) {
					return false;
				}

				return !candidateCanBeSkippedAfterDirectCountryMatch( candidate, directMatches );
			} );

			return resolveWithTimeoutIfNeeded(
				checkCandidateBatch( remaining, checkedTitles, result ),
				foundCountrySpecificCategory,
				result
			);
		} ).then( function () {
			return result;
		} );
	}

	function countrySpecificCandidateExists( candidates ) {
		return candidates.some( function ( candidate ) {
			return candidate.exists && /\|from\|/.test( candidate.groupId );
		} );
	}

	function resolveWithTimeoutIfNeeded( promise, useTimeout, fallbackResult ) {
		var deferred;
		var settled = false;

		if ( !useTimeout ) {
			return promise;
		}

		deferred = $.Deferred();

		window.setTimeout( function () {
			if ( !settled ) {
				settled = true;
				deferred.resolve( fallbackResult );
			}
		}, CONFIG.lateCandidateCheckTimeout );

		promise.then( function ( result ) {
			if ( !settled ) {
				settled = true;
				deferred.resolve( result );
			}
		}, function () {
			if ( !settled ) {
				settled = true;
				deferred.resolve( fallbackResult );
			}
		} );

		return deferred.promise();
	}

	function shouldCheckCandidateInFirstPass( candidate ) {
		return !candidate.isByName &&
			!isGenericOccupationFallback( candidate ) &&
			( /\|from\|/.test( candidate.groupId ) || candidate.stage === 'faculty' );
	}

	function checkCandidateBatch( candidates, checkedTitles, result ) {
		var titles = candidates.map( function ( candidate ) {
			return candidateCategoryTitle( candidate );
		} ).filter( function ( title ) {
			if ( checkedTitles[ title ] ) {
				return false;
			}
			checkedTitles[ title ] = true;
			return true;
		} );

		return checkCommonsPages( titles ).then( function ( pages ) {
			$.extend( result, pages );
			applyCandidateExistence( pages );
			return result;
		} );
	}

	function applyCandidateExistence( pages ) {
		state.candidates.forEach( function ( candidate ) {
			var page = pages[ candidateCategoryTitle( candidate ) ];

			if ( page ) {
				candidate.exists = !!page.exists;
			}
		} );
	}

	function makeCategoryCandidates() {
		return generateCategoryCandidates( buildCategoryCandidateContext() );
	}

	function buildCategoryCandidateContext() {
		return {
			occupationEntries: [].concat.apply( [],
			claimValueIds( state.entity, CONFIG.properties.occupation )
				.slice( 0, CONFIG.maxOccupationCount )
				.map( occupationNameEntries )
				.concat( claimValueIds( state.entity, CONFIG.properties.fieldOfWork )
					.slice( 0, CONFIG.maxOccupationCount )
					.map( fieldOfWorkCategoryEntries )
				)
			).filter( function ( entry ) {
				return entry && entry.name;
			} ),
			countries: claimValueIds( state.entity, CONFIG.properties.countryOfCitizenship )
				.slice( 0, CONFIG.maxCountryCount )
				.map( countryPhrase )
				.filter( Boolean ),
			gender: genderWord(),
			century: activeCentury(),
			facultyCategoryNames: state.facultyCategoryNames.slice()
		};
	}

	function generateCategoryCandidates( context ) {
		var candidates = [];

		context.occupationEntries.forEach( function ( entry ) {
			var occupation = entry.name;
			var genderedOccupation = genderedOccupationCategory( occupation, context.gender );

			context.countries.forEach( function ( country ) {
				var groupId = occupation + '|from|' + country;
				var metadata = {
					occupation: occupation,
					sourceOccupation: entry.sourceOccupation,
					isFallback: !!entry.isFallback
				};

				addCandidateWithByName( candidates, occupation + ' from ' + country, 'occupation + country', groupId, metadata );
				addCandidateWithByName( candidates, genderedOccupation && (
					genderedOccupation + ' from ' + country
				), 'gendered occupation + country', groupId, $.extend( {}, metadata, {
					isGenderedOccupation: true
				} ) );
				addCandidateWithByName( candidates, context.gender && !genderedOccupation && (
					context.gender + ' ' + occupation + ' from ' + country
				), 'gender + occupation + country', groupId, metadata );
				addCandidateWithByName( candidates, context.century && (
					context.century + ' ' + occupation + ' from ' + country
				), 'century + occupation + country', groupId, metadata );
				addCandidateWithByName( candidates, context.century && genderedOccupation && (
					context.century + ' ' + genderedOccupation + ' from ' + country
				), 'century + gendered occupation + country', groupId, $.extend( {}, metadata, {
					isGenderedOccupation: true
				} ) );
				addCandidateWithByName( candidates, context.century && context.gender && !genderedOccupation && (
					context.century + ' ' + context.gender + ' ' + occupation + ' from ' + country
				), 'century + gender + occupation + country', groupId, metadata );
			} );
			addCandidate( candidates, occupation, 'occupation', occupation + '|occupation', {
				occupation: occupation,
				sourceOccupation: entry.sourceOccupation,
				isFallback: !!entry.isFallback
			} );
		} );

		context.facultyCategoryNames.forEach( function ( name ) {
			addCandidate( candidates, name, 'employer faculty', 'faculty|' + name, {
				occupation: name,
				sourceOccupation: name,
				isFallback: false
			} );
		} );

		return candidates;
	}

	function addCandidateWithByName( candidates, name, reason, groupId, metadata ) {
		addCandidate( candidates, name, reason, groupId, metadata );
		addCandidate(
			candidates,
			name && name + ' by name',
			reason + ' + by name',
			groupId,
			$.extend( {}, metadata, { isByName: true } )
		);
	}

	function addCandidate( candidates, name, reason, groupId, metadata ) {
		if ( !name ) {
			return;
		}

		name = name.replace( /\s+/g, ' ' ).trim();
		if (
			metadata &&
			metadata.isFallback &&
			isDiscardedGenericOccupationName( metadata.occupation || name )
		) {
			return;
		}

		if ( !name || candidates.some( function ( candidate ) {
			return candidate.name === name;
		} ) ) {
			return;
		}

		candidates.push( {
			name: name,
			reason: reason,
			groupId: groupId || name,
			depth: categoryTreeDepth( name, reason ),
			stage: candidateStage( reason, metadata ),
			occupation: metadata && metadata.occupation || '',
			sourceOccupation: metadata && metadata.sourceOccupation || '',
			isFallback: !!( metadata && metadata.isFallback ),
			isGenderedOccupation: !!( metadata && metadata.isGenderedOccupation ),
			isByName: !!( metadata && metadata.isByName ),
			exists: false
		} );
	}

	function candidateStage( reason, metadata ) {
		if ( metadata && metadata.isFallback ) {
			return 'fallback';
		}
		if ( reason === 'employer faculty' ) {
			return 'faculty';
		}
		if ( /\+ country/.test( reason ) ) {
			return 'country';
		}
		return 'occupation';
	}

	function firstExistingCandidate( candidates ) {
		return bestCategoryCandidate( candidates.filter( function ( candidate ) {
			return candidate.exists;
		} ).filter( function ( candidate ) {
			return !candidateCoveredByDirectOccupation( candidate, candidates ) &&
				!genericFallbackCoveredBySpecificFallback( candidate, candidates );
		} ) ) || candidates[ 0 ] || null;
	}

	function bestCategoryCandidate( candidates ) {
		return candidates.slice().sort( function ( left, right ) {
			return right.depth - left.depth ||
				( right.isGenderedOccupation ? 1 : 0 ) -
				( left.isGenderedOccupation ? 1 : 0 ) ||
				( isGenericOccupationFallback( left ) ? 1 : 0 ) -
				( isGenericOccupationFallback( right ) ? 1 : 0 ) ||
				( isByNameCandidate( left ) ? 1 : 0 ) -
				( isByNameCandidate( right ) ? 1 : 0 );
		} )[ 0 ] || null;
	}

	function categoryTreeDepth( name, reason ) {
		var depth = 0;

		if ( /\bfrom\b/i.test( name ) ) {
			depth += 10;
		}
		if ( /\bmale\b|\bfemale\b/i.test( name ) ) {
			depth += 1;
		}
		if ( /\d+(?:st|nd|rd|th)-century/i.test( name ) ) {
			depth += 1;
		}
		if ( /\|occupation$/.test( reason || '' ) ) {
			depth -= 10;
		}

		return depth;
	}

	function isByNameCandidate( candidate ) {
		return /\bby name$/i.test( candidate && candidate.name || '' );
	}

	function isGenericOccupationFallback( candidate ) {
		return !!(
			candidate &&
			candidate.isFallback &&
			isDiscardedGenericOccupationName( candidate.occupation || candidate.name || '' )
		);
	}

	function isDiscardedGenericOccupationName( name ) {
		return /^(?:workers|professions|professionals|people by occupation)$/i.test(
			String( name || '' ).trim()
		);
	}

	function genericFallbackCoveredBySpecificFallback( candidate, candidates ) {
		if ( !isGenericOccupationFallback( candidate ) ) {
			return false;
		}

		return candidates.some( function ( other ) {
			return other !== candidate &&
				other.exists &&
				!isGenericOccupationFallback( other ) &&
				/\|from\|/.test( other.groupId );
		} );
	}

	function makeDisambiguationOptions() {
		var baseName = state.originalPersonCategory.replace( /^Category:/i, '' );
		var lifeYears = disambiguationLifeYears();
		var options = [];
		var occupationNames = uniqueIds(
			claimValueIds( state.entity, CONFIG.properties.occupation )
				.slice( 0, CONFIG.maxOccupationCount )
				.map( occupationDisambiguationName )
				.filter( Boolean )
		);

		occupationNames.sort( compareDisambiguationLabels ).forEach( function ( occupation ) {
			options.push( disambiguationOption(
				'Category:' + baseName + ' (' + occupation + ')',
				occupation,
				'occupation'
			) );
		} );

		if ( !occupationNames.length && lifeYears ) {
			options.push( disambiguationOption(
				'Category:' + baseName + ' (' + lifeYears + ')',
				lifeYears,
				'life-years'
			) );
		}

		return uniqueOptionsByTitle( options );
	}

	function compareDisambiguationLabels( left, right ) {
		return right.split( /\s+/ ).length - left.split( /\s+/ ).length ||
			right.length - left.length ||
			left.localeCompare( right );
	}

	function currentItemYearDisambiguationOptions() {
		var baseName = state.originalPersonCategory.replace( /^Category:/i, '' );
		var yearSuffix = disambiguationYearSuffix();
		var options = [];
		var selectedOccupation = selectedCurrentOccupationDisambiguationLabel();
		var occupationNames;

		if ( !yearSuffix ) {
			return options;
		}

		occupationNames = uniqueIds(
			claimValueIds( state.entity, CONFIG.properties.occupation )
				.slice( 0, CONFIG.maxOccupationCount )
				.map( occupationDisambiguationName )
				.filter( Boolean )
		).sort( compareDisambiguationLabels );

		if ( selectedOccupation ) {
			occupationNames = [ selectedOccupation ].concat( occupationNames.filter( function ( occupation ) {
				return occupation !== selectedOccupation;
			} ) );
		}

		occupationNames.forEach( function ( occupation ) {
			options.push( disambiguationOption(
				'Category:' + baseName + ' (' + occupation + ', ' + yearSuffix + ')',
				occupation + ', ' + yearSuffix,
				'occupation-year'
			) );
		} );

		return uniqueOptionsByTitle( options );
	}

	function selectedCurrentOccupationDisambiguationLabel() {
		var option = state.selectedCurrentItemDisambiguationOption ||
			state.selectedDisambiguationOption;

		if ( option && option.source === 'occupation' ) {
			return option.occupation;
		}

		return '';
	}

	function disambiguationYearSuffix() {
		var birthYear = yearFromTimeClaim( CONFIG.properties.dateOfBirth );
		var deathYear = yearFromTimeClaim( CONFIG.properties.dateOfDeath );

		if ( birthYear && deathYear ) {
			return birthYear + '-' + deathYear;
		}
		if ( birthYear ) {
			return 'born ' + birthYear;
		}

		return '';
	}

	function disambiguationYearSuffixForEntity( entity ) {
		var birthYear = yearFromEntityTimeClaim( entity, CONFIG.properties.dateOfBirth );
		var deathYear = yearFromEntityTimeClaim( entity, CONFIG.properties.dateOfDeath );

		if ( birthYear && deathYear ) {
			return birthYear + '-' + deathYear;
		}
		if ( birthYear ) {
			return 'born ' + birthYear;
		}

		return '';
	}

	function disambiguationLifeYears() {
		var birthYear = yearFromTimeClaim( CONFIG.properties.dateOfBirth );
		var deathYear = yearFromTimeClaim( CONFIG.properties.dateOfDeath );

		return birthYear && deathYear ? birthYear + '-' + deathYear : '';
	}

	function addDisambiguationOption( title, occupation, source ) {
		title = normalizeCategoryTitle( title );

		if ( !state.disambiguationOptions.some( function ( option ) {
			return option.title === title;
		} ) ) {
			state.disambiguationOptions.push( disambiguationOption( title, occupation, source ) );
		}
	}

	function disambiguationOption( title, occupation, source ) {
		return {
			occupation: occupation,
			source: source,
			title: normalizeCategoryTitle( title ),
			exists: false,
			wikibaseItem: null,
			redirect: false
		};
	}

	function searchExistingDisambiguationCategories() {
		if ( !state.disambiguationNeeded && !baseCategoryNeedsDisambiguationPage() ) {
			return $.Deferred().resolve( [] ).promise();
		}

		return searchSuffixedCategories( state.originalPersonCategory );
	}

	function searchSuffixedCategories( baseTitle ) {
		var deferred = $.Deferred();
		var baseName = normalizeCategoryTitle( baseTitle ).replace( /^Category:/i, '' );
		var escapedBaseName = baseName.replace( /"/g, '\\"' );
		var pattern = new RegExp(
			'^Category:' + escapeRegExp( baseName ) + ' \\([^)]+\\)$',
			'i'
		);

		state.commonsApi.get( {
			action: 'query',
			list: 'search',
			srnamespace: 14,
			srsearch: 'intitle:"' + escapedBaseName + ' ("',
			srlimit: 20,
			format: 'json'
		} ).then( function ( data ) {
			deferred.resolve(
				( data.query && data.query.search || [] )
					.map( function ( page ) {
						return page.title;
					} )
					.filter( function ( title ) {
						return pattern.test( title );
					} )
			);
		}, function () {
			deferred.resolve( [] );
		} );

		return deferred.promise();
	}

	function occupationDisambiguationName( qid ) {
		var entity = state.relatedEntities[ qid ];
		var name = CONFIG.occupationDisambiguationByQid[ qid ] ||
			englishLabel( entity ) ||
			qid;

		name = lcfirst( String( name ).replace( /^Category:/i, '' ).replace( /\s+/g, ' ' ).trim() );
		return isSkippedDisambiguationOccupation( name ) ? '' : name;
	}

	function isSkippedDisambiguationOccupation( name ) {
		return /^university teachers?$/i.test( String( name || '' ).trim() );
	}

	function firstAvailableDisambiguationOption() {
		return firstAvailableOccupationDisambiguationOption() ||
			firstConflictingOccupationDisambiguationOption() ||
			primaryDisambiguationOptions().filter( function ( option ) {
				return !option.exists || option.wikibaseItem === mw.config.get( 'wbEntityId' );
			} )[ 0 ] || primaryDisambiguationOptions()[ 0 ] || null;
	}

	function isYearDisambiguationOption( option ) {
		return !!(
			option &&
			( option.source === 'occupation-year' ||
				option.source === 'life-years' ||
				/,\s*(?:born\s+)?\d{4}(?:-\d{4})?\)$/i.test( option.title || '' ) ||
				/\(\d{4}-\d{4}\)$/i.test( option.title || '' )
			)
		);
	}

	function primaryDisambiguationOptions() {
		return state.disambiguationOptions.filter( function ( option ) {
			return !isYearDisambiguationOption( option );
		} );
	}

	function firstAvailableOccupationDisambiguationOption() {
		return state.disambiguationOptions.filter( function ( option ) {
			return option.source === 'occupation' &&
				( !option.exists || option.wikibaseItem === mw.config.get( 'wbEntityId' ) );
		} )[ 0 ] || null;
	}

	function firstConflictingOccupationDisambiguationOption() {
		return state.disambiguationOptions.filter( function ( option ) {
			return option.source === 'occupation' &&
				option.exists &&
				option.wikibaseItem &&
				option.wikibaseItem !== mw.config.get( 'wbEntityId' );
		} )[ 0 ] || null;
	}

	function preferredAvailableYearDisambiguationOption() {
		var existingOccupations = {};

		state.disambiguationOptions.forEach( function ( option ) {
			if ( option.exists && option.source === 'occupation' ) {
				existingOccupations[ option.occupation ] = true;
			}
		} );

		return state.disambiguationOptions.filter( function ( option ) {
			return option.source === 'occupation-year' &&
				existingOccupations[ option.occupation.replace( /,\s*(?:born\s+)?\d{4}(?:-\d{4})?$/, '' ) ] &&
				( !option.exists || option.wikibaseItem === mw.config.get( 'wbEntityId' ) );
		} )[ 0 ] || null;
	}

	function selectDisambiguationOption( option ) {
		if ( !option ) {
			return;
		}

		state.selectedDisambiguationOption = option;
		state.personCategory = option.title;
		state.personCategoryExists = option.exists;
		state.personCategoryRedirect = !!option.redirect;
		state.personCategoryWikibaseItem = option.wikibaseItem;
	}

	function getPersonCategoryTitle() {
		var commonsCategory = getStringClaim( state.entity, CONFIG.properties.commonsCategory );

		if ( commonsCategory ) {
			return normalizeCategoryTitle( commonsCategory );
		}

		if ( state.entity.sitelinks &&
			state.entity.sitelinks.commonswiki &&
			/^Category:/i.test( state.entity.sitelinks.commonswiki.title )
		) {
			return state.entity.sitelinks.commonswiki.title;
		}

		return normalizeCategoryTitle( englishLabel( state.entity ) || mw.config.get( 'wbEntityId' ) );
	}

	function normalizeCategoryTitle( title ) {
		title = String( title || '' ).replace( /^Category:/i, '' ).trim();
		return 'Category:' + ucfirst( title );
	}

	function occupationNames( qid ) {
		return occupationNameEntries( qid ).map( function ( entry ) {
			return entry.name;
		} );
	}

	function occupationNameEntries( qid ) {
		var entries = [];
		var directName = occupationName( qid );

		addOccupationEntry( entries, directName, directName, false );
		occupationParentCategoryNames( qid, CONFIG.properties.subclassOf ).forEach( function ( name ) {
			addOccupationEntry( entries, name, directName, true );
		} );
		occupationParentCategoryNames( qid, CONFIG.properties.instanceOf ).forEach( function ( name ) {
			addOccupationEntry( entries, name, directName, true );
		} );

		return entries;
	}

	function fieldOfWorkCategoryEntries( qid ) {
		return fieldOfWorkCategoryNames( qid ).map( function ( name ) {
			return {
				name: name,
				sourceOccupation: name,
				isFallback: false
			};
		} );
	}

	function addOccupationEntry( entries, name, sourceOccupation, isFallback ) {
		if ( name && !entries.some( function ( entry ) {
			return entry.name === name;
		} ) ) {
			entries.push( {
				name: name,
				sourceOccupation: sourceOccupation,
				isFallback: !!isFallback
			} );
		}
	}

	function addOccupationName( names, name ) {
		if ( name && names.indexOf( name ) === -1 ) {
			names.push( name );
		}
	}

	function occupationParentCategoryNames( qid, property ) {
		var entity = state.relatedEntities[ qid ];

		return claimValueIds( entity, property ).map( function ( parentQid ) {
			var parentEntity = state.relatedEntities[ parentQid ];
			var parentName = CONFIG.occupationCategoryByRelatedQid[ parentQid ] ||
				englishLabel( parentEntity );

			return parentName ? normalizeOccupationCategory( pluralize( parentName ) ) : '';
		} ).filter( Boolean );
	}

	function fieldOfWorkCategoryNames( qid ) {
		return [ CONFIG.occupationCategoryByRelatedQid[ qid ] || '' ].filter( Boolean );
	}

	function occupationName( qid ) {
		var entity = state.relatedEntities[ qid ];
		var category = getStringClaim( entity, CONFIG.properties.commonsCategory );
		var name = CONFIG.occupationCategoryByQid[ qid ] ||
			category ||
			englishLabel( entity ) ||
			qid;

		name = name.replace( /^Category:/i, '' ).trim();
		name = normalizeOccupationCategory( pluralize( name ) );
		return lcfirst( name );
	}

	function normalizeOccupationCategory( name ) {
		name = name.replace( /\s+/g, ' ' ).trim();
		return CONFIG.occupationCategoryReplacements[ name ] || name;
	}

	function countryPhrase( qid ) {
		var entity = state.relatedEntities[ qid ];
		var category = getStringClaim( entity, CONFIG.properties.commonsCategory );
		var name = CONFIG.countryPhraseByQid[ qid ] ||
			getEnglishMonolingualTextClaim( entity, CONFIG.properties.shortName ) ||
			category ||
			englishLabel( entity ) ||
			qid;

		name = name.replace( /^Category:/i, '' ).trim();

		if ( CONFIG.countryPhraseByQid[ qid ] ) {
			return CONFIG.countryPhraseByQid[ qid ];
		}

		return normalizeCountryPhrase( name );
	}

	function normalizeCountryPhrase( name ) {
		name = name.replace( /\s+/g, ' ' ).trim();

		if ( CONFIG.countryNameReplacements[ name ] ) {
			return CONFIG.countryNameReplacements[ name ];
		}

		if ( /^United\s/.test( name ) ) {
			return addDefiniteArticle( name );
		}

		if ( /^(Bahamas|Comoros|Gambia|Maldives|Philippines|Seychelles)$/.test( name ) ) {
			return addDefiniteArticle( name );
		}

		if ( /^(Central African|Dominican|Czech) Republic$/.test( name ) ) {
			return addDefiniteArticle( name );
		}

		if ( /^(Marshall|Solomon) Islands$/.test( name ) ) {
			return addDefiniteArticle( name );
		}

		return name;
	}

	function addDefiniteArticle( name ) {
		return /^the\s/i.test( name ) ? name : 'the ' + name;
	}

	function genderWord() {
		var genderIds = claimValueIds( state.entity, CONFIG.properties.sexOrGender );

		if ( $.inArray( CONFIG.items.male, genderIds ) !== -1 ) {
			return 'male';
		}
		if ( $.inArray( CONFIG.items.female, genderIds ) !== -1 ) {
			return 'female';
		}

		return '';
	}

	function genderedOccupationCategory( occupation, gender ) {
		if ( /^businesspeople$/i.test( occupation ) ) {
			if ( gender === 'male' ) {
				return 'businessmen';
			}
			if ( gender === 'female' ) {
				return 'businesswomen';
			}
		}

		return '';
	}

	function activeCentury() {
		var birthYear = yearFromTimeClaim( CONFIG.properties.dateOfBirth );
		var deathYear = yearFromTimeClaim( CONFIG.properties.dateOfDeath );
		var currentYear = new Date().getFullYear();
		var basisYear;

		if ( deathYear ) {
			basisYear = deathYear;
		} else if ( birthYear ) {
			basisYear = currentYear - birthYear > 120 ? birthYear + 60 : currentYear;
		}

		return basisYear ? ordinal( Math.ceil( basisYear / 100 ) ) + '-century' : '';
	}

	function yearFromTimeClaim( property ) {
		var claim = bestClaims( state.entity, property )[ 0 ];

		return yearFromClaim( claim );
	}

	function yearFromEntityTimeClaim( entity, property ) {
		var claim = bestClaims( entity, property )[ 0 ];

		return yearFromClaim( claim );
	}

	function yearFromClaim( claim ) {
		var value = claim &&
			claim.mainsnak &&
			claim.mainsnak.datavalue &&
			claim.mainsnak.datavalue.value &&
			claim.mainsnak.datavalue.value.time;
		var match = value && String( value ).match( /^([+-]\d{4,})/ );

		return match ? Math.abs( Number( match[ 1 ] ) ) : null;
	}

	function ordinal( number ) {
		var suffix = 'th';

		if ( number % 100 < 11 || number % 100 > 13 ) {
			if ( number % 10 === 1 ) {
				suffix = 'st';
			} else if ( number % 10 === 2 ) {
				suffix = 'nd';
			} else if ( number % 10 === 3 ) {
				suffix = 'rd';
			}
		}

		return number + suffix;
	}

	function pluralize( name ) {
		if ( /person$/i.test( name ) ) {
			return name.replace( /person$/i, function ( match ) {
				return /^[A-Z]/.test( match ) ? 'People' : 'people';
			} );
		}
		if ( /people$/i.test( name ) ) {
			return name;
		}
		if ( /s$/i.test( name ) ) {
			return name;
		}
		if ( /ist$/i.test( name ) || /ian$/i.test( name ) || /er$/i.test( name ) ) {
			return name + 's';
		}
		if ( /y$/i.test( name ) ) {
			return name.replace( /y$/i, 'ies' );
		}

		return name + 's';
	}

	function lcfirst( text ) {
		if ( !text ) {
			return text;
		}
		return text.charAt( 0 ).toLowerCase() + text.slice( 1 );
	}

	function ucfirst( text ) {
		if ( !text ) {
			return text;
		}
		return text.charAt( 0 ).toUpperCase() + text.slice( 1 );
	}

	function escapeRegExp( text ) {
		return String( text ).replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
	}

	function renderPanel( message ) {
		var $panel = $( '#CatapultPanel' );
		var $body;

		if ( !$panel.length ) {
			$panel = $( '<div>', {
				id: 'CatapultPanel'
			} ).css( {
				background: '#fff',
				border: '1px solid #a2a9b1',
				boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
				boxSizing: 'border-box',
				display: 'flex',
				flexDirection: 'column',
				maxHeight: 'calc(100vh - 80px)',
				maxWidth: '720px',
				position: 'fixed',
				right: '16px',
				top: '64px',
				zIndex: 1000
			} ).appendTo( document.body );
		}

		$panel.empty().append(
			$( '<div>' ).css( {
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				borderBottom: '1px solid #eaecf0',
				flex: '0 0 auto',
				gap: '12px',
				padding: '10px 12px'
			} ).append(
				$( '<div>' ).css( {
					alignItems: 'center',
					display: 'flex',
					gap: '8px',
					minWidth: 0
				} ).append(
					$( '<img>', {
						alt: '',
						src: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Commons-logo.svg'
					} ).css( {
						flex: '0 0 auto',
						height: '28px',
						width: '21px'
					} ),
					$( '<strong>' ).css( {
						fontSize: '1.05em',
						lineHeight: '1.2'
					} ).text( 'New category on Wikimedia Commons' )
				),
				makeButton( {
					label: '',
					icon: 'close',
					framed: false,
					title: 'Close'
				}, function () {
					$panel.remove();
				} )
			)
		);

		$body = $( '<div>', {
			id: 'CatapultPanelBody'
		} ).css( {
			flex: '1 1 auto',
			minHeight: 0,
			overflowY: 'auto',
			padding: '12px'
		} ).appendTo( $panel );

		$body.append( $( '<p>' ).css( {
			marginTop: 0
		} ).append( message ) );

		$panel.append( buildVersionFooter() );
		applyPanelResponsiveStyles( $panel );
	}

	function buildVersionFooter() {
		return $( '<div>', {
			id: 'CatapultVersion'
		} ).css( {
			color: '#72777d',
			flex: '0 0 auto',
			fontSize: '10px',
			lineHeight: '1',
			padding: '0 8px 5px',
			textAlign: 'right'
		} ).text( CONFIG.version );
	}

	function applyPanelResponsiveStyles( $panel ) {
		if ( $( window ).width() <= 700 ) {
			$panel.css( {
				bottom: '8px',
				left: '8px',
				maxHeight: 'calc(100vh - 16px)',
				maxWidth: 'none',
				right: '8px',
				top: '8px',
				width: 'auto'
			} );
			return;
		}

		$panel.css( {
			bottom: '',
			left: '',
			maxHeight: 'calc(100vh - 80px)',
			maxWidth: '720px',
			right: '16px',
			top: '64px',
			width: ''
		} );
	}

	function sentence() {
		return $( '<span>' ).append.apply(
			$( '<span>' ),
			Array.prototype.slice.call( arguments )
		);
	}

	function commonsCategoryLink( title, label ) {
		return $( '<a>', {
			href: 'https://commons.wikimedia.org/wiki/' + mw.util.wikiUrlencode( title ),
			target: '_blank',
			rel: 'noopener',
			text: label || title
		} );
	}

	function wikidataItemLink( id, entity ) {
		return $( '<a>', {
			href: 'https://www.wikidata.org/wiki/' + id,
			target: '_blank',
			rel: 'noopener',
			text: itemDisplayText( id, entity )
		} );
	}

	function wikidataItemLabelLink( id, entity ) {
		var label = englishLabel( entity );

		return $( '<a>', {
			href: 'https://www.wikidata.org/wiki/' + id,
			target: '_blank',
			rel: 'noopener',
			text: label ? label + ' (' + id + ')' : id
		} );
	}

	function wikidataItemLinkWithText( id, text ) {
		return $( '<a>', {
			href: 'https://www.wikidata.org/wiki/' + id,
			target: '_blank',
			rel: 'noopener',
			text: text
		} );
	}

	function itemDisplayText( id, entity ) {
		var label = englishLabel( entity );
		var description = englishDescription( entity );

		return ( label ? label + ' (' + id + ')' : id ) +
			( description ? ' - ' + description : '' );
	}

	function renderProgressPanel( title, steps ) {
		var $panel;
		var $list;
		var progress;

		state.progressTitle = title || state.progressTitle || 'Working...';
		state.progressSteps = steps || state.progressSteps || [];
		renderPanel( state.progressTitle );
		$panel = $( '#CatapultPanelBody' );
		$list = $( '<ul>' ).css( {
			marginBottom: 0
		} );

		state.progressSteps.forEach( function ( step ) {
			$list.append(
				$( '<li>' ).text(
					step.label + ( step.status ? ' - ' + step.status : '' )
				)
			);
		} );

		if ( window.OO && OO.ui && OO.ui.ProgressBarWidget ) {
			progress = new OO.ui.ProgressBarWidget( {
				progress: progressPercent()
			} );
			$panel.append( progress.$element.css( {
				marginBottom: '10px'
			} ) );
		} else {
			$panel.append(
				$( '<progress>', {
					max: 100,
					value: progressPercent()
				} ).css( {
					width: '100%',
					marginBottom: '10px'
				} )
			);
		}

		$panel.append( $list );
	}

	function setProgressStep( index, status ) {
		if ( state.progressSteps[ index ] ) {
			state.progressSteps[ index ].status = status;
		}
		renderProgressPanel( state.progressTitle, state.progressSteps );
	}

	function progressPercent() {
		var done = state.progressSteps.filter( function ( step ) {
			return step.status === 'done';
		} ).length;

		if ( !state.progressSteps.length ) {
			return 0;
		}

		return Math.round( done / state.progressSteps.length * 100 );
	}

	function findMultilingualSitesGroup() {
		var selectors = [
			'#sitelinks-special',
			'[id*="sitelinks-special"]',
			'[data-wb-sitelinks-group="special"]'
		];
		var $target = $( selectors.join( ',' ) ).first();

		if ( $target.length ) {
			return $target;
		}

		return $( '.wikibase-sitelinkgroupview, .wikibase-sitelinklistview, .wikibase-listview' )
			.filter( function () {
				return /multilingual sites/i.test( $( this ).text() );
			} )
			.first();
	}

	function renderSuggestions() {
		var $panel = $( '#CatapultPanelBody' );
		var $shell;
		var categoryText = buildCategoryText();
		var mode = currentWorkflowMode();

		renderPanel(
			mode === 'link-or-disambiguate-existing' || mode === 'target-conflict-disambiguate' || mode === 'target-conflict-merge' ?
				'' :
				panelStatusMessage()
		);

		$panel = $( '#CatapultPanelBody' );
		$shell = $( '#CatapultPanel' );
		if ( mode === 'linked-base-disambiguate' || mode === 'linked-base-merge' ) {
			$panel.append( buildLinkedExistingCategoryReview() );
		}
		if ( baseCategoryNeedsDisambiguationPage() ) {
			$panel.append( buildExistingDisambiguationCategoryReview() );
		}
		if ( mode === 'target-conflict-disambiguate' || mode === 'target-conflict-merge' ) {
			$panel.append( buildTargetCategoryConflictReview() );
		}
		if ( mode === 'link-or-disambiguate-existing' || mode === 'disambiguate-unlinked-existing' ) {
			$panel.append( buildUnlinkedExistingCategoryReview() );
		}
		if ( mode === 'open-existing' ) {
			$panel.append( buildExistingCategoryThumbnailPreview() );
		}
		$panel.append(
			shouldShowParentCategoryCheckboxes() ? buildParentCategoryCheckboxes() : $( '<span>' ),
			shouldShowCategoryTextInput() ? buildCategoryTextInput( categoryText ) : $( '<span>' ),
			mode === 'open-existing' ? $( '<span>' ) : buildCandidateDebugPanel()
		);
		$( '#CatapultVersion' ).detach();
		$shell.append(
			buildPanelActions( mode ),
			buildVersionFooter()
		);
	}

	function buildPanelActions( mode ) {
		return $( '<div>', {
			id: 'CatapultPanelActions'
		} ).css( {
			alignItems: 'center',
			background: '#fff',
			borderTop: '1px solid #eaecf0',
			display: 'flex',
			flex: '0 0 auto',
			gap: '8px',
			justifyContent: 'flex-end',
			padding: '8px 12px'
		} ).append(
			makeButton( {
				id: 'CatapultPrimaryAction',
				label: primaryActionLabel(),
				icon: primaryActionIcon(),
				invisibleLabel: mode === 'open-existing',
				title: mode === 'open-existing' ? 'Open category on Commons' : null,
				flags: primaryActionFlags(),
				disabled: primaryActionDisabled()
			}, function () {
				var plan = buildWorkflowPlan( mode );

				if ( primaryActionDisabled() ) {
					return;
				}
				if ( !activateWorkflowPlan( plan ) ) {
					return;
				}
				if ( mode === 'open-existing' ) {
					window.open( 'https://commons.wikimedia.org/wiki/' + mw.util.wikiUrlencode( state.personCategory ), '_blank' );
					return;
				}
				if ( mode === 'linked-base-merge' ) {
					openMergeForLinkedCategoryItem();
					return;
				}
				if ( mode === 'target-conflict-merge' ) {
					openMergeForTargetCategoryItem();
					return;
				}
				if ( mode === 'target-conflict-disambiguate' ) {
					disambiguateTargetCategoryConflict( plan );
					return;
				}
				if ( mode === 'linked-base-disambiguate' ) {
					disambiguateCommonsCategory( plan );
					return;
				}
				if ( mode === 'disambiguate-unlinked-existing' ) {
					disambiguateUnlinkedExistingCategory( plan );
					return;
				}
				if ( mode === 'link-existing' || mode === 'link-or-disambiguate-existing' ) {
					linkExistingCommonsCategory();
					return;
				}
				createCommonsCategory();
			} )
		);
	}

	function currentWorkflowMode() {
		return Workflow.currentMode();
	}

	function baseCategoryNeedsDisambiguationPage() {
		return Workflow.baseCategoryNeedsDisambiguationPage();
	}

	function shouldOfferLinkOrDisambiguate() {
		return Workflow.shouldOfferLinkOrDisambiguate();
	}

	function shouldShowCategoryTextInput() {
		var mode = currentWorkflowMode();

		if (
			mode === 'open-existing' ||
			mode === 'linked-base-merge' ||
			mode === 'target-conflict-merge'
		) {
			return false;
		}

		return mode !== 'link-or-disambiguate-existing';
	}

	function shouldShowParentCategoryCheckboxes() {
		var mode = currentWorkflowMode();

		if (
			mode === 'open-existing' ||
			mode === 'linked-base-merge' ||
			mode === 'target-conflict-merge'
		) {
			return false;
		}

		return mode !== 'link-or-disambiguate-existing';
	}

	function buildUnlinkedExistingCategoryReview() {
		var $wrap = $( '<div>' );
		var $review = $( '<div>' ).css( {
			background: '#f8f9fa',
			border: '1px solid #c8ccd1',
			marginBottom: '10px',
			padding: '8px'
		} );

		$review.append(
			$( '<p>' ).css( {
				marginTop: 0
			} ).append(
				commonsCategoryLink( state.originalPersonCategory ),
				' already exists on Commons and is not tied to a Wikidata item.'
			),
			buildExistingCategoryIntention(),
			buildLinkOrDisambiguateChoice()
		);

		if ( state.disambiguateUnlinkedExistingCategory && state.unlinkedDisambiguationOptions.length ) {
			$review.append(
				$( '<div>' ).css( {
					marginTop: '8px'
				} ).append(
					$( '<strong>' ).text( 'Move existing content to: ' ),
					buildUnlinkedDisambiguationSelect()
				),
				$( '<div>' ).css( {
					marginTop: '8px'
				} ).append(
					$( '<strong>' ).text( 'Create current item category as: ' ),
					buildCurrentItemDisambiguationControls()
				)
			);

			if ( !canDisambiguateUnlinkedExistingCategory() ) {
				$review.append( unlinkedDisambiguationWarning() );
			}
		}

		$wrap.append( $review );

		if ( !state.disambiguateUnlinkedExistingCategory ) {
			$wrap.append( buildExistingCategoryThumbnailPreview() );
		}

		return $wrap;
	}

	function unlinkedDisambiguationWarning() {
		return $( '<p>' ).css( {
			color: '#72777d',
			margin: '8px 0 0'
		} ).text(
			'Choose two different disambiguation labels before creating. If birth/death years are not known, consider adding a nationality or another distinguishing feature to one label.'
		);
	}

	function buildLinkOrDisambiguateChoice() {
		return $( '<div>' ).css( {
			marginTop: '8px'
		} ).append(
			$( '<div>' ).append(
				radioOption( 'CatapultExistingActionLink', !state.disambiguateUnlinkedExistingCategory, 'Link existing category', function () {
					state.disambiguateUnlinkedExistingCategory = false;
					state.unlinkedDisambiguationTitle = '';
					state.currentItemDisambiguationTitle = '';
					state.personCategory = state.originalPersonCategory;
					state.personCategoryExists = true;
					state.personCategoryRedirect = false;
					state.personCategoryWikibaseItem = null;
					state.selectedCurrentItemDisambiguationOption = null;
					renderSuggestions();
				} )
			),
			radioOption( 'CatapultExistingActionDisambiguate', state.disambiguateUnlinkedExistingCategory, 'Disambiguate; move existing content first', function () {
				var existingTarget;
				var currentTarget;

				state.disambiguateUnlinkedExistingCategory = true;
				if ( !state.selectedUnlinkedDisambiguationOption ) {
					state.selectedUnlinkedDisambiguationOption = state.unlinkedDisambiguationOptions[ 0 ] || null;
				}
				if ( !state.unlinkedDisambiguationTitle ) {
					state.unlinkedDisambiguationTitle =
						selectedUnlinkedDisambiguationTarget() || '';
				}
				existingTarget = selectedUnlinkedDisambiguationTarget();
				currentTarget = firstCurrentItemDisambiguationTargetDifferentFrom( existingTarget );
				if ( !state.currentItemDisambiguationTitle ) {
					state.currentItemDisambiguationTitle = currentTarget || '';
				}
				state.personCategory = selectedCurrentItemDisambiguationTarget() ||
					state.personCategory;
				state.personCategoryExists = false;
				state.personCategoryRedirect = false;
				state.personCategoryWikibaseItem = null;
				renderSuggestions();
			} )
		);
	}

	function buildExistingCategoryThumbnailPreview() {
		var $preview = $( '<div>' ).css( {
			marginTop: '10px'
		} );

		if ( state.personCategoryThumbnailsLoaded ) {
			renderExistingCategoryThumbnails( $preview );
			return $preview;
		}

		$preview.text( 'Loading category thumbnails...' ).css( {
			color: '#72777d'
		} );

		loadExistingCategoryThumbnails().then( function () {
			renderExistingCategoryThumbnails( $preview.empty().css( {
				color: ''
			} ) );
		} );

		return $preview;
	}

	function renderExistingCategoryThumbnails( $preview ) {
		if ( !state.personCategoryThumbnails.length ) {
			$preview.text( 'No file thumbnails found in the existing category.' ).css( {
				color: '#72777d'
			} );
			return;
		}

		$preview.append(
			$( '<div>' ).css( {
				fontWeight: 'bold',
				marginBottom: '4px'
			} ).text( 'Files in the existing category' ),
			$( '<div>' ).css( {
				display: 'flex',
				flexWrap: 'wrap',
				gap: '10px'
			} ).append( state.personCategoryThumbnails.map( function ( file ) {
				return $( '<a>', {
					href: 'https://commons.wikimedia.org/wiki/' + mw.util.wikiUrlencode( file.title ),
					target: '_blank',
					rel: 'noopener',
					title: file.title
				} ).append(
					$( '<img>', {
						alt: '',
						src: file.thumburl
					} ).css( {
						background: '#f8f9fa',
						border: '1px solid #c8ccd1',
						height: '96px',
						objectFit: 'cover',
						width: '96px'
					} )
				);
			} ) )
		);
	}

	function loadExistingCategoryThumbnails() {
		var deferred = $.Deferred();

		if ( state.personCategoryThumbnailsLoaded ) {
			return deferred.resolve().promise();
		}

		state.commonsApi.get( {
			action: 'query',
			generator: 'categorymembers',
			gcmtitle: state.originalPersonCategory,
			gcmnamespace: 6,
			gcmlimit: 8,
			prop: 'imageinfo',
			iiprop: 'url',
			iiurlwidth: 160,
			iiurlheight: 160,
			format: 'json'
		} ).then( function ( data ) {
			state.personCategoryThumbnails = Object.keys( data.query && data.query.pages || {} )
				.map( function ( pageId ) {
					var page = data.query.pages[ pageId ];
					var imageinfo = page.imageinfo && page.imageinfo[ 0 ];

					return imageinfo && imageinfo.thumburl ? {
						title: page.title,
						thumburl: imageinfo.thumburl
					} : null;
				} )
				.filter( Boolean );
			state.personCategoryThumbnailsLoaded = true;
			deferred.resolve();
		}, function () {
			state.personCategoryThumbnails = [];
			state.personCategoryThumbnailsLoaded = true;
			deferred.resolve();
		} );

		return deferred.promise();
	}

	function buildLinkedExistingCategoryReview() {
		var $review = $( '<div>' ).css( {
			background: '#f8f9fa',
			border: '1px solid #c8ccd1',
			marginBottom: '10px',
			padding: '8px'
		} );

		$review.append(
			$( '<p>' ).css( {
				marginTop: 0
			} ).append(
				commonsCategoryLink( state.originalPersonCategory ),
				' already exists on Commons and is tied to a Wikidata item.'
			),
			$( '<div>' ).append(
				$( '<strong>' ).text( 'This category is intended for:' ),
				$( '<p>' ).css( {
					margin: '4px 0 8px 0'
				} ).append(
					wikidataItemLabelLink( state.originalPersonCategoryWikibaseItem, state.personCategoryWikibaseEntity ),
					linkedItemDescriptionText()
				)
			),
			buildLinkedExistingCategoryChoice()
		);

		if ( !state.mergeLinkedExistingCategory ) {
			$review.append(
				$( '<div>' ).css( {
					marginTop: '8px'
				} ).append(
					$( '<strong>' ).text( 'Move existing content to: ' ),
					buildLinkedMoveTargetSelect()
				),
				$( '<div>' ).css( {
					marginTop: '8px'
				} ).append(
					$( '<strong>' ).text( 'Create current item category as: ' ),
					buildDisambiguationSelect()
				)
			);
		}

		return $review;
	}

	function buildExistingDisambiguationCategoryReview() {
		var $review = $( '<div>' ).css( {
			background: '#f8f9fa',
			border: '1px solid #c8ccd1',
			marginBottom: '10px',
			padding: '8px'
		} );
		var message = state.baseCategoryRedirectTarget ?
			' is a redirect on Commons and will become a disambiguation category.' :
			' already exists on Commons as a disambiguation category.';

		$review.append(
			$( '<p>' ).css( {
				marginTop: 0
			} ).append(
				commonsCategoryLink( state.originalPersonCategory ),
				message
			),
			$( '<div>' ).css( {
				marginTop: '8px'
			} ).append(
				$( '<strong>' ).text( 'Create current item category as: ' ),
				buildCurrentItemDisambiguationControls()
			)
		);

		return $review;
	}

	function buildTargetCategoryConflictReview() {
		var $review = $( '<div>' ).css( {
			background: '#f8f9fa',
			border: '1px solid #c8ccd1',
			marginBottom: '10px',
			padding: '8px'
		} );

		$review.append(
			$( '<p>' ).css( {
				marginTop: 0
			} ).append(
				commonsCategoryLink( state.targetCategoryConflictOption.title ),
				' already exists on Commons and is tied to a Wikidata item.'
			),
			$( '<div>' ).append(
				$( '<strong>' ).text( 'This category is intended for:' ),
				$( '<p>' ).css( {
					margin: '4px 0 8px 0'
				} ).append(
					wikidataItemLabelLink(
						state.targetCategoryConflictOption.wikibaseItem,
						state.targetCategoryConflictEntity
					),
					targetConflictItemDescriptionText()
				)
			),
			buildTargetCategoryConflictChoice()
		);

		if ( !state.mergeTargetCategoryConflict ) {
			$review.append(
				$( '<div>' ).css( {
					marginTop: '8px'
				} ).append(
					$( '<strong>' ).text( 'Move existing content to: ' ),
					buildTargetConflictMoveTargetSelect()
				),
				$( '<div>' ).css( {
					marginTop: '8px'
				} ).append(
					$( '<strong>' ).text( 'Create current item category as: ' ),
					buildTargetConflictCurrentItemSelect()
				)
			);
		}

		return $review;
	}

	function targetConflictItemDescriptionText() {
		var description = englishDescription( state.targetCategoryConflictEntity );

		return description ? ' - ' + description : '';
	}

	function refreshTargetCategoryConflictForCurrentSelection() {
		var option = state.selectedCurrentItemDisambiguationOption;

		if (
			option &&
			option.exists &&
			option.wikibaseItem &&
			option.wikibaseItem !== mw.config.get( 'wbEntityId' )
		) {
			loadSelectedTargetCategoryConflict().then( renderSuggestions );
			return;
		}

		state.targetCategoryConflictOption = null;
		state.targetCategoryConflictEntity = null;
		state.targetCategoryMoveTarget = null;
		state.targetCategoryMoveTargetTitle = '';
		state.targetCategoryCurrentTitle = '';
		state.targetCategoryMoveTargetExists = false;
		state.mergeTargetCategoryConflict = false;
		refreshPrimaryActionDisabled();
		renderSuggestions();
	}

	function buildTargetCategoryConflictChoice() {
		return $( '<div>' ).css( {
			marginTop: '8px'
		} ).append(
			radioOption( 'CatapultTargetActionMerge', state.mergeTargetCategoryConflict, 'Merge these items', function () {
				state.mergeTargetCategoryConflict = true;
				renderSuggestions();
			} ),
			radioOption( 'CatapultTargetActionDisambiguate', !state.mergeTargetCategoryConflict, 'Disambiguate; move existing category first', function () {
				state.mergeTargetCategoryConflict = false;
				if ( !state.targetCategoryMoveTargetTitle ) {
					state.targetCategoryMoveTargetTitle = state.targetCategoryMoveTarget || '';
				}
				if ( !state.targetCategoryCurrentTitle ) {
					state.targetCategoryCurrentTitle = preferredCurrentItemTargetAfterTargetConflict();
				}
				renderSuggestions();
			} )
		);
	}

	function linkedItemDescriptionText() {
		var description = englishDescription( state.personCategoryWikibaseEntity );

		return description ? ' - ' + description : '';
	}

	function buildLinkedExistingCategoryChoice() {
		return $( '<div>' ).css( {
			marginTop: '8px'
		} ).append(
			radioOption( 'CatapultLinkedActionMerge', state.mergeLinkedExistingCategory, 'Merge these items', function () {
				state.mergeLinkedExistingCategory = true;
				state.personCategory = state.originalPersonCategory;
				state.personCategoryExists = true;
				state.personCategoryWikibaseItem = state.originalPersonCategoryWikibaseItem;
				renderSuggestions();
			} ),
			radioOption( 'CatapultLinkedActionDisambiguate', !state.mergeLinkedExistingCategory, 'Disambiguate; move existing category first', function () {
				state.mergeLinkedExistingCategory = false;
				if ( !state.linkedMoveTargetTitle ) {
					state.linkedMoveTargetTitle = state.personCategoryMoveTarget || '';
				}
				selectDisambiguationOption( firstAvailableDisambiguationOption() );
				if ( !state.linkedDisambiguationTitle ) {
					state.linkedDisambiguationTitle = selectedLinkedDisambiguationTarget() || '';
				}
				renderSuggestions();
			} )
		);
	}

	function radioOption( id, checked, label, handler ) {
		return $( '<label>' ).css( {
			display: 'block',
			marginTop: '4px'
		} ).append(
			$( '<input>', {
				id: id,
				name: id.indexOf( 'CatapultLinkedAction' ) === 0 ?
					'CatapultLinkedAction' :
					'CatapultExistingAction',
				type: 'radio',
				checked: checked
			} ).on( 'change', function () {
				if ( this.checked ) {
					handler();
				}
			} ),
			$( '<span>' ).css( {
				marginLeft: '6px'
			} ).text( label )
		);
	}

	function buildExistingCategoryIntention() {
		var display = existingCategoryIntentionLabels();

		if ( !state.personCategoryExistingParents.length ) {
			return $( '<p>' ).text( 'No parent categories were found on the existing category page.' );
		}

		return $( '<div>' ).append(
			$( '<strong>' ).text( 'Existing category intended for:' ),
			$( '<p>' ).css( {
				margin: '4px 0 8px 0'
			} ).text( display.text )
		);
	}

	function existingCategoryIntentionLabels() {
		var country = commonFromCountry( state.personCategoryExistingParents );
		var labels = categoryIntentionLabelsFromParents();

		return {
			labels: labels,
			text: summarizeIntentionLabels( labels, country )
		};
	}

	function categoryIntentionLabelsFromParents() {
		var occupations = state.personCategoryExistingParents.map( occupationFromParentCategory )
			.filter( Boolean );
		var countrySuffix = commonFromSuffix( state.personCategoryExistingParents );

		if ( occupations.length === state.personCategoryExistingParents.length ) {
			return uniqueIds( occupations );
		}

		return state.personCategoryExistingParents.map( function ( title ) {
			return singularizeCategoryLabel(
				title.replace( /^Category:/i, '' )
					.replace( /\s+by name$/i, '' )
					.replace( countrySuffix, '' )
			);
		} );
	}

	function summarizeIntentionLabels( labels, country ) {
		var cleanLabels = uniqueIds( labels.map( function ( label ) {
			return singularizeCategoryLabel( label );
		} ) );
		var text;

		if ( country && cleanLabels.length ) {
			text = cleanLabels.join( ', ' ) + ' from ' + country;
		} else {
			text = cleanLabels.join( ', ' );
		}

		return articleFor( text ) + ' ' + text;
	}

	function articleFor( text ) {
		return /^[aeiou]/i.test( String( text || '' ).trim() ) ? 'an' : 'a';
	}

	function commonFromCountry( titles ) {
		var countries = titles.map( function ( title ) {
			var match = title.replace( /^Category:/i, '' ).replace( /\s+by name$/i, '' )
				.match( /\s+from\s+(.+)$/i );
			return match ? match[ 0 ] : '';
		} );
		var first = countries[ 0 ];

		if ( !first ) {
			return '';
		}

		return countries.every( function ( country ) {
			return country.toLowerCase() === first.toLowerCase();
		} ) ? first.replace( /^\s+from\s+/i, '' ) : '';
	}

	function commonFromSuffix( titles ) {
		var suffixes = titles.map( function ( title ) {
			var match = title.replace( /^Category:/i, '' ).replace( /\s+by name$/i, '' )
				.match( /\s+from\s+.+$/i );
			return match ? match[ 0 ] : '';
		} );
		var first = suffixes[ 0 ];

		if ( !first ) {
			return '';
		}

		return suffixes.every( function ( suffix ) {
			return suffix.toLowerCase() === first.toLowerCase();
		} ) ? new RegExp( escapeRegExp( first ) + '$', 'i' ) : /$a/;
	}

	function singularizeCategoryLabel( label ) {
		return singularizeOccupation( lcfirst(
			String( label || '' ).replace( /\s+/g, ' ' ).trim()
		) );
	}

	function buildLinkedMoveTargetSelect() {
		var currentValue = selectedLinkedMoveTarget() ||
			state.personCategoryMoveTarget ||
			state.originalPersonCategory;
		var options = [ {
			data: currentValue,
			label: currentValue.replace( /^Category:/i, '' )
		} ];
		var comboBox;

		function updateLinkedMoveTarget( value ) {
			state.linkedMoveTargetTitle = normalizeCategoryTitle( value );
			refreshPrimaryActionDisabled();
		}

		if ( window.OO && OO.ui && OO.ui.ComboBoxInputWidget && OO.ui.MenuOptionWidget ) {
			comboBox = new OO.ui.ComboBoxInputWidget( {
				value: currentValue,
				menu: {
					filterFromInput: true,
					filterMode: 'substring',
					items: options.map( function ( option ) {
						return new OO.ui.MenuOptionWidget( option );
					} )
				}
			} );
			comboBox.on( 'change', updateLinkedMoveTarget );
			return comboBox.$element.css( {
				minWidth: '360px',
				maxWidth: '100%'
			} );
		}

		return $( '<span>' ).append(
			$( '<input>', {
				type: 'text',
				value: currentValue,
				list: 'CatapultLinkedMoveTargetOptions'
			} ).css( {
				boxSizing: 'border-box',
				minWidth: '360px',
				maxWidth: '100%'
			} ).on( 'input', function () {
				updateLinkedMoveTarget( this.value );
			} ),
			$( '<datalist>' )
				.attr( 'id', 'CatapultLinkedMoveTargetOptions' )
				.append( options.map( function ( option ) {
					return $( '<option>', {
						value: option.data,
						label: option.label
					} );
				} ) )
		);
	}

	function buildTargetConflictMoveTargetSelect() {
		var currentValue = selectedTargetConflictMoveTarget() ||
			state.targetCategoryMoveTarget ||
			state.targetCategoryConflictOption.title;
		var options = targetConflictMoveTargetOptions( currentValue );
		var comboBox;

		function updateTargetConflictMoveTarget( value ) {
			state.targetCategoryMoveTargetTitle = normalizeCategoryTitle( value );
			refreshPrimaryActionDisabled();
		}

		if ( window.OO && OO.ui && OO.ui.ComboBoxInputWidget && OO.ui.MenuOptionWidget ) {
			comboBox = new OO.ui.ComboBoxInputWidget( {
				value: currentValue,
				menu: {
					filterFromInput: true,
					filterMode: 'substring',
					items: options.map( function ( option ) {
						return new OO.ui.MenuOptionWidget( option );
					} )
				}
			} );
			comboBox.on( 'change', updateTargetConflictMoveTarget );
			return comboBox.$element.css( {
				minWidth: '360px',
				maxWidth: '100%'
			} );
		}

		return $( '<span>' ).append(
			$( '<input>', {
				type: 'text',
				value: currentValue,
				list: 'CatapultTargetConflictMoveTargetOptions'
			} ).css( {
				boxSizing: 'border-box',
				minWidth: '360px',
				maxWidth: '100%'
			} ).on( 'input', function () {
				updateTargetConflictMoveTarget( this.value );
			} ),
			$( '<datalist>' )
				.attr( 'id', 'CatapultTargetConflictMoveTargetOptions' )
				.append( options.map( function ( option ) {
					return $( '<option>', {
						value: option.data,
						label: option.label
					} );
				} ) )
		);
	}

	function targetConflictMoveTargetOptions( currentValue ) {
		var options = entityDisambiguationOptions(
			state.targetCategoryConflictEntity,
			englishLabel( state.targetCategoryConflictEntity ) ||
				state.targetCategoryConflictOption.title.replace( /\s*\([^)]*\)\s*$/i, '' )
		).map( function ( option ) {
			return {
				data: option.title,
				label: option.title.replace( /^Category:/i, '' )
			};
		} );

		if ( !options.some( function ( option ) {
			return normalizeCategoryTitle( option.data ) === normalizeCategoryTitle( currentValue );
		} ) ) {
			options.unshift( {
				data: currentValue,
				label: currentValue.replace( /^Category:/i, '' )
			} );
		}

		return options;
	}

	function buildTargetConflictCurrentItemSelect() {
		var currentValue = selectedCurrentItemTargetForTargetConflict() ||
			preferredCurrentItemTargetAfterTargetConflict();
		var options = targetConflictCurrentItemOptions( currentValue );
		var comboBox;

		function updateTargetConflictCurrentItem( value ) {
			state.targetCategoryCurrentTitle = normalizeCategoryTitle( value );
			refreshPrimaryActionDisabled();
		}

		if ( window.OO && OO.ui && OO.ui.ComboBoxInputWidget && OO.ui.MenuOptionWidget ) {
			comboBox = new OO.ui.ComboBoxInputWidget( {
				value: currentValue,
				menu: {
					filterFromInput: true,
					filterMode: 'substring',
					items: options.map( function ( option ) {
						return new OO.ui.MenuOptionWidget( option );
					} )
				}
			} );
			comboBox.on( 'change', updateTargetConflictCurrentItem );
			return comboBox.$element.css( {
				minWidth: '360px',
				maxWidth: '100%'
			} );
		}

		return $( '<span>' ).append(
			$( '<input>', {
				type: 'text',
				value: currentValue,
				list: 'CatapultTargetConflictCurrentItemOptions'
			} ).css( {
				boxSizing: 'border-box',
				minWidth: '360px',
				maxWidth: '100%'
			} ).on( 'input', function () {
				updateTargetConflictCurrentItem( this.value );
			} ),
			$( '<datalist>' )
				.attr( 'id', 'CatapultTargetConflictCurrentItemOptions' )
				.append( options.map( function ( option ) {
					return $( '<option>', {
						value: option.data,
						label: option.label
					} );
				} ) )
		);
	}

	function targetConflictCurrentItemOptions( currentValue ) {
		var secondaryOptions = primaryDisambiguationOptions().concat(
			currentItemYearDisambiguationOptions()
		);
		var options = uniqueOptionsByTitle( secondaryOptions ).map( function ( option ) {
			return {
				data: option.title,
				label: option.title.replace( /^Category:/i, '' )
			};
		} );

		if ( !options.some( function ( option ) {
			return normalizeCategoryTitle( option.data ) === normalizeCategoryTitle( currentValue );
		} ) ) {
			options.unshift( {
				data: currentValue,
				label: currentValue.replace( /^Category:/i, '' )
			} );
		}

		return options;
	}

	function buildUnlinkedDisambiguationSelect() {
		var currentValue = selectedUnlinkedDisambiguationTarget() ||
			state.originalPersonCategory;
		var options = state.unlinkedDisambiguationOptions.map( function ( option ) {
			return {
				data: option.title,
				label: option.title.replace( /^Category:/i, '' ) +
					( option.source ? ' - from ' + option.source.replace( /^Category:/i, '' ) : '' )
			};
		} );
		var comboBox;

		function updateUnlinkedDisambiguation( value ) {
			var title = normalizeCategoryTitle( value );

			state.unlinkedDisambiguationTitle = title;
			state.selectedUnlinkedDisambiguationOption =
				state.unlinkedDisambiguationOptions.filter( function ( option ) {
					return option.title === title;
				} )[ 0 ] || null;
			refreshPrimaryActionDisabled();
		}

		if ( window.OO && OO.ui && OO.ui.ComboBoxInputWidget && OO.ui.MenuOptionWidget ) {
			comboBox = new OO.ui.ComboBoxInputWidget( {
				value: currentValue,
				menu: {
					filterFromInput: true,
					filterMode: 'substring',
					items: options.map( function ( option ) {
						return new OO.ui.MenuOptionWidget( option );
					} )
				}
			} );
			comboBox.on( 'change', updateUnlinkedDisambiguation );
			return comboBox.$element.css( {
				minWidth: '360px',
				maxWidth: '100%'
			} );
		}

		return $( '<span>' ).append(
			$( '<input>', {
				type: 'text',
				value: currentValue,
				list: 'CatapultUnlinkedDisambiguationOptions'
			} ).css( {
				boxSizing: 'border-box',
				minWidth: '360px',
				maxWidth: '100%'
			} ).on( 'input', function () {
				updateUnlinkedDisambiguation( this.value );
			} ),
			$( '<datalist>' )
				.attr( 'id', 'CatapultUnlinkedDisambiguationOptions' )
				.append( options.map( function ( option ) {
					return $( '<option>', {
						value: option.data,
						label: option.label
					} );
				} ) )
		);
	}

	function buildCurrentItemDisambiguationControls() {
		return buildCurrentItemDisambiguationSelect();
	}

	function buildCurrentItemDisambiguationSelect() {
		var currentValue = selectedCurrentItemDisambiguationTarget() ||
			state.personCategory ||
			state.originalPersonCategory;
		var availableOptions = primaryDisambiguationOptions();
		var options = availableOptions.map( function ( option ) {
			return {
				data: option.title,
				label: option.title.replace( /^Category:/i, '' )
			};
		} );
		var comboBox;

		function updateCurrentItemDisambiguation( value ) {
			var title = normalizeCategoryTitle( value );

			state.currentItemDisambiguationTitle = title;
			state.selectedCurrentItemDisambiguationOption =
				availableOptions.filter( function ( option ) {
					return option.title === title;
				} )[ 0 ] || null;
			state.personCategory = title;
			state.personCategoryExists = !!( state.selectedCurrentItemDisambiguationOption &&
				state.selectedCurrentItemDisambiguationOption.exists );
			state.personCategoryRedirect = !!( state.selectedCurrentItemDisambiguationOption &&
				state.selectedCurrentItemDisambiguationOption.redirect );
			state.personCategoryWikibaseItem = state.selectedCurrentItemDisambiguationOption &&
				state.selectedCurrentItemDisambiguationOption.wikibaseItem || null;
			state.targetCategoryCurrentTitle = '';
			setCategoryTextValue( buildCategoryText() );
			refreshTargetCategoryConflictForCurrentSelection();
		}

		if ( window.OO && OO.ui && OO.ui.ComboBoxInputWidget && OO.ui.MenuOptionWidget ) {
			comboBox = new OO.ui.ComboBoxInputWidget( {
				value: currentValue,
				menu: {
					filterFromInput: true,
					filterMode: 'substring',
					items: options.map( function ( option ) {
						return new OO.ui.MenuOptionWidget( option );
					} )
				}
			} );
			comboBox.on( 'change', updateCurrentItemDisambiguation );
			return comboBox.$element.css( {
				minWidth: '360px',
				maxWidth: '100%'
			} );
		}

		return $( '<span>' ).append(
			$( '<input>', {
				type: 'text',
				value: currentValue,
				list: 'CatapultCurrentItemDisambiguationOptions'
			} ).css( {
				boxSizing: 'border-box',
				minWidth: '360px',
				maxWidth: '100%'
			} ).on( 'input', function () {
				updateCurrentItemDisambiguation( this.value );
			} ),
			$( '<datalist>' )
				.attr( 'id', 'CatapultCurrentItemDisambiguationOptions' )
				.append( options.map( function ( option ) {
					return $( '<option>', {
						value: option.data,
						label: option.label
					} );
				} ) )
		);
	}

	function buildDisambiguationWorkflowReview() {
		var $review = $( '<div>' ).css( {
			background: '#fff',
			border: '1px solid #eaecf0',
			margin: '8px 0',
			padding: '8px'
		} );
		$review.append(
			$( '<p>' ).css( {
				marginTop: 0
			} ).append(
				$( '<span>' ).text( 'Currently linked item: ' ),
				wikidataItemLink( state.originalPersonCategoryWikibaseItem, state.personCategoryWikibaseEntity )
			),
			$( '<ul>' ).css( {
				marginBottom: '8px'
			} ).append(
				$( '<li>' ).append(
					'Move existing category to ',
					commonsCategoryLink( state.personCategoryMoveTarget ),
					'.',
					state.personCategoryMoveTargetExists ? ' This target already exists.' : ''
				),
				$( '<li>' ).append( 'Create or link ', commonsCategoryLink( state.personCategory ), ' for this item.' ),
				$( '<li>' ).append( 'Replace ', commonsCategoryLink( state.originalPersonCategory ), ' with a disambiguation category.' ),
				$( '<li>' ).text( 'Create a Wikidata item for the disambiguation category.' )
			)
		);

		return $review;
	}

	function canDisambiguateCommonsCategory() {
		var plan = buildWorkflowPlan( 'linked-base-disambiguate' );

		return !!(
			state.disambiguationNeeded &&
			validateWorkflowPlan( plan ).valid &&
			!(
				normalizeCategoryTitle( plan.existingPerson.targetCategory ) ===
					normalizeCategoryTitle( state.personCategoryMoveTarget ) &&
				state.personCategoryMoveTargetExists
			) &&
			!selectedCategoryTiedToOtherItem()
		);
	}

	function canDisambiguateUnlinkedExistingCategory() {
		return Workflow.canDisambiguateUnlinkedExistingCategory();
	}

	function canDisambiguateTargetCategoryConflict() {
		var plan = buildWorkflowPlan( 'target-conflict-disambiguate' );

		return !!(
			state.targetCategoryConflictOption &&
			validateWorkflowPlan( plan ).valid &&
			!(
				normalizeCategoryTitle( plan.existingPerson.targetCategory ) ===
					normalizeCategoryTitle( state.targetCategoryMoveTarget ) &&
				state.targetCategoryMoveTargetExists
			)
		);
	}

	function disambiguationTargetsAreDistinct( firstTitle, secondTitle ) {
		var firstLabel = disambiguationLabelFromTitle( firstTitle );
		var secondLabel = disambiguationLabelFromTitle( secondTitle );

		return !!(
			firstTitle &&
			secondTitle &&
			normalizeCategoryTitle( firstTitle ) !== normalizeCategoryTitle( secondTitle ) &&
			firstLabel &&
			secondLabel &&
			firstLabel.toLowerCase() !== secondLabel.toLowerCase()
		);
	}

	function disambiguationLabelFromTitle( title ) {
		var match = String( title || '' ).match( /\(([^()]*)\)\s*$/ );

		return match ? match[ 1 ].replace( /\s+/g, ' ' ).trim() : '';
	}

	function panelStatusMessage() {
		if (
			state.disambiguationNeeded &&
			state.mergeLinkedExistingCategory &&
			!isMergeGadgetUsable()
		) {
			return sentence( 'Activate the Merge gadget before merging these items.' );
		}
		if (
			state.personCategoryExists &&
			state.personCategoryWikibaseItem &&
			state.personCategoryWikibaseItem === mw.config.get( 'wbEntityId' )
		) {
			return sentence( commonsCategoryLink( state.personCategory ), ' already exists and is tied to this item.' );
		}
		if (
			state.personCategoryExists &&
			state.personCategoryWikibaseItem &&
			state.personCategoryWikibaseItem !== mw.config.get( 'wbEntityId' )
		) {
			return sentence(
				commonsCategoryLink( state.personCategory ),
				' already exists and is tied to ',
				wikidataItemLink( state.personCategoryWikibaseItem, state.personCategoryWikibaseEntity ),
				'.'
			);
		}
		if ( currentWorkflowMode() === 'redirect-existing' ) {
			return sentence( commonsCategoryLink( state.personCategory ), ' is a redirect on Commons. Choose another disambiguation label.' );
		}
		if ( state.personCategoryExists ) {
			return sentence( commonsCategoryLink( state.personCategory ), ' already exists on Commons and is not tied to a Wikidata item.' );
		}
		if (
			state.personCategoryExists &&
			state.disambiguateUnlinkedExistingCategory &&
			!canDisambiguateUnlinkedExistingCategory()
		) {
			return sentence( 'Choose two different disambiguation labels before creating.' );
		}
		return sentence( 'Ready to create ', commonsCategoryLink( state.personCategory ), '.' );
	}

	function buildDisambiguationSelect() {
		var currentValue = selectedLinkedDisambiguationTarget() ||
			state.personCategory ||
			state.originalPersonCategory;
		var options = primaryDisambiguationOptions().map( function ( option ) {
			return {
				data: option.title,
				label: option.title.replace( /^Category:/i, '' ) +
					( option.exists ? ' (exists)' : '' ) +
					( option.wikibaseItem ? ' - ' + option.wikibaseItem : '' )
			};
		} );
		var comboBox;

		function updateLinkedDisambiguation( value ) {
			var title = normalizeCategoryTitle( value );
			var option = state.disambiguationOptions.filter( function ( candidate ) {
				return candidate.title === title;
			} )[ 0 ] || null;

			state.linkedDisambiguationTitle = title;
			if ( option ) {
				selectDisambiguationOption( option );
			} else {
				state.selectedDisambiguationOption = null;
				state.personCategory = title;
				state.personCategoryExists = false;
				state.personCategoryWikibaseItem = null;
			}
			setCategoryTextValue( buildCategoryText() );
			refreshPrimaryActionDisabled();
		}

		if ( window.OO && OO.ui && OO.ui.ComboBoxInputWidget && OO.ui.MenuOptionWidget ) {
			comboBox = new OO.ui.ComboBoxInputWidget( {
				value: currentValue,
				menu: {
					filterFromInput: true,
					filterMode: 'substring',
					items: options.map( function ( option ) {
						return new OO.ui.MenuOptionWidget( option );
					} )
				}
			} );
			comboBox.on( 'change', updateLinkedDisambiguation );
			return comboBox.$element.css( {
				minWidth: '360px',
				maxWidth: '100%'
			} );
		}

		return $( '<span>' ).append(
			$( '<input>', {
				type: 'text',
				value: currentValue,
				list: 'CatapultLinkedDisambiguationOptions'
			} ).css( {
				boxSizing: 'border-box',
				minWidth: '360px',
				maxWidth: '100%'
			} ).on( 'input', function () {
				updateLinkedDisambiguation( this.value );
			} ),
			$( '<datalist>' )
				.attr( 'id', 'CatapultLinkedDisambiguationOptions' )
				.append( options.map( function ( option ) {
					return $( '<option>', {
						value: option.data,
						label: option.label
					} );
				} ) )
		);
	}

	function primaryActionLabel() {
		var mode = currentWorkflowMode();

		if ( mode === 'open-existing' ) {
			return 'open';
		}
		if ( mode === 'linked-base-merge' || mode === 'target-conflict-merge' ) {
			return isMergeGadgetUsable() ? 'merge' : 'activate merge gadget';
		}
		if ( mode === 'target-conflict-disambiguate' ) {
			return 'create';
		}
		if ( mode === 'redirect-existing' ) {
			return 'choose';
		}
		if ( selectedCategoryTiedToOtherItem() ) {
			return 'choose';
		}
		if ( mode === 'linked-base-disambiguate' ) {
			return 'create';
		}
		if ( mode === 'disambiguate-unlinked-existing' ) {
			return 'create';
		}
		if ( mode === 'link-existing' || mode === 'link-or-disambiguate-existing' ) {
			return 'link';
		}
		return 'create';
	}

	function primaryActionIcon() {
		var mode = currentWorkflowMode();

		if ( mode === 'open-existing' ) {
			return 'linkExternal';
		}
		if ( mode === 'linked-base-merge' || mode === 'target-conflict-merge' ) {
			return isMergeGadgetUsable() ? 'articles' : 'settings';
		}
		if ( mode === 'target-conflict-disambiguate' || mode === 'disambiguate-unlinked-existing' ) {
			return 'articles';
		}
		if ( mode === 'redirect-existing' ) {
			return 'alert';
		}
		if ( mode === 'link-existing' || mode === 'link-or-disambiguate-existing' ) {
			return 'link';
		}
		return state.personCategoryExists ? 'link' : 'add';
	}

	function primaryActionDisabled() {
		var mode = currentWorkflowMode();

		if ( mode === 'linked-base-merge' ) {
			return !state.originalPersonCategoryWikibaseItem;
		}
		if ( mode === 'target-conflict-merge' ) {
			return !state.targetCategoryConflictOption.wikibaseItem;
		}
		if ( mode === 'target-conflict-disambiguate' ) {
			return !canDisambiguateTargetCategoryConflict();
		}
		if ( mode === 'redirect-existing' ) {
			return true;
		}
		if ( selectedCategoryTiedToOtherItem() ) {
			return true;
		}
		if ( mode === 'linked-base-disambiguate' ) {
			return !canDisambiguateCommonsCategory();
		}
		if ( mode === 'disambiguate-unlinked-existing' ) {
			return !canDisambiguateUnlinkedExistingCategory();
		}
		return false;
	}

	function primaryActionFlags() {
		var mode = currentWorkflowMode();

		if ( mode === 'open-existing' ) {
			return [];
		}
		if (
			mode === 'linked-base-merge' ||
			mode === 'target-conflict-merge' ||
			mode === 'target-conflict-disambiguate'
		) {
			return [ 'primary', 'progressive' ];
		}
		if ( mode === 'redirect-existing' ) {
			return [ 'destructive' ];
		}
		if ( selectedCategoryTiedToOtherItem() ) {
			return [ 'destructive' ];
		}
		return [ 'primary', 'progressive' ];
	}

	function openMergeForLinkedCategoryItem() {
		var linkedItem = state.originalPersonCategoryWikibaseItem;

		openMergeForItem( linkedItem );
	}

	function openMergeForTargetCategoryItem() {
		var linkedItem = state.targetCategoryConflictOption &&
			state.targetCategoryConflictOption.wikibaseItem;

		openMergeForItem( linkedItem );
	}

	function openMergeForItem( linkedItem ) {
		if ( !linkedItem ) {
			return;
		}

		if ( window.mergeTool && typeof window.mergeTool.launchDialog === 'function' ) {
			window.mergeTool.launchDialog( linkedItem );
			return;
		}
		if ( mw.loader.getState( 'ext.gadget.Merge' ) !== null ) {
			mw.loader.using( 'ext.gadget.Merge' ).then( function () {
				if ( window.mergeTool && typeof window.mergeTool.launchDialog === 'function' ) {
					window.mergeTool.launchDialog( linkedItem );
				} else {
					window.open( 'https://www.wikidata.org/wiki/' + linkedItem, '_blank' );
				}
			}, function () {
				window.open( 'https://www.wikidata.org/wiki/' + linkedItem, '_blank' );
			} );
			return;
		}

		window.open( mw.util.getUrl( 'Special:Preferences', { mwprefsection: 'gadgets' } ), '_blank' );
	}

	function isMergeGadgetUsable() {
		return !!(
			window.mergeTool && typeof window.mergeTool.launchDialog === 'function' ||
			mw.loader.getState( 'ext.gadget.Merge' ) !== null
		);
	}

	function shouldMoveExistingCategoryFirst() {
		return !!(
			state.disambiguationNeeded &&
			!state.personCategoryExists
		);
	}

	function selectedCategoryTiedToOtherItem() {
		return Workflow.selectedCategoryTiedToOtherItem();
	}

	function buildParentCategoryCheckboxes() {
		var groups = groupedCandidatesForCategoryText();
		var $wrap;

		if ( groups.length <= 1 ) {
			return $( '<span>' );
		}

		$wrap = $( '<div>' ).css( {
			borderTop: '1px solid #eaecf0',
			marginTop: '10px',
			paddingTop: '8px'
		} ).append(
			$( '<strong>' ).text( 'Parent categories' )
		);

		groups.forEach( function ( group ) {
			var groupId = group[ 0 ].groupId;
			var candidate = selectedParentCandidate( group );
			var checkboxId = 'CatapultParentCategory-' + groupId.replace( /[^A-Za-z0-9_-]/g, '-' );

			if ( !candidate ) {
				return;
			}

			$wrap.append(
				$( '<div>' ).css( {
					marginTop: '4px'
				} ).append(
					$( '<input>', {
						id: checkboxId,
						type: 'checkbox',
						checked: state.parentCategorySelections[ groupId ] !== false
					} ).on( 'change', function () {
						state.parentCategorySelections[ groupId ] = this.checked;
						setCategoryTextValue( buildCategoryText() );
					} ),
					$( '<label>', {
						for: checkboxId
					} ).css( {
						marginLeft: '6px'
					} ).text( candidate.name )
				)
			);
		} );

		return $wrap;
	}

	function buildCategoryTextInput( value ) {
		var input;

		if ( window.OO && OO.ui && OO.ui.MultilineTextInputWidget ) {
			input = new OO.ui.MultilineTextInputWidget( {
				value: value,
				rows: 8,
				autosize: false
			} );
			input.$input.attr( 'id', 'CatapultText' );
			input.$element.css( {
				width: '100%'
			} );
			input.$input.css( {
				fontFamily: 'monospace'
			} );
			return input.$element;
		}

		return $( '<textarea>', {
			id: 'CatapultText',
			rows: 8
		} ).css( {
			boxSizing: 'border-box',
			fontFamily: 'monospace',
			width: '100%'
		} ).val( value );
	}

	function buildCandidateDebugPanel() {
		var $details;
		var selectedGroups;

		if ( !CONFIG.debug ) {
			return $( '<span>' );
		}

		selectedGroups = groupedCandidatesForCategoryText().map( function ( group ) {
			var selected = selectedParentCandidate( group );
			return selected ? candidateDebugLine( selected, 'selected' ) : '';
		} ).filter( Boolean );

		$details = $( '<details>' ).css( {
			marginTop: '8px'
		} ).append(
			$( '<summary>' ).text( 'catapult debug: category candidates' ),
			$( '<pre>' ).css( {
				background: '#f8f9fa',
				border: '1px solid #eaecf0',
				fontSize: '11px',
				maxHeight: '180px',
				overflow: 'auto',
				padding: '6px',
				whiteSpace: 'pre-wrap'
			} ).text(
				'Selected:\n' + ( selectedGroups.join( '\n' ) || '(none)' ) +
				'\n\nAll:\n' + state.candidates.map( function ( candidate ) {
					return candidateDebugLine( candidate, '' );
				} ).join( '\n' )
			)
		);

		return $details;
	}

	function candidateDebugLine( candidate, prefix ) {
		return [
			prefix || '-',
			candidate.exists ? 'exists' : 'missing',
			'stage=' + candidate.stage,
			candidate.isFallback ? 'fallback' : 'direct',
			candidate.isGenderedOccupation ? 'gendered' : '',
			candidate.reason,
			candidateCategoryTitle( candidate ),
			'source=' + ( candidate.sourceOccupation || '' ),
			'occupation=' + ( candidate.occupation || '' )
		].filter( Boolean ).join( ' | ' );
	}

	function setCategoryTextValue( value ) {
		$( '#CatapultText' ).val( value ).trigger( 'change' );
	}

	function getCategoryTextValue() {
		var value = $( '#CatapultText' ).val();

		return typeof value === 'string' ? value : buildCategoryText();
	}

	function makeButton( config, handler ) {
		var button;

		if ( window.OO && OO.ui && OO.ui.ButtonWidget ) {
			button = new OO.ui.ButtonWidget( {
				label: config.label,
				icon: config.icon,
				invisibleLabel: !!config.invisibleLabel,
				title: config.title,
				framed: config.framed !== false,
				flags: config.flags || [],
				disabled: !!config.disabled
			} );
			if ( config.id ) {
				button.$element.attr( 'id', config.id );
			}
			if ( config.id === 'CatapultPrimaryAction' ) {
				state.primaryActionButton = button;
				state.primaryActionElement = button.$element;
			}
			if ( config.classes ) {
				button.$element.addClass( config.classes.join( ' ' ) );
			}
			button.on( 'click', handler );
			return button.$element;
		}

		button = $( '<button>', {
			id: config.id,
			type: 'button',
			text: config.label,
			title: config.title,
			disabled: !!config.disabled
		} ).on( 'click', handler );
		if ( config.id === 'CatapultPrimaryAction' ) {
			state.primaryActionButton = null;
			state.primaryActionElement = button;
		}
		return button;
	}

	function refreshPrimaryActionDisabled() {
		var disabled;

		if ( !state.primaryActionElement ) {
			return;
		}

		disabled = primaryActionDisabled();
		if ( state.primaryActionButton ) {
			state.primaryActionButton.setDisabled( disabled );
		} else {
			state.primaryActionElement.prop( 'disabled', disabled );
		}
	}

	function buildCategoryText() {
		var lines = [ '{{Wikidata Infobox}}' ];
		var groupedCandidates = groupedCandidatesForCategoryText();

		groupedCandidates.forEach( function ( candidates ) {
			if ( state.parentCategorySelections[ candidates[ 0 ].groupId ] === false ) {
				return;
			}
			var category = buildParentCategoryLine( candidates );

			if ( category ) {
				lines.push( category );
			}
		} );

		return lines.join( '\n' ) + '\n';
	}

	function groupedCandidatesForCategoryText() {
		var groups = {};
		var grouped = [];
		var selectedGroupId = state.selectedCandidate && state.selectedCandidate.groupId;
		var occupationSpecificMatches = {};
		var hasCountrySpecificMatch = false;
		var directOccupationMatches = directOccupationMatchMap( state.candidates );

		orderedCandidates().forEach( function ( candidate ) {
			if ( !groups[ candidate.groupId ] ) {
				groups[ candidate.groupId ] = [];
				grouped.push( groups[ candidate.groupId ] );
			}

			groups[ candidate.groupId ].push( candidate );
		} );

		grouped.forEach( function ( group ) {
			var groupId = group[ 0 ].groupId;
			var occupation = groupId.split( '|from|' )[ 0 ];

			if ( /\|from\|/.test( groupId ) && group.some( function ( candidate ) {
				return candidate.exists;
			} ) ) {
				occupationSpecificMatches[ occupation ] = true;
				hasCountrySpecificMatch = true;
			}
		} );

		if ( selectedGroupId && groups[ selectedGroupId ] ) {
			grouped = [ groups[ selectedGroupId ] ].concat( grouped.filter( function ( group ) {
				return group !== groups[ selectedGroupId ];
			} ) );
		}

		return grouped.filter( function ( group ) {
			var groupId = group[ 0 ].groupId;
			var occupation = groupId.replace( /\|occupation$/, '' );

			if (
				groupId !== selectedGroupId &&
				group[ 0 ].isFallback &&
				directOccupationKeys( group[ 0 ] ).some( function ( key ) {
					return directOccupationMatches[ key ];
				} )
			) {
				return false;
			}

			if (
				groupId !== selectedGroupId &&
				genericFallbackCoveredBySpecificFallback( group[ 0 ], state.candidates )
			) {
				return false;
			}

			if (
				groupId !== selectedGroupId &&
				/\|occupation$/.test( groupId ) &&
				(
					occupationSpecificMatches[ occupation ] ||
					hasCountrySpecificMatch
				)
			) {
				return false;
			}

			return group.some( function ( candidate ) {
				return candidate.exists;
			} ) || group[ 0 ] === state.selectedCandidate;
		} );
	}

	function directOccupationMatchMap( candidates ) {
		var matches = {};

		candidates.forEach( function ( candidate ) {
			if (
				candidate.exists &&
				!candidate.isFallback &&
				/\|from\|/.test( candidate.groupId )
			) {
				directOccupationKeys( candidate ).forEach( function ( key ) {
					matches[ key ] = true;
				} );
			}
		} );

		return matches;
	}

	function candidateCoveredByDirectOccupation( candidate, candidates ) {
		var matches = directOccupationMatchMap( candidates );

		return candidateCoveredByDirectOccupationMatches( candidate, matches );
	}

	function candidateCoveredByDirectOccupationMatches( candidate, matches ) {
		return !!(
			candidate.isFallback &&
			directOccupationKeys( candidate ).some( function ( key ) {
				return matches[ key ];
			} )
		);
	}

	function candidateCanBeSkippedAfterDirectCountryMatch( candidate, matches ) {
		return !!(
			( candidate.isFallback ||
				( candidate.reason === 'occupation' && !/\|from\|/.test( candidate.groupId ) )
			) &&
			directOccupationKeys( candidate ).some( function ( key ) {
				return matches[ key ];
			} )
		);
	}

	function directOccupationKeys( candidate ) {
		return uniqueIds( [
			candidate.sourceOccupation,
			candidate.occupation,
			normalizeOccupationCategory( pluralize( candidate.sourceOccupation || '' ) ),
			normalizeOccupationCategory( pluralize( candidate.occupation || '' ) )
		].filter( Boolean ) );
	}

	function orderedCandidates() {
		if ( !state.selectedCandidate ) {
			return state.candidates;
		}

		return [ state.selectedCandidate ].concat( state.candidates.filter( function ( candidate ) {
			return candidate !== state.selectedCandidate;
		} ) );
	}

	function buildParentCategoryLine( candidates ) {
		var candidate = selectedParentCandidate( candidates );
		var byNameCandidate = supplementaryByNameCandidate( candidates, candidate );
		var lines = [];

		if ( candidate && candidate.name ) {
			lines.push( '[[' + candidateCategoryTitle( candidate ) + ']]' );
		}
		if ( byNameCandidate && byNameCandidate.name ) {
			lines.push( '[[' + candidateCategoryTitle( byNameCandidate ) + ']]' );
		}

		return lines.join( '\n' );
	}

	function candidateCategoryTitle( candidate ) {
		return normalizeCategoryTitle( candidate && candidate.name || '' );
	}

	function selectedParentCandidate( candidates ) {
		return candidates.filter( function ( item ) {
			return item === state.selectedCandidate;
		} )[ 0 ] || bestCategoryCandidate( candidates.filter( function ( item ) {
			return item.exists;
		} ) ) || candidates[ 0 ];
	}

	function supplementaryByNameCandidate( candidates, selectedCandidate ) {
		if ( !selectedCandidate || isByNameCandidate( selectedCandidate ) ) {
			return null;
		}

		return candidates.filter( function ( candidate ) {
			return candidate.exists &&
				candidate.reason === 'occupation + country + by name';
		} )[ 0 ] || null;
	}

	function initializeParentCategorySelections() {
		var nextSelections = {};

		groupedCandidatesForCategoryText().forEach( function ( group ) {
			var groupId = group[ 0 ].groupId;

			if ( Object.prototype.hasOwnProperty.call( state.parentCategorySelections, groupId ) ) {
				nextSelections[ groupId ] = state.parentCategorySelections[ groupId ] !== false;
				return;
			}

			nextSelections[ groupId ] = !isUniversityTeachersFromCountryGroup( group );
		} );

		state.parentCategorySelections = nextSelections;
	}

	function isUniversityTeachersFromCountryGroup( group ) {
		return group.some( function ( candidate ) {
			return /^university teachers from /i.test( candidate.name );
		} );
	}

	function createCommonsCategory() {
		var text = getCategoryTextValue();
		var updateBaseDisambiguation = currentWorkflowMode() === 'base-already-disambiguation';
		var steps = [
			{ label: 'Create Commons category', status: 'working' }
		];

		if ( updateBaseDisambiguation ) {
			steps.push(
				{ label: 'Update disambiguation category', status: 'waiting' }
			);
		}
		steps.push(
			{ label: 'Update current image category', status: 'waiting' },
			{ label: 'Set Commons sitelink on Wikidata item', status: 'waiting' },
			{ label: 'Add Commons category statement', status: 'waiting' }
		);

		$( '#CatapultPanel button' ).prop( 'disabled', true );
		renderProgressPanel( 'Working on ' + state.personCategory + '...', steps );
		state.commonsApi.postWithToken( 'csrf', {
			action: 'edit',
			title: state.personCategory,
			text: text,
			summary: CONFIG.summary,
			createonly: 1,
			format: 'json'
		} ).then( function () {
			state.personCategoryExists = true;
			setProgressStep( 0, 'done' );
			if ( !updateBaseDisambiguation ) {
				return;
			}
			return ensureBaseDisambiguationHasCurrentCategory();
		} ).then( function () {
			if ( !updateBaseDisambiguation ) {
				return;
			}
			markProgressLabelDone( 'Update disambiguation category' );
		} ).then( function () {
			return recategorizeCurrentImageFile( updateBaseDisambiguation );
		} ).then( function () {
			markProgressLabelDone( 'Update current image category' );
			return linkCommonsCategoryToItem();
		} ).then( function () {
			state.hasCommonsSitelink = true;
			state.hasPersonCommonsCategory = true;
			model.workflow.phase = 'complete';
			$( '#CatapultMultilingualSitesButton' ).remove();
			renderPanel( sentence( 'Created and linked ', commonsCategoryLink( state.personCategory ), '.' ) );
		}, function ( code, data ) {
			model.workflow.phase = 'error';
			debugWarn( 'Create/link failed', code, data );
			if ( state.personCategoryExists ) {
				renderPanel( sentence(
					'Created ',
					commonsCategoryLink( state.personCategory ),
					', but could not link it to this Wikidata item.',
					apiErrorSentence( code, data )
				) );
			} else {
				renderPanel( sentence( 'Could not create ', commonsCategoryLink( state.personCategory ), '. Check your Commons permissions.' ) );
			}
		} );
	}

	function linkExistingCommonsCategory() {
		$( '#CatapultPanel button' ).prop( 'disabled', true );
		renderProgressPanel( 'Working on ' + state.personCategory + '...', [
			{ label: 'Set Commons sitelink on Wikidata item', status: 'working' },
			{ label: 'Add Commons category statement', status: 'waiting' }
		] );
		linkCommonsCategoryToItem().then( function () {
			state.hasCommonsSitelink = true;
			state.hasPersonCommonsCategory = true;
			model.workflow.phase = 'complete';
			$( '#CatapultMultilingualSitesButton' ).remove();
			renderPanel( sentence( 'Linked ', commonsCategoryLink( state.personCategory ), ' to this Wikidata item.' ) );
		}, function ( code, data ) {
			model.workflow.phase = 'error';
			debugWarn( 'Link failed', code, data );
			renderPanel( sentence( 'Could not link ', commonsCategoryLink( state.personCategory ), '.', apiErrorSentence( code, data ) ) );
		} );
	}

	function linkCommonsCategoryToItem() {
		return setCommonsSitelink().then( function () {
			markProgressLabelDone( 'Set Commons sitelink on Wikidata item' );
			return refreshCurrentEntity();
		} ).then( function () {
			return addCommonsCategoryStatement();
		} ).then( function () {
			markProgressLabelDone( 'Add Commons category statement' );
		} );
	}

	function refreshCurrentEntity() {
		return state.localApi.get( {
			action: 'wbgetentities',
			ids: mw.config.get( 'wbEntityId' ),
			props: 'labels|claims|sitelinks',
			languages: 'en',
			languagefallback: 1,
			format: 'json'
		} ).then( function ( data ) {
			state.entity = data.entities && data.entities[ mw.config.get( 'wbEntityId' ) ] || state.entity;
			state.hasPersonCommonsCategory = !!getStringClaim( state.entity, CONFIG.properties.commonsCategory );
			state.hasCommonsSitelink = entityHasCommonsSitelink( state.entity );
		} );
	}

	function ensureBaseDisambiguationHasCurrentCategory() {
		if ( !baseCategoryNeedsDisambiguationPage() ) {
			return $.Deferred().resolve().promise();
		}

		if ( state.baseCategoryText ) {
			return writeBaseDisambiguationCategory( state.baseCategoryText );
		}

		return readCommonsPageText( state.originalPersonCategory ).then( function ( text ) {
			state.baseCategoryText = text;
			state.baseCategoryWasDisambiguation = isDisambiguationCategoryText( text );
			state.baseCategoryRedirectTarget = categoryRedirectTarget( text );
			return writeBaseDisambiguationCategory( text );
		} );
	}

	function ensurePendingBaseDisambiguationCategory() {
		var pending = state.pendingBaseDisambiguation;
		var links;
		var text;

		if ( !pending ) {
			return $.Deferred().resolve().promise();
		}

		links = pendingBaseDisambiguationLinks( pending );
		text = buildDisambiguationCategoryText( pending.text, links );

		if ( !text ) {
			return rejectInternalError( 'No disambiguation text was generated for ' + pending.title );
		}

		return state.commonsApi.postWithToken( 'csrf', {
			action: 'edit',
			title: pending.title,
			text: text,
			summary: 'Replacing category redirect with category disambiguation page using [[User:1Veertje/Catapult/app.js|Catapult]]',
			format: 'json'
		} );
	}

	function pendingBaseDisambiguationLinks( pending ) {
		var existingLinks = pending.wasDisambiguation ?
			existingDisambiguationLinks( pending.text ) :
			[];

		return uniqueIds(
			existingLinks.concat( [
				state.personCategory,
				state.personCategoryMoveTarget,
				pending.redirectTarget
			] ).concat( state.existingBaseDisambiguationTitles )
				.filter( Boolean )
				.map( normalizeCategoryTitle )
		);
	}

	function renderDisambiguationSuccess( itemId ) {
		var $list = $( '<ul>' ).css( {
			listStyle: 'none',
			margin: 0,
			padding: 0
		} );

		model.workflow.phase = 'complete';
		addSuccessListItem( $list, sentence(
			'Disambiguated ',
			commonsCategoryLink( state.originalPersonCategory )
		) );
		addSuccessListItem( $list, sentence(
			'Linked ',
			commonsCategoryLink( state.personCategory )
		) );
		if ( itemId ) {
			addSuccessListItem( $list, sentence(
				'Created item ',
				wikidataItemLinkWithText(
					itemId,
					state.originalPersonCategory + ' (' + itemId + ')'
				)
			) );
		}

		renderPanel( 'Done.' );
		$( '#CatapultPanelBody' ).append(
			$list,
			buildDisambiguationManualFollowUp()
		);
	}

	function addSuccessListItem( $list, content ) {
		$list.append(
			$( '<li>' ).append(
				$( '<span>' ).attr( 'aria-hidden', 'true' ).text( '\u2713 ' ),
				content
			)
		);
	}

	function buildDisambiguationManualFollowUp() {
		var categories = uniqueIds( [
			state.pendingBaseDisambiguation && state.pendingBaseDisambiguation.title,
			state.originalPersonCategory
		].filter( Boolean ).map( normalizeCategoryTitle ) );
		var $categories = $( '<span>' );

		categories.forEach( function ( title, index ) {
			if ( index ) {
				$categories.append( index === categories.length - 1 ? ' and ' : ', ' );
			}
			$categories.append( commonsCategoryLink( title ) );
		} );

		return $( '<div>' ).css( {
			background: '#eaecf0',
			borderLeft: '4px solid #36c',
			marginTop: '12px',
			padding: '10px 12px'
		} ).append(
			$( '<strong>' ).text( '\u2139\uFE0F Manual follow-up:' ),
			$( '<p>' ).css( {
				margin: '6px 0 0'
			} ).append(
				'Please review ',
				$categories,
				' and move all files into the newly created subcategories. Files should not remain in the disambiguation ',
				categories.length > 1 ? 'categories.' : 'category.'
			)
		);
	}

	function disambiguateUnlinkedExistingCategory( plan ) {
		var existingContentTarget;
		var currentItemTarget;

		plan = plan || buildWorkflowPlan( 'disambiguate-unlinked-existing' );
		if ( !activateWorkflowPlan( plan ) ) {
			return;
		}
		existingContentTarget = plan.existingPerson.targetCategory;
		currentItemTarget = plan.currentPerson.targetCategory;

		state.personCategoryMoveTarget = existingContentTarget;
		state.personCategory = currentItemTarget;
		state.personCategoryExists = false;
		$( '#CatapultPanel button' ).prop( 'disabled', true );
		renderProgressPanel( 'Disambiguating ' + state.originalPersonCategory + '...', [
			{ label: 'Move existing Commons category', status: 'working' },
			{ label: 'Write Commons disambiguation category', status: 'waiting' },
			{ label: 'Update depicted files', status: 'waiting' },
			{ label: 'Update current image category', status: 'waiting' },
			{ label: 'Set Commons sitelink on Wikidata item', status: 'waiting' },
			{ label: 'Add Commons category statement', status: 'waiting' },
			{ label: 'Create Wikidata item for disambiguation category', status: 'waiting' }
		] );

		prepareBaseCategoryForDisambiguation().then( function () {
			markProgressLabelDone( 'Move existing Commons category' );
			return recategorizeDepictedFiles();
		} ).then( function () {
			markProgressLabelDone( 'Write Commons disambiguation category' );
			markProgressLabelDone( 'Update depicted files' );
			return ensureCurrentCommonsCategory( buildCategoryText() );
		} ).then( function () {
			return recategorizeCurrentImageFile( true );
		} ).then( function () {
			markProgressLabelDone( 'Update current image category' );
		} ).then( function () {
			return linkCommonsCategoryToItem();
		} ).then( createCategoryDisambiguationItem )
			.then( function ( itemId ) {
				markProgressLabelDone( 'Create Wikidata item for disambiguation category' );
				state.disambiguationCategoryItem = itemId;
				state.hasCommonsSitelink = true;
				state.hasPersonCommonsCategory = true;
				$( '#CatapultMultilingualSitesButton' ).remove();
				renderDisambiguationSuccess( itemId );
			}, function ( code, data ) {
				model.workflow.phase = 'error';
				debugWarn( 'Disambiguating unlinked category failed', code, data );
				renderPanel( sentence(
					'Could not disambiguate ',
					commonsCategoryLink( state.originalPersonCategory ),
					'. Check Commons and Wikidata permissions before retrying.'
				) );
			} );
	}

	function selectedUnlinkedDisambiguationTarget() {
		if ( state.unlinkedDisambiguationTitle ) {
			return normalizeCategoryTitle( state.unlinkedDisambiguationTitle );
		}

		return state.selectedUnlinkedDisambiguationOption &&
			state.selectedUnlinkedDisambiguationOption.title || null;
	}

	function selectedLinkedMoveTarget() {
		if ( state.linkedMoveTargetTitle ) {
			return normalizeCategoryTitle( state.linkedMoveTargetTitle );
		}

		return state.personCategoryMoveTarget || null;
	}

	function selectedTargetConflictMoveTarget() {
		if ( state.targetCategoryMoveTargetTitle ) {
			return normalizeCategoryTitle( state.targetCategoryMoveTargetTitle );
		}

		return state.targetCategoryMoveTarget || null;
	}

	function selectedLinkedDisambiguationTarget() {
		if ( state.linkedDisambiguationTitle ) {
			return normalizeCategoryTitle( state.linkedDisambiguationTitle );
		}

		return state.selectedDisambiguationOption &&
			state.selectedDisambiguationOption.title ||
			state.personCategory ||
			null;
	}

	function selectedCurrentItemDisambiguationTarget() {
		var option = state.selectedCurrentItemDisambiguationOption ||
			state.selectedDisambiguationOption ||
			firstAvailableDisambiguationOption() ||
			primaryDisambiguationOptions()[ 0 ];
		var title = state.currentItemDisambiguationTitle;
		var extra = String( state.currentItemDisambiguationExtra || '' )
			.replace( /^\s*,?\s*/, '' )
			.replace( /\s+/g, ' ' )
			.trim();
		var base;

		if ( title ) {
			return normalizeCategoryTitle( title );
		}

		if ( !option ) {
			return null;
		}

		if ( !extra ) {
			return option.title;
		}

		base = option.title.replace( /\)$/i, '' );
		return base + ', ' + extra + ')';
	}

	function firstCurrentItemDisambiguationTargetDifferentFrom( title ) {
		var normalizedTitle = normalizeCategoryTitle( title );
		var option = primaryDisambiguationOptions().filter( function ( candidate ) {
				return normalizeCategoryTitle( candidate.title ) !== normalizedTitle;
			} )[ 0 ] ||
			currentItemYearDisambiguationOptions().filter( function ( candidate ) {
				return normalizeCategoryTitle( candidate.title ) !== normalizedTitle;
			} )[ 0 ];

		return option && option.title || '';
	}

	function selectedCurrentItemTargetForTargetConflict() {
		if ( state.targetCategoryCurrentTitle ) {
			return normalizeCategoryTitle( state.targetCategoryCurrentTitle );
		}

		var selectedTarget = selectedCurrentItemDisambiguationTarget();
		var fallbackTarget;

		if (
			state.targetCategoryConflictOption &&
			selectedTarget &&
			normalizeCategoryTitle( selectedTarget ) === normalizeCategoryTitle( state.targetCategoryConflictOption.title )
		) {
			fallbackTarget = preferredCurrentItemTargetAfterTargetConflict();
			if ( fallbackTarget &&
				normalizeCategoryTitle( fallbackTarget ) !== normalizeCategoryTitle( state.targetCategoryConflictOption.title )
			) {
				return fallbackTarget;
			}
		}

		return selectedTarget;
	}

	function preferredCurrentItemTargetAfterTargetConflict() {
		var option = primaryDisambiguationOptions().filter( function ( candidate ) {
				return candidate !== state.targetCategoryConflictOption &&
					( !candidate.exists || candidate.wikibaseItem === mw.config.get( 'wbEntityId' ) );
			} )[ 0 ] ||
			currentItemYearDisambiguationOptions().filter( function ( candidate ) {
				return !candidate.exists || candidate.wikibaseItem === mw.config.get( 'wbEntityId' );
			} )[ 0 ] ||
			preferredAvailableYearDisambiguationOption() ||
			primaryDisambiguationOptions()[ 0 ];

		return option && option.title || '';
	}

	function markProgressLabelDone( label ) {
		var matched = false;

		state.progressSteps.forEach( function ( step, index ) {
			if ( step.label === label ) {
				matched = true;
				setProgressStep( index, 'done' );
			} else if ( matched && step.status === 'waiting' ) {
				step.status = 'working';
				renderProgressPanel( state.progressTitle, state.progressSteps );
				matched = false;
			}
		} );
	}

	function disambiguateTargetCategoryConflict( plan ) {
		plan = plan || buildWorkflowPlan( 'target-conflict-disambiguate' );
		if ( !activateWorkflowPlan( plan ) ) {
			return;
		}

		state.originalPersonCategory = plan.existingPerson.sourceCategory;
		state.originalPersonCategoryWikibaseItem = plan.existingPerson.itemId;
		state.personCategoryWikibaseEntity = state.targetCategoryConflictEntity;
		state.personCategoryMoveTarget = plan.existingPerson.targetCategory;
		state.linkedMoveTargetTitle = state.personCategoryMoveTarget;
		state.linkedDisambiguationTitle = plan.currentPerson.targetCategory;
		state.personCategory = plan.currentPerson.targetCategory;
		state.personCategoryExists = false;
		state.personCategoryWikibaseItem = null;
		state.disambiguationNeeded = true;
		state.mergeLinkedExistingCategory = false;
		state.pendingBaseDisambiguation = plan.pendingBaseDisambiguation;
		state.baseCategoryRedirectTarget = null;
		state.baseCategoryWasDisambiguation = false;

		disambiguateCommonsCategory( plan );
	}

	function disambiguateCommonsCategory( plan ) {
		var currentCategoryText = getCategoryTextValue();

		plan = plan || buildWorkflowPlan( 'linked-base-disambiguate' );
		if ( !activateWorkflowPlan( plan ) ) {
			return;
		}

		state.personCategoryMoveTarget = plan.existingPerson.targetCategory;
		state.personCategory = plan.currentPerson.targetCategory;
		$( '#CatapultPanel button' ).prop( 'disabled', true );
		renderProgressPanel( 'Disambiguating ' + state.originalPersonCategory + '...', [
			{ label: 'Move existing Commons category', status: 'working' },
			{ label: 'Write Commons disambiguation category', status: 'waiting' },
			{ label: 'Update depicted files', status: 'waiting' },
			{ label: 'Update linked item Commons sitelink', status: 'waiting' },
			{ label: 'Create or keep current Commons category', status: 'waiting' },
			{ label: 'Update current image category', status: 'waiting' },
			{ label: 'Set Commons sitelink on Wikidata item', status: 'waiting' },
			{ label: 'Add Commons category statement', status: 'waiting' },
			{ label: 'Create Wikidata item for disambiguation category', status: 'waiting' }
		] );

		prepareBaseCategoryForDisambiguation()
			.then( function () {
				markProgressLabelDone( 'Move existing Commons category' );
				return recategorizeDepictedFiles();
			} )
			.then( function () {
				markProgressLabelDone( 'Write Commons disambiguation category' );
				markProgressLabelDone( 'Update depicted files' );
			} )
			.then( updateConflictingItemSitelink )
			.then( function () {
				markProgressLabelDone( 'Update linked item Commons sitelink' );
				return waitForSitelinkPropagation();
			} )
			.then( function () {
				return ensureCurrentCommonsCategory( currentCategoryText );
			} )
			.then( function () {
				markProgressLabelDone( 'Create or keep current Commons category' );
				return recategorizeCurrentImageFile( true );
			} )
			.then( function () {
				markProgressLabelDone( 'Update current image category' );
			} )
			.then( ensurePendingBaseDisambiguationCategory )
			.then( linkCommonsCategoryToItem )
			.then( createCategoryDisambiguationItem )
			.then( function ( itemId ) {
				markProgressLabelDone( 'Create Wikidata item for disambiguation category' );
				state.disambiguationCategoryItem = itemId;
				state.hasCommonsSitelink = true;
				state.hasPersonCommonsCategory = true;
				$( '#CatapultMultilingualSitesButton' ).remove();
				renderDisambiguationSuccess( itemId );
			}, function ( code, data ) {
				model.workflow.phase = 'error';
				debugWarn( 'Disambiguation failed', code, data );
				renderPanel( sentence(
					'Could not disambiguate ',
					commonsCategoryLink( state.originalPersonCategory ),
					'. Check Commons and Wikidata permissions before retrying.'
				) );
			} );
	}

	function moveExistingCommonsCategory() {
		return state.commonsApi.postWithToken( 'csrf', {
			action: 'move',
			from: state.originalPersonCategory,
			to: state.personCategoryMoveTarget,
			reason: 'Disambiguating Commons category using [[User:1Veertje/Catapult/app.js|Catapult]]',
			movetalk: 1,
			format: 'json'
		} );
	}

	function prepareBaseCategoryForDisambiguation() {
		return readCommonsPageText( state.originalPersonCategory ).then( function ( text ) {
			var redirectTarget = categoryRedirectTarget( text );

			if ( isDisambiguationCategoryText( text ) ) {
				state.baseCategoryWasDisambiguation = true;
				return writeBaseDisambiguationCategory( text );
			}

			if ( redirectTarget ) {
				state.baseCategoryRedirectTarget = redirectTarget;
				state.personCategoryMoveTarget = redirectTarget;
				return writeBaseDisambiguationCategory( text );
			}

			return moveExistingCommonsCategory().then( function () {
				return writeBaseDisambiguationCategory( text );
			} );
		} );
	}

	function recategorizeDepictedFiles() {
		var target = state.personCategoryMoveTarget;
		var itemId = state.originalPersonCategoryWikibaseItem;

		if ( !target || !itemId ) {
			return $.Deferred().resolve().promise();
		}

		return filesInOriginalCategoryDepictingItem( itemId ).then( function ( files ) {
			var imageTitle = imageFileTitleForEntity( state.personCategoryWikibaseEntity );

			if ( imageTitle && files.indexOf( imageTitle ) === -1 ) {
				files.push( imageTitle );
			}

			return recategorizeFiles( uniqueIds( files ), state.originalPersonCategory, target );
		} );
	}

	function recategorizeCurrentImageFile( removeOriginalCategory ) {
		var imageTitle = imageFileTitleForEntity( state.entity );
		var removeCategories = [];

		if ( !imageTitle || !state.personCategory ) {
			return $.Deferred().resolve().promise();
		}

		if ( removeOriginalCategory ) {
			removeCategories = uniqueIds( removeCategories.concat( [
				state.originalPersonCategory
			] ) );
		}

		return updateFileCategorySet(
			imageTitle,
			removeCategories,
			state.personCategory
		).then( null, function ( code, data ) {
			debugWarn( 'Could not update current image category', code, data );
			return $.Deferred().resolve().promise();
		} );
	}

	function selectedParentCategoryTitles() {
		var titles = [];

		groupedCandidatesForCategoryText().forEach( function ( candidates ) {
			var groupId = candidates[ 0 ].groupId;
			var candidate;

			if ( state.parentCategorySelections[ groupId ] === false ) {
				return;
			}

			candidate = selectedParentCandidate( candidates );
			if ( candidate && candidate.name ) {
				titles.push( candidateCategoryTitle( candidate ) );
			}
		} );

		return uniqueIds( titles );
	}

	function filesInOriginalCategoryDepictingItem( itemId ) {
		return categoryFileMembers( state.originalPersonCategory ).then( function ( files ) {
			if ( !files.length ) {
				return [];
			}

			return filesDepictingItem( files, itemId );
		} );
	}

	function categoryFileMembers( categoryTitle ) {
		var deferred = $.Deferred();

		state.commonsApi.get( {
			action: 'query',
			list: 'categorymembers',
			cmtitle: categoryTitle,
			cmnamespace: 6,
			cmlimit: 50,
			format: 'json'
		} ).then( function ( data ) {
			deferred.resolve(
				( data.query && data.query.categorymembers || [] ).map( function ( page ) {
					return {
						title: page.title,
						mediaInfoId: 'M' + page.pageid
					};
				} )
			);
		}, function () {
			deferred.resolve( [] );
		} );

		return deferred.promise();
	}

	function filesDepictingItem( files, itemId ) {
		var deferred = $.Deferred();
		var ids = files.map( function ( title ) {
			return title.mediaInfoId;
		} );

		state.commonsApi.get( {
			action: 'wbgetentities',
			ids: ids.join( '|' ),
			props: 'claims',
			format: 'json'
		} ).then( function ( data ) {
			var entities = data.entities || {};

			deferred.resolve( files.filter( function ( file, index ) {
				return claimValueIds( entities[ ids[ index ] ], CONFIG.properties.depicts )
					.indexOf( itemId ) !== -1;
			} ).map( function ( file ) {
				return file.title;
			} ) );
		}, function () {
			deferred.resolve( [] );
		} );

		return deferred.promise();
	}

	function imageFileTitleForEntity( entity ) {
		var claim = bestClaims( entity, CONFIG.properties.image )[ 0 ];
		var value = claim &&
			claim.mainsnak &&
			claim.mainsnak.datavalue &&
			claim.mainsnak.datavalue.value;

		return value ? 'File:' + String( value ).replace( /^File:/i, '' ) : '';
	}

	function recategorizeFiles( files, fromCategory, toCategory ) {
		var chain = $.Deferred().resolve().promise();

		files.forEach( function ( fileTitle ) {
			chain = chain.then( function () {
				return recategorizeFile( fileTitle, fromCategory, toCategory );
			} );
		} );

		return chain;
	}

	function recategorizeFile( fileTitle, fromCategory, toCategory ) {
		return readCommonsPageText( fileTitle ).then( function ( text ) {
			var nextText = replaceOrAppendCategory( text, fromCategory, toCategory );

			if ( nextText === text ) {
				return $.Deferred().resolve().promise();
			}

			return state.commonsApi.postWithToken( 'csrf', {
				action: 'edit',
				title: fileTitle,
				text: nextText,
				summary: 'Updating category after Commons category disambiguation using [[User:1Veertje/Catapult/app.js|Catapult]]',
				format: 'json'
			} );
		} );
	}

	function updateFileCategorySet( fileTitle, removeCategories, addCategory ) {
		return readCommonsPageText( fileTitle ).then( function ( text ) {
			var nextText = text;

			removeCategories.forEach( function ( category ) {
				nextText = removeCategory( nextText, category );
			} );
			nextText = ensureCategory( nextText, addCategory );

			if ( nextText === text ) {
				return $.Deferred().resolve().promise();
			}

			return state.commonsApi.postWithToken( 'csrf', {
				action: 'edit',
				title: fileTitle,
				text: nextText,
				summary: 'Updating image category after creating Commons category using [[User:1Veertje/Catapult/app.js|Catapult]]',
				format: 'json'
			} );
		} );
	}

	function replaceOrAppendCategory( text, fromCategory, toCategory ) {
		var fromName = fromCategory.replace( /^Category:/i, '' );
		var toName = normalizeCategoryTitle( toCategory ).replace( /^Category:/i, '' );
		var regex = new RegExp(
			'\\[\\[\\s*Category\\s*:\\s*' + escapeRegExp( fromName ) + '(\\s*(?:\\|[^\\]]*)?)\\]\\]',
			'i'
		);

		if ( regex.test( text ) ) {
			return text.replace( regex, '[[Category:' + toName + '$1]]' );
		}

		return text.replace( /\s*$/, '\n[[Category:' + toName + ']]\n' );
	}

	function removeCategory( text, categoryTitle ) {
		var categoryName = categoryTitle.replace( /^Category:/i, '' );
		var regex = new RegExp(
			'\\n?\\[\\[\\s*Category\\s*:\\s*' + escapeRegExp( categoryName ) +
				'(?:\\s*\\|[^\\]]*)?\\]\\]\\s*',
			'ig'
		);

		return text.replace( regex, '\n' ).replace( /\n{3,}/g, '\n\n' );
	}

	function ensureCategory( text, categoryTitle ) {
		var categoryName = normalizeCategoryTitle( categoryTitle ).replace( /^Category:/i, '' );
		var regex = new RegExp(
			'\\[\\[\\s*Category\\s*:\\s*' + escapeRegExp( categoryName ) +
				'(?:\\s*\\|[^\\]]*)?\\]\\]',
			'i'
		);

		if ( regex.test( text ) ) {
			return text;
		}

		return text.replace( /\s*$/, '\n[[Category:' + categoryName + ']]\n' );
	}

	function isDisambiguationCategoryText( text ) {
		return /\{\{\s*(?:disambig|disambiguation)\s*(?:\||\}\})/i.test( text );
	}

	function categoryRedirectTarget( text ) {
		var match = String( text || '' ).match(
			/\{\{\s*Category[ _]redirect\s*\|\s*(?:Category\s*:\s*)?([^|}]+?)\s*(?:[|}]|}})/i
		);

		return match ? normalizeCategoryTitle( match[ 1 ] ) : null;
	}

	function updateConflictingItemSitelink() {
		if ( !state.originalPersonCategoryWikibaseItem ) {
			return $.Deferred().resolve().promise();
		}

		return state.localApi.postWithToken( 'csrf', {
			action: 'wbsetsitelink',
			id: state.originalPersonCategoryWikibaseItem,
			assertuser: mw.config.get( 'wgUserName' ),
			linksite: 'commonswiki',
			linktitle: state.personCategoryMoveTarget,
			summary: 'Updating Commons category after disambiguation by catapult',
			format: 'json'
		} ).then( updateConflictingItemCommonsCategoryStatement );
	}

	function updateConflictingItemCommonsCategoryStatement() {
		var entity = state.personCategoryWikibaseEntity;
		var claim = bestClaims( entity, CONFIG.properties.commonsCategory )[ 0 ];
		var categoryName = state.personCategoryMoveTarget.replace( /^Category:/i, '' );

		if ( !state.originalPersonCategoryWikibaseItem || !categoryName ) {
			return $.Deferred().resolve().promise();
		}

		if ( claim && claim.id ) {
			return state.localApi.postWithToken( 'csrf', {
				action: 'wbsetclaimvalue',
				claim: claim.id,
				snaktype: 'value',
				value: JSON.stringify( categoryName ),
				summary: 'Updating Commons category after category move by catapult',
				format: 'json'
			} );
		}

		return state.localApi.postWithToken( 'csrf', {
			action: 'wbcreateclaim',
			entity: state.originalPersonCategoryWikibaseItem,
			property: CONFIG.properties.commonsCategory,
			snaktype: 'value',
			value: JSON.stringify( categoryName ),
			summary: 'Adding moved Commons category after disambiguation by catapult',
			format: 'json'
		} );
	}

	function waitForSitelinkPropagation() {
		var deferred = $.Deferred();

		window.setTimeout( function () {
			deferred.resolve();
		}, 1000 );

		return deferred.promise();
	}

	function ensureCurrentCommonsCategory( text ) {
		if ( state.personCategoryExists ) {
			return ensureWikidataInfoboxOnCommonsCategory();
		}

		return state.commonsApi.postWithToken( 'csrf', {
			action: 'edit',
			title: state.personCategory,
			text: text,
			summary: CONFIG.summary,
			createonly: 1,
			format: 'json'
		} ).then( function () {
			state.personCategoryExists = true;
		} );
	}

	function ensureWikidataInfoboxOnCommonsCategory() {
		return readCommonsPageText( state.personCategory ).then( function ( text ) {
			if ( /\{\{\s*Wikidata[ _]Infobox\b/i.test( text ) ) {
				return $.Deferred().resolve().promise();
			}

			return state.commonsApi.postWithToken( 'csrf', {
				action: 'edit',
				title: state.personCategory,
				text: '{{Wikidata Infobox}}\n' + text.replace( /^\s+/, '' ),
				summary: 'Adding {{Wikidata Infobox}} using [[User:1Veertje/Catapult/app.js|Catapult]]',
				format: 'json'
			} );
		} );
	}

	function readCommonsPageText( title ) {
		var deferred = $.Deferred();

		state.commonsApi.get( {
			action: 'query',
			prop: 'revisions',
			titles: title,
			rvprop: 'content',
			rvslots: 'main',
			formatversion: 2,
			format: 'json'
		} ).then( function ( data ) {
			var page = data.query && data.query.pages && data.query.pages[ 0 ];
			var revision = page && page.revisions && page.revisions[ 0 ];
			var slot = revision && revision.slots && revision.slots.main;

			deferred.resolve( slot && slot.content || '' );
		}, deferred.reject );

		return deferred.promise();
	}

	function writeBaseDisambiguationCategory( existingText ) {
		var text = buildBaseDisambiguationCategoryText( existingText );

		if ( !text ) {
			return rejectInternalError( 'No disambiguation text was generated for ' + state.originalPersonCategory );
		}

		return state.commonsApi.postWithToken( 'csrf', {
			action: 'edit',
			title: state.originalPersonCategory,
			text: text,
			summary: 'Replacing category redirect with category disambiguation page using [[User:1Veertje/Catapult/app.js|Catapult]]',
			format: 'json'
		} );
	}

	function createCategoryDisambiguationItem() {
		return state.localApi.postWithToken( 'csrf', {
			action: 'wbeditentity',
			new: 'item',
			data: JSON.stringify( buildCategoryDisambiguationEntityData() ),
			summary: 'Creating Wikidata item for Commons category disambiguation page',
			format: 'json'
		} ).then( function ( data ) {
			return data.entity && data.entity.id || null;
		} );
	}

	function buildBaseDisambiguationCategoryText( existingText ) {
		var text = buildDisambiguationCategoryText( existingText, disambiguationCategoryLinks( existingText ) );

		if ( state.pendingBaseDisambiguation ) {
			text += '{{See also|' + state.pendingBaseDisambiguation.title + '}}\n';
		}

		return text;
	}

	function buildDisambiguationCategoryText( existingText, links ) {
		return '{{disambig}}\n' + links.map( function ( title ) {
			return '* [[:' + title + ']]';
		} ).join( '\n' ) + '\n';
	}

	function disambiguationCategoryLinks( existingText ) {
		var existingLinks = isDisambiguationCategoryText( existingText ) ?
			existingDisambiguationLinks( existingText ) :
			[];
		var includeExistingOptions = !state.pendingBaseDisambiguation;

		return uniqueIds(
			existingLinks
				.concat( [ state.baseCategoryRedirectTarget, state.personCategoryMoveTarget, state.personCategory ] )
				.concat( includeExistingOptions ?
					state.disambiguationOptions.filter( function ( option ) {
						return option.exists;
					} ).map( function ( option ) {
						return option.title;
					} ) :
					[]
				)
				.filter( Boolean )
				.map( normalizeCategoryTitle )
				.filter( function ( title ) {
					return title !== normalizeCategoryTitle( state.originalPersonCategory );
				} )
		);
	}

	function existingDisambiguationLinks( text ) {
		var links = [];
		var regex = /\[\[\s*:?\s*Category\s*:\s*([^\]|#]+)(?:[|#][^\]]*)?\]\]/ig;
		var match;

		while ( ( match = regex.exec( text || '' ) ) !== null ) {
			links.push( normalizeCategoryTitle( match[ 1 ] ) );
		}

		return links;
	}

	function buildCategoryDisambiguationEntityData() {
		var label = state.originalPersonCategory;

		return {
			labels: {
				en: {
					language: 'en',
					value: label
				}
			},
			descriptions: {
				en: {
					language: 'en',
					value: 'Wikimedia category disambiguation page'
				}
			},
			sitelinks: {
				commonswiki: {
					site: 'commonswiki',
					title: state.originalPersonCategory
				}
			},
			claims: [ {
				mainsnak: {
					snaktype: 'value',
					property: CONFIG.properties.instanceOf,
					datavalue: {
						type: 'wikibase-entityid',
						value: {
							'entity-type': 'item',
							'numeric-id': 15407973,
							id: CONFIG.items.categoryDisambiguationPage
						}
					}
				},
				type: 'statement',
				rank: 'normal'
			} ]
		};
	}

	function setCommonsSitelink() {
		var deferred = $.Deferred();
		var currentTitle = commonsSitelinkTitle( state.entity );

		if (
			currentTitle &&
			normalizeCategoryTitle( currentTitle ) === normalizeCategoryTitle( state.personCategory )
		) {
			return deferred.resolve().promise();
		}

		state.localApi.postWithToken( 'csrf', {
			action: 'wbsetsitelink',
			id: mw.config.get( 'wbEntityId' ),
			assertuser: mw.config.get( 'wgUserName' ),
			linksite: 'commonswiki',
			linktitle: state.personCategory,
			summary: 'Linking Commons category created by catapult',
			format: 'json'
		} ).then( deferred.resolve, function ( code, data ) {
			debugWarn( 'Could not set Commons sitelink', code, data );
			deferred.reject( code, data );
		} );

		return deferred.promise();
	}

	function addCommonsCategoryStatement() {
		var deferred = $.Deferred();
		var categoryName = state.personCategory.replace( /^Category:/i, '' );
		var claim = bestClaims( state.entity, CONFIG.properties.commonsCategory )[ 0 ];
		var currentCategoryName = getStringClaim( state.entity, CONFIG.properties.commonsCategory );

		if ( normalizeCategoryTitle( currentCategoryName ) === normalizeCategoryTitle( categoryName ) ) {
			return deferred.resolve().promise();
		}

		if ( claim && claim.id ) {
			state.localApi.postWithToken( 'csrf', {
				action: 'wbsetclaimvalue',
				claim: claim.id,
				snaktype: 'value',
				value: JSON.stringify( categoryName ),
				summary: 'Updating Commons category linked by catapult',
				format: 'json'
			} ).then( deferred.resolve, function ( code, data ) {
				debugWarn( 'Could not update Commons category statement', code, data );
				deferred.reject( code, data );
			} );

			return deferred.promise();
		}

		state.localApi.postWithToken( 'csrf', {
			action: 'wbcreateclaim',
			entity: mw.config.get( 'wbEntityId' ),
			property: CONFIG.properties.commonsCategory,
			snaktype: 'value',
			value: JSON.stringify( categoryName ),
			summary: 'Adding Commons category created by catapult',
			format: 'json'
		} ).then( deferred.resolve, function ( code, data ) {
			debugWarn( 'Could not add Commons category statement', code, data );
			deferred.reject( code, data );
		} );

		return deferred.promise();
	}

	function isHuman( entity ) {
		return hasClaimValue( entity, CONFIG.properties.instanceOf, CONFIG.items.human );
	}

	function isCategoryDisambiguationItem( entity ) {
		return hasClaimValue(
			entity,
			CONFIG.properties.instanceOf,
			CONFIG.items.categoryDisambiguationPage
		);
	}

	function claimValueIds( entity, property ) {
		return bestClaims( entity, property ).map( function ( claim ) {
			var value = claim.mainsnak &&
				claim.mainsnak.datavalue &&
				claim.mainsnak.datavalue.value;

			return value && value.id;
		} ).filter( Boolean );
	}

	function bestClaims( entity, property ) {
		var claims = entity && entity.claims && entity.claims[ property ] || [];
		var preferred;

		claims = claims.filter( function ( claim ) {
			return claim.rank !== 'deprecated';
		} );

		preferred = claims.filter( function ( claim ) {
			return claim.rank === 'preferred';
		} );

		return preferred.length ? preferred : claims;
	}

	function hasClaimValue( entity, property, qid ) {
		return $.inArray( qid, claimValueIds( entity, property ) ) !== -1;
	}

	function getStringClaim( entity, property ) {
		var claim = bestClaims( entity, property )[ 0 ];
		var value = claim &&
			claim.mainsnak &&
			claim.mainsnak.datavalue &&
			claim.mainsnak.datavalue.value;

		return typeof value === 'string' ? value : '';
	}

	function getEnglishMonolingualTextClaim( entity, property ) {
		var fallback = '';

		bestClaims( entity, property ).some( function ( claim ) {
			var value = claim &&
				claim.mainsnak &&
				claim.mainsnak.datavalue &&
				claim.mainsnak.datavalue.value;

			if ( value && value.text ) {
				if ( value.language === 'en' ) {
					fallback = value.text;
					return true;
				}
				if ( !fallback ) {
					fallback = value.text;
				}
			}

			return false;
		} );

		return fallback;
	}

	function englishLabel( entity ) {
		return entity &&
			entity.labels &&
			entity.labels.en &&
			entity.labels.en.value;
	}

	function englishDescription( entity ) {
		return entity &&
			entity.descriptions &&
			entity.descriptions.en &&
			entity.descriptions.en.value;
	}

	function uniqueIds( ids ) {
		var seen = {};

		return ids.filter( function ( id ) {
			if ( !id || seen[ id ] ) {
				return false;
			}
			seen[ id ] = true;
			return true;
		} );
	}

	function apiErrorSentence( code, data ) {
		var error = data && data.error;
		var details = error && ( error.info || error.code ) || code;

		if ( !details ) {
			return '';
		}

		return sentence(
			$( '<br>' ),
			$( '<span>' ).css( { color: '#990000' } ).text( 'API error: ' + details )
		);
	}

	function rejectInternalError( message ) {
		var deferred = $.Deferred();

		deferred.reject( 'catapult-internal-error', {
			error: {
				code: 'catapult-internal-error',
				info: message
			}
		} );

		return deferred.promise();
	}

	function debugWarn() {
		if ( !CONFIG.debug || !window.console || !console.warn ) {
			return;
		}

		console.warn.apply( console, [ '[catapult]' ].concat(
			Array.prototype.slice.call( arguments )
		) );
	}
}( mediaWiki, jQuery ) );
// </nowiki>
