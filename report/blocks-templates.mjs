import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const pages = JSON.parse(fs.readFileSync(path.join(ROOT, 'report', 'data', 'pages.json'), 'utf8'));
const agg = JSON.parse(fs.readFileSync(path.join(ROOT, 'report', 'data', 'aggregates.json'), 'utf8'));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cxDays = { 'Low': 1.5, 'Medium': 3, 'High': 5, 'Very High': 8 };

// ---------- BLOCK CATALOG (block + variations) with page detection ----------
const blockCatalog = [
  { block: 'Hero / Hero-Block', key: 'hero-block', cx: 'High', days: 6,
    variations: ['Standard hero', 'Hero Video (js-hero-block-video)', 'Hero Carousel (multi-slide)', 'Hero Split', 'Hero Overlay', 'Sticky hero'] },
  { block: 'Teaser / Card', key: 'teaser', cx: 'High', days: 6,
    variations: ['Image teaser', 'CTA teaser', 'Product card', 'News card', 'Navigation teaser', '2/3/4-up teaser grid'] },
  { block: 'Carousel / Slider', key: 'carousel', cx: 'High', days: 6,
    variations: ['Media carousel', 'Product rail', 'Tabbed carousel (cmp-carousel-tab)', 'Gallery carousel'] },
  { block: 'Accordion', key: 'accordion', cx: 'Medium', days: 3,
    variations: ['Standard', 'FAQ', 'Multi-expand', 'Spec accordion'] },
  { block: 'Gallery / Image Grid', key: 'gallery', cx: 'Medium', days: 4,
    variations: ['Grid gallery', 'Carousel gallery', 'Image grid (cmp-image-grid)', 'Tile mosaic (cmp-tilemosaic)'] },
  { block: 'Image', key: 'image', cx: 'Low', days: 2,
    variations: ['Responsive image (Scene7/DAM)', 'Background image', 'Object-fit cover'] },
  { block: 'Breadcrumb', key: 'breadcrumb', cx: 'Low', days: 1.5,
    variations: ['Standard breadcrumb'] },
  { block: 'Title / Heading', key: 'title', cx: 'Low', days: 1,
    variations: ['H1–H4 title component'] },
  { block: 'Text / Rich Text', key: 'text', cx: 'Low', days: 1,
    variations: ['RTE body copy'] },
  { block: 'List', key: 'list', cx: 'Low', days: 2,
    variations: ['Link list', 'Navigation list', 'Dynamic list (cmp-list)'] },
  { block: 'Container / Section', key: 'container', cx: 'Low', days: 2,
    variations: ['Responsive grid container (aem-Grid)', 'Segment block'] },
  { block: 'Video / Video Embed', key: 'video', cx: 'Medium', days: 4,
    variations: ['YouTube embed', 'Video (cmp-video)', 'Video embed (cmp-videoembed)', 'Inline hero video'] },
  { block: 'Iframe / App Embed', key: 'iframe', cx: 'High', days: 5,
    variations: ['BYO configurator embed', 'External tool embed'] },
  { block: 'Feature / Segment Block', key: 'feature', cx: 'Medium', days: 4,
    variations: ['Feature callout', 'Segment navigation block'] },
  { block: 'Modal / Dialog', key: 'modal', cx: 'Medium', days: 3,
    variations: ['Content modal', 'Video modal'] },
  { block: 'CTA / Banner', key: 'banner', cx: 'Low', days: 2,
    variations: ['CTA banner', 'Promo banner', 'Action-link bar'] },
  { block: 'Page-Level Navigation', key: 'page-level-navigation', cx: 'Medium', days: 3,
    variations: ['In-page anchor nav (cmp-page-level-navigation)'] },
  { block: 'Tabs', key: 'tabs', cx: 'Medium', days: 3,
    variations: ['Horizontal tabs (cmp-tabs)'] },
  { block: 'Table', key: 'table', cx: 'Low', days: 1.5,
    variations: ['Data / spec table'] },
  { block: 'Downloads', key: 'download', cx: 'Low', days: 2,
    variations: ['PDF / brochure download list'] },
  { block: 'Form', key: 'form', cx: 'High', days: 5,
    variations: ['Lead-gen / quote / pre-order form'] },
  { block: 'Dealer Locator', key: 'dealer', cx: 'Very High', days: 8,
    variations: ['Map + search locator app'] },
];
function pagesForKey(key) {
  return pages.filter((x) => x.cmp[key] || x.custom[key]
    || (key === 'iframe' && x.blocks.iframes > 2)
    || (key === 'table' && x.blocks.tables > 0)
    || (key === 'form' && x.blocks.forms > 0)
    || (key === 'download' && x.blocks.pdfLinks > 0)).length;
}
const totalVariations = blockCatalog.reduce((s, b) => s + b.variations.length, 0);
const totalBlockDays = blockCatalog.reduce((s, b) => s + b.days, 0);

// ---------- TEMPLATES ----------
const byT = {};
for (const x of pages) (byT[x.template] ??= []).push(x);
const templateMeta = {
  'Home': { cx: 'High', found: 'Multi-brand hero carousel (8 H1s), teaser grids, segment blocks.' },
  'Brand Home': { cx: 'High', found: 'Per-brand landing (5 brands): hero carousels + teaser navigation.' },
  'Product Detail (Model)': { cx: 'High', found: 'Model/lineup pages: hero, heavy carousels (avg 22), spec teasers, galleries, accordions.' },
  'Product Listing (Model Year)': { cx: 'Medium', found: 'Model-year index: teaser card grids linking to models.' },
  'Product Configurator (BYO)': { cx: 'Very High', found: 'Customise-Your-Own: 3rd-party app via iframe (zlthunder.net); 92% carry iframe.' },
  'Experience / Editorial': { cx: 'Medium', found: 'Editorial storytelling: hero, teasers, galleries (19%), accordions.' },
  'Owner Zone / Support Article': { cx: 'Medium', found: 'Support/how-to: rich text, images, accordions, some hero.' },
  'Blog / Article': { cx: 'Medium', found: 'Blog posts: hero, rich text, galleries, accordions.' },
  'News': { cx: 'Medium', found: 'BRP Universe news: gallery-heavy (44%), teaser cards.' },
  'Events': { cx: 'Medium', found: 'BRP Universe events: galleries (63%), teasers.' },
  'Press Release': { cx: 'Low', found: 'Text-dominant, minimal blocks.' },
  'Promotion / Campaign': { cx: 'Medium', found: 'Hero + CTA driven campaign pages.' },
  'Parts, Accessories & Apparel': { cx: 'High', found: 'PA&A: extremely carousel-heavy (avg 119), product rails.' },
  'About / Corporate': { cx: 'Medium', found: 'Corporate: hero (100%), accordion-heavy content.' },
  'Section Landing': { cx: 'Medium', found: 'Section index pages: teaser navigation grids.' },
  'Dealer Locator': { cx: 'High', found: 'Find-a-dealer: interactive locator (dynamic JS/map app).' },
  'Downloads / Brochures': { cx: 'Medium', found: 'Brochure downloads: PDF link lists.' },
  'Form / Lead Gen': { cx: 'High', found: 'Request-a-quote / pre-order: forms, accordions.' },
  'FAQ': { cx: 'Low', found: 'Accordion Q&A.' },
  'Legal / Utility': { cx: 'Low', found: 'Long-form text, nested lists.' },
  'Content Page (Generic)': { cx: 'Medium', found: 'Generic content pages on master template.' },
  'Shopping Tool': { cx: 'Medium', found: 'Misc shopping tool landing.' },
};
const templateRows = Object.entries(byT).sort((a, b) => b[1].length - a[1].length).map(([t, arr]) => {
  const meta = templateMeta[t] || { cx: 'Medium', found: '' };
  return { t, n: arr.length, cx: meta.cx, found: meta.found, days: cxDays[meta.cx] };
});
const totalTemplateDays = templateRows.reduce((s, r) => s + r.days, 0);

// ---------- MATRIX ----------
const matrixBlocks = ['hero-block', 'teaser', 'carousel', 'accordion', 'gallery', 'image', 'breadcrumb', 'title', 'text', 'list', 'video', 'iframe'];
const matrixLabels = { 'hero-block': 'Hero', teaser: 'Teaser', carousel: 'Carousel', accordion: 'Accordion', gallery: 'Gallery', image: 'Image', breadcrumb: 'Breadcrumb', title: 'Title', text: 'Text', list: 'List', video: 'Video', iframe: 'Iframe' };
const matrixRows = templateRows.map(({ t, n, cx }) => {
  const arr = byT[t];
  const cells = matrixBlocks.map((b) => {
    const c = arr.filter((x) => x.cmp[b] || x.custom[b] || (b === 'iframe' && x.blocks.iframes > 2)).length;
    return Math.round((c / n) * 100);
  });
  return { t, n, cx, cells };
});

// ---------- HTML ----------
const cxClass = (c) => 'cx-' + c.replace(/\s/g, '');
const matrixCell = (v) => `<td class="mx" style="background:${v === 0 ? '#f6f8fa' : `rgba(37,99,235,${(v / 100) * 0.85 + 0.12})`};color:${v > 55 ? '#fff' : '#111'}">${v || ''}</td>`;

const blockRows = blockCatalog.map((b) => {
  const pg = pagesForKey(b.key);
  return `<tr>
<td><b>${esc(b.block)}</b></td>
<td class="num">${b.variations.length}</td>
<td>${b.variations.map((v) => `<span class="chip">${esc(v)}</span>`).join(' ')}</td>
<td class="num">${pg}</td>
<td class="num">${Math.round(pg / pages.length * 100)}%</td>
<td><span class="cx ${cxClass(b.cx)}">${b.cx}</span></td>
</tr>`;
}).join('');

const templateTableRows = templateRows.map((r) => `<tr>
<td><b>${esc(r.t)}</b></td>
<td class="num">${r.n}</td>
<td class="num">${(r.n / pages.length * 100).toFixed(1)}%</td>
<td><span class="cx ${cxClass(r.cx)}">${r.cx}</span></td>
<td class="found">${esc(r.found)}</td>
</tr>`).join('');

const matrixHeader = matrixBlocks.map((b) => `<th class="rot"><span>${esc(matrixLabels[b])}</span></th>`).join('');
const matrixTableRows = matrixRows.map((r) => `<tr><td class="sticky">${esc(r.t)}</td><td class="num">${r.n}</td><td class="num"><span class="cx ${cxClass(r.cx)}">${r.cx}</span></td>${r.cells.map(matrixCell).join('')}</tr>`).join('');

// complexity distribution
const cxDist = {};
for (const r of templateRows) cxDist[r.cx] = (cxDist[r.cx] || 0) + 1;
const blkCxDist = {};
for (const b of blockCatalog) blkCxDist[b.cx] = (blkCxDist[b.cx] || 0) + 1;

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BRP-World → EDS · Blocks, Templates & Complexity</title>
<style>
:root{--brand:#ffcb00;--ink:#0b0f19;--edge:#e2e6ee;--blue:#2563eb;--muted:#5b6472}
*{box-sizing:border-box}
body{margin:0;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:#f4f6fa}
header.hero{background:linear-gradient(135deg,#0b0f19,#1c2541);color:#fff;padding:44px 40px 36px}
header.hero h1{margin:0 0 8px;font-size:28px;letter-spacing:-.5px}
header.hero .sub{color:#9fb0c9;font-size:14.5px;max-width:820px}
header.hero .badge{display:inline-block;background:var(--brand);color:#111;font-weight:700;padding:3px 10px;border-radius:5px;font-size:12px;margin-bottom:14px;letter-spacing:.5px}
.wrap{max-width:1240px;margin:0 auto;padding:0 24px 70px}
nav.toc{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--edge);z-index:40;padding:10px 24px;display:flex;flex-wrap:wrap;gap:4px 16px;font-size:13px}
nav.toc a{color:var(--muted);text-decoration:none}
nav.toc a:hover{color:var(--blue)}
section{background:#fff;border:1px solid var(--edge);border-radius:12px;padding:26px 30px;margin:22px 0;box-shadow:0 1px 3px rgba(10,15,25,.04)}
h2.sec{font-size:21px;margin:0 0 6px;padding-bottom:10px;border-bottom:3px solid var(--brand);display:inline-block}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin:18px 0}
.kpi{background:#f8fafc;border:1px solid var(--edge);border-radius:10px;padding:16px}
.kpi .n{font-size:26px;font-weight:800;color:var(--blue)}
.kpi .l{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-top:2px}
table{border-collapse:collapse;width:100%;font-size:13px;margin:12px 0}
th,td{border:1px solid var(--edge);padding:8px 10px;text-align:left;vertical-align:top}
th{background:#f0f3f8;font-weight:700}
td.num,th.num{text-align:center;white-space:nowrap}
tr:nth-child(even){background:#fafbfd}
.found{color:var(--muted);font-size:12px}
.cx{padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap}
.cx-Low{background:#dbf3e0;color:#0f5132}.cx-Medium{background:#fff3cd;color:#664d03}.cx-High{background:#ffe0d6;color:#842029}.cx-VeryHigh{background:#f5d0f0;color:#5a1a6e}
.chip{display:inline-block;background:#eef1f6;border:1px solid #dfe4ec;color:#3a4453;font-size:11px;padding:1px 7px;border-radius:4px;margin:2px 1px}
.rot{height:96px;padding:0}
.rot>span{writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;font-size:12px}
td.sticky{position:sticky;left:0;background:#fff;font-weight:600;max-width:190px;font-size:12px}
.mx{text-align:center;font-weight:600;font-size:11px}
.tablewrap{max-height:660px;overflow:auto;border:1px solid var(--edge);border-radius:8px}
.note{background:#f0f6ff;border-left:4px solid var(--blue);padding:12px 16px;border-radius:0 8px 8px 0;margin:14px 0;font-size:13.5px}
.legend{font-size:12px;color:var(--muted);margin:6px 0}
.total-row{background:#0b0f19!important;color:#fff;font-weight:800}
.total-row td{border-color:#333}
.pills{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
.pill{padding:4px 12px;border-radius:20px;font-size:12.5px;font-weight:700}
footer{text-align:center;color:var(--muted);font-size:12px;padding:26px}
</style></head>
<body>
<header class="hero">
  <div class="badge">ADOBE EDGE DELIVERY SERVICES · BLOCK & TEMPLATE REPORT</div>
  <h1>BRP-World.com → EDS · Blocks, Templates & Complexity</h1>
  <div class="sub">Derived from independent DOM analysis of all <b>${pages.length.toLocaleString()}</b> in-scope URLs (<code>www.brp-world.com/int/en/</code>). Blocks and variations are detected from live AEM component signatures (<code>cmp-*</code>); complexity is a relative build rating. Effort estimates are in the sales summary.</div>
</header>
<nav class="toc">
  <a href="#summary">Summary</a>
  <a href="#blocks">1 · Blocks & Variations</a>
  <a href="#templates">2 · Unique Templates</a>
  <a href="#matrix">3 · Template → Block Mapping</a>
  <a href="#complexity">4 · Complexity Overview</a>
</nav>
<div class="wrap">

<section id="summary">
<h2 class="sec">Summary</h2>
<div class="kpis">
  <div class="kpi"><div class="n">${blockCatalog.length}</div><div class="l">Total blocks</div></div>
  <div class="kpi"><div class="n">${totalVariations}</div><div class="l">Block variations</div></div>
  <div class="kpi"><div class="n">${templateRows.length}</div><div class="l">Unique templates</div></div>
  <div class="kpi"><div class="n">${pages.length.toLocaleString()}</div><div class="l">Pages analyzed</div></div>
</div>
</section>

<section id="blocks">
<h2 class="sec">1 · Total Blocks & Their Variations</h2>
<p><b>${blockCatalog.length} distinct EDS blocks</b> with <b>${totalVariations} variations</b>. "Pages" = number of pages whose DOM carries the block's component signature.</p>
<table>
<thead><tr><th>Block</th><th class="num"># Var.</th><th>Variations (observed)</th><th class="num">Pages</th><th class="num">% Site</th><th>Complexity</th></tr></thead>
<tbody>${blockRows}
<tr class="total-row"><td>TOTAL</td><td class="num">${totalVariations}</td><td>${blockCatalog.length} blocks</td><td class="num">—</td><td class="num">—</td><td>—</td></tr>
</tbody>
</table>
</section>

<section id="templates">
<h2 class="sec">2 · Total Unique Templates</h2>
<p><b>${templateRows.length} distinct templates</b> across ${pages.length.toLocaleString()} pages.</p>
<table>
<thead><tr><th>Template</th><th class="num">Pages</th><th class="num">% Site</th><th>Complexity</th><th>Findings</th></tr></thead>
<tbody>${templateTableRows}
<tr class="total-row"><td>TOTAL</td><td class="num">${pages.length}</td><td class="num">100%</td><td>—</td><td>Template scaffolding</td></tr>
</tbody>
</table>
</section>

<section id="matrix">
<h2 class="sec">3 · Template → Block Mapping Matrix</h2>
<p>Each cell = % of pages in that template whose DOM contains the block. Darker = more prevalent.</p>
<div class="legend">Blank/light = absent · Dark blue = present on most pages of the template.</div>
<div class="tablewrap">
<table>
<thead><tr><th class="sticky">Template</th><th class="num">Pages</th><th class="num">Complexity</th>${matrixHeader}</tr></thead>
<tbody>${matrixTableRows}</tbody>
</table>
</div>
<div class="note"><b>Read-out:</b> Teaser, Image and Breadcrumb are near-universal. Hero + Carousel dominate Home, Brand, Product and PA&A templates. The Configurator template is defined almost entirely by the Iframe embed. Support/Owner-Zone and Blog lean on Accordion and Text.</div>
</section>

<section id="complexity">
<h2 class="sec">4 · Complexity Overview</h2>
<h3 style="margin-top:4px">Templates by complexity</h3>
<div class="pills">
${['Very High', 'High', 'Medium', 'Low'].filter((c) => cxDist[c]).map((c) => `<span class="pill ${cxClass(c)}">${c}: ${cxDist[c]} template${cxDist[c] > 1 ? 's' : ''}</span>`).join('')}
</div>
<h3>Blocks by complexity</h3>
<div class="pills">
${['Very High', 'High', 'Medium', 'Low'].filter((c) => blkCxDist[c]).map((c) => `<span class="pill ${cxClass(c)}">${c}: ${blkCxDist[c]} block${blkCxDist[c] > 1 ? 's' : ''}</span>`).join('')}
</div>
<div class="note"><b>Interpretation:</b> The bulk of the site is Low/Medium complexity thanks to a small, highly-reused block palette. High/Very-High complexity concentrates in the Hero, Teaser and Carousel blocks (site-wide, rich behaviour) and in the BYO Configurator and Dealer Locator (dynamic / third-party). Effort estimates are provided separately in the sales summary (<code>report/summary.html</code>).</div>
</section>

<footer>Prepared from independent DOM analysis of all ${pages.length.toLocaleString()} in-scope URLs · Complexity ratings are planning-grade EDS build estimates.</footer>
</div>
</body></html>`;

fs.writeFileSync(path.join(ROOT, 'report', 'blocks-templates.html'), html);
console.log('Written report/blocks-templates.html', (html.length / 1024).toFixed(0), 'KB');
console.log('Blocks:', blockCatalog.length, '| Variations:', totalVariations, '| Templates:', templateRows.length);
