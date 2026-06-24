# Catapult

Catapult helps propel data from Wikidata to Wikimedia Commons by assisting with the creation and disambiguation of Commons categories.

## Install

Add to your Wikidata [`common.js`](https://www.wikidata.org/wiki/Special:MyPage/common.js):

```js
importScript( 'User:1Veertje/Catapult.js' );
```

## Debug

Append `?catapultDebug=1` to any Wikidata URL to enable console logging:

```
https://www.wikidata.org/wiki/Q42?catapultDebug=1
```

## Wiki files

Stable release under `User:1Veertje`:

| Page | |
|------|--|
| `User:1Veertje/Catapult.js` | bootstrap loader |
| `User:1Veertje/Catapult/app.js` | main application |
| `User:1Veertje/Catapult/styles.css` | interface styling |
| `User:1Veertje/Catapult/mappings.json` | category / occupation mappings |

Development under `User:1VeertjeBot`:

| Page | |
|------|--|
| `User:1VeertjeBot/catapult.js` | bootstrap loader |
| `User:1VeertjeBot/catapult/app.js` | main application |
| `User:1VeertjeBot/catapult/styles.css` | interface styling |
| `User:1VeertjeBot/catapult/mappings.json` | category / occupation mappings |

The Commons-side bootstrap (`User:1VeertjeBot/catapult.js` on Commons) exists to run Catapult while staying on Commons. It is not part of the core Wikidata gadget flow.

## Repo

| Directory | |
|-----------|--|
| `catapult/app.js` | main gadget application |
| `catapult/styles.css` | interface styling |
| `catapult/mappings.json` | category and occupation mappings |
| `commons/catapult-loader.js` | Commons bootstrap loader |

## Validate

```
node --check catapult/app.js
node --check commons/catapult-loader.js
```
