# Catapult

Catapult is a Wikidata gadget for creating, linking, and disambiguating Wikimedia Commons categories from Wikidata data.

The live gadget is published as:

- `User:1VeertjeBot/commonsCat.js`
- `User:1VeertjeBot/commonsCat/app.js`
- `User:1VeertjeBot/commonsCat/styles.css`
- `User:1VeertjeBot/commonsCat/mappings.json`

## Files

- `commonsCat.js` — small bootstrap loader.
- `commonsCat/app.js` — main gadget application.
- `commonsCat/styles.css` — interface styling.
- `commonsCat/mappings.json` — category and occupation mappings.

## Validation

```powershell
node --check commonsCat.js
node --check commonsCat\app.js
```
