---
name: sunglasses-color-maintainer
description: Maintain the sunglasses color intelligence site in this repo. Use when updating brand HTML or catalog data, recalibrating lens hue/category/frame-family classifications, regenerating Overview/Market Signals/Pairings/Catalog data, preparing Railway deployment, or explaining how to safely maintain this sunglasses color analysis website.
---

# Sunglasses Color Maintainer

Use this skill to update the sunglasses color intelligence site without breaking the generated outputs or losing the original product names.

## Core Rule

Treat `work/` as the source of generation logic and `outputs/site/` as generated deliverables.

Do not hand-edit `outputs/site/app.js`, `outputs/site/app.css`, `outputs/site/data/catalog.json`, or `outputs/site/data/insights.json` unless the user explicitly wants a one-off patch. Prefer editing:

- `work/build_combined.js` for extraction, normalization, hex calibration, `lensHue`, `cat`, and `frameFamily`.
- `work/build_site.js` for UI, charts, Overview, Market Signals, Pairings, Catalog, and Data Admin.

Then regenerate outputs.

## Standard Workflow

1. Inspect current files with `rg --files`, `rg`, and targeted reads.
2. If source HTML changed, run:
   `npm run build:all`
3. If only UI or insight logic changed, run:
   `npm run build:site`
4. Validate generated JavaScript:
   `node --check work/build_site.js`
   `node --check outputs/site/app.js`
5. If interaction changed, start local preview with `npm start` and verify the page in a browser.
6. Stop the local preview server before finishing.

## Data Contract

Catalog records should preserve original product naming and include:

- `brand`
- `product`
- `rank`
- `frameColor`
- `frameFamily`
- `lensName`
- `lensHue`
- `hueHex`
- `hueSource`
- `cat`
- `img`

Keep original brand/product/lens/frame names intact. Add normalized fields beside them; do not overwrite the original names.

## Classification Guidance

Use hex first, then name fallback.

- `lensHue`: normalize to the site hue vocabulary such as `black`, `grey`, `brown`, `amber`, `yellow`, `orange`, `rose`, `violet`, `blue`, `teal`, `green`, `olive`, `clear`, `unknown`.
- `cat`: classify lens treatment as `sun`, `tint`, or `gradient`.
- `frameFamily`: normalize frame color families such as `Black / Ink`, `Tortoise / Brown`, `Grey / Silver`, `Blue / Navy`, `Rose / Red / Purple`, and similar families already used by the project.

If a new color name is ambiguous, preserve the original `lensName`, add the best normalized `lensHue`, and leave enough evidence in code or data comments only if the choice is not obvious.

## AI-Assisted Updates

When using a model to classify new brand data:

1. Ask it to output structured JSON only.
2. Require it to preserve `product`, `lensName`, and `frameColor` exactly.
3. Let it propose `lensHue`, `cat`, `frameFamily`, and optional confidence.
4. Review low-confidence or `unknown` values manually.
5. Commit the reviewed mapping into the builder or the catalog input, not into generated UI files.

## Overview And Insights

Overview is generated from `outputs/site/data/catalog.json`. Do not manually write conclusions that are not backed by current data.

Useful Overview dimensions:

- category mix: `sun`, `tint`, `gradient`
- hue ranking
- gradient hue focus
- category hue mix
- lens hue x frame family heatmap
- hex spectrum distribution from `hueHex`
- merchandising color markers

## Deployment

Railway uses:

- `package.json`
- `server.mjs`
- `railway.json`
- `outputs/site/`

After rebuilding, deploy the repo to Railway. The server serves `outputs/site` and uses `PORT` from Railway.

## Human Maintenance Reference

For the handoff guide, read `docs/MAINTENANCE.md`.
