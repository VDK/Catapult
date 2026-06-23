# Catapult

Catapult is a Wikidata userscript for creating, linking, and disambiguating Wikimedia Commons categories from Wikidata data.

The live gadget is published as:

- `User:1VeertjeBot/commonsCat.js`
- `User:1VeertjeBot/commonsCat/app.js`
- `User:1VeertjeBot/commonsCat/styles.css`
- `User:1VeertjeBot/commonsCat/mappings.json`

## Files

- `commonsCat.js` — small bootstrap loader.
- `commonsCat/app.js` — main userscript application.
- `commonsCat/styles.css` — interface styling.
- `commonsCat/mappings.json` — category and occupation mappings.
- `upload_commonscat_to_wikidata.py` — local deployment helper for Wikidata user pages.
- `upload_commonscat_to_commons.py` — local deployment helper for the Commons bootstrap page.

The deployment helpers currently contain local filesystem paths and require a working Pywikibot setup.

## Validation

```powershell
node --check commonsCat.js
node --check commonsCat\app.js
```
