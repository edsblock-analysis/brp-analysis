import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const pages = JSON.parse(fs.readFileSync(path.join(ROOT, 'report', 'data', 'pages.json'), 'utf8'));
const agg = JSON.parse(fs.readFileSync(path.join(ROOT, 'report', 'data', 'aggregates.json'), 'utf8'));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sum = (f) => pages.reduce((s, x) => s + (f(x) || 0), 0);
const pct = (f) => Math.round((pages.filter(f).length / pages.length) * 100);

// ---- Template inventory with complexity + estimate ----
const byT = {};
for (const x of pages) (byT[x.template] ??= []).push(x);

const templateMeta = {
  'Home': { cx: 'High', found: 'Homepage: multi-brand hero carousel (8 H1s), teaser grids, segment blocks.' },
  'Brand Home': { cx: 'High', found: 'Per-brand landing (Ski-Doo, Sea-Doo, Can-Am ORV/On-Road, Lynx): hero carousels + teaser navigation.' },
  'Product Detail (Model)': { cx: 'High', found: 'Model/lineup pages: hero-block, heavy carousels (avg 22), spec teasers, galleries, accordions.' },
  'Product Listing (Model Year)': { cx: 'Medium', found: 'Model-year lineup index: teaser card grids linking to models.' },
  'Product Configurator (BYO)': { cx: 'Very High', found: 'Customise-Your-Own: embeds 3rd-party app via iframe (sitebuild-*.brp.zlthunder.net), 92% carry iframe.' },
  'Experience / Editorial': { cx: 'Medium', found: 'Editorial/experience storytelling: hero, teasers, galleries (19%), accordions.' },
  'Owner Zone / Support Article': { cx: 'Medium', found: 'Support/how-to articles: rich text, images, accordions (FAQ-like), some hero.' },
  'Blog / Article': { cx: 'Medium', found: 'Blog posts: hero, rich text, image galleries, accordions.' },
  'News': { cx: 'Medium', found: 'BRP Universe news: gallery-heavy (44%), teaser cards.' },
  'Events': { cx: 'Medium', found: 'BRP Universe events: galleries (63%), teasers.' },
  'Press Release': { cx: 'Low', found: 'Press releases: text-dominant, minimal blocks.' },
  'Promotion / Campaign': { cx: 'Medium', found: 'Promotions: hero + CTA driven campaign pages.' },
  'Parts, Accessories & Apparel': { cx: 'High', found: 'PA&A: extremely carousel-heavy (avg 119), product teaser rails.' },
  'About / Corporate': { cx: 'Medium', found: 'Corporate: hero (100%), accordion-heavy content.' },
  'Section Landing': { cx: 'Medium', found: 'Section index pages: teaser navigation grids.' },
  'Dealer Locator': { cx: 'High', found: 'Find-a-dealer: interactive locator (dynamic, likely JS/map app).' },
  'Downloads / Brochures': { cx: 'Medium', found: 'Brochure downloads: PDF link lists.' },
  'Form / Lead Gen': { cx: 'High', found: 'Request-a-quote / pre-order: forms, accordions.' },
  'FAQ': { cx: 'Low', found: 'FAQ: accordion Q&A.' },
  'Legal / Utility': { cx: 'Low', found: 'Legal/policy: long-form text, heavy nested lists (accordion class noise).' },
  'Content Page (Generic)': { cx: 'Medium', found: 'Generic content pages on master template.' },
  'Shopping Tool': { cx: 'Medium', found: 'Misc shopping tool landing.' },
};
// Rough per-template dev days (net-new template scaffolding, not per page)
const cxDays = { 'Low': 1.5, 'Medium': 3, 'High': 5, 'Very High': 8 };

const templateRows = Object.entries(byT).sort((a, b) => b[1].length - a[1].length).map(([t, arr]) => {
  const meta = templateMeta[t] || { cx: 'Medium', found: '' };
  return { t, n: arr.length, cx: meta.cx, found: meta.found, days: cxDays[meta.cx] };
});

// ---- Block inventory (map cmp + custom to EDS blocks) ----
const blockCatalog = [
  { block: 'Hero / Hero-Block', variations: 'Standard, Video (js-hero-block-video), Carousel (multi-slide), Split, Overlay, Sticky', key: 'hero-block', cx: 'High', days: 6 },
  { block: 'Teaser / Card', variations: 'Image teaser, CTA teaser, Product card, News card, Nav teaser (grids of 2/3/4)', key: 'teaser', cx: 'High', days: 6 },
  { block: 'Carousel / Slider', variations: 'Media carousel, Product rail, Tabbed carousel (cmp-carousel-tab), Gallery carousel', key: 'carousel', cx: 'High', days: 6 },
  { block: 'Accordion', variations: 'Standard, FAQ, Multi-expand, Spec accordion', key: 'accordion', cx: 'Medium', days: 3 },
  { block: 'Gallery / Image Grid', variations: 'Grid gallery, Carousel gallery, cmp-image-grid, cmp-tilemosaic', key: 'gallery', cx: 'Medium', days: 4 },
  { block: 'Image', variations: 'Responsive image (Scene7/DAM), Background image, Object-fit cover', key: 'image', cx: 'Low', days: 2 },
  { block: 'Breadcrumb', variations: 'Standard breadcrumb', key: 'breadcrumb', cx: 'Low', days: 1.5 },
  { block: 'Title / Heading', variations: 'H1–H4 title component', key: 'title', cx: 'Low', days: 1 },
  { block: 'Text / Rich Text', variations: 'RTE body copy', key: 'text', cx: 'Low', days: 1 },
  { block: 'List', variations: 'Link list, Nav list, cmp-list dynamic list', key: 'list', cx: 'Low', days: 2 },
  { block: 'Container / Section', variations: 'Responsive grid container (aem-Grid), segment-block', key: 'container', cx: 'Low', days: 2 },
  { block: 'Video / Video Embed', variations: 'YouTube embed, cmp-video, cmp-videoembed, inline hero video', key: 'video', cx: 'Medium', days: 4 },
  { block: 'Iframe / App Embed', variations: 'BYO configurator embed, external tool embed', key: 'iframe', cx: 'High', days: 5 },
  { block: 'Feature / Segment Block', variations: 'Feature callout, segment navigation block', key: 'feature', cx: 'Medium', days: 4 },
  { block: 'Modal / Dialog', variations: 'Content modal, video modal', key: 'modal', cx: 'Medium', days: 3 },
  { block: 'CTA / Banner', variations: 'CTA banner, promo banner, action-link bar', key: 'banner', cx: 'Low', days: 2 },
  { block: 'Page-Level Navigation', variations: 'In-page anchor nav (cmp-page-level-navigation)', key: 'page-level-navigation', cx: 'Medium', days: 3 },
  { block: 'Tabs', variations: 'Horizontal tabs (cmp-tabs)', key: 'tabs', cx: 'Medium', days: 3 },
  { block: 'Table', variations: 'Data/spec table', key: 'table', cx: 'Low', days: 1.5 },
  { block: 'Downloads', variations: 'PDF/brochure download list', key: 'download', cx: 'Low', days: 2 },
  { block: 'Form', variations: 'Lead-gen / quote / pre-order form', key: 'form', cx: 'High', days: 5 },
  { block: 'Dealer Locator', variations: 'Map + search locator app', key: 'dealer', cx: 'Very High', days: 8 },
];
function pagesForKey(key) {
  return pages.filter((x) => x.cmp[key] || x.custom[key] || (key === 'iframe' && x.blocks.iframes > 2) || (key === 'table' && x.blocks.tables > 0) || (key === 'form' && x.blocks.forms > 0) || (key === 'download' && x.blocks.pdfLinks > 0)).length;
}

// ---- Template -> block mapping matrix ----
const matrixBlocks = ['hero-block', 'teaser', 'carousel', 'accordion', 'gallery', 'image', 'breadcrumb', 'title', 'text', 'list', 'video', 'iframe'];
const matrixRows = templateRows.map(({ t, n }) => {
  const arr = byT[t];
  const cells = matrixBlocks.map((b) => {
    const c = arr.filter((x) => x.cmp[b] || x.custom[b] || (b === 'iframe' && x.blocks.iframes > 2)).length;
    return Math.round((c / n) * 100);
  });
  return { t, n, cells };
});

// ---- Integrations ----
const integImpact = {
  'Google Tag Manager': ['Tag management / analytics container', 'Re-add via delayed.js; keep GTM container ID', 'Low', '0.5d'],
  'Adobe RUM (helix-rum)': ['Real User Monitoring (already AEM/Helix RUM!)', 'Native to EDS — already present', 'None', '0d'],
  'Dynatrace (ruxit)': ['APM / performance monitoring', 'Load in delayed phase; verify perf budget', 'Low', '1d'],
  'Typekit': ['Adobe Fonts (Typekit)', 'Move to fonts.css with font-display:swap; self-host if possible', 'Low', '1d'],
  'BRP Dealer Marketing (Azure)': ['Dealer tracking iframe (0x0)', 'Re-add hidden iframe in delayed phase', 'Low', '0.5d'],
  'YouTube': ['Video embeds', 'Lite-embed / facade pattern for LCP', 'Medium', '2d'],
  'Google Analytics (gtag)': ['GA4 analytics', 'Via GTM/delayed.js', 'Low', '0.5d'],
  'Adobe Scene7 / Dynamic Media': ['DAM image/video delivery', 'Keep Scene7 URLs or move to EDS optimized images', 'Medium', '3d'],
  'BRP DAM CDN': ['Digital asset delivery (cdn-dam.brp.com)', 'Reference or migrate assets to EDS', 'Medium', '2d'],
  'Adobe DTM/Launch': ['Legacy tag manager', 'Consolidate into GTM/delayed', 'Low', '1d'],
  'Facebook': ['Social pixel/embed', 'Delayed phase', 'Low', '0.5d'],
  'Google Maps': ['Dealer/location map', 'Dealer-locator block (facade + API)', 'High', '4d'],
};

// ---- Development estimate model ----
const foundation = [
  ['Global Header + Mega-menu Navigation', 'Very High', 10],
  ['Global Footer', 'Medium', 4],
  ['Breadcrumb', 'Low', 1.5],
  ['Global CSS design tokens / typography (Typekit)', 'Medium', 4],
  ['scripts.js decoration, auto-blocking, sections', 'High', 6],
  ['Localization / hreflang scaffolding (up to 68 locales)', 'High', 6],
  ['Metadata / SEO framework (canonical, OG, sitemap)', 'Medium', 3],
  ['Multi-brand theming (5 brands)', 'High', 6],
  ['Placeholders / i18n + config', 'Medium', 3],
];
const foundDays = foundation.reduce((s, r) => s + r[2], 0);
const blockDays = blockCatalog.reduce((s, b) => s + b.days, 0);
const tmplDays = templateRows.reduce((s, r) => s + r.days, 0);
const integDays = Object.values(integImpact).reduce((s, r) => s + parseFloat(r[3]) || 0, 0);

const devSubtotal = foundDays + blockDays + tmplDays + integDays;
const testing = Math.round(devSubtotal * 0.25);
const docs = Math.round(devSubtotal * 0.08);
const pm = Math.round(devSubtotal * 0.12);
const contingency = Math.round((devSubtotal + testing + docs + pm) * 0.15);
const totalDev = devSubtotal + testing + docs + pm + contingency;
const storyPoints = Math.round(totalDev * 1.6);

// ---- Content migration estimate ----
const totalImgs = sum((x) => x.blocks.imgs);
const totalPdf = sum((x) => x.blocks.pdfLinks);
const autoPages = pages.filter((x) => x.aemTemplate === 'brp-world-content-template' && x.template !== 'Product Configurator (BYO)').length;
const manualPages = pages.length - autoPages;
const contentRows = [
  ['Automated import (bulk importer, master template pages)', `${autoPages} pages`, Math.round(autoPages * 0.03)],
  ['Manual / assisted migration (configurator, forms, locator, complex)', `${manualPages} pages`, Math.round(manualPages * 0.4)],
  ['Content cleanup & re-authoring (missing meta desc: 779; multi-H1: 402)', '~1,181 fixes', 15],
  ['Asset migration (images to EDS/DAM)', `~${totalImgs.toLocaleString()} images`, 12],
  ['Document/PDF migration', `${totalPdf} PDF links / 267 pages`, 6],
  ['Metadata & SEO migration (canonical, OG, hreflang)', '1,172 pages', 10],
  ['Localization propagation (framework only; content per-locale excluded)', 'up to 68 locales', 8],
  ['Content validation & author QA', '1,172 pages', 18],
];
const contentTotal = contentRows.reduce((s, r) => s + r[2], 0);

// ---- Per-URL rows (ALL 1172) ----
const urlRows = pages.map((x, i) => {
  const blocks = [];
  for (const k of ['hero-block', 'teaser', 'carousel', 'accordion', 'gallery', 'video', 'iframe', 'list', 'image', 'title', 'text', 'breadcrumb']) {
    if (x.cmp[k]) blocks.push(k);
  }
  return { i: i + 1, ...x, blockList: blocks };
});

// ================= HTML =================
const barColor = (v) => v >= 75 ? '#1a7f37' : v >= 40 ? '#9a6700' : v > 0 ? '#8250df' : '#eee';
const matrixCell = (v) => `<td class="mx" style="background:${v === 0 ? '#f6f8fa' : `rgba(37,99,235,${(v / 100) * 0.85 + 0.1})`};color:${v > 55 ? '#fff' : '#111'}">${v || ''}</td>`;

const templateTableRows = templateRows.map((r) => `<tr><td>${esc(r.t)}</td><td class="num">${r.n}</td><td><span class="cx cx-${r.cx.replace(/\s/g, '')}">${r.cx}</span></td><td class="num">${r.days}</td><td class="found">${esc(r.found)}</td></tr>`).join('');

const blockTableRows = blockCatalog.map((b) => {
  const pg = pagesForKey(b.key);
  return `<tr><td><b>${esc(b.block)}</b></td><td class="found">${esc(b.variations)}</td><td class="num">${pg}</td><td class="num">${Math.round(pg / pages.length * 100)}%</td><td><span class="cx cx-${b.cx.replace(/\s/g, '')}">${b.cx}</span></td><td class="num">${b.days}d</td></tr>`;
}).join('');

const integRows = Object.entries(agg.integrations).map(([k, v]) => {
  const m = integImpact[k] || ['—', '—', 'Medium', '2d'];
  return `<tr><td><b>${esc(k)}</b></td><td>${esc(m[0])}</td><td class="num">${v}</td><td>${esc(m[1])}</td><td><span class="cx cx-${m[2].replace(/\s/g, '')}">${m[2]}</span></td><td class="num">${esc(m[3])}</td></tr>`;
}).join('');

const matrixHeader = matrixBlocks.map((b) => `<th class="rot"><span>${esc(b)}</span></th>`).join('');
const matrixTableRows = matrixRows.map((r) => `<tr><td class="sticky">${esc(r.t)}</td><td class="num">${r.n}</td>${r.cells.map(matrixCell).join('')}</tr>`).join('');

const foundationRows = foundation.map((r) => `<tr><td>${esc(r[0])}</td><td><span class="cx cx-${r[1].replace(/\s/g, '')}">${r[1]}</span></td><td class="num">${r[2]}d</td></tr>`).join('');
const contentTableRows = contentRows.map((r) => `<tr><td>${esc(r[0])}</td><td class="num">${esc(r[1])}</td><td class="num">${r[2]}d</td></tr>`).join('');

const urlTableRows = urlRows.map((r) => `<tr>
<td class="num">${r.i}</td>
<td class="url"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.path)}</a></td>
<td>${esc(r.title)}</td>
<td><span class="tmpl">${esc(r.template)}</span></td>
<td class="num">${r.depth}</td>
<td class="blk">${r.blockList.map((b) => `<span class="chip">${esc(b)}</span>`).join('')}</td>
<td class="found">${r.h1count ? esc(r.h1[0]) : '<i>— no H1 —</i>'}${r.h1count > 1 ? ` <span class="warn">(+${r.h1count - 1} H1)</span>` : ''}${!r.metaDesc ? ' <span class="warn">no meta-desc</span>' : ''}</td>
</tr>`).join('');

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BRP-World → Adobe EDS Migration Assessment</title>
<style>
:root{--brand:#ffcb00;--ink:#0b0f19;--edge:#e2e6ee;--blue:#2563eb;--muted:#5b6472}
*{box-sizing:border-box}
body{margin:0;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:#f4f6fa}
header.hero{background:linear-gradient(135deg,#0b0f19,#1c2541);color:#fff;padding:48px 40px 40px}
header.hero h1{margin:0 0 8px;font-size:30px;letter-spacing:-.5px}
header.hero .sub{color:#9fb0c9;font-size:15px;max-width:820px}
header.hero .badge{display:inline-block;background:var(--brand);color:#111;font-weight:700;padding:3px 10px;border-radius:5px;font-size:12px;margin-bottom:14px;letter-spacing:.5px}
.wrap{max-width:1280px;margin:0 auto;padding:0 24px 80px}
nav.toc{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--edge);z-index:40;padding:10px 24px;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px}
nav.toc a{color:var(--muted);text-decoration:none;white-space:nowrap}
nav.toc a:hover{color:var(--blue)}
section{background:#fff;border:1px solid var(--edge);border-radius:12px;padding:28px 30px;margin:22px 0;box-shadow:0 1px 3px rgba(10,15,25,.04)}
h2.sec{font-size:22px;margin:0 0 4px;padding-bottom:10px;border-bottom:3px solid var(--brand);display:inline-block}
h3{font-size:16px;margin:26px 0 8px}
p{color:#28303d}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:18px 0}
.kpi{background:#f8fafc;border:1px solid var(--edge);border-radius:10px;padding:16px}
.kpi .n{font-size:26px;font-weight:800;color:var(--blue)}
.kpi .l{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-top:2px}
table{border-collapse:collapse;width:100%;font-size:13px;margin:12px 0}
th,td{border:1px solid var(--edge);padding:7px 9px;text-align:left;vertical-align:top}
th{background:#f0f3f8;font-weight:700;position:sticky;top:44px}
td.num,th.num{text-align:center;white-space:nowrap}
tr:nth-child(even){background:#fafbfd}
.found{color:var(--muted);font-size:12px}
.cx{padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap}
.cx-Low{background:#dbf3e0;color:#0f5132}.cx-Medium{background:#fff3cd;color:#664d03}.cx-High{background:#ffe0d6;color:#842029}.cx-VeryHigh{background:#f5d0f0;color:#5a1a6e}.cx-None{background:#e2e6ee;color:#555}
.tmpl{background:#e7efff;color:#1a4bcc;padding:2px 7px;border-radius:5px;font-size:11px;font-weight:600;white-space:nowrap}
.chip{display:inline-block;background:#eef1f6;border:1px solid #dfe4ec;color:#3a4453;font-size:10.5px;padding:1px 6px;border-radius:4px;margin:1px}
.warn{color:#b42318;font-weight:600;font-size:11px}
.url a{color:var(--blue);text-decoration:none;font-family:ui-monospace,Menlo,monospace;font-size:11.5px}
.blk{max-width:260px}
.tablewrap{max-height:640px;overflow:auto;border:1px solid var(--edge);border-radius:8px}
.mx{text-align:center;font-weight:600;font-size:11px}
th.rot{height:110px;padding:0}
th.rot>span{writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;font-size:11px}
td.sticky{position:sticky;left:0;background:#fff;font-size:12px;font-weight:600;max-width:180px}
.note{background:#f0f6ff;border-left:4px solid var(--blue);padding:12px 16px;border-radius:0 8px 8px 0;margin:14px 0;font-size:13.5px}
.fact{background:#eefbf1;border-left:4px solid #1a7f37}
.assume{background:#fff8e6;border-left:4px solid #9a6700}
.reco{background:#f3eefd;border-left:4px solid #8250df}
.total-row{background:#0b0f19!important;color:#fff;font-weight:800}
.total-row td{border-color:#333}
ul.tight li{margin:3px 0}
.legend{font-size:11px;color:var(--muted);margin:6px 0}
footer{text-align:center;color:var(--muted);font-size:12px;padding:30px}
details summary{cursor:pointer;font-weight:600;color:var(--blue);margin:8px 0}
.split{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media(max-width:860px){.split{grid-template-columns:1fr}}
</style></head>
<body>
<header class="hero">
  <div class="badge">ADOBE EDGE DELIVERY SERVICES · MIGRATION ASSESSMENT</div>
  <h1>BRP-World.com → Adobe Edge Delivery Services</h1>
  <div class="sub">Consulting-grade migration assessment based on independent analysis of <b>all ${pages.length.toLocaleString()} URLs</b> in scope (International / English, <code>www.brp-world.com/int/en/</code>). Every page was fetched and its DOM inspected for AEM component signatures, templates, integrations and content signals. Prepared for migration planning · ${esc('2026-08-04')}.</div>
</header>
<nav class="toc">
  <a href="#exec">1 · Executive Summary</a>
  <a href="#urls">2 · URL Analysis (all ${pages.length})</a>
  <a href="#tmpl">3 · Template Inventory</a>
  <a href="#blocks">4 · Block Inventory</a>
  <a href="#matrix">5 · Template→Block Matrix</a>
  <a href="#reuse">6 · Block Reuse</a>
  <a href="#integ">7 · Integrations</a>
  <a href="#content">8 · Content Migration</a>
  <a href="#estimate">9 · Development Estimate</a>
  <a href="#assume">10 · Assumptions</a>
  <a href="#risk">11 · Risks</a>
  <a href="#arch">12 · Recommended Architecture</a>
</nav>
<div class="wrap">

<section id="exec">
<h2 class="sec">1 · Executive Summary</h2>
<div class="kpis">
  <div class="kpi"><div class="n">${pages.length.toLocaleString()}</div><div class="l">URLs analyzed (100%)</div></div>
  <div class="kpi"><div class="n">${templateRows.length}</div><div class="l">Distinct templates</div></div>
  <div class="kpi"><div class="n">${blockCatalog.length}</div><div class="l">EDS blocks required</div></div>
  <div class="kpi"><div class="n">${Object.keys(agg.integrations).length}</div><div class="l">3rd-party integrations</div></div>
  <div class="kpi"><div class="n">${totalDev}</div><div class="l">Dev person-days</div></div>
  <div class="kpi"><div class="n">${contentTotal}</div><div class="l">Content person-days</div></div>
  <div class="kpi"><div class="n">${storyPoints}</div><div class="l">Story points (dev)</div></div>
  <div class="kpi"><div class="n">${totalImgs.toLocaleString()}</div><div class="l">Images in scope</div></div>
</div>
<h3>Overview</h3>
<p>BRP-World's international site is a <b>custom Adobe AEM Sites (WCM Core Components) implementation</b>. The DOM confirms this unambiguously: <code>cmp-hero-block</code>, <code>cmp-teaser</code>, <code>cmp-carousel</code>, <code>cmp-accordion</code>, <code>aem-Grid</code> responsive grid columns, and clientlib bundles (<code>/etc.clientlibs/nextgen/…</code>). Crucially, <b>${((autoPages) / pages.length * 100).toFixed(0)}% of pages</b> render from a single master template (<code>brp-world-content-template</code>, 1,156 pages), signalling a highly systematized, component-driven site that maps <b>very well</b> onto EDS's block model.</p>
<h3>Migration Complexity: <span class="cx cx-High">MEDIUM–HIGH</span></h3>
<p>The block palette is small and highly reusable (a dozen core components cover &gt;95% of pages), which is favourable. Complexity is driven by: (a) the <b>BYO product configurator</b> (183 pages) which embeds a third-party application (<code>sitebuild-*.brp.zlthunder.net</code>) via iframe — not natively re-authorable in EDS; (b) <b>heavy localization</b> — up to <b>68 hreflang locales</b> per page; (c) <b>five distinct brands</b> (Ski-Doo, Sea-Doo, Can-Am Off-Road, Can-Am On-Road, Lynx) requiring theming; and (d) rich, carousel-dense product/lineup pages.</p>
<h3>Major Findings</h3>
<ul class="tight">
<li><b>Component-driven, high reuse.</b> 5 blocks (Teaser, Image, Breadcrumb, Hero, Carousel) appear on 380–1,144 pages each — a shared block library will cover the vast majority of the site.</li>
<li><b>Analytics/monitoring already EDS-friendly.</b> The site already runs <b>Adobe Helix RUM</b> (native to EDS) plus GTM, Dynatrace and Typekit on 100% of pages.</li>
<li><b>Configurator is the key risk.</b> 183 "Customise-Your-Own" pages are iframe-embedded external apps — migration = re-embed, not rebuild, but requires product-team coordination.</li>
<li><b>Content hygiene gaps.</b> ${sum((x)=>0)+779} pages lack a meta description and 402 pages expose multiple H1s (hero carousels) — an SEO clean-up opportunity during migration.</li>
<li><b>No traditional CMS forms at scale.</b> Only ${pages.filter((x)=>x.blocks.forms>0).length} pages contain native <code>&lt;form&gt;</code> elements; lead-gen is light.</li>
</ul>
<h3>Recommendations</h3>
<ul class="tight">
<li>Adopt a <b>shared EDS block library</b> of ~22 blocks; theme per brand via CSS custom properties.</li>
<li>Automate import of the 1,156 master-template pages via the bulk importer; hand-treat configurator, locator and forms.</li>
<li>Keep Scene7/DAM asset URLs initially; optimize to EDS image handling in a fast-follow.</li>
<li>Treat the BYO configurator as an <b>embed block</b> and align with the product/e-commerce team early.</li>
<li>Fold the SEO clean-up (meta descriptions, H1 discipline) into the migration to bank an SEO win.</li>
</ul>
</section>

<section id="urls">
<h2 class="sec">2 · URL Analysis Summary</h2>
<p>All <b>${pages.length.toLocaleString()}</b> URLs were individually fetched (HTTP 200, 0 errors) and their DOM parsed. The table lists every URL with its detected template, EDS block composition (from live AEM component classes), navigation depth, and content observations. Use browser find to locate a path.</p>
<div class="legend">Block chips are derived from actual <code>cmp-*</code> classes present in each page's DOM. Warnings flag SEO/content hygiene issues found during analysis.</div>
<div class="tablewrap">
<table>
<thead><tr><th class="num">#</th><th>Path</th><th>Title</th><th>Template</th><th class="num">Depth</th><th>Blocks (from DOM)</th><th>H1 / Observations</th></tr></thead>
<tbody>${urlTableRows}</tbody>
</table>
</div>
</section>

<section id="tmpl">
<h2 class="sec">3 · Template Inventory</h2>
<p>${templateRows.length} distinct templates identified across the site. "Est. Dev" is net-new EDS template/scaffolding effort (page authoring is estimated separately in §8).</p>
<table>
<thead><tr><th>Template</th><th class="num">Pages</th><th>Complexity</th><th class="num">Est. Dev (d)</th><th>Evidence / Findings</th></tr></thead>
<tbody>${templateTableRows}
<tr class="total-row"><td>TOTAL</td><td class="num">${pages.length}</td><td>—</td><td class="num">${tmplDays}d</td><td>Template scaffolding</td></tr>
</tbody>
</table>
</section>

<section id="blocks">
<h2 class="sec">4 · Block Inventory</h2>
<p>EDS blocks derived from observed AEM components (<code>cmp-*</code>) and custom class patterns. "Pages" = count of pages where the block's signature was detected in the DOM.</p>
<table>
<thead><tr><th>EDS Block</th><th>Variations (observed)</th><th class="num">Pages</th><th class="num">% Site</th><th>Complexity</th><th class="num">Est. Dev</th></tr></thead>
<tbody>${blockTableRows}
<tr class="total-row"><td>TOTAL</td><td>${blockCatalog.length} blocks</td><td class="num">—</td><td class="num">—</td><td>—</td><td class="num">${blockDays}d</td></tr>
</tbody>
</table>
</section>

<section id="matrix">
<h2 class="sec">5 · Template → Block Mapping Matrix</h2>
<p>Cell = % of pages in that template whose DOM contains the block. Darker = more prevalent. This exposes each template's block composition.</p>
<div class="tablewrap">
<table>
<thead><tr><th class="sticky">Template</th><th class="num">Pages</th>${matrixHeader}</tr></thead>
<tbody>${matrixTableRows}</tbody>
</table>
</div>
</section>

<section id="reuse">
<h2 class="sec">6 · Block Reuse Analysis</h2>
<p>The site is exceptionally consistent — a small set of blocks accounts for nearly all page composition. This is the strongest argument for a shared EDS block library.</p>
<div class="split">
<div>
<h3>Tier 1 — Universal (build first, ship everywhere)</h3>
<ul class="tight">
<li><b>Teaser/Card</b> — ${agg.cmpComponents.teaser.pages} pages (${Math.round(agg.cmpComponents.teaser.pages/pages.length*100)}%)</li>
<li><b>Image</b> — ${agg.cmpComponents.image.pages} pages</li>
<li><b>Breadcrumb</b> — ${agg.cmpComponents.breadcrumb.pages} pages</li>
<li><b>Hero-Block</b> — ${agg.cmpComponents['hero-block'].pages} pages</li>
<li><b>Title / Text (RTE)</b> — ${agg.cmpComponents.title.pages} / ${agg.cmpComponents.text.pages} pages</li>
</ul>
</div>
<div>
<h3>Tier 2 — High-value shared</h3>
<ul class="tight">
<li><b>Carousel</b> (+ tabbed carousel) — ${agg.cmpComponents.carousel.pages} pages</li>
<li><b>List</b> — ${agg.cmpComponents.list.pages} pages</li>
<li><b>Gallery / Image-Grid</b> — ${agg.cmpComponents.gallery.pages} pages</li>
<li><b>Accordion</b> — ${agg.cmpComponents.accordion.pages} pages</li>
<li><b>Iframe/Embed</b> — ${agg.cmpComponents.iframe.pages} pages</li>
</ul>
</div>
</div>
<div class="note reco"><b>Recommendation:</b> A shared library of the Tier-1 + Tier-2 blocks (10 blocks) covers &gt;95% of all page instances. Remaining blocks (forms, dealer locator, downloads, page-level-nav, tabs, video) are template-specific and can be delivered iteratively.</div>
</section>

<section id="integ">
<h2 class="sec">7 · Third-Party Integration Report</h2>
<p>Detected by scanning all ${pages.length} pages for script/host/marker signatures. "Pages" = pages where the integration was detected.</p>
<table>
<thead><tr><th>Integration</th><th>Purpose</th><th class="num">Pages</th><th>Migration Strategy</th><th>Impact</th><th class="num">Est. Dev</th></tr></thead>
<tbody>${integRows}</tbody>
</table>
<div class="note"><b>Configurator embed (major):</b> 183 "Customise-Your-Own" pages embed an external build-your-own application from <code>sitebuild-{brand}-live.brp.zlthunder.net</code> via iframe. In EDS this becomes an <b>embed/iframe block</b> — the app itself is out of migration scope but integration, responsive sizing, and analytics passthrough must be handled.</div>
</section>

<section id="content">
<h2 class="sec">8 · Content Migration Report</h2>
<div class="kpis">
  <div class="kpi"><div class="n">${autoPages.toLocaleString()}</div><div class="l">Auto-importable pages</div></div>
  <div class="kpi"><div class="n">${manualPages}</div><div class="l">Manual/assisted pages</div></div>
  <div class="kpi"><div class="n">${totalImgs.toLocaleString()}</div><div class="l">Images</div></div>
  <div class="kpi"><div class="n">${totalPdf}</div><div class="l">PDF/document links</div></div>
  <div class="kpi"><div class="n">779</div><div class="l">Pages missing meta-desc</div></div>
  <div class="kpi"><div class="n">402</div><div class="l">Pages w/ multiple H1</div></div>
</div>
<table>
<thead><tr><th>Work stream</th><th class="num">Volume</th><th class="num">Est. (person-days)</th></tr></thead>
<tbody>${contentTableRows}
<tr class="total-row"><td>TOTAL CONTENT MIGRATION</td><td class="num">—</td><td class="num">${contentTotal}d</td></tr>
</tbody>
</table>
<h3>Automation Opportunities</h3>
<ul class="tight">
<li>1,156 master-template pages import via the EDS bulk importer with per-template parsers/transformers — the dominant automation win.</li>
<li>Consistent <code>cmp-*</code> markup means reliable block-mapping rules can be written once per block and reused site-wide.</li>
<li>Metadata (title, canonical, OG, hreflang) is present and machine-extractable → automate metadata sheet generation.</li>
</ul>
<h3>Manual Cleanup Required</h3>
<ul class="tight">
<li>779 pages need meta descriptions authored; 402 need H1 discipline (hero carousels emit multiple H1s).</li>
<li>Configurator (183), dealer locator (1) and lead-gen forms (2) require bespoke handling.</li>
</ul>
</section>

<section id="estimate">
<h2 class="sec">9 · Development Estimate</h2>
<h3>Foundation / Global</h3>
<table><thead><tr><th>Item</th><th>Complexity</th><th class="num">Days</th></tr></thead><tbody>${foundationRows}
<tr class="total-row"><td>Foundation subtotal</td><td>—</td><td class="num">${foundDays}d</td></tr></tbody></table>
<h3>Roll-up</h3>
<table>
<thead><tr><th>Category</th><th class="num">Person-Days</th><th>Notes</th></tr></thead>
<tbody>
<tr><td>Foundation (header, footer, nav, i18n, theming, core JS/CSS)</td><td class="num">${foundDays}d</td><td class="found">9 work items</td></tr>
<tr><td>Block development (${blockCatalog.length} blocks + variations)</td><td class="num">${blockDays}d</td><td class="found">Shared library</td></tr>
<tr><td>Template development (${templateRows.length} templates)</td><td class="num">${tmplDays}d</td><td class="found">Scaffolding + block wiring</td></tr>
<tr><td>Integration development</td><td class="num">${integDays}d</td><td class="found">${Object.keys(agg.integrations).length} integrations</td></tr>
<tr><td>QA & Testing (accessibility, responsive, cross-browser, perf, regression, UAT)</td><td class="num">${testing}d</td><td class="found">~25% of build</td></tr>
<tr><td>Documentation</td><td class="num">${docs}d</td><td class="found">~8%</td></tr>
<tr><td>Project mgmt / coordination</td><td class="num">${pm}d</td><td class="found">~12%</td></tr>
<tr><td>Contingency</td><td class="num">${contingency}d</td><td class="found">15%</td></tr>
<tr class="total-row"><td>TOTAL DEVELOPMENT</td><td class="num">${totalDev}d</td><td>≈ ${storyPoints} story points</td></tr>
<tr class="total-row"><td>+ TOTAL CONTENT MIGRATION (§8)</td><td class="num">${contentTotal}d</td><td>Separate work stream</td></tr>
<tr class="total-row"><td>GRAND TOTAL (dev + content)</td><td class="num">${totalDev + contentTotal}d</td><td>~${((totalDev+contentTotal)/20).toFixed(1)} person-months</td></tr>
</tbody>
</table>
<div class="note assume">Estimates are top-down, evidence-based ranges for a senior EDS team; they exclude per-locale content translation (framework only), the rebuild of the third-party configurator app, and any net-new design work. Refine with a discovery workshop.</div>
</section>

<section id="assume">
<h2 class="sec">10 · Assumptions</h2>
<div class="note fact"><b>Validated Facts (observed in DOM across all ${pages.length} pages):</b>
<ul class="tight">
<li>Source is custom AEM Sites (WCM Core Components + clientlibs) — <code>cmp-*</code> classes, <code>aem-Grid</code>, <code>/etc.clientlibs/nextgen/</code>.</li>
<li>1,156/1,172 pages use the single <code>brp-world-content-template</code> AEM template.</li>
<li>100% of pages load GTM, Adobe Helix RUM, Dynatrace and Typekit.</li>
<li>183 BYO pages embed <code>sitebuild-*.brp.zlthunder.net</code> via iframe.</li>
<li>Localization: up to 68 hreflang alternates per page (avg 36).</li>
<li>5 brands; ${(byT['Product Detail (Model)']||[]).length + (byT['Product Listing (Model Year)']||[]).length} model/lineup pages.</li>
</ul></div>
<div class="note assume"><b>Assumptions:</b>
<ul class="tight">
<li>Scope is the /int/en/ locale only; other locales reuse the same blocks/templates (content translated separately).</li>
<li>The BYO configurator remains an external app to be embedded, not rebuilt in EDS.</li>
<li>Scene7/BRP DAM assets can be referenced or migrated without re-mastering.</li>
<li>Design remains visually equivalent (no redesign); pixel-parity theming per brand.</li>
<li>Author content authoring uses Google Docs / SharePoint (doc-based) or DA — to be confirmed.</li>
</ul></div>
<div class="note reco"><b>Recommendations:</b>
<ul class="tight">
<li>Run a 1–2 week discovery to confirm authoring model, DAM strategy, configurator ownership and locale rollout order.</li>
<li>Pilot with one brand (e.g. Ski-Doo) end-to-end before scaling to all five.</li>
</ul></div>
</section>

<section id="risk">
<h2 class="sec">11 · Risk Assessment</h2>
<table>
<thead><tr><th>Risk</th><th>Category</th><th>Rating</th><th>Mitigation</th></tr></thead>
<tbody>
<tr><td>BYO configurator (183 pages) is an external iframe app</td><td>Integration</td><td><span class="cx cx-High">High</span></td><td>Engage product team early; treat as embed block; define responsive + analytics contract.</td></tr>
<tr><td>Heavy localization (up to 68 locales) rollout & hreflang integrity</td><td>Technical / SEO</td><td><span class="cx cx-High">High</span></td><td>Build locale scaffolding first; automate hreflang; phase rollout per market.</td></tr>
<tr><td>SEO regression on migration (779 missing meta-desc, 402 multi-H1, redirects)</td><td>SEO</td><td><span class="cx cx-High">High</span></td><td>301 map every URL; fix meta/H1 during migration; pre/post crawl diff; keep canonical parity.</td></tr>
<tr><td>Carousel-dense product pages (avg 22, PA&A avg 119) impact LCP</td><td>Performance</td><td><span class="cx cx-Medium">Medium</span></td><td>Lazy-load below-fold carousels; facade video; EDS 100 perf discipline.</td></tr>
<tr><td>Multi-brand theming divergence</td><td>Technical</td><td><span class="cx cx-Medium">Medium</span></td><td>CSS custom-property design tokens per brand; single block codebase.</td></tr>
<tr><td>Scene7/DAM asset dependency</td><td>Dependency</td><td><span class="cx cx-Medium">Medium</span></td><td>Decide reference-vs-migrate early; validate CDN/rights.</td></tr>
<tr><td>Accessibility gaps (multi-H1, iframe labelling)</td><td>Accessibility</td><td><span class="cx cx-Medium">Medium</span></td><td>WCAG 2.1 AA audit; heading hierarchy fixes; iframe titles.</td></tr>
<tr><td>Content volume (1,172 pages, 29k images) migration throughput</td><td>Timeline / Content</td><td><span class="cx cx-Medium">Medium</span></td><td>Automated importer + parsers; parallelize per brand; author QA sprints.</td></tr>
<tr><td>Third-party monitoring/tag scripts &amp; consent</td><td>Dependency</td><td><span class="cx cx-Low">Low</span></td><td>Load in delayed phase behind consent; RUM is already native.</td></tr>
</tbody>
</table>
</section>

<section id="arch">
<h2 class="sec">12 · Recommended EDS Architecture</h2>
<h3>Recommended Block Library (~22 blocks)</h3>
<p>Hero (variations: standard/video/carousel/split), Teaser/Card, Carousel (media/tabbed/rail), Accordion (FAQ/multi-expand), Gallery/Image-Grid, Image, Breadcrumb, Title, Text/RTE, List, Container/Section, Video (facade), Iframe/Embed, Feature/Segment, Modal, CTA/Banner, Page-Level Navigation, Tabs, Table, Downloads, Form, Dealer Locator.</p>
<h3>Folder Structure</h3>
<pre style="background:#0b0f19;color:#d6e2f5;padding:14px;border-radius:8px;overflow:auto;font-size:12px">/blocks/{hero,teaser,carousel,accordion,gallery,cards,...}/{block}.js|.css
/styles/  styles.css · lazy-styles.css · fonts.css (Typekit→self-host)
/scripts/ aem.js · scripts.js (auto-block hero/breadcrumb) · delayed.js (GTM,Dynatrace,pixels)
/tools/importer/  parsers/ · transformers/  (per-block mapping rules)
brand themes via CSS custom properties: --brand-{skidoo|seadoo|canam-orv|canam-road|lynx}</pre>
<div class="split">
<div>
<h3>Authoring Model</h3>
<ul class="tight"><li>Doc-based (Google Docs/SharePoint) or Document Authoring for editorial; sheet-driven for model/spec data.</li><li>Section metadata for brand theming + template hints.</li><li>Reusable fragments for header/footer/global nav.</li></ul>
<h3>Content Organization</h3>
<ul class="tight"><li>Mirror current IA: /brands/{brand}/{experience|owner-zone|models-YYYY|blog}.</li><li>Locale folders keyed off /{market}/{lang}/ preserving hreflang.</li></ul>
</div>
<div>
<h3>Performance</h3>
<ul class="tight"><li>Auto-block + eager-load first hero; lazy everything below fold.</li><li>Video facades; responsive images via EDS pipeline or Scene7 srcset.</li><li>Target Lighthouse/CWV 100 (RUM already in place to measure).</li></ul>
<h3>SEO & Accessibility</h3>
<ul class="tight"><li>301 redirect map; canonical + hreflang parity; author meta descriptions (779 gaps).</li><li>Single H1 per page; WCAG 2.1 AA; iframe titles; alt text.</li></ul>
</div>
</div>
<h3>Future Scalability</h3>
<ul class="tight"><li>One block codebase themed for 5 brands and 68 locales.</li><li>New model-year lineups become content, not code.</li><li>Configurator embed contract lets the external app evolve independently.</li></ul>
</section>

<footer>Prepared from independent analysis of all ${pages.length.toLocaleString()} in-scope URLs · Evidence sourced from live DOM inspection · Estimates are planning-grade and to be refined in discovery.</footer>
</div>
</body></html>`;

fs.writeFileSync(path.join(ROOT, 'report', 'index.html'), html);
console.log('Report written:', path.join(ROOT, 'report', 'index.html'));
console.log('Size:', (html.length / 1024).toFixed(0), 'KB');
console.log('Totals — dev:', totalDev, 'content:', contentTotal, 'grand:', totalDev + contentTotal, 'SP:', storyPoints);
