# Catapult

Catapult helps propel data from Wikidata to Wikimedia Commons by assisting with the creation and disambiguation of Commons categories.

## Install

Add this line to [your common.js](https://www.wikidata.org/wiki/Special:MyPage/common.js) on Wikidata:

```js
importScript( 'User:1Veertje/Catapult.js' );
```

`Catapult.js` is the bootloader — it loads the gadget files below on demand.

## Debug

Append `?catapultDebug=1` to any Wikidata URL to enable console logging:

```
https://www.wikidata.org/wiki/Q42?catapultDebug=1
```

## Wiki files

All files live under `User:1Veertje` on Wikidata:

| Page | Function |
|------|----------|
| `User:1Veertje/Catapult.js` | bootloader |
| `User:1Veertje/Catapult/app.js` | main application |
| `User:1Veertje/Catapult/styles.css` | interface styling |
| `User:1Veertje/Catapult/mappings.json` | category / occupation mappings |

## Repo

| File | Purpose |
|------|---------|
| `catapult.js` | bootloader |
| `app.js` | main gadget application |
| `styles.css` | interface styling |
| `mappings.json` | category and occupation mappings |

## Validate

```
node --check app.js
```
