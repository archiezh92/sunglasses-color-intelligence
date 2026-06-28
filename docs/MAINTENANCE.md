# Sunglasses Color Intelligence Maintenance

This project turns scraped brand HTML/catalog data into a static sunglasses color intelligence site.

## What Gets Maintained

- Product records and images
- Lens hue classification
- Sun / tint / gradient classification
- Frame color family classification
- Overview charts and heatmaps
- Pairing cases
- Market Signals
- Railway deployment output

## Important Files

Source logic:

- `work/build_combined.js`: extracts and normalizes source HTML, preserves original product names, recalibrates colors with hex/name rules, and generates combined data.
- `work/build_site.js`: builds the static site UI and generated JSON data.

Generated outputs:

- `outputs/combined-sunglasses-color-map.html`
- `outputs/combined-sunglasses-analysis.json`
- `outputs/site/index.html`
- `outputs/site/app.css`
- `outputs/site/app.js`
- `outputs/site/data/catalog.json`
- `outputs/site/data/insights.json`

Deployment:

- `package.json`
- `server.mjs`
- `railway.json`
- `outputs/site/DEPLOY_RAILWAY.md`

## Normal Update Flow

If new source HTML or brand scrape data changed:

```bash
npm run build:all
```

If only UI, charts, or insight logic changed:

```bash
npm run build:site
```

Validate after rebuilding:

```bash
node --check work/build_site.js
node --check outputs/site/app.js
```

Preview locally:

```bash
npm start
```

Open `http://localhost:3000/`.

## Color Classification Contract

Always preserve original brand strings:

- `product`
- `lensName`
- `frameColor`

Add normalized analysis fields beside the original strings:

- `lensHue`
- `hueHex`
- `hueSource`
- `cat`
- `frameFamily`

Do not rename products just to make analytics easier.

## Lens Hue Rules

Prefer `hueHex` over text names when possible. Text names are a fallback.

Current normalized hue vocabulary:

- `black`
- `grey`
- `brown`
- `amber`
- `yellow`
- `orange`
- `rose`
- `violet`
- `blue`
- `teal`
- `green`
- `olive`
- `clear`
- `unknown`

If a brand launches a color name that does not map cleanly, keep the original name and classify the normalized hue conservatively. Use `unknown` only when the data is truly insufficient.

## Category Rules

Use `cat` for lens treatment:

- `sun`: ordinary sunglass lens or dark functional lens
- `tint`: lighter fashion tint or custom tint
- `gradient`: gradient lens

Gradient naming should win over generic color naming. For example, `Brown Gradient` should be `cat: "gradient"` and `lensHue: "brown"`.

## Frame Family Rules

Use `frameFamily` to compare frame colors across brands without losing original names.

Examples:

- black, ink, classic black -> `Black / Ink`
- tortoise, brown, walnut, chocolate -> `Tortoise / Brown`
- silver, grey, graphite -> `Grey / Silver`
- blue, navy, cosmic blue -> `Blue / Navy`
- rose, red, ruby, purple, violet -> `Rose / Red / Purple`

Keep the brand's exact `frameColor` in the catalog.

## AI-Assisted Classification

When using a large model to classify newly scraped products, ask for structured JSON and require exact preservation of original names.

Recommended prompt shape:

```text
Classify these sunglasses records. Preserve product, lensName, and frameColor exactly.
Return JSON records with lensHue, cat, frameFamily, hueHex if inferable, and confidence.
Use only the existing normalized vocabularies unless there is no reasonable match.
```

Review:

- low-confidence values
- `unknown`
- new color names
- gradient/tint ambiguity
- frame colors that mix material and lens names

After review, put durable logic into `work/build_combined.js` or the input mapping, then rebuild.

## Overview Maintenance

Overview should stay data-backed. It currently includes:

- category mix
- overall hue ranking
- gradient hue focus
- brand category mix
- category hue mix
- merchandising color markers
- hex spectrum distribution
- lens hue x frame family heatmap
- interactive hue map

If adding a new chart, calculate it from `catalog.json` or `insights.json`. Avoid static claims that are not tied to current data.

## Market Signals Maintenance

Market Signals has two kinds of evidence:

- official/current website signal
- local best-selling scrape signal

Label unverified current signals clearly. Do not invent "newest" or "hero" colors if the current site cannot be checked.

## Railway Deployment

Railway runs:

```bash
npm start
```

`server.mjs` serves `outputs/site` and uses Railway's `PORT` environment variable.

Use `outputs/site/DEPLOY_RAILWAY.md` for deployment steps.

## Quick Handoff Checklist

1. Add or update source data.
2. Rebuild with `npm run build:all` or `npm run build:site`.
3. Run JS checks.
4. Preview locally.
5. Confirm images load.
6. Check Overview and Market Signals.
7. Deploy to Railway.

## Codex Skill

This repo includes a project skill:

```text
.codex/skills/sunglasses-color-maintainer/SKILL.md
```

When asking Codex to update this project later, say:

```text
Use the sunglasses-color-maintainer skill to update the sunglasses color site with the new data.
```
