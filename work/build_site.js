const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'outputs');
const SITE = path.join(OUT, 'site');
const DATA_DIR = path.join(SITE, 'data');
const DOCS_DIR = path.join(SITE, 'docs');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function extractCombinedData() {
  const htmlPath = path.join(OUT, 'combined-sunglasses-color-map.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const match = html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('combined HTML data payload was not found');
  return JSON.parse(match[1]);
}

function buildInsights(data) {
  const hueOrder = data.hueSummary
    .slice()
    .sort((a, b) => b.brandCount - a.brandCount || b.count - a.count)
    .map(x => x.hue);
  const byHue = {};
  for (const hue of hueOrder) {
    const rows = data.records.filter(r => r.lensHue === hue);
    const variants = new Map();
    const brandCounts = new Map();
    const categoryCounts = new Map();
    for (const row of rows) {
      const item = variants.get(row.lensName) || {
        name: row.lensName,
        count: 0,
        brands: new Set(),
        categories: new Set(),
        examples: [],
      };
      item.count += 1;
      item.brands.add(row.brand);
      item.categories.add(row.cat);
      if (item.examples.length < 4 && row.img) item.examples.push(row);
      variants.set(row.lensName, item);
      brandCounts.set(row.brand, (brandCounts.get(row.brand) || 0) + 1);
      categoryCounts.set(row.cat, (categoryCounts.get(row.cat) || 0) + 1);
    }
    byHue[hue] = {
      hue,
      variants: [...variants.values()]
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .map(v => ({
          name: v.name,
          count: v.count,
          brands: [...v.brands],
          categories: [...v.categories],
          examples: v.examples,
        })),
      brandCounts: Object.fromEntries([...brandCounts.entries()].sort((a, b) => b[1] - a[1])),
      categoryCounts: Object.fromEntries([...categoryCounts.entries()].sort((a, b) => b[1] - a[1])),
      frameFamilies: data.frameByHue[hue] || [],
      examples: rows
        .slice()
        .sort((a, b) => a.rank - b.rank)
        .filter((row, idx, arr) => arr.findIndex(x => x.brand === row.brand && x.product === row.product && x.lensName === row.lensName) === idx)
        .slice(0, 18),
    };
  }
  return {
    generatedAt: data.generatedAt,
    totals: data.totals,
    hueOrder,
    hueSummary: data.hueSummary,
    frameByHue: data.frameByHue,
    byHue,
    research: [
      {
        title: 'Warby Parker official sunglasses shelf',
        url: 'https://www.warbyparker.com/sunglasses',
        confidence: 'High',
        takeaway: 'Official page exposes Bestsellers, New arrivals, Trending: 90s minimalism, 120 frames, and current promo language around Boaz as a newest bestseller.',
      },
      {
        title: 'Meta official shop-all',
        url: 'https://www.meta.com/ai-glasses/shop-all/',
        confidence: 'High',
        takeaway: 'Featured order starts with new Meta Glasses Starfire Kylie Edition, Adventurer, Fury, then Ray-Ban/Oakley Meta families.',
      },
      {
        title: '2026 sunglasses trend reporting',
        url: 'https://www.whowhatwear.com/fashion/trends/sunglasses-trends-2026',
        confidence: 'Medium',
        takeaway: 'Trend layer favors oversized silhouettes, wire frames, thick acetate, cat-eyes, and high-impact color lenses.',
      },
      {
        title: 'Light tint / non-sun sunglasses',
        url: 'https://www.theguardian.com/fashion/2026/mar/06/non-sun-sunglasses-sport-fashion-fusion-accessory-goes-mainstream',
        confidence: 'Medium',
        takeaway: 'Light tint and performance/shield influenced sunglasses are moving into everyday fashion.',
      },
    ],
  };
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function applyDefaultCorrections(data) {
  const corrections = {
    'moscot:1:6:tokyo-tortoise': { lensHue: 'blue', hueHex: '#26777a', hueSource: 'visual-default-correction' },
    'moscot:1:12:matte-tortoise': { lensHue: 'blue', hueHex: '#26777a', hueSource: 'visual-default-correction' },
  };
  const manualPath = path.join(process.cwd(), 'work', 'lens-color-overrides.json');
  const manual = fs.existsSync(manualPath) ? JSON.parse(fs.readFileSync(manualPath, 'utf8')) : {};
  const normalizeHue = hue => hue === 'olive' ? 'green' : hue;
  data.records.forEach(row => {
    const c = corrections[row.id];
    if (c) {
      row.lensHue = normalizeHue(c.lensHue);
      row.hueHex = c.hueHex;
      row.hueSource = c.hueSource;
    }
    if (row.lensHue === 'olive') row.lensHue = 'green';
    const override = manual[row.id];
    if (!override) return;
    if (override.lensHue) row.lensHue = normalizeHue(override.lensHue);
    if (override.cat) row.cat = override.cat;
    row.hueSource = 'reviewed-correction';
  });
  data.classifiers.forEach(row => {
    if (row.hue === 'olive') row.hue = 'green';
  });
}

const HUE_ORDER = ['black', 'grey', 'brown', 'amber', 'yellow', 'orange', 'rose', 'violet', 'blue', 'teal', 'green', 'unknown'];
const HUE_LABELS = {
  black: 'Black',
  grey: 'Grey / Smoke',
  brown: 'Brown',
  amber: 'Amber / Tortoise',
  yellow: 'Yellow',
  orange: 'Orange',
  rose: 'Rose / Red',
  violet: 'Violet',
  blue: 'Blue',
  teal: 'Teal',
  green: 'Green / G-15 / Olive / Khaki',
  unknown: 'Unknown',
};

function refreshDataSummaries(data) {
  data.hueSummary = HUE_ORDER.map(hue => {
    const rows = data.records.filter(r => r.lensHue === hue);
    const brands = [...new Set(rows.map(r => r.brand))];
    const cats = rows.reduce((acc, r) => {
      acc[r.cat] = (acc[r.cat] || 0) + 1;
      return acc;
    }, {});
    const examples = [...new Set(rows.map(r => r.lensName))].slice(0, 10);
    return {
      hue,
      label: HUE_LABELS[hue],
      count: rows.length,
      brandCount: brands.length,
      brands,
      cats,
      examples,
    };
  }).filter(x => x.count);

  data.frameByHue = {};
  for (const hue of HUE_ORDER) {
    const rows = data.records.filter(r => r.lensHue === hue);
    if (!rows.length) continue;
    const byFrame = new Map();
    rows.forEach(r => {
      const cur = byFrame.get(r.frameFamily) || { frameFamily: r.frameFamily, count: 0, weighted: 0, examples: new Set(), brands: new Set() };
      cur.count += 1;
      cur.weighted += r.weight || 0;
      cur.examples.add(r.frameColor);
      cur.brands.add(r.brand);
      byFrame.set(r.frameFamily, cur);
    });
    data.frameByHue[hue] = [...byFrame.values()]
      .sort((a, b) => b.weighted - a.weighted || b.count - a.count)
      .slice(0, 5)
      .map(x => ({
        frameFamily: x.frameFamily,
        count: x.count,
        weighted: Math.round(x.weighted),
        examples: [...x.examples].slice(0, 6),
        brands: [...x.brands],
      }));
  }
}

function writeSite(data, insights) {
  writeFile(path.join(DATA_DIR, 'catalog.json'), JSON.stringify({
    generatedAt: data.generatedAt,
    records: data.records,
    classifiers: data.classifiers,
  }));
  writeFile(path.join(DATA_DIR, 'insights.json'), JSON.stringify(insights));
  writeFile(path.join(DOCS_DIR, 'MAINTENANCE.md'), fs.readFileSync(path.join(ROOT, 'docs', 'MAINTENANCE.md'), 'utf8'));
  writeFile(path.join(DOCS_DIR, 'sunglasses-color-maintainer.SKILL.md'), fs.readFileSync(path.join(ROOT, '.codex', 'skills', 'sunglasses-color-maintainer', 'SKILL.md'), 'utf8'));
  writeFile(path.join(DOCS_DIR, 'sunglasses-color-maintainer.openai.yaml'), fs.readFileSync(path.join(ROOT, '.codex', 'skills', 'sunglasses-color-maintainer', 'agents', 'openai.yaml'), 'utf8'));

  writeFile(path.join(SITE, 'index.html'), `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sunglasses Lens Intelligence</title>
<link rel="stylesheet" href="./app.css?v=manual-save-v2">
</head>
<body>
<header class="top">
  <div>
    <p class="eyebrow">Lens color intelligence</p>
    <h1>Sunglasses Tint, Gradient & Frame Pairing Explorer</h1>
  </div>
  <div class="topStats" id="topStats"></div>
</header>
<nav class="nav">
  <button class="navBtn active" data-view="overview">Overview</button>
  <button class="navBtn" data-view="hue">Hue Lab</button>
  <button class="navBtn" data-view="pairing">Pairings</button>
  <button class="navBtn" data-view="market">Market Signals</button>
  <button class="navBtn" data-view="catalog">Catalog</button>
  <button class="navBtn" data-view="data">Data Admin</button>
</nav>
<div class="globalNote">⚠ 颜色分类依据<b>镜片类型</b>，非产品图片整体视觉。图片展示镜架+镜片组合，视觉主色由<b>镜架颜色</b>主导——例如深棕镜架配蓝色镜片，图片整体偏棕，但分类标注为蓝色。</div>
<main>
  <section id="overview" class="view active"></section>
  <section id="hue" class="view"></section>
  <section id="pairing" class="view"></section>
  <section id="market" class="view"></section>
  <section id="catalog" class="view"></section>
  <section id="data" class="view"></section>
</main>
<template id="cardTemplate">
  <figure class="productCard">
    <img loading="lazy" alt="">
    <figcaption></figcaption>
  </figure>
</template>
<script type="module" src="./app.js?v=manual-save-v2"></script>
</body>
</html>`);

  writeFile(path.join(SITE, 'app.css'), `:root{--bg:#f5f1ea;--ink:#1d1c1a;--mut:#716b62;--line:#ded5c8;--panel:#fffdf9;--soft:#ece5da;--brown:#6b4a34;--blue:#276d98;--green:#48694c;--rose:#9b5265;--grey:#656766;--amber:#b07a35;--black:#1f1f1f;--violet:#7560a8;--yellow:#d7aa22;--accent:#111}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}button,input,select{font:inherit}button{cursor:pointer}.top{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;padding:24px 28px 18px;border-bottom:1px solid var(--line)}.eyebrow{margin:0 0 4px;color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.08em}h1{margin:0;font-size:28px;line-height:1.1;letter-spacing:0}.topStats{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}.stat{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:9px 12px;min-width:96px}.stat b{display:block;font-size:20px}.stat span{font-size:11px;color:var(--mut)}.nav{position:sticky;top:0;z-index:20;display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px 28px;background:rgba(245,241,234,.96);border-bottom:1px solid var(--line);backdrop-filter:saturate(140%) blur(10px)}.navBtn,.toolBtn{border:1px solid var(--line);background:#fff;border-radius:8px;padding:8px 11px;font-size:12px;font-weight:800;color:#3f3b35}.navBtn.active,.toolBtn.primary{background:#111;color:#fff;border-color:#111}.view{display:none;padding:22px 28px 40px}.view.active{display:block}.grid2{display:grid;grid-template-columns:1.1fr .9fr;gap:16px}.panel{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px}.panel h2,.panel h3{margin:0 0 10px;letter-spacing:0}.panel h2{font-size:18px}.panel h3{font-size:15px}.mut{color:var(--mut);font-size:12px}.metricGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.bigMetric{background:#fff;border:1px solid var(--line);border-radius:8px;padding:14px}.bigMetric b{font-size:28px}.bigMetric span{display:block;color:var(--mut);font-size:12px}.barList{display:grid;gap:9px}.barRow{display:grid;grid-template-columns:150px 1fr 56px;gap:10px;align-items:center}.barName{font-weight:800}.barTrack{height:18px;background:var(--soft);border-radius:999px;overflow:hidden}.barFill{height:100%;border-radius:999px;background:var(--accent);transition:width .35s ease}.hueButtons{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}.hueBtn{border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:800}.hueBtn.active{background:#111;color:#fff;border-color:#111}.swatchBoard{display:grid;grid-template-columns:repeat(12,1fr);gap:6px}.swatch{height:48px;border-radius:8px;border:1px solid rgba(0,0,0,.14);display:flex;align-items:flex-end;padding:5px;color:#fff;font-size:10px;font-weight:800;text-shadow:0 1px 2px rgba(0,0,0,.4);overflow:hidden}.detailLayout{display:grid;grid-template-columns:300px 1fr;gap:16px}.variantList{max-height:520px;overflow:auto;border:1px solid var(--line);border-radius:8px;background:#fff}.variant{display:flex;justify-content:space-between;gap:10px;padding:9px 10px;border-bottom:1px solid var(--line);font-size:12px}.variant b{display:block}.imageGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.productCard{margin:0;background:#fff;border:1px solid var(--line);border-radius:8px;overflow:hidden}.productCard img{display:block;width:100%;height:132px;object-fit:contain;background:#f3f3f3;padding:5px}.productCard figcaption{padding:9px 10px;font-size:12px}.badge{display:inline-flex;border-radius:999px;padding:2px 7px;background:#111;color:#fff;font-size:10px;font-weight:800}.calib{display:flex;align-items:center;gap:6px;margin-top:5px;color:var(--mut);font-size:10px}.calibSw{width:14px;height:14px;border:1px solid rgba(0,0,0,.18);border-radius:4px;flex:0 0 auto}.manualFix{display:grid;grid-template-columns:1fr 1fr auto;gap:5px;margin-top:7px}.miniSelect{border:1px solid var(--line);background:#fff;border-radius:6px;padding:4px 5px;font-size:10px;min-width:0}.miniBtn{border:1px solid #111;background:#111;color:#fff;border-radius:6px;padding:4px 7px;font-size:10px;font-weight:900}.overrideNote{display:inline-flex;margin-left:4px;color:#247a39;font-size:10px;font-weight:900}.saveStatus{position:fixed;right:18px;bottom:18px;z-index:50;background:#111;color:#fff;border-radius:8px;padding:10px 12px;font-size:12px;font-weight:900;box-shadow:0 8px 22px rgba(0,0,0,.18);opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity .18s ease,transform .18s ease}.saveStatus.show{opacity:1;transform:translateY(0)}.toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}.input,.select{border:1px solid var(--line);background:#fff;border-radius:8px;padding:8px 10px;min-width:180px}.table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:8px;overflow:hidden}.table th,.table td{text-align:left;border-bottom:1px solid var(--line);padding:9px 10px;font-size:12px;vertical-align:top}.table th{background:#efe8dc;color:#554f47}.pairCards{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.pairCard{background:#fff;border:1px solid var(--line);border-radius:8px;padding:12px}.pairCard b{font-size:15px}.sourceGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.sourceCard{background:#fff;border:1px solid var(--line);border-radius:8px;padding:12px}.sourceCard a{color:#195a8a;text-decoration:none;font-weight:800}.sourceCard a:hover{text-decoration:underline}.adminDrop{border:1px dashed #9d9283;border-radius:8px;background:#fff;padding:18px}.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#eee7db;border-radius:6px;padding:2px 5px;font-size:12px}.small{font-size:11px;color:var(--mut)}.chartGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:16px}.donutWrap{display:flex;align-items:center;gap:16px}.donut{width:154px;height:154px;border-radius:50%;display:grid;place-items:center;flex:0 0 auto}.donut::after{content:"";width:82px;height:82px;border-radius:50%;background:var(--panel);border:1px solid var(--line)}.legend{display:grid;gap:8px}.legendBtn{display:grid;grid-template-columns:14px 1fr auto;gap:8px;align-items:center;border:0;background:transparent;text-align:left;padding:0;color:var(--ink)}.legendSw{width:14px;height:14px;border-radius:4px;border:1px solid rgba(0,0,0,.14)}.stackBar{height:24px;background:var(--soft);border-radius:999px;overflow:hidden;display:flex}.stackSeg{height:100%;border:0;padding:0;min-width:2px}.clickBar{border:0;background:transparent;padding:0;text-align:left;width:100%;display:grid;grid-template-columns:130px 1fr 54px;gap:8px;align-items:center}.chartNote{font-size:12px;color:var(--mut);margin:4px 0 12px}.heatWrap{overflow:auto}.heat{display:grid;gap:4px;min-width:720px}.heatRow{display:grid;grid-template-columns:140px repeat(9,1fr);gap:4px;align-items:stretch}.heatHead{font-size:10px;color:var(--mut);font-weight:800}.heatCell{border:0;border-radius:6px;min-height:34px;padding:4px;font-size:10px;font-weight:800;color:#1d1c1a;background:#efe8dc}.insightList{display:grid;gap:8px}.insightItem{background:#fff;border:1px solid var(--line);border-radius:8px;padding:10px 11px}.insightItem b{display:block;margin-bottom:2px}.readGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.readCard{background:#fff;border:1px solid var(--line);border-radius:8px;padding:11px}.readCard b{display:block;margin-bottom:8px}.colorMarks{display:flex;gap:7px;flex-wrap:wrap}.markChip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:#fff;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:800;color:#3f3a33}.markDot{width:16px;height:16px;border-radius:50%;border:1px solid rgba(0,0,0,.18);box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)}.pairMarks{display:grid;gap:6px}.pairMark{display:grid;grid-template-columns:18px 1fr auto;align-items:center;gap:8px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:6px 8px;font-size:11px}.spectrumLayout{display:grid;grid-template-columns:1.45fr .8fr;gap:14px}.spectrumBars{display:grid;grid-template-columns:repeat(24,1fr);gap:3px;align-items:end;height:190px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:10px}.spectrumBin{border:0;border-radius:6px 6px 3px 3px;min-height:8px;padding:0;position:relative}.spectrumBin span{position:absolute;left:50%;bottom:100%;transform:translateX(-50%);font-size:9px;color:var(--mut);margin-bottom:3px;white-space:nowrap}.spectrumAxis{display:grid;grid-template-columns:repeat(6,1fr);font-size:10px;color:var(--mut);margin-top:6px}.hexSwatches{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.hexSwatch{display:grid;grid-template-columns:22px 1fr auto;align-items:center;gap:8px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:6px;font-size:11px}.hexBox{width:22px;height:22px;border-radius:6px;border:1px solid rgba(0,0,0,.18)}.miniTabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}.miniTab{border:1px solid var(--line);border-radius:999px;background:#fff;padding:5px 9px;font-size:11px;font-weight:800}.miniTab.active{background:#111;color:#fff;border-color:#111}.caseGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}.caseMini{border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff}.caseMini img{display:block;width:100%;height:84px;object-fit:contain;background:#f4f4f4;padding:4px}.caseMini div{padding:7px;font-size:10px}.signalGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.signalCard{background:#fff;border:1px solid var(--line);border-radius:8px;padding:12px}.signalCard h3{font-size:14px;margin:0 0 6px}.signalCard .action{margin-top:8px;padding-top:8px;border-top:1px solid var(--line);font-size:12px}.quote{font-size:12px;color:var(--mut);margin:4px 0}.sourcePill{display:inline-flex;margin-top:6px;border:1px solid var(--line);border-radius:999px;padding:3px 8px;color:#195a8a;text-decoration:none;font-size:11px;font-weight:800}.brandSignalGrid{display:grid;gap:14px}.brandSignalCard{background:#fff;border:1px solid var(--line);border-radius:8px;padding:13px}.globalNote{background:#fffbe6;border-bottom:1px solid #e8d89a;padding:7px 28px;font-size:12px;color:#5a4e2a;line-height:1.4}.brandSignalHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px}.brandSignalHead h3{margin:0;font-size:17px}.signalCols{display:grid;grid-template-columns:1fr 1fr 1.25fr;gap:10px}.signalCol{border:1px solid var(--line);border-radius:8px;background:#fffdf9;padding:10px;min-width:0}.signalCol h4{margin:0 0 6px;font-size:12px;color:#504940;text-transform:uppercase;letter-spacing:.05em}.signalCol ul{margin:0;padding-left:17px;color:var(--mut);font-size:12px}.signalCol li{margin:0 0 5px}.evidencePill{display:inline-flex;border-radius:999px;padding:3px 8px;background:#efe8dc;color:#4c453d;font-size:10px;font-weight:900}.topCaseGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.brandSources{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
@media(max-width:1160px){.grid2,.detailLayout,.spectrumLayout{grid-template-columns:1fr}.imageGrid{grid-template-columns:repeat(3,1fr)}.metricGrid{grid-template-columns:repeat(2,1fr)}.pairCards{grid-template-columns:repeat(2,1fr)}.chartGrid{grid-template-columns:1fr 1fr}.signalCols{grid-template-columns:1fr}.topCaseGrid{grid-template-columns:repeat(3,1fr)}}@media(max-width:720px){.top,.view,.nav{padding-left:14px;padding-right:14px}.top{display:block}.topStats{justify-content:flex-start;margin-top:14px}.barRow,.clickBar{grid-template-columns:1fr}.imageGrid,.pairCards,.sourceGrid,.chartGrid,.topCaseGrid,.readGrid,.hexSwatches{grid-template-columns:1fr}.swatchBoard{grid-template-columns:repeat(6,1fr)}.donutWrap{display:block}.donut{margin-bottom:12px}}`);

  writeFile(path.join(SITE, 'app.js'), `const HUE_LABEL={black:'Black',grey:'Grey / Smoke',brown:'Brown',amber:'Amber / Tortoise',yellow:'Yellow',orange:'Orange',rose:'Rose / Red',violet:'Violet',blue:'Blue',teal:'Teal',green:'Green / G-15 / Olive / Khaki',unknown:'Unknown'};
const HUE_COLOR={black:'#1f1f1f',grey:'#656766',brown:'#6b4a34',amber:'#b07a35',yellow:'#d7aa22',orange:'#c9702f',rose:'#9b5265',violet:'#7560a8',blue:'#276d98',teal:'#26777a',green:'#48694c',unknown:'#8a8176'};
const CAT_LABEL={sun:'Sun',tint:'Tint',gradient:'Gradient'};
const FRAME_COLOR={'Tortoise / Brown':'#7a5230','Black / Ink':'#1f1f1f','Clear / Crystal':'#d8d4cc','Grey / Silver':'#9a9a9a','Rose / Red / Purple':'#9b5265','Blue / Navy':'#2d5a8a','Gold / Warm Crystal':'#b89040','Green / Olive':'#4a6644','Other / Mixed':'#8a8176'};
const CAT_STANDARD='<section class="panel" style="margin:14px 0"><h2>镜片类别分类标准 <span class="mut">国际 Cat. 1–3 透光率标准</span></h2><table class="table"><thead><tr><th>类别</th><th>透光率</th><th>适用场景</th><th>本站标注</th></tr></thead><tbody><tr><td><b>Cat. 1</b></td><td>44%–80%</td><td>阴天、室内、时尚装饰，浅色染色镜片</td><td><span class="badge" style="background:#bd6f92">Tint</span></td></tr><tr><td><b>Cat. 2</b></td><td>19%–43%</td><td>多云天气、日常通勤，中度染色太阳镜</td><td><span class="badge" style="background:#bd6f92">Tint</span></td></tr><tr><td><b>Cat. 3</b></td><td>8%–18%</td><td>强光晴天、夏季、海滩，标准深色墨镜</td><td><span class="badge" style="background:#2f2f2f">Sun</span></td></tr><tr><td><b>Gradient</b></td><td>渐变（上深下浅）</td><td>上层 Cat.3 级深度，开车/日常两用</td><td><span class="badge" style="background:#44799a">Gradient</span></td></tr></tbody></table></section>';
const state={catalog:null,insights:null,hue:'brown',query:'',brand:'',cat:'',lensHue:'',frameFamily:'',overrides:{}};
const $=s=>document.querySelector(s);
const el=(tag,cls,html)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(html!=null)n.innerHTML=html;return n};
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function loadOverrides(){try{return JSON.parse(localStorage.getItem('lensColorOverrides')||'{}')}catch(err){console.warn('Could not read manual overrides',err);return {}}}
function persistOverrides(){try{localStorage.setItem('lensColorOverrides',JSON.stringify(state.overrides||{},null,2));return true}catch(err){console.warn('Could not save manual overrides',err);return false}}
function overrideCount(){return Object.keys(state.overrides||{}).length}
function normalizeHue(hue){return hue==='olive'?'green':hue}
function applyOverrides(){const map=state.overrides||{};(state.catalog?.records||[]).forEach(r=>{if(r.lensHue==='olive')r.lensHue='green';const o=map[r.id];if(o){if(o.lensHue)r.lensHue=normalizeHue(o.lensHue);if(o.cat)r.cat=o.cat;r.hueSource='reviewed-correction'}})}
function showSaved(msg){let n=$('#saveStatus');if(!n){n=document.createElement('div');n.id='saveStatus';n.className='saveStatus';document.body.appendChild(n)}n.textContent=msg;n.classList.add('show');clearTimeout(showSaved.timer);showSaved.timer=setTimeout(()=>n.classList.remove('show'),1600)}
function saveManualOverride(id,hue,cat){const r=state.catalog.records.find(x=>x.id===id);if(!r){alert('Could not find this product in the catalog.');return}state.overrides={...(state.overrides||{}),[id]:{id,brand:r.brand,product:r.product,lensName:r.lensName,frameColor:r.frameColor,lensHue:normalizeHue(hue),cat,hueHex:r.hueHex||'',hueSource:'reviewed-correction',updatedAt:new Date().toISOString()}};persistOverrides();applyOverrides();renderCatalog();renderTop();showSaved('Saved in this page. Export once when done.')}
function downloadText(name,text){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function exportOverrides(){const count=overrideCount();if(!count){alert('No manual overrides saved yet. Change a card dropdown first, or click Save on a card.');return}downloadText('lens-color-overrides.json',JSON.stringify(state.overrides||{},null,2))}
function clearOverrides(){if(confirm('Clear local manual overrides in this browser?')){state.overrides={};localStorage.removeItem('lensColorOverrides');location.reload()}}
async function init(){const [catalog,insights]=await Promise.all([fetch('./data/catalog.json?v=hex-calibrated').then(r=>r.json()),fetch('./data/insights.json?v=hex-calibrated').then(r=>r.json())]);state.catalog=catalog;state.insights=insights;state.overrides=loadOverrides();applyOverrides();renderTop();bindNav();renderAll()}
function bindNav(){document.querySelectorAll('.navBtn').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.navBtn').forEach(b=>b.classList.toggle('active',b===btn));document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===btn.dataset.view));renderView(btn.dataset.view)}))}
function renderAll(){['overview','hue','pairing','market','catalog','data'].forEach(renderView)}
function renderTop(){const t=state.insights.totals;$('#topStats').innerHTML='<div class="stat"><b>'+t.records+'</b><span>colorways</span></div><div class="stat"><b>'+t.classifiers+'</b><span>editable colors</span></div><div class="stat"><b>'+Object.keys(t.brands).length+'</b><span>brands</span></div>'}
function renderView(id){if(id==='overview')renderOverview();if(id==='hue')renderHueLab();if(id==='pairing')renderPairings();if(id==='market')renderMarket();if(id==='catalog')renderCatalog();if(id==='data')renderDataAdmin()}
function metric(label,value){return '<div class="bigMetric"><b>'+value+'</b><span>'+label+'</span></div>'}
function group(rows,key){const m={};rows.forEach(r=>{const k=typeof key==='function'?key(r):r[key];m[k]=(m[k]||0)+1});return m}
function sortedEntries(obj){return Object.entries(obj).sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0])))}
function sumValues(obj){return Object.values(obj).reduce((a,b)=>a+b,0)}
function openCatalog(filter){state.query=filter.query||'';state.brand=filter.brand||'';state.cat=filter.cat||'';state.lensHue=filter.lensHue||'';state.frameFamily=filter.frameFamily||'';document.querySelector('[data-view="catalog"]').click()}
function openHue(hue){state.hue=hue;document.querySelector('[data-view="hue"]').click()}
function donut(title,counts,colors,onClickAttr){const total=sumValues(counts)||1;let acc=0;const stops=Object.entries(counts).map(([k,v])=>{const start=acc/total*100;acc+=v;const end=acc/total*100;return (colors[k]||'#999')+' '+start.toFixed(2)+'% '+end.toFixed(2)+'%'}).join(',');return '<section class="panel"><h2>'+title+'</h2><div class="donutWrap"><div class="donut" style="background:conic-gradient('+stops+')"></div><div class="legend">'+Object.entries(counts).map(([k,v])=>'<button class="legendBtn" '+onClickAttr(k)+'><span class="legendSw" style="background:'+(colors[k]||'#999')+'"></span><span>'+safe(CAT_LABEL[k]||HUE_LABEL[k]||k)+'</span><b>'+v+'</b></button>').join('')+'</div></div></section>'}
function barChart(title,entries,max,mode){return '<section class="panel"><h2>'+title+'</h2><div class="barList">'+entries.map(([k,v])=>'<button class="clickBar" data-'+mode+'="'+safe(k)+'"><span><b>'+(HUE_LABEL[k]||k)+'</b></span><span class="barTrack"><span class="barFill" style="display:block;width:'+(v/max*100).toFixed(1)+'%;background:'+(HUE_COLOR[k]||'#222')+'"></span></span><b>'+v+'</b></button>').join('')+'</div></section>'}
function stackBarChart(title,rows,segments,colors,kind){const max=Math.max(...rows.map(r=>sumValues(r.counts)),1);return '<section class="panel"><h2>'+title+'</h2><p class="chartNote">每条堆叠条可点击，进入对应品牌或类别样本。</p><div class="barList">'+rows.map(row=>'<div class="barRow"><button class="legendBtn" data-'+kind+'="'+safe(row.key)+'"><b>'+safe(row.label)+'</b></button><div><div class="stackBar" style="max-width:'+((sumValues(row.counts)/max*100).toFixed(1))+'%">'+segments.map(s=>'<button class="stackSeg" title="'+safe((CAT_LABEL[s]||HUE_LABEL[s]||s)+': '+(row.counts[s]||0))+'" data-'+kind+'="'+safe(row.key)+'" data-seg="'+safe(s)+'" style="width:'+((row.counts[s]||0)/(sumValues(row.counts)||1)*100).toFixed(1)+'%;background:'+(colors[s]||'#999')+'"></button>').join('')+'</div><div class="small">'+segments.map(s=>(CAT_LABEL[s]||HUE_LABEL[s]||s)+' '+(row.counts[s]||0)).join(' · ')+'</div></div><b>'+sumValues(row.counts)+'</b></div>').join('')+'</div></section>'}
function heatMatrix(rows,cols,getVal,max){return '<div class="heatWrap"><div class="heat"><div class="heatRow"><div></div>'+cols.map(c=>'<div class="heatHead">'+safe(c)+'</div>').join('')+'</div>'+rows.map(r=>'<div class="heatRow"><div class="heatHead">'+safe(r)+'</div>'+cols.map(c=>{const v=getVal(r,c);const a=v/max;return '<button class="heatCell" data-hue="'+safe(r)+'" data-frame="'+safe(c)+'" style="background:rgba(30,28,25,'+(0.08+a*.62).toFixed(2)+')">'+(v||'')+'</button>'}).join('')+'</div>').join('')+'</div></div>'}
function hexToHsl(hex){const m=String(hex||'').match(/^#?([0-9a-f]{6})$/i);if(!m)return null;const n=parseInt(m[1],16);let r=((n>>16)&255)/255,g=((n>>8)&255)/255,b=(n&255)/255;const max=Math.max(r,g,b),min=Math.min(r,g,b);let h=0,s=0,l=(max+min)/2;if(max!==min){const d=max-min;s=l>.5?d/(2-max-min):d/(max+min);if(max===r)h=(g-b)/d+(g<b?6:0);else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60}return{h,s:s*100,l:l*100}}
function colorMark(entries){return '<div class="colorMarks">'+entries.map(([h,n])=>'<button class="markChip" data-read-hue="'+safe(h)+'"><span class="markDot" style="background:'+(HUE_COLOR[h]||'#999')+'"></span><span>'+safe(HUE_LABEL[h]||h)+'</span><b>'+n+'</b></button>').join('')+'</div>'}
function pairMark(entries){return '<div class="pairMarks">'+entries.map(([k,n])=>{const [h,f]=k.split('|');return '<button class="pairMark" data-pair-hue="'+safe(h)+'" data-pair-frame="'+safe(f)+'"><span class="markDot" style="background:'+(HUE_COLOR[h]||'#999')+'"></span><span>'+safe((HUE_LABEL[h]||h)+' × '+f)+'</span><b>'+n+'</b></button>'}).join('')+'</div>'}
function spectrumChart(rows){const parsed=rows.map(r=>({row:r,hsl:hexToHsl(r.hueHex)})).filter(x=>x.hsl);const bins=Array.from({length:24},(_,i)=>({i,start:i*15,end:i*15+15,count:0,examples:[]}));const neutrals={black:0,grey:0,light:0};const hexCounts={};for(const item of parsed){const {h,s,l}=item.hsl;hexCounts[item.row.hueHex]=(hexCounts[item.row.hueHex]||0)+1;if(l<18)neutrals.black++;else if(s<12)neutrals.grey++;else if(l>82&&s<28)neutrals.light++;else{const idx=Math.min(23,Math.floor(h/15));bins[idx].count++;if(bins[idx].examples.length<3)bins[idx].examples.push(item.row.hueHex)}}const max=Math.max(...bins.map(b=>b.count),1);const topHex=Object.entries(hexCounts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,12);return '<section class="panel" style="margin-top:16px"><h2>Hex spectrum distribution</h2><p class="chartNote">按每条记录的 hueHex 计算 HSL 色相角。低亮度黑色、低饱和灰色单独归为 neutral，不强行放进彩色色相轴。</p><div class="spectrumLayout"><div><div class="spectrumBars">'+bins.map(b=>'<button class="spectrumBin" title="'+b.start+'-'+b.end+'°: '+b.count+'" style="height:'+(8+b.count/max*170).toFixed(1)+'px;background:hsl('+(b.start+7.5)+' 62% 45%)"><span>'+(b.count||'')+'</span></button>').join('')+'</div><div class="spectrumAxis"><span>0° Red</span><span>60° Yellow</span><span>120° Green</span><span>180° Cyan</span><span>240° Blue</span><span>300° Violet</span></div><div class="colorMarks" style="margin-top:10px"><span class="markChip"><span class="markDot" style="background:#171717"></span>Black neutral <b>'+neutrals.black+'</b></span><span class="markChip"><span class="markDot" style="background:#777"></span>Grey neutral <b>'+neutrals.grey+'</b></span><span class="markChip"><span class="markDot" style="background:#d8e2e2"></span>Light neutral <b>'+neutrals.light+'</b></span></div></div><div><h3>Top repeated hex</h3><div class="hexSwatches">'+topHex.map(([hex,n])=>'<div class="hexSwatch"><span class="hexBox" style="background:'+hex+'"></span><span>'+hex+'</span><b>'+n+'</b></div>').join('')+'</div></div></div></section>'}
function renderOverview(){const root=$('#overview');const recs=state.catalog.records;const knownRecs=recs.filter(r=>r.lensHue!=='unknown');const hueRows=state.insights.hueSummary.filter(r=>r.hue!=='unknown').sort((a,b)=>b.brandCount-a.brandCount||b.count-a.count);const catCounts=group(recs,'cat');const frameCounts=group(recs,'frameFamily');const topHue=hueRows[0];const gradientRows=knownRecs.filter(r=>r.cat==='gradient');const gradientHue=sortedEntries(group(gradientRows,'lensHue'));const catColors={sun:'#2f2f2f',tint:'#bd6f92',gradient:'#44799a'};const maxHue=Math.max(...hueRows.map(r=>r.count),1);const maxGrad=Math.max(...gradientHue.map(x=>x[1]),1);const brandCounts=group(recs,'brand');const brandCatRows=Object.keys(brandCounts).map(b=>({key:b,label:b,counts:group(recs.filter(r=>r.brand===b),'cat')}));const frameCols=sortedEntries(frameCounts).slice(0,9).map(x=>x[0]);const heatRows=hueRows.slice(0,9).map(x=>x.hue);const pairMap={};knownRecs.forEach(r=>{const k=r.lensHue+'|'+r.frameFamily;pairMap[k]=(pairMap[k]||0)+1});const maxPair=Math.max(...Object.values(pairMap),1);const brandLensRows=Object.keys(brandCounts).map(b=>{const bRecs=recs.filter(r=>r.brand===b);const distinctHues=[...new Set(bRecs.map(r=>r.lensHue).filter(h=>h&&h!=='unknown'))].sort();const distinctLens=[...new Set(bRecs.map(r=>r.lensName))].sort();return '<tr><td><b>'+safe(b)+'</b></td><td style="text-align:center">'+bRecs.length+'</td><td style="text-align:center"><b>'+distinctHues.length+'</b></td><td>'+distinctHues.map(h=>'<span style="display:inline-flex;align-items:center;gap:3px;margin:2px 6px 2px 0;white-space:nowrap"><span style="width:9px;height:9px;border-radius:50%;background:'+(HUE_COLOR[h]||'#999')+';flex:0 0 auto"></span>'+safe(HUE_LABEL[h]||h)+'</span>').join('')+'</td><td style="color:#a09589;font-size:11px;max-width:220px">'+safe(distinctLens.slice(0,8).join('、'))+(distinctLens.length>8?'…':'')+'</td></tr>'}).join('');const catCompact='<section class="panel"><h2>镜片类别标准</h2><table class="table"><tbody><tr><td><b>Cat. 1–2</b> <span class="mut">19–80%</span></td><td><span class="badge" style="background:#bd6f92">Tint</span></td></tr><tr><td><b>Cat. 3</b> <span class="mut">8–18%</span></td><td><span class="badge" style="background:#2f2f2f">Sun</span></td></tr><tr><td><b>Gradient</b> <span class="mut">渐变上深下浅</span></td><td><span class="badge" style="background:#44799a">Gradient</span></td></tr></tbody></table></section>';root.innerHTML='<div class="metricGrid">'+metric('Total SKUs',recs.length)+metric('可分类色相',knownRecs.length)+metric('最高频色相',topHue?HUE_LABEL[topHue.hue]+' · '+topHue.count+'条':'—')+metric('Top 镜架家族',sortedEntries(frameCounts)[0][0])+'</div><div class="grid2" style="margin-top:14px"><section class="panel"><h2>各品牌镜片色相 <span class="mut">各品牌实际 offer 的色相种类</span></h2><p class="chartNote">色相由 lensHue 统计，排除 unknown。产品图片展示镜架+镜片整体，视觉主色由镜架主导。</p><table class="table"><thead><tr><th>品牌</th><th style="text-align:center">SKU</th><th style="text-align:center">色相数</th><th>色相分布</th><th style="color:#a09589">原始镜片命名</th></tr></thead><tbody>'+brandLensRows+'</tbody></table><div style="margin-top:10px;font-size:11px;color:#8a7f74;border-top:1px solid var(--line);padding-top:8px"><b>数据说明：</b>Warby Parker — 官方标准化镜片体系，15 种镜片类型跨所有镜架共用。MOSCOT — 标准 Sun 款原始命名为镜架醋酸颜色（如 Flesh、Crystal、Tortoise），实际镜片默认为 G-15 绿色；CUSTOM MADE TINTS / MONOCHROME 系列例外，有独立镜片色。Gentle Monster — 原始数据仅区分 Sun lens / Tint lens，色相由图片取样 hex 推导。Meta — 官方命名包含镜片类型（如 Transitions、Sapphire、Ruby）。</div></section><div style="display:flex;flex-direction:column;gap:12px">'+catCompact+donut('类别构成',catCounts,catColors,k=>'data-cat="'+k+'"')+'</div></div><div class="chartGrid" style="margin-top:14px">'+barChart('色相分布排名',hueRows.map(r=>[r.hue,r.count]),maxHue,'hue')+stackBarChart('各品牌类别构成',brandCatRows,['sun','tint','gradient'],catColors,'brand')+barChart('Gradient 色相偏好',gradientHue,maxGrad,'hue')+'</div><section class="panel" style="margin-top:14px"><h2>镜片色相 × 镜架家族 搭配热力图</h2><p class="chartNote">颜色越深代表该搭配组合越常见。点击任意格子进入 Catalog 精准筛选。</p>'+heatMatrix(heatRows,frameCols,(h,f)=>pairMap[h+'|'+f]||0,maxPair)+'</section>'+spectrumChart(knownRecs)+'<section class="panel" style="margin-top:14px"><h2>色相导航 <span class="mut">点击进入 Hue Lab</span></h2><div class="swatchBoard">'+hueRows.map(r=>'<button class="swatch" style="background:'+HUE_COLOR[r.hue]+'" data-hue="'+r.hue+'">'+HUE_LABEL[r.hue]+'<br><span style="font-size:10px;opacity:.8">'+r.count+'</span></button>').join('')+'</div></section>';root.querySelectorAll('[data-hue]').forEach(b=>b.onclick=()=>openHue(b.dataset.hue));root.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>openCatalog({cat:b.dataset.cat}));root.querySelectorAll('[data-brand]').forEach(b=>b.onclick=()=>openCatalog({brand:b.dataset.brand}));root.querySelectorAll('.heatCell').forEach(b=>b.onclick=()=>openCatalog({lensHue:b.dataset.hue,frameFamily:b.dataset.frame}))}
function hueButtons(){return '<div class="hueButtons">'+state.insights.hueOrder.map(h=>'<button class="hueBtn '+(state.hue===h?'active':'')+'" data-hue="'+h+'">'+HUE_LABEL[h]+'</button>').join('')+'</div>'}
function productCard(r){const lensColor=r.hueHex||(HUE_COLOR[r.lensHue]||'#ccc');const frameColor=FRAME_COLOR[r.frameFamily]||'#8a8176';const hueOptions=Object.keys(HUE_LABEL).map(h=>'<option value="'+h+'" '+(r.lensHue===h?'selected':'')+'>'+HUE_LABEL[h]+'</option>').join('');const catOptions=Object.keys(CAT_LABEL).map(c=>'<option value="'+c+'" '+(r.cat===c?'selected':'')+'>'+CAT_LABEL[c]+'</option>').join('');const colorBar='<div style="display:flex;gap:0;height:28px;border-radius:6px;overflow:hidden;margin-bottom:8px;border:1px solid rgba(0,0,0,.1)"><div style="flex:1;background:'+frameColor+';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5);letter-spacing:.03em">镜架</div><div style="flex:1;background:'+lensColor+';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5);letter-spacing:.03em">镜片</div></div>';return '<figure class="productCard" data-id="'+safe(r.id)+'"><img loading="lazy" src="'+r.img+'" alt="'+safe(r.product)+'"><figcaption>'+colorBar+'<b>'+safe(r.brand)+'</b><br>'+safe(r.product)+'<br><span class="small" style="color:#8a7a6a">镜架 '+safe(r.frameColor)+'</span><br><span class="small">镜片 '+safe(HUE_LABEL[r.lensHue]||r.lensHue)+' · '+safe(r.lensName)+'</span><br><span class="badge">'+CAT_LABEL[r.cat]+'</span><div class="calib"><span class="calibSw" style="background:'+lensColor+'"></span><span>'+safe(r.hueHex||'—')+'</span></div><div class="manualFix"><select class="miniSelect manualHue">'+hueOptions+'</select><select class="miniSelect manualCat">'+catOptions+'</select><button class="miniBtn saveFix" type="button">Save</button></div></figcaption></figure>'}
function bindManualSave(root){root.querySelectorAll('.saveFix').forEach(btn=>btn.addEventListener('click',()=>{const card=btn.closest('.productCard');saveManualOverride(card.dataset.id,card.querySelector('.manualHue').value,card.querySelector('.manualCat').value)}))}
function renderHueLab(){const root=$('#hue');const d=state.insights.byHue[state.hue];root.innerHTML=hueButtons()+'<div class="detailLayout"><aside class="panel"><h2>'+HUE_LABEL[state.hue]+'</h2><p class="mut">'+d.variants.length+' named variants · '+Object.values(d.brandCounts).reduce((a,b)=>a+b,0)+' records</p><h3>Top variants</h3><div class="variantList">'+d.variants.slice(0,80).map(v=>'<div class="variant"><div><b>'+safe(v.name)+'</b><span class="small">'+v.brands.join(' / ')+'</span></div><b>'+v.count+'</b></div>').join('')+'</div></aside><section class="panel"><h2>Case images</h2><p class="chartNote">图片为镜架+镜片整体效果，视觉主色由镜架颜色主导，色相分类依据镜片类型。</p><div class="imageGrid">'+d.examples.map(productCard).join('')+'</div></section></div><div class="grid2" style="margin-top:16px"><section class="panel"><h2>Category mix</h2><div class="barList">'+Object.entries(d.categoryCounts).map(([k,v])=>'<div class="barRow"><b>'+CAT_LABEL[k]+'</b><div class="barTrack"><div class="barFill" style="width:'+(v/Object.values(d.categoryCounts).reduce((a,b)=>a+b,0)*100).toFixed(1)+'%;background:'+HUE_COLOR[state.hue]+'"></div></div><b>'+v+'</b></div>').join('')+'</div></section><section class="panel"><h2>Brand mix</h2><div class="barList">'+Object.entries(d.brandCounts).map(([k,v])=>'<div class="barRow"><b>'+k+'</b><div class="barTrack"><div class="barFill" style="width:'+(v/Object.values(d.brandCounts).reduce((a,b)=>a+b,0)*100).toFixed(1)+'%;background:'+HUE_COLOR[state.hue]+'"></div></div><b>'+v+'</b></div>').join('')+'</div></section></div>';root.querySelectorAll('.hueBtn').forEach(b=>b.onclick=()=>{state.hue=b.dataset.hue;renderHueLab()});bindManualSave(root)}
function pairCases(hue,frame){return state.catalog.records.filter(r=>r.lensHue===hue&&r.frameFamily===frame).sort((a,b)=>a.rank-b.rank).filter((r,i,a)=>a.findIndex(x=>x.brand===r.brand&&x.product===r.product&&x.lensName===r.lensName)===i).slice(0,3)}
function miniCase(r){return '<div class="caseMini"><img loading="lazy" src="'+r.img+'" alt="'+safe(r.product)+'"><div><b>'+safe(r.brand)+'</b><br>'+safe(r.product)+'<br><span class="small">镜片 '+safe(r.lensName)+' / '+safe(r.frameColor)+'</span></div></div>'}
function renderPairings(){const root=$('#pairing');const rows=state.insights.hueOrder.filter(h=>h!=='unknown').map(h=>({h,frames:state.insights.frameByHue[h]||[]})).filter(x=>x.frames.length);root.innerHTML='<section class="panel"><h2>Lens hue × frame family cases</h2><p class="chartNote">每张卡先列高频镜框家族，再给真实产品图。Unknown 记录保留在 Catalog 中人工校准，不进入搭配趋势。</p><div class="pairCards">'+rows.map(x=>'<div class="pairCard"><b style="color:'+HUE_COLOR[x.h]+'">'+HUE_LABEL[x.h]+'</b><p class="mut">'+x.frames.slice(0,3).map(f=>f.frameFamily+' ('+f.count+')').join(' · ')+'</p>'+x.frames.slice(0,3).map(f=>'<div style="margin-top:10px"><b>'+f.frameFamily+'</b><span class="small"> · '+f.count+' records · examples: '+f.examples.slice(0,3).join(', ')+'</span><div class="caseGrid">'+pairCases(x.h,f.frameFamily).map(miniCase).join('')+'</div></div>').join('')+'</div>').join('')+'</div></section>';root.querySelectorAll('.caseMini').forEach(card=>card.onclick=()=>{openCatalog({query:card.textContent.trim().split('\\n').slice(-1)[0]||''})})}
function brandTopCases(brand){const rows=state.catalog.records.filter(r=>r.brand===brand&&r.img).sort((a,b)=>a.rank-b.rank||String(a.product).localeCompare(String(b.product)));const out=[];const seen=new Set();for(const r of rows){const key=brand==='Warby Parker'?r.product:(brand==='Gentle Monster'?r.product:r.product+'|'+r.frameColor+'|'+r.lensName);if(seen.has(key))continue;seen.add(key);out.push(r);if(out.length===3)break}return out}
function signalCases(brand,terms){const rows=state.catalog.records.filter(r=>r.brand===brand&&r.img).sort((a,b)=>a.rank-b.rank||String(a.product).localeCompare(String(b.product)));const out=[];const seen=new Set();for(const term of terms){const q=term.toLowerCase();const hit=rows.find(r=>!seen.has(r.product+'|'+r.frameColor+'|'+r.lensName)&&(r.product+' '+r.frameColor+' '+r.lensName+' '+r.lensHue+' '+r.cat).toLowerCase().includes(q));if(hit){seen.add(hit.product+'|'+hit.frameColor+'|'+hit.lensName);out.push(hit)}}for(const r of rows){if(out.length>=3)break;const key=r.product+'|'+r.frameColor+'|'+r.lensName;if(seen.has(key))continue;seen.add(key);out.push(r)}return out.slice(0,3)}
function bulletList(items){return '<ul>'+items.map(x=>'<li>'+x+'</li>').join('')+'</ul>'}
function caseStrip(rows){return '<div class="topCaseGrid">'+rows.map(miniCase).join('')+'</div>'}
function sourcePills(items){return '<div class="brandSources">'+items.map(s=>'<a class="sourcePill" href="'+s.url+'" target="_blank" rel="noreferrer">'+s.label+'</a>').join('')+'</div>'}
function renderMarket(){const root=$('#market');const recs=state.catalog.records;const market=[{brand:'Gentle Monster',status:'官网实时待确认',newness:['当前页面先不硬写“newest”：官网实时 merchandising 还没有接稳定 scraper。','本地 best-selling 抓取显示前排以 Black 为核心，随后出现 Brown / Tortoise / Silver。','建议下一步抓取官网 sunglasses 列表的 New / Campaign / Hero 模块，单独落到 market_signals.json。'],hero:['本地首屏排序的强信号是 Black lens + Black frame。','Brown / Tortoise 是第二层商业安全色，可作为黑色之后的补充墙。','Silver / Grey 更适合金属或轻量造型，不应替代黑棕基本盘。'],newTerms:['Black','Brown','Tortoise'],heroTerms:['Black','Brown','Silver'],note:'Top3 来自本地 best-selling 排序。新上与主图推色暂不伪造，等待官网 scraper。',sources:[{label:'Local best-selling scrape',url:'./data/catalog.json'}]},{brand:'Meta AI Glasses',status:'官网确认 + 本地样本',newness:['官网当前新/featured 家族可见 Starfire Kylie Edition、Adventurer、Fury。','新色语言集中在 Classic Black、Dark Tortoise + Chocolate、Transitions Grey，以及 Merlot/Ruby、Linen/Sapphire 这类 tech color naming。','对我们有用的不是单纯 hue，而是“经典框色 + 功能镜片名”的组合。'],hero:['当前主推更偏 AI glasses family：黑、玳瑁/巧克力、灰变色是最稳的三组。','Fury / Adventurer 扩展出 Green、Dark Amber、Light Blue Atlantic、Sapphire、Ruby，适合做运动/科技感色彩带。','Meta 的颜色墙应把 Transitions 单独标注，不能只归成普通 Grey。'],newTerms:['Starfire Kylie Edition Classic Black','Dark Tortoise','Transitions Grey'],heroTerms:['Brown','Green','Sapphire'],note:'Top3 使用本地抓取中的 featured 排序；官网信号来自 Meta AI glasses shop-all。',sources:[{label:'Meta official shop-all',url:'https://www.meta.com/ai-glasses/shop-all/'},{label:'Local featured scrape',url:'./data/catalog.json'}]},{brand:'Warby Parker',status:'官网确认 + 本地样本',newness:['官网 sunglasses shelf 有 New arrivals，并把 Boaz 作为夏季 newest bestseller 露出。','官网定制 tint 色彩包括 Blue、Yellow、Rosy Brown；另有新 tortoise shell + green lenses 的促销语言。','Warby 的商业逻辑是“热门框型 + 多镜片系统”，颜色分析要按 frame 和 lens 分开看。'],hero:['当前主推可读作 Tortoise/Black Walnut 框色 + Blue/Green/Brown/Grey 镜片系统。','Blue 在本地 top frames 的默认抓取里非常突出，但它更像 lens option 的首位展示，不一定等于所有销量第一。','适合把 Blue tint/blue sun 做成入口色，再用 Green/Brown/Grey 承接常规转化。'],newTerms:['Blue','Yellow','Rose'],heroTerms:['Tortoise','Green','Black Walnut'],note:'Top3 按本地 best-selling top frames 去重；镜片显示抓取里的第一组默认 lens。',sources:[{label:'Warby official sunglasses',url:'https://www.warbyparker.com/sunglasses'},{label:'Local best-selling scrape',url:'./data/catalog.json'}]},{brand:'MOSCOT',status:'官网实时待确认',newness:['当前页面先不硬写官方 newest：MOSCOT 官网实时列表还没有接稳定 scraper。','本地数据里 CUSTOM MADE TINTS、NYC Champs、Rose+ 等可作为 seasonal/tint 风格组继续追踪。','LEMTOSH SUN 在 best-selling 样本中权重极高，应先分析它的颜色展开，而不是平均看全站。'],hero:['本地前排是 LEMTOSH SUN：Flesh、Black、Blonde、Tortoise G-15、Cosmitan Brown。','经典商业组合是 Black / Tortoise / Brown / G-15；Flesh、Blonde 更像品牌调性的 tint/acetate 特色。','MOSCOT 适合单独做“经典款多色展开”视图，避免被其他品牌的 SKU 结构稀释。'],newTerms:['Flesh','Blonde','Ruby'],heroTerms:['Tortoise with G-15','Black','Cosmitan Brown'],note:'Top3 来自本地 best-selling 排序，同一 bestseller 产品下展示前三个颜色搭配。',sources:[{label:'Local best-selling scrape',url:'./data/catalog.json'}]}];const cats=group(recs,'cat');const cards=market.map(m=>'<article class="brandSignalCard"><div class="brandSignalHead"><div><h3>'+safe(m.brand)+'</h3><p class="mut">'+safe(m.note)+'</p></div><span class="evidencePill">'+safe(m.status)+'</span></div><div class="signalCols"><div class="signalCol"><h4>1. 新上的颜色</h4>'+bulletList(m.newness)+caseStrip(signalCases(m.brand,m.newTerms))+'</div><div class="signalCol"><h4>2. 主图/官网当前推色</h4>'+bulletList(m.hero)+caseStrip(signalCases(m.brand,m.heroTerms))+'</div><div class="signalCol"><h4>3. Bestselling Top3 搭配</h4>'+caseStrip(brandTopCases(m.brand))+sourcePills(m.sources)+'</div></div></article>').join('');root.innerHTML='<div class="metricGrid">'+metric('Brand signal cards',market.length)+metric('Sun / Tint / Gradient',cats.sun+' / '+cats.tint+' / '+cats.gradient)+metric('Official current checks','Meta / Warby')+metric('Local top3 basis','Best-selling scrape')+'</div><section class="panel" style="margin-top:16px"><h2>Market Signals by Brand</h2><p class="chartNote">每家拆成三个维度：新上颜色、当前主图/官网推色、best-selling top3 搭配。每个维度都配本地 catalog 的实际产品图；没有稳定官网实时证据的品牌会明确标“待确认”。</p><div class="brandSignalGrid">'+cards+'</div></section><section class="panel" style="margin-top:16px"><h2>Evidence notes</h2><table class="table"><thead><tr><th>Brand</th><th>Current-source confidence</th><th>How to read the top3</th></tr></thead><tbody>'+market.map(m=>'<tr><td>'+safe(m.brand)+'</td><td>'+safe(m.status)+'</td><td>'+safe(m.note)+'</td></tr>').join('')+'</tbody></table></section>';root.querySelectorAll('.caseMini').forEach(card=>card.onclick=()=>openCatalog({query:card.textContent.trim().replace(/\\s+/g,' ')}))}
function renderCatalog(){const root=$('#catalog');const brands=[...new Set(state.catalog.records.map(r=>r.brand))];const cats=[...new Set(state.catalog.records.map(r=>r.cat))];let rows=state.catalog.records.filter(r=>(!state.query||(r.brand+' '+r.product+' '+r.frameColor+' '+r.lensName+' '+r.frameFamily+' '+r.lensHue).toLowerCase().includes(state.query))&&(!state.brand||r.brand===state.brand)&&(!state.cat||r.cat===state.cat)&&(!state.lensHue||r.lensHue===state.lensHue)&&(!state.frameFamily||r.frameFamily===state.frameFamily)).slice(0,360);const chips=[state.lensHue?'<span class="badge">Lens: '+safe(HUE_LABEL[state.lensHue]||state.lensHue)+'</span>':'',state.frameFamily?'<span class="badge">Frame: '+safe(state.frameFamily)+'</span>':''].filter(Boolean).join(' ');const savedCount=overrideCount();root.innerHTML='<div class="toolbar"><input class="input" id="q" placeholder="Search product, lens, frame" value="'+safe(state.query)+'"><select class="select" id="brand"><option value="">All brands</option>'+brands.map(b=>'<option '+(state.brand===b?'selected':'')+'>'+b+'</option>').join('')+'</select><select class="select" id="cat"><option value="">All categories</option>'+cats.map(c=>'<option value="'+c+'" '+(state.cat===c?'selected':'')+'>'+CAT_LABEL[c]+'</option>').join('')+'</select>'+(chips?'<span class="mut">'+chips+'</span><button class="toolBtn" id="clearExact">Clear heatmap filters</button>':'')+'<button class="toolBtn" id="exportOverrides" type="button">Export overrides</button><span class="mut">'+savedCount+' overrides in current page · '+rows.length+' shown</span></div><div class="panel" style="margin-bottom:12px;padding:10px 14px;font-size:12px"><b>⚠ 关于图片颜色与分类标注不符</b>：产品图片展示的是<b>镜架+镜片整体效果</b>，视觉主色由<b>镜架颜色</b>主导。颜色分类（lensHue）依据的是<b>镜片类型</b>，不是图片的整体观感。例如：Warby Parker Black Walnut 镜架配 Blue 蓝色镜片，图片整体偏深棕，但分类为蓝色。卡片中"<b>镜片</b> / <b>镜架</b>"标签可帮助核对。</div><div class="imageGrid">'+rows.map(productCard).join('')+'</div>';$('#q').oninput=e=>{state.query=e.target.value.toLowerCase();renderCatalog()};$('#brand').onchange=e=>{state.brand=e.target.value;renderCatalog()};$('#cat').onchange=e=>{state.cat=e.target.value;renderCatalog()};$('#exportOverrides').onclick=exportOverrides;const clear=$('#clearExact');if(clear)clear.onclick=()=>{state.lensHue='';state.frameFamily='';renderCatalog()};bindManualSave(root)}
function renderDataAdmin(){const root=$('#data');root.innerHTML='<div class="grid2"><section class="panel"><h2>How to update this site</h2><p class="chartNote">当前版本是静态站：这里先作为维护说明页。新数据上传后，需要由维护者或 AI agent 重新分类、重新 build，再部署到 Railway。</p><table class="table"><tbody><tr><td><b>1</b></td><td><b>准备新数据</b><br>可以是新抓下来的品牌 HTML、CSV/JSON catalog，或后端 scraper 输出。必须保留原始 product / lensName / frameColor。</td></tr><tr><td><b>2</b></td><td><b>AI 辅助分类</b><br>让模型只输出结构化 JSON：lensHue、cat、frameFamily、hueHex、confidence。低置信度和 unknown 需要人工确认。</td></tr><tr><td><b>3</b></td><td><b>重新生成</b><br><span class="code">npm run build:all</span> 用于源 HTML 更新；<span class="code">npm run build:site</span> 用于只改图表或页面。</td></tr><tr><td><b>4</b></td><td><b>检查并发布</b><br>运行 <span class="code">node --check outputs/site/app.js</span>，本地预览后推到 Railway。</td></tr></tbody></table></section><section class="panel"><h2>Upload packet requirements</h2><p class="chartNote">以后做成后端上传时，上传包至少要能产出这些字段。没有 hex 的颜色也可以上传，但分类准确度会下降。</p><table class="table"><tbody><tr><td>Required</td><td><span class="code">brand</span> · <span class="code">product</span> · <span class="code">rank</span> · <span class="code">frameColor</span> · <span class="code">lensName</span> · <span class="code">img</span></td></tr><tr><td>Generated</td><td><span class="code">lensHue</span> · <span class="code">hueHex</span> · <span class="code">hueSource</span> · <span class="code">cat</span> · <span class="code">frameFamily</span></td></tr><tr><td>Do not overwrite</td><td>原始品牌命名要保留。标准化字段只作为分析层，不替代原始商品名。</td></tr></tbody></table><div class="adminDrop" style="margin-top:12px"><b>Future upload API shape</b><p class="mut">POST /api/import-brand · POST /api/reclassify · GET /api/catalog · GET /api/insights</p></div></section></div><div class="grid2" style="margin-top:16px"><section class="panel"><h2>Color classification rules</h2><table class="table"><tbody><tr><td>Lens hue</td><td>优先用 <span class="code">hueHex</span>，再用颜色名兜底。统一到 black / grey / brown / amber / yellow / orange / rose / violet / blue / teal / green / unknown；Olive / Khaki 合并进 Green。</td></tr><tr><td>Category</td><td><span class="code">sun</span> 是常规墨镜；<span class="code">tint</span> 是浅色/时装 tint；<span class="code">gradient</span> 是渐变镜片。Gradient 命名优先。</td></tr><tr><td>Frame family</td><td>把 Black、Tortoise、Brown、Silver、Blue 等归入跨品牌可比较的 frameFamily，同时保留原始 frameColor。</td></tr></tbody></table></section><section class="panel"><h2>Maintenance downloads</h2><p class="chartNote">这些文件会随静态网站一起发布。别人只拿到网站目录，也可以从这里下载维护说明和 Codex Skill。</p><div class="toolbar"><button class="toolBtn primary" id="dataExportOverrides" type="button">Export manual overrides</button><button class="toolBtn" id="dataClearOverrides" type="button">Clear local overrides</button></div><table class="table"><tbody><tr><td>Human guide</td><td><a class="sourcePill" href="./docs/MAINTENANCE.md" download>Download MAINTENANCE.md</a></td></tr><tr><td>Codex skill</td><td><a class="sourcePill" href="./docs/sunglasses-color-maintainer.SKILL.md" download>Download SKILL.md</a></td></tr><tr><td>Skill metadata</td><td><a class="sourcePill" href="./docs/sunglasses-color-maintainer.openai.yaml" download>Download openai.yaml</a></td></tr><tr><td>Ask Codex</td><td>“Use the sunglasses-color-maintainer skill to update the sunglasses color site with the new data.”</td></tr><tr><td>Railway</td><td>Railway runs <span class="code">npm start</span>; <span class="code">server.mjs</span> serves <span class="code">outputs/site</span>.</td></tr></tbody></table></section></div>';const ex=$('#dataExportOverrides');if(ex)ex.onclick=exportOverrides;const cl=$('#dataClearOverrides');if(cl)cl.onclick=clearOverrides}
init().catch(err=>{document.body.innerHTML='<pre>'+err.stack+'</pre>'});`);
}

const data = extractCombinedData();
applyDefaultCorrections(data);
refreshDataSummaries(data);
const insights = buildInsights(data);
writeSite(data, insights);
console.log(JSON.stringify({
  site: path.join(SITE, 'index.html'),
  catalog: path.join(DATA_DIR, 'catalog.json'),
  insights: path.join(DATA_DIR, 'insights.json'),
}, null, 2));
