# Catapult

Catapult is a Wikidata gadget for creating, linking, and disambiguating Wikimedia Commons categories from Wikidata data.

The Wikidata-side gadget files are:

- `User:1Veertje/Catapult/app.js`
- `User:1Veertje/Catapult/styles.css`
- `User:1Veertje/Catapult/mappings.json`

The optional Commons-side loader is separate:

- `User:1Veertje/Catapult-loader.js`

That loader exists only to run Catapult while staying on Commons. It is not part of the core Wikidata gadget flow.

## Files

- `catapult/app.js` — main gadget application.
- `catapult/styles.css` — interface styling.
- `catapult/mappings.json` — category and occupation mappings.
- `commons/catapult-loader.js` — optional Commons bootstrap loader.

## Validation

```powershell
node --check catapult/app.js
node --check commons/catapult-loader.js
```
