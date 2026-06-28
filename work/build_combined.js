const fs = require('fs');
const path = require('path');

const ROOT = '/Users/vit-lap-0098';
const OUT = path.join(process.cwd(), 'outputs');

const SOURCES = {
  gentlemonster: {
    label: 'Gentle Monster',
    file: path.join(ROOT, 'gentlemonster-sunglasses-color-map.html'),
  },
  meta: {
    label: 'Meta AI Glasses',
    file: path.join(ROOT, 'meta-ai-glasses-color-map.html'),
  },
  moscot: {
    label: 'MOSCOT',
    file: path.join(ROOT, 'moscot-sunglasses-color-map.html'),
  },
  warby: {
    label: 'Warby Parker',
    file: path.join(ROOT, 'warbyparker-sunglasses-color-map.html'),
  },
};

function readSeed(file) {
  const html = fs.readFileSync(file, 'utf8');
  const match = html.match(/<script id="seed" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error(`No seed JSON found in ${file}`);
  return JSON.parse(match[1]);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'item';
}

function hueFromHex(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (l < 0.13) return 'black';
  if (s < 0.12) return l < 0.2 ? 'black' : 'grey';
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  if (h >= 345 || h < 12) return 'rose';
  if (h < 28) return l < 0.54 ? 'brown' : 'orange';
  if (h < 48) return l < 0.52 ? 'brown' : 'amber';
  if (h < 62) return 'yellow';
  if (h < 86) return 'olive';
  if (h < 165) return 'green';
  if (h < 195) return 'teal';
  if (h < 248) return 'blue';
  if (h < 288) return 'violet';
  if (h < 345) return 'rose';
  return 'unknown';
}

function canonicalHexFromName(name) {
  const n = String(name || '').toLowerCase();
  const rules = [
    [/clear to g-?15|g-?15|g15|graphite green|green\b|emerald|forest|sage|pine|garnet|ever green|dark green/, '#3f5942'],
    [/olive|khaki|bamboo|limelight/, '#6f7442'],
    [/sapphire|cerulean|atlantic|bel air|celebrity blue|denim|light blue|blue\b|navy|aqua|turquoise/, '#426f94'],
    [/teal/, '#2f7778'],
    [/amethyst|violet|purple|lavender|nurple/, '#7560a8'],
    [/\bruby\b|cabernet|rosewood|rosy|\brose\b|\bred\b|burgundy|merlot|blush|new york rose|big apple|city lights/, '#9b5265'],
    [/yellow|mellow|citron|goldenrod|candy corn/, '#d8b63e'],
    [/orange|woodstock/, '#c9702f'],
    [/dark amber|amber|gold|sand|tortoise|havana|honey|blonde|butterscotch|caramel|classic havana|tokyo tortoise/, '#a56f35'],
    [/chocolate|brown gradient|brown mirrored|brown\b|walnut|tobacco|chestnut|root beer|bark|wood|cinnamon|sepia|cosmitan/, '#6b4a34'],
    [/polar gradient graphite|gradient graphite|graphite|polar grey|transitions grey|grey|gray|silver|pewter|gunmetal|charcoal|smoke|ash|shale/, '#626465'],
    [/black|matte black|ink|onyx|noir/, '#171717'],
    [/crystal|clear|flesh|transparent|peach|apricot|beach glass|white|straw/, '#d9c8b7'],
  ];
  for (const [pattern, hex] of rules) {
    if (pattern.test(n)) return hex;
  }
  return '';
}

function calibrateColor(name, actualHex = '') {
  const cleanHex = /^#[0-9a-f]{6}$/i.test(actualHex || '') ? actualHex.toUpperCase() : '';
  const mappedHex = canonicalHexFromName(name);
  const hex = cleanHex || mappedHex;
  const n = String(name || '').toLowerCase();
  if (!cleanHex && /\bcrystal|clear|transparent|beach glass\b/.test(n)) {
    return {
      hue: 'clear',
      hex,
      source: mappedHex ? 'name-to-reference-hex' : 'name-keyword',
    };
  }
  return {
    hue: hueFromHex(hex) || hueFromName(name),
    hex,
    source: cleanHex ? 'source-hex' : (mappedHex ? 'name-to-reference-hex' : 'name-keyword'),
  };
}

function hueFromName(name, hex = '') {
  const byHex = hueFromHex(hex);
  const n = String(name || '').toLowerCase();
  if (/\bblack|noir|onyx|ink\b/.test(n)) return 'black';
  if (/\bgrey|gray|charcoal|pewter|silver|gunmetal|smoke|ash\b/.test(n)) return 'grey';
  if (/\bbrown|espresso|walnut|tobacco|chestnut|cocoa|coffee|root beer|bark|wood|oak|nutmeg\b/.test(n)) return 'brown';
  if (/\btortoise|havana|blonde|honey|bamboo|amber|gold|sand|toffee|butterscotch|cinnamon|caramel|sepia\b/.test(n)) return byHex || 'amber';
  if (/\byellow|citron|mellow|limelight|goldenrod\b/.test(n)) return 'yellow';
  if (/\bolive|g-15|g15|green|emerald|forest|sage|pine|khaki|garnet\b/.test(n)) return 'green';
  if (/\bblue|navy|denim|sapphire|aqua|turquoise|bel air|celebrity\b/.test(n)) return 'blue';
  if (/\bteal\b/.test(n)) return 'teal';
  if (/\bviolet|purple|lavender|nurple\b/.test(n)) return 'violet';
  if (/\brose|rosewood|rosy|pink|blush|burgundy|cabernet|ruby|garnet|red|wine|big apple\b/.test(n)) return 'rose';
  if (/\borange|woodstock|candy corn\b/.test(n)) return 'orange';
  if (/\bcrystal|clear|flesh|apricot|beach glass\b/.test(n)) return byHex || 'clear';
  return byHex || 'unknown';
}

function frameFamily(name) {
  const n = String(name || '').toLowerCase();
  if (/\bblack|noir|onyx|ink\b/.test(n)) return 'Black / Ink';
  if (/\btortoise|havana|walnut|toffee|bark|wood|brown|espresso|tobacco|chestnut|nutmeg|cinnamon|bamboo|honey|blonde\b/.test(n)) return 'Tortoise / Brown';
  if (/\bgold|sand|amber|caramel|butterscotch|yellow|apricot\b/.test(n)) return 'Gold / Warm Crystal';
  if (/\bsilver|grey|gray|gunmetal|pewter|charcoal|shale|ash\b/.test(n)) return 'Grey / Silver';
  if (/\bclear|crystal|flesh|beach glass|transparent\b/.test(n)) return 'Clear / Crystal';
  if (/\bgreen|olive|emerald|sage|pine|khaki|aventurine\b/.test(n)) return 'Green / Olive';
  if (/\bblue|navy|denim|sapphire\b/.test(n)) return 'Blue / Navy';
  if (/\brose|pink|burgundy|red|cabernet|ruby|violet|purple|lavender\b/.test(n)) return 'Rose / Red / Purple';
  return 'Other / Mixed';
}

function metaLensName(name) {
  let n = String(name || '');
  const slash = n.match(/\/\s*([^,]+)(?:,\s*(?:Large|Standard))?$/i);
  if (slash) return slash[1].replace(/\s+lenses?$/i, '').trim();
  const paren = n.match(/\(([^)]*)\)$/);
  if (paren) {
    const bits = paren[1].split(',').map(s => s.trim()).filter(Boolean);
    if (bits.length) return bits[bits.length - 1].replace(/ lenses$/i, '');
  }
  const lensEndings = [
    'Polar Gradient Graphite',
    'Transitions Graphite Green',
    'Transitions Sapphire',
    'Transitions Amethyst',
    'Transitions Emerald',
    'Transitions Brown',
    'Transitions Grey',
    'Brown Gradient',
    'Light Blue Atlantic',
    'Polar Grey',
    'Dark Amber',
    'Chocolate',
    'Green',
    'Brown',
    'Black',
    'Transitions',
  ];
  const clean = n.replace(/\s+lenses?$/i, '');
  for (const ending of lensEndings) {
    if (clean.toLowerCase().endsWith(ending.toLowerCase())) return ending;
  }
  return n;
}

function metaFrameName(c) {
  const lens = metaLensName(c.name);
  return c.name
    .replace(/\([^)]*\)$/g, '')
    .replace(new RegExp(`\\b${lens.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b(?: Lenses?)?`, 'i'), '')
    .replace(/^Meta\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim() || c.model;
}

function productWeight(rank) {
  if (!rank || rank > 999) return 1;
  return Math.max(1, 60 - Math.min(rank, 59));
}

function buildData() {
  const gm = readSeed(SOURCES.gentlemonster.file);
  const meta = readSeed(SOURCES.meta.file);
  const moscot = readSeed(SOURCES.moscot.file);
  const wp = readSeed(SOURCES.warby.file);

  const records = [];
  const classifiers = new Map();
  const addClassifier = item => classifiers.set(item.key, item);

  gm.products.forEach((p, i) => {
    const key = `gentlemonster:${slug(p.name)}:${i}`;
    const lensName = p.cat === 'gradient' ? 'Gradient lens' : (p.cat === 'tint' ? 'Tint lens' : 'Sun lens');
    const cal = { hue: 'unknown', hex: '', source: 'gm-source-lacks-lens-hue' };
    addClassifier({ key, brand: SOURCES.gentlemonster.label, name: `${p.name} / ${lensName}`, lensName, cat: p.cat, hue: cal.hue, img: p.img, hex: cal.hex, hueSource: cal.source });
    records.push({
      id: key,
      classifierKey: key,
      brand: SOURCES.gentlemonster.label,
      rank: p.rank,
      product: p.name,
      frameColor: p.color || 'Unknown',
      frameFamily: frameFamily(p.color),
      lensName,
      lensHue: cal.hue,
      hueHex: cal.hex,
      hueSource: cal.source,
      cat: p.cat,
      img: p.img,
      price: p.price ? `$${p.price}` : '',
      sourceNote: p.bestseller ? `BEST #${p.bestseller} · GM source has frame color only` : 'GM source has frame color only',
      weight: productWeight(p.rank),
    });
  });

  meta.colorways.forEach((c, i) => {
    const lensName = metaLensName(c.name);
    const frameColor = metaFrameName(c);
    const key = `meta:${slug(c.name)}:${i}`;
    const cal = calibrateColor(lensName);
    addClassifier({ key, brand: SOURCES.meta.label, name: c.name, lensName, cat: c.cat, hue: cal.hue, img: c.img, hex: cal.hex, hueSource: cal.source });
    records.push({
      id: key,
      classifierKey: key,
      brand: SOURCES.meta.label,
      rank: c.order,
      product: c.model,
      frameColor,
      frameFamily: frameFamily(frameColor),
      lensName,
      lensHue: cal.hue,
      hueHex: cal.hex,
      hueSource: cal.source,
      cat: c.cat,
      img: c.img,
      price: c.price ? `$${c.price}` : '',
      sourceNote: c.transitions ? 'Transitions' : '',
      weight: productWeight(c.order),
    });
  });

  wp.lenses.forEach(l => {
    const key = `warby:${l.lens}`;
    const cal = calibrateColor(l.lensName);
    addClassifier({ key, brand: SOURCES.warby.label, name: l.lensName, lensName: l.lensName, cat: l.cat, hue: cal.hue, img: l.img, hex: cal.hex, hueSource: cal.source });
  });
  wp.products.forEach(p => {
    p.combos.forEach(c => {
      const key = `warby:${c.lens}`;
      const cal = calibrateColor(c.lensName);
      records.push({
        id: `warby:${p.style}:${c.lens}`,
        classifierKey: key,
        brand: SOURCES.warby.label,
        rank: p.rank,
        product: p.name,
        frameColor: p.frameColor,
        frameFamily: frameFamily(p.frameColor),
        lensName: c.lensName,
        lensHue: cal.hue,
        hueHex: cal.hex,
        hueSource: cal.source,
        cat: c.cat,
        img: c.img.includes('?') ? c.img : `${c.img}?w=500`,
        price: '',
        sourceNote: p.salesRanked ? `SALES #${p.rank}` : `#${p.rank}`,
        weight: productWeight(p.rank),
      });
    });
  });

  const moscotColorByName = new Map(moscot.colors.map(c => [c.name, c]));
  moscot.colors.forEach(c => {
    const key = `moscot:${slug(c.name)}`;
    const cal = calibrateColor(c.name, c.hex);
    addClassifier({ key, brand: SOURCES.moscot.label, name: c.name, lensName: c.name, cat: c.cat, hue: cal.hue, img: c.img, hex: cal.hex, hueSource: cal.source });
  });
  moscot.p1.forEach(p => {
    p.colors.forEach((c, i) => {
      const metaColor = moscotColorByName.get(c.name) || {};
      const key = `moscot:${slug(c.name)}`;
      const cal = calibrateColor(c.name, metaColor.hex);
      records.push({
        id: `moscot:${p.rank}:${i}:${slug(c.name)}`,
        classifierKey: key,
        brand: SOURCES.moscot.label,
        rank: p.rank,
        product: p.title,
        frameColor: c.name,
        frameFamily: frameFamily(c.name),
        lensName: c.name,
        lensHue: cal.hue,
        hueHex: cal.hex,
        hueSource: cal.source,
        cat: metaColor.cat || (String(p.pt).includes('TINT') ? 'tint' : 'sun'),
        img: c.img,
        price: '',
        sourceNote: p.pt,
        weight: productWeight(p.rank),
      });
    });
  });

  const classifierList = [...classifiers.values()].map(x => ({
    ...x,
    ...(() => {
      if (x.hue && x.hueSource) return { hue: x.hue, hex: x.hex || '', hueSource: x.hueSource };
      const cal = calibrateColor(x.lensName || x.name, x.hex);
      return { hue: cal.hue, hex: cal.hex, hueSource: cal.source };
    })(),
  }));

  const hueOrder = ['black', 'grey', 'brown', 'amber', 'yellow', 'orange', 'rose', 'violet', 'blue', 'teal', 'green', 'olive', 'clear', 'unknown'];
  const hueLabel = {
    black: 'Black', grey: 'Grey / Smoke', brown: 'Brown', amber: 'Amber / Tortoise',
    yellow: 'Yellow', orange: 'Orange', rose: 'Rose / Red', violet: 'Violet',
    blue: 'Blue', teal: 'Teal', green: 'Green / G-15', olive: 'Olive / Khaki',
    clear: 'Clear / Crystal', unknown: 'Unknown',
  };

  const hueSummary = hueOrder.map(hue => {
    const rows = records.filter(r => r.lensHue === hue);
    const brands = [...new Set(rows.map(r => r.brand))];
    const cats = rows.reduce((acc, r) => (acc[r.cat] = (acc[r.cat] || 0) + 1, acc), {});
    const examples = [...new Set(rows.map(r => r.lensName))].slice(0, 10);
    return {
      hue,
      label: hueLabel[hue],
      count: rows.length,
      brandCount: brands.length,
      brands,
      cats,
      examples,
    };
  }).filter(x => x.count);

  const frameByHue = {};
  for (const hue of hueOrder) {
    const rows = records.filter(r => r.lensHue === hue);
    if (!rows.length) continue;
    const byFrame = new Map();
    rows.forEach(r => {
      const cur = byFrame.get(r.frameFamily) || { frameFamily: r.frameFamily, count: 0, weighted: 0, examples: new Set(), brands: new Set() };
      cur.count += 1;
      cur.weighted += r.weight;
      cur.examples.add(r.frameColor);
      cur.brands.add(r.brand);
      byFrame.set(r.frameFamily, cur);
    });
    frameByHue[hue] = [...byFrame.values()]
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

  const totalByBrand = {};
  records.forEach(r => totalByBrand[r.brand] = (totalByBrand[r.brand] || 0) + 1);

  return {
    generatedAt: new Date().toISOString(),
    records,
    classifiers: classifierList,
    hueSummary,
    frameByHue,
    totals: {
      records: records.length,
      classifiers: classifierList.length,
      brands: totalByBrand,
    },
  };
}

function makeHtml(data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Combined Sunglasses Tint & Gradient Color Map</title>
<style>
:root{--bg:#f7f4ef;--ink:#1d1d1f;--mut:#756f66;--line:#dfd8cc;--panel:#fffdf9;--accent:#111;--sun:#3a3a3a;--tint:#bd6f92;--gradient:#44799a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
header{padding:24px 28px 14px;border-bottom:1px solid var(--line)}h1{margin:0 0 6px;font-size:24px;letter-spacing:0}.sub{color:var(--mut);font-size:13px}.tabs{position:sticky;top:0;z-index:10;background:rgba(247,244,239,.96);backdrop-filter:saturate(140%) blur(10px);display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px 28px;border-bottom:1px solid var(--line)}
button{font:inherit}.tab,.btn{cursor:pointer;border:1px solid var(--line);background:#fff;border-radius:8px;padding:7px 11px;font-size:12px;font-weight:700;color:#3d3934}.tab.active{background:#111;color:#fff;border-color:#111}.spacer{flex:1}.page{display:none}.page.active{display:block}.wrap{padding:20px 28px 36px}.toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px}.search{border:1px solid var(--line);background:#fff;border-radius:8px;padding:8px 10px;min-width:240px}.select{border:1px solid var(--line);background:#fff;border-radius:8px;padding:8px 10px}
.metric{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}.metric>div{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px}.metric b{display:block;font-size:22px}.metric span{color:var(--mut);font-size:12px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}.card{background:#fff;border:1px solid var(--line);border-radius:8px;overflow:hidden;display:flex;flex-direction:column;min-width:0}.card img{width:100%;height:118px;object-fit:contain;background:#f1f1f2;padding:5px}.cap{padding:9px 10px;font-size:12px}.name{font-weight:700}.meta{color:var(--mut);font-size:11px;margin-top:3px}.badge{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:2px 8px;color:#fff;font-size:10px;font-weight:800}.sun{background:var(--sun)}.tint{background:var(--tint)}.gradient{background:var(--gradient)}
.section{margin:0 0 22px}.section h2{font-size:16px;margin:0 0 10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.tag{color:var(--mut);font-size:12px;font-weight:400}.barrow{display:grid;grid-template-columns:150px 1fr 80px;gap:10px;align-items:center;margin:8px 0}.bar{height:14px;background:#ebe5da;border-radius:999px;overflow:hidden}.fill{height:100%;background:#242424;border-radius:999px}.table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:8px;overflow:hidden}.table th,.table td{text-align:left;border-bottom:1px solid var(--line);padding:9px 10px;font-size:12px;vertical-align:top}.table th{background:#eee8de;font-size:11px;color:#5e574e}.sw{display:inline-block;width:12px;height:12px;border-radius:3px;border:1px solid rgba(0,0,0,.18);vertical-align:-2px;margin-right:5px}.seg{display:flex;gap:4px}.seg button{flex:1;border:1px solid var(--line);background:#fff;border-radius:6px;padding:4px 6px;font-size:10px;font-weight:800;color:#777;cursor:pointer}.seg button.on-sun{background:var(--sun);color:#fff}.seg button.on-tint{background:var(--tint);color:#fff}.seg button.on-gradient{background:var(--gradient);color:#fff}.moved{outline:2px solid #d79922}.note{color:var(--mut);font-size:12px;margin:8px 0 14px}.save{color:#247a39;font-size:12px;font-weight:700}
.detail{background:#fff;border:1px solid var(--line);border-radius:8px;margin:10px 0;overflow:hidden}.detail summary{cursor:pointer;list-style:none;padding:12px 14px;font-weight:800;display:flex;gap:10px;align-items:center;justify-content:space-between}.detail summary::-webkit-details-marker{display:none}.detailBody{border-top:1px solid var(--line);padding:12px 14px}.chips{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 12px}.chip{background:#f0ebe3;border:1px solid var(--line);border-radius:999px;padding:4px 8px;font-size:11px}.miniGrid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}.mini{border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff}.mini img{width:100%;height:86px;object-fit:contain;background:#f5f5f5;padding:4px}.mini div{padding:7px 8px;font-size:11px}.sourceList{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.sourceBox{background:#fff;border:1px solid var(--line);border-radius:8px;padding:11px 12px}.sourceBox a{color:#1b5a8f;text-decoration:none}.sourceBox a:hover{text-decoration:underline}
@media(max-width:1180px){.grid{grid-template-columns:repeat(4,1fr)}.metric{grid-template-columns:repeat(2,1fr)}.miniGrid{grid-template-columns:repeat(4,1fr)}}@media(max-width:760px){.wrap,header,.tabs{padding-left:14px;padding-right:14px}.grid{grid-template-columns:repeat(2,1fr)}.barrow{grid-template-columns:1fr}.metric{grid-template-columns:1fr}.card img{height:104px}.miniGrid{grid-template-columns:repeat(2,1fr)}.sourceList{grid-template-columns:1fr}}
</style>
</head>
<body>
<header><h1>Combined Sunglasses Lens & Frame Color Map</h1><div class="sub" id="subline"></div></header>
<nav class="tabs">
<button class="tab active" data-page="insights">Insights</button>
<button class="tab" data-page="classify">分类工作台</button>
<button class="tab" data-page="all">All Colorways</button>
<span class="spacer"></span><span class="save" id="saveState">● saved locally</span>
<button class="btn" id="exportBtn">Export Edits</button><button class="btn" id="importBtn">Import Edits</button><button class="btn" id="resetBtn">Reset</button>
<input id="fileInput" type="file" accept="application/json" hidden>
</nav>
<main>
<section id="insights" class="page active"><div class="wrap" id="insightsWrap"></div></section>
<section id="classify" class="page"><div class="wrap"><div class="note">这里是预留给你修正分类的空间。Warby Parker 按镜片库统一修改；其他品牌按原始 colorway/产品项修改。改动会保存在本浏览器，导出后可备份。</div><div class="toolbar"><input class="search" id="classSearch" placeholder="Search brand, lens, color"><select class="select" id="classBrand"><option value="">All brands</option></select><select class="select" id="classHue"><option value="">All hues</option></select></div><div id="classifyWrap"></div></div></section>
<section id="all" class="page"><div class="wrap"><div class="toolbar"><input class="search" id="allSearch" placeholder="Search product, frame, lens"><select class="select" id="allBrand"><option value="">All brands</option></select><select class="select" id="allCat"><option value="">All categories</option><option value="sun">Sun</option><option value="tint">Tint</option><option value="gradient">Gradient</option></select></div><div class="grid" id="allGrid"></div></div></section>
</main>
<script id="data" type="application/json">${json}</script>
<script>
const DATA=JSON.parse(document.getElementById('data').textContent);
const RESEARCH=[
 {label:'Warby Parker official shelf',url:'https://www.warbyparker.com/sunglasses',note:'Current sunglasses page shows 120 frames, filters for Bestsellers / Trending: 90s minimalism / New arrivals, and a promo calling Boaz “Summer’s newest bestseller”.'},
 {label:'Meta official shop-all',url:'https://www.meta.com/ai-glasses/shop-all/',note:'Featured order currently starts with New Meta Glasses Starfire Kylie Edition, Adventurer, and Fury, followed by Ray-Ban / Oakley Meta families.'},
 {label:'2026 sunglasses trend reporting',url:'https://www.whowhatwear.com/fashion/trends/sunglasses-trends-2026',note:'Runway/edit market signal: oversize silhouettes, wire frames, thick acetate, modern cat-eyes, and high-impact colors including blue, red, and yellow.'},
 {label:'Light tint / non-sun sunglasses',url:'https://www.theguardian.com/fashion/2026/mar/06/non-sun-sunglasses-sport-fashion-fusion-accessory-goes-mainstream',note:'Fashion signal: light-tint, shield/performance-influenced “non-sun” sunglasses are moving into everyday style.'},
 {label:'2026 color trend context',url:'https://www.wallpaper.com/design-interiors/colour-trends-2026',note:'Broader color signal: chocolate brown, burgundy, deep teal, glacier blue, rich gold, khaki, and warm white are prominent 2026 palettes.'}
];
const CATS=['sun','tint','gradient'];
const CATLABEL={sun:'Sun',tint:'Tint',gradient:'Gradient'};
const HUELABEL={black:'Black',grey:'Grey / Smoke',brown:'Brown',amber:'Amber / Tortoise',yellow:'Yellow',orange:'Orange',rose:'Rose / Red',violet:'Violet',blue:'Blue',teal:'Teal',green:'Green / G-15',olive:'Olive / Khaki',clear:'Clear / Crystal',unknown:'Unknown'};
const KEY='combined_sunglasses_category_edits_v1';
const defaults=Object.fromEntries(DATA.classifiers.map(x=>[x.key,x.cat]));
let cats=Object.assign({},defaults,JSON.parse(localStorage.getItem(KEY)||'{}'));
function save(){const diff={};Object.keys(cats).forEach(k=>{if(cats[k]!==defaults[k])diff[k]=cats[k]});localStorage.setItem(KEY,JSON.stringify(diff));document.getElementById('saveState').textContent='● saved locally';}
function catForRecord(r){return cats[r.classifierKey]||r.cat}
function clsCat(c){return c==='gradient'?'gradient':c==='tint'?'tint':'sun'}
function setPage(id){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.page===id));document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));window.scrollTo(0,0)}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>setPage(b.dataset.page));
function populateSelect(id, values, labels){const s=document.getElementById(id);values.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=labels?.[v]||v;s.appendChild(o)})}
const brands=[...new Set(DATA.records.map(r=>r.brand))];populateSelect('classBrand',brands);populateSelect('allBrand',brands);populateSelect('classHue',[...new Set(DATA.classifiers.map(c=>c.hue))],HUELABEL);
function renderSub(){const counts={sun:0,tint:0,gradient:0};DATA.classifiers.forEach(c=>counts[cats[c.key]||c.cat]++);document.getElementById('subline').innerHTML=DATA.totals.records+' colorways · '+DATA.totals.classifiers+' editable color entries · <b>Sun '+counts.sun+' / Tint '+counts.tint+' / Gradient '+counts.gradient+'</b>'}
function renderInsights(){
 const rows=DATA.hueSummary.slice().sort((a,b)=>b.brandCount-a.brandCount||b.count-a.count);
 const max=Math.max(...rows.map(r=>r.count));
 let html='<div class="metric"><div><b>'+DATA.totals.records+'</b><span>frame × lens records</span></div><div><b>'+DATA.totals.classifiers+'</b><span>editable classification entries</span></div><div><b>'+rows.filter(r=>r.brandCount>=3).length+'</b><span>hues shared by 3+ brands</span></div><div><b>'+rows[0].label+'</b><span>most cross-brand hue family</span></div></div>';
 html+='<section class="section"><h2>Lens Hue Ranking <span class="tag">sorted by cross-brand presence, then volume</span></h2>';
 rows.forEach(r=>{html+='<div class="barrow"><div><b>'+r.label+'</b><div class="tag">'+r.brands.join(', ')+'</div></div><div class="bar"><div class="fill" style="width:'+(100*r.count/max).toFixed(1)+'%"></div></div><div>'+r.count+'</div></div>'});
 html+='</section><section class="section"><h2>Classic Frame Pairings <span class="tag">rank-weighted; bestseller order gets more weight</span></h2><table class="table"><thead><tr><th>Lens hue</th><th>Strongest frame families</th><th>Typical examples</th></tr></thead><tbody>';
 rows.forEach(r=>{const frames=(DATA.frameByHue[r.hue]||[]).slice(0,3);html+='<tr><td><b>'+r.label+'</b><br><span class="tag">'+r.examples.slice(0,5).join(', ')+'</span></td><td>'+frames.map(f=>'<b>'+f.frameFamily+'</b> <span class="tag">('+f.count+')</span>').join('<br>')+'</td><td>'+frames.map(f=>f.examples.slice(0,4).join(', ')).join('<br>')+'</td></tr>'});
 html+='</tbody></table></section>';
 html+='<section class="section"><h2>Hue Deep Dive <span class="tag">variants, categories, pairings, image cases</span></h2>';
 rows.forEach((r,idx)=>{
   const recs=DATA.records.filter(x=>x.lensHue===r.hue);
   const variants={};recs.forEach(x=>variants[x.lensName]=(variants[x.lensName]||0)+1);
   const topVariants=Object.entries(variants).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,18);
   const images=[];const seen=new Set();
   recs.sort((a,b)=>a.rank-b.rank).forEach(x=>{const k=x.brand+'|'+x.product+'|'+x.lensName;if(images.length<12&&!seen.has(k)&&x.img){images.push(x);seen.add(k)}});
   const frames=(DATA.frameByHue[r.hue]||[]).slice(0,4);
   html+='<details class="detail" '+(idx<4?'open':'')+'><summary><span>'+r.label+' · '+Object.keys(variants).length+' variants · '+r.count+' records</span><span class="tag">'+r.brands.join(' / ')+'</span></summary><div class="detailBody">';
   html+='<div class="chips">'+topVariants.map(v=>'<span class="chip">'+v[0]+' · '+v[1]+'</span>').join('')+'</div>';
   html+='<table class="table"><tbody><tr><td><b>Category mix</b></td><td>'+Object.entries(r.cats).map(([k,v])=>CATLABEL[k]+': '+v).join(' · ')+'</td></tr><tr><td><b>Classic frames</b></td><td>'+frames.map(f=>'<b>'+f.frameFamily+'</b> ('+f.count+') - '+f.examples.slice(0,4).join(', ')).join('<br>')+'</td></tr></tbody></table>';
   html+='<div class="miniGrid">'+images.map(x=>'<div class="mini"><img loading="lazy" src="'+x.img+'" alt="'+x.product+'"><div><b>'+x.brand+'</b><br>'+x.product+'<br><span class="tag">'+x.lensName+' / '+x.frameColor+'</span></div></div>').join('')+'</div>';
   html+='</div></details>';
 });
 html+='</section>';
 html+='<section class="section"><h2>Best Selling / Newest Signals <span class="tag">official where available, local scrape where blocked</span></h2><table class="table"><thead><tr><th>Brand</th><th>Best-selling / featured signal</th><th>Newest / color signal</th><th>Confidence</th></tr></thead><tbody>';
 html+='<tr><td><b>Warby Parker</b></td><td>Official page exposes “Bestsellers” as a shop filter; current featured grid starts Elio, Brimmer, Esme, Millie, Boaz. The page promo names Boaz as “Summer’s newest bestseller”.</td><td>Official page also exposes “New arrivals” and “Trending: 90s minimalism”; current promo highlights new tortoise shell sunglasses with green lenses and tint personalization in blue, yellow, and rosy brown.</td><td>High: official page readable.</td></tr>';
 html+='<tr><td><b>Meta AI Glasses</b></td><td>Official shop-all featured order starts with New Meta Glasses Starfire Kylie Edition, Adventurer, Fury, then Ray-Ban Meta Wayfarer Gen 2.</td><td>Newest official labels are the three “New Meta Glasses” families; color count shown as Starfire 3, Adventurer 8, Fury 7.</td><td>High: official page readable.</td></tr>';
 html+='<tr><td><b>Gentle Monster</b></td><td>Current official page could not be fetched in this environment. This HTML keeps your local best-selling rank from the Claude scrape; top local entries start Gent 01, Soho 01(LV), etc.</td><td>External current signal points to 2026 Circuit Disney × F1 collection, but exact newest color order was not safely confirmable from official PDP/listing here.</td><td>Medium/low: local scrape + external signal.</td></tr>';
 html+='<tr><td><b>MOSCOT</b></td><td>Current official page could not be fetched in this environment. This HTML keeps your local best-selling product order; top local product groups remain the basis for pairings.</td><td>Newest color order was not safely confirmable from official listing here.</td><td>Medium/low: local scrape only for ordering.</td></tr>';
 html+='</tbody></table></section>';
 html+='<section class="section"><h2>Industry Read <span class="tag">how external 2026 trends compare with this dataset</span></h2><table class="table"><tbody><tr><td><b>Commercial core</b></td><td>Your four-site dataset says the commercial spine is still brown, grey/smoke, blue, and green/G-15. Brown is especially convincing because it is both an evergreen sunglass color and aligned with broader 2026 chocolate/mocha color momentum.</td></tr><tr><td><b>Fashion layer</b></td><td>Trend reporting pushes oversized/dramatic shapes, high-impact lens colors, and light “non-sun” tints. In this dataset that maps best to blue tint, yellow tint, rose/red, violet gradient, and sporty/transitions-style colorways.</td></tr><tr><td><b>Merchandising implication</b></td><td>Keep best-selling assortments grounded in black/tortoise/brown/grey/green. Use blue, yellow, rose, violet, and gradient lenses as editorial accents or seasonal capsules rather than the whole wall.</td></tr></tbody></table></section>';
 html+='<section class="section"><h2>Sources</h2><div class="sourceList">'+RESEARCH.map(s=>'<div class="sourceBox"><b><a href="'+s.url+'" target="_blank" rel="noreferrer">'+s.label+'</a></b><br><span class="tag">'+s.note+'</span></div>').join('')+'</div></section>';
 html+='<section class="section"><h2>Takeaways</h2><table class="table"><tbody><tr><td><b>共同选择</b></td><td>Brown, Blue, Grey/Smoke, Green/G-15 是四站最稳定的共同色相；Rose/Red、Violet、Yellow 更像 tint/gradient 或时装化补充。</td></tr><tr><td><b>最经典搭配</b></td><td>棕色镜片最常配 Tortoise/Brown；灰黑片最常配 Grey/Silver 或 Black/Ink；绿色/G-15 在 Black 与 Tortoise 上都成立；蓝片需要深色、银灰或同色系镜框来压住。</td></tr><tr><td><b>需要人工校准</b></td><td>GM 和 MOSCOT 的部分“颜色名”同时描述镜框和镜片，我保留了原始项并用关键词归 hue。分类工作台就是给这些边界项留的修正空间。</td></tr></tbody></table></section>';
 document.getElementById('insightsWrap').innerHTML=html;
}
function renderClassify(){
 const q=document.getElementById('classSearch').value.toLowerCase();const b=document.getElementById('classBrand').value;const h=document.getElementById('classHue').value;
 const list=DATA.classifiers.filter(c=>(!b||c.brand===b)&&(!h||c.hue===h)&&(!q||(c.brand+' '+c.name+' '+c.lensName).toLowerCase().includes(q))).sort((a,b)=>a.brand.localeCompare(b.brand)||a.hue.localeCompare(b.hue)||a.name.localeCompare(b.name));
 let html='<table class="table"><thead><tr><th>Brand</th><th>Lens / color entry</th><th>Hue</th><th>Category</th></tr></thead><tbody>';
 list.forEach(c=>{const moved=(cats[c.key]||c.cat)!==defaults[c.key]?' moved':'';html+='<tr class="'+moved+'"><td>'+c.brand+'</td><td>'+(c.hex?'<span class="sw" style="background:'+c.hex+'"></span>':'')+'<b>'+c.name+'</b><br><span class="tag">'+c.lensName+'</span></td><td>'+HUELABEL[c.hue]+'</td><td><div class="seg">'+CATS.map(cat=>'<button data-key="'+c.key+'" data-cat="'+cat+'" class="'+((cats[c.key]||c.cat)===cat?'on-'+cat:'')+'">'+CATLABEL[cat]+'</button>').join('')+'</div></td></tr>'});
 html+='</tbody></table>';document.getElementById('classifyWrap').innerHTML=html;
}
function card(r){const c=catForRecord(r);return '<figure class="card"><img loading="lazy" src="'+r.img+'" alt="'+r.product+'"><div class="cap"><div class="name">'+r.product+'</div><div class="meta">'+r.brand+' · '+(r.sourceNote||'')+'</div><div class="meta">Frame: '+r.frameColor+'</div><div class="meta">Lens: '+r.lensName+' · '+(HUELABEL[r.lensHue]||r.lensHue)+'</div><span class="badge '+clsCat(c)+'">'+CATLABEL[c]+'</span></div></figure>'}
function renderAll(){
 const q=document.getElementById('allSearch').value.toLowerCase();const b=document.getElementById('allBrand').value;const cat=document.getElementById('allCat').value;
 const list=DATA.records.filter(r=>(!b||r.brand===b)&&(!cat||catForRecord(r)===cat)&&(!q||(r.brand+' '+r.product+' '+r.frameColor+' '+r.lensName).toLowerCase().includes(q))).slice(0,600);
 document.getElementById('allGrid').innerHTML=list.map(card).join('');
}
document.getElementById('classifyWrap').onclick=e=>{const btn=e.target.closest('button[data-key]');if(!btn)return;cats[btn.dataset.key]=btn.dataset.cat;save();renderSub();renderClassify();renderAll();};
['classSearch','classBrand','classHue'].forEach(id=>document.getElementById(id).addEventListener('input',renderClassify));
['allSearch','allBrand','allCat'].forEach(id=>document.getElementById(id).addEventListener('input',renderAll));
document.getElementById('exportBtn').onclick=()=>{const diff={};Object.keys(cats).forEach(k=>{if(cats[k]!==defaults[k])diff[k]=cats[k]});const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(diff,null,2)],{type:'application/json'}));a.download='combined-sunglasses-category-edits.json';a.click()};
document.getElementById('importBtn').onclick=()=>document.getElementById('fileInput').click();
document.getElementById('fileInput').onchange=ev=>{const f=ev.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{try{const o=JSON.parse(rd.result);Object.keys(o).forEach(k=>{if(k in cats&&CATS.includes(o[k]))cats[k]=o[k]});save();renderSub();renderClassify();renderInsights();renderAll()}catch(e){alert('Import failed: '+e.message)}};rd.readAsText(f);ev.target.value=''};
document.getElementById('resetBtn').onclick=()=>{if(!confirm('Reset all classification edits?'))return;cats=Object.assign({},defaults);localStorage.removeItem(KEY);renderSub();renderClassify();renderInsights();renderAll()};
renderSub();renderInsights();renderClassify();renderAll();
</script>
</body>
</html>`;
}

fs.mkdirSync(OUT, { recursive: true });
const data = buildData();
fs.writeFileSync(path.join(OUT, 'combined-sunglasses-analysis.json'), JSON.stringify({
  generatedAt: data.generatedAt,
  totals: data.totals,
  hueSummary: data.hueSummary,
  frameByHue: data.frameByHue,
}, null, 2));
fs.writeFileSync(path.join(OUT, 'combined-sunglasses-color-map.html'), makeHtml(data));

console.log(JSON.stringify({
  html: path.join(OUT, 'combined-sunglasses-color-map.html'),
  analysis: path.join(OUT, 'combined-sunglasses-analysis.json'),
  totals: data.totals,
  topHues: data.hueSummary.slice().sort((a, b) => b.brandCount - a.brandCount || b.count - a.count).slice(0, 8),
}, null, 2));
