// Sales-ready estimation summary (summary.html).
// Reuses the same evidence data + effort models as the detailed reports so
// numbers reconcile. All effort shown in HOURS (8h/person-day).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const D = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'report', 'data', f), 'utf8'));
const pages = D('pages.json');
const agg = D('aggregates.json');
const vars = D('variations.json');
const tdetail = D('template-detail.json');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const HPD = 8;
const H = (d) => +(d * HPD).toFixed(1); // days -> hours (number)
const hh = (d) => `${H(d)}h`;
const cxBadge = (c) => `<span class="cx cx-${c.replace(/\s/g, '')}">${c}</span>`;

// ---------------- BLOCKS (same model as build-detailed.mjs) ----------------
const blockEffort = {
  'Hero / Hero-Block': { cx: 'High', build: 6, variant: 1.5 },
  'Teaser / Card': { cx: 'High', build: 6, variant: 1 },
  'Carousel / Slider': { cx: 'High', build: 6, variant: 1.5 },
  'Accordion': { cx: 'Medium', build: 3, variant: 0.5 },
  'Gallery / Image Grid': { cx: 'Medium', build: 4, variant: 1 },
  'Video / Video Embed': { cx: 'Medium', build: 4, variant: 1 },
  'Image (Core)': { cx: 'Low', build: 2, variant: 0.5 },
  'Iframe / BYO Configurator Embed': { cx: 'High', build: 5, variant: 1 },
  'Dealer Locator / Map': { cx: 'Very High', build: 8, variant: 1.5 },
  'Configurator Package Selector': { cx: 'High', build: 5, variant: 1 },
  'Container / Section': { cx: 'Low', build: 2, variant: 0 },
  'CTA / Button': { cx: 'Low', build: 2, variant: 0 },
  'Breadcrumb': { cx: 'Low', build: 1.5, variant: 0 },
  'Title / Heading': { cx: 'Low', build: 1, variant: 0 },
  'Text / Rich Text': { cx: 'Low', build: 1, variant: 0 },
  'Downloads (PDF list)': { cx: 'Low', build: 2, variant: 0 },
  'Modal / Dialog': { cx: 'Medium', build: 3, variant: 0 },
  'List': { cx: 'Low', build: 2, variant: 0 },
  'Page-Level Navigation': { cx: 'Medium', build: 3, variant: 0 },
  'Table': { cx: 'Low', build: 1.5, variant: 0 },
  'Form': { cx: 'High', build: 5, variant: 0 },
  'Tabs': { cx: 'Medium', build: 3, variant: 0 },
};
const blockRows = Object.entries(vars).filter(([k]) => k !== '__meta').map(([name, d]) => {
  const eff = blockEffort[name] || { cx: 'Medium', build: 3, variant: 1 };
  const days = eff.build + (d.variations.length - 1) * eff.variant;
  return { name, pages: d.blockPages, tier: d.tier, nVar: d.variations.length, nCap: d.capabilities.length, cx: eff.cx, days };
}).sort((a, b) => b.pages - a.pages);
const totalVariations = blockRows.reduce((s, b) => s + b.nVar, 0);
const totalCapabilities = blockRows.reduce((s, b) => s + b.nCap, 0);
const blockDays = blockRows.reduce((s, b) => s + b.days, 0);

// ---------------- TEMPLATES ----------------
const tmplMeta = {
  'Product Detail (Model)': 'High', 'Experience / Editorial': 'Medium', 'Owner Zone / Support Article': 'Medium',
  'Product Configurator (BYO)': 'Very High', 'Blog / Article': 'Medium', 'Content Page (Generic)': 'Medium',
  'News': 'Medium', 'Product Listing (Model Year)': 'Medium', 'Parts, Accessories & Apparel': 'High',
  'Events': 'Medium', 'Press Release': 'Low', 'Section Landing': 'Medium', 'About / Corporate': 'Medium',
  'Brand Home': 'High', 'Promotion / Campaign': 'Medium', 'Legal / Utility': 'Low', 'Form / Lead Gen': 'High',
  'FAQ': 'Low', 'Home': 'High', 'Shopping Tool': 'Medium', 'Dealer Locator': 'High', 'Downloads / Brochures': 'Medium',
};
const cxDays = { 'Low': 1.5, 'Medium': 3, 'High': 5, 'Very High': 8 };
const templateRows = Object.entries(tdetail).map(([t, d]) => {
  const cx = tmplMeta[t] || 'Medium';
  return { t, n: d.n, cx, days: cxDays[cx] };
}).sort((a, b) => b.n - a.n);
const templateDays = templateRows.reduce((s, r) => s + r.days, 0);

// ---------------- FOUNDATION / PROJECT SETUP ----------------
const foundation = [
  ['EDS project scaffolding, repo, CI/CD & environments', 'Medium', 3],
  ['Global Header + Mega-menu Navigation', 'Very High', 10],
  ['Global Footer', 'Medium', 4],
  ['Global CSS design tokens / typography (Typekit)', 'Medium', 4],
  ['scripts.js decoration, auto-blocking, sections', 'High', 6],
  ['Localization / hreflang scaffolding (up to 68 locales)', 'High', 6],
  ['Metadata / SEO framework (canonical, OG, sitemap, redirects)', 'Medium', 3],
  ['Multi-brand theming (5 brands)', 'High', 6],
  ['Placeholders / i18n + site config', 'Medium', 3],
];
const foundationDays = foundation.reduce((s, r) => s + r[2], 0);

// ---------------- 3RD-PARTY INTEGRATIONS ----------------
const integModel = {
  'Google Tag Manager': ['Tag management / analytics container', 'Re-add via delayed.js; keep GTM container ID', 'Low', 0.5],
  'Adobe RUM (helix-rum)': ['Real User Monitoring — already Helix RUM', 'Native to EDS; already present', 'None', 0],
  'Dynatrace (ruxit)': ['APM / performance monitoring', 'Load in delayed phase; verify perf budget', 'Low', 1],
  'Typekit': ['Adobe Fonts (Typekit)', 'Move to fonts.css, font-display:swap; self-host if possible', 'Low', 1],
  'BRP Dealer Marketing (Azure)': ['Dealer tracking iframe (0×0)', 'Re-add hidden iframe in delayed phase', 'Low', 0.5],
  'YouTube': ['Video embeds', 'Lite-embed / facade pattern for LCP', 'Medium', 2],
  'Google Analytics (gtag)': ['GA4 analytics', 'Via GTM / delayed.js', 'Low', 0.5],
  'Adobe Scene7 / Dynamic Media': ['DAM image/video delivery', 'Keep Scene7 URLs or move to EDS images', 'Medium', 3],
  'BRP DAM CDN': ['Digital asset delivery (cdn-dam.brp.com)', 'Reference or migrate assets to EDS', 'Medium', 2],
  'Adobe DTM/Launch': ['Legacy tag manager', 'Consolidate into GTM / delayed', 'Low', 1],
  'Facebook': ['Social pixel / embed', 'Delayed phase', 'Low', 0.5],
  'Google Maps': ['Dealer / location map', 'Dealer-locator block (facade + API)', 'High', 4],
};
// Adobe Commerce is a discovered dependency worth surfacing for sales even if not in aggregates list
const integRows = Object.entries(agg.integrations).map(([name, pg]) => {
  const m = integModel[name] || ['—', 'Assess during discovery', 'Medium', 2];
  return { name, pages: pg, purpose: m[0], strategy: m[1], impact: m[2], days: m[3] };
}).sort((a, b) => b.pages - a.pages);
// add commerce middleware line (present on 100% of pages)
integRows.push({ name: 'Adobe Commerce (Magento) middleware', pages: pages.length, purpose: 'Commerce middleware present site-wide (data-magento-middleware-base-url)', strategy: 'Scope with commerce team; integrate cart/pricing endpoints as needed', impact: 'High', days: 5 });
const integDays = integRows.reduce((s, r) => s + r.days, 0);

// ---------------- CONTENT MIGRATION ----------------
const totalImgs = pages.reduce((s, x) => s + x.blocks.imgs, 0);
const totalPdf = pages.reduce((s, x) => s + x.blocks.pdfLinks, 0);
const noMeta = pages.filter((x) => !x.metaDesc).length;
const multiH1 = pages.filter((x) => x.h1count > 1).length;
const autoPages = pages.filter((x) => x.aemTemplate === 'brp-world-content-template' && x.template !== 'Product Configurator (BYO)').length;
const manualPages = pages.length - autoPages;
const contentRows = [
  ['Automated import (bulk importer, master-template pages)', `${autoPages} pages`, Math.round(autoPages * 0.03)],
  ['Manual / assisted migration (configurator, forms, locator, complex)', `${manualPages} pages`, Math.round(manualPages * 0.4)],
  [`Content cleanup & re-authoring (${noMeta} missing meta-desc; ${multiH1} multi-H1)`, `~${(noMeta + multiH1).toLocaleString()} fixes`, 15],
  ['Asset migration (images to EDS / DAM)', `~${totalImgs.toLocaleString()} images`, 12],
  ['Document / PDF migration', `${totalPdf} PDF links / 267 pages`, 6],
  ['Metadata & SEO migration (canonical, OG, hreflang)', `${pages.length.toLocaleString()} pages`, 10],
  ['Localization propagation (framework only; per-locale translation excluded)', 'up to 68 locales', 8],
  ['Content validation & author QA', `${pages.length.toLocaleString()} pages`, 18],
];
const contentDays = contentRows.reduce((s, r) => s + r[2], 0);

// ---------------- ROLL-UP ----------------
const buildSubtotal = foundationDays + blockDays + templateDays + integDays;
const qa = Math.round(buildSubtotal * 0.25);
const docs = Math.round(buildSubtotal * 0.08);
const pm = Math.round(buildSubtotal * 0.12);
const devContingency = Math.round((buildSubtotal + qa + docs + pm) * 0.15);
const totalDev = buildSubtotal + qa + docs + pm + devContingency;
const grand = totalDev + contentDays;

// ---------------- AI-ASSISTED (Claude-leveraged) DELIVERY MODEL ----------------
// Transparent per-category productivity factors: fraction of baseline effort
// that REMAINS when delivery is AI-accelerated. Lower = more AI leverage.
// Grounded in where LLM codegen genuinely helps most (block/template code,
// import parsers, docs) vs where human judgement still dominates (nav UX,
// commerce integration, PM, author QA).
const AI = {
  foundation: 0.65, // nav/theming need human UX; scaffolding & decoration accelerate
  blocks: 0.45, // strong: generate block JS/CSS + variations from patterns
  templates: 0.45, // strong: template scaffolding + block wiring
  integrations: 0.70, // moderate: config/glue helps; external systems need coordination
  qa: 0.75, // moderate: test generation helps; manual UAT remains
  docs: 0.40, // strong: auto-generated docs
  pm: 0.90, // minimal: coordination stays human
  contentImport: 0.45, // strong: import parsers/transformers auto-generated
  contentManual: 0.70, // moderate: complex pages still assisted, not free
  contentOther: 0.65, // cleanup/metadata/validation partly automated
};
const r0 = (n) => Math.round(n);
const aiFoundation = r0(foundationDays * AI.foundation);
const aiBlocks = r0(blockDays * AI.blocks);
const aiTemplates = r0(templateDays * AI.templates);
const aiInteg = r0(integDays * AI.integrations);
const aiBuildSubtotal = aiFoundation + aiBlocks + aiTemplates + aiInteg;
const aiQa = r0(aiBuildSubtotal * 0.25 * AI.qa / 1); // QA scales with (reduced) build, then AI factor
const aiDocs = r0(aiBuildSubtotal * 0.08 * AI.docs / 1);
const aiPm = r0(aiBuildSubtotal * 0.12 * AI.pm / 1);
const aiContingency = r0((aiBuildSubtotal + aiQa + aiDocs + aiPm) * 0.12); // lower risk → 12%
const aiTotalDev = aiBuildSubtotal + aiQa + aiDocs + aiPm + aiContingency;
// content migration AI split
const cImport = contentRows[0][2];
const cManual = contentRows[1][2];
const cOther = contentDays - cImport - cManual;
const aiContent = r0(cImport * AI.contentImport) + r0(cManual * AI.contentManual) + r0(cOther * AI.contentOther);
const aiGrand = aiTotalDev + aiContent;
const savePct = Math.round((1 - aiGrand / grand) * 100);

// ---------------- RENDER ----------------
const row = (cells) => `<tr>${cells.map((c, i) => (i === 0 ? `<td>${c}</td>` : `<td class="num">${c}</td>`)).join('')}</tr>`;

const blockTable = blockRows.map((b) => `<tr><td><b>${esc(b.name)}</b></td><td class="num">${b.pages}</td><td class="num">${b.nVar}</td><td class="num">${b.nCap || '—'}</td><td>${cxBadge(b.cx)}</td><td class="num">${hh(b.days)}</td></tr>`).join('');
const templateTable = templateRows.map((r) => `<tr><td><b>${esc(r.t)}</b></td><td class="num">${r.n}</td><td class="num">${(r.n / pages.length * 100).toFixed(1)}%</td><td>${cxBadge(r.cx)}</td><td class="num">${hh(r.days)}</td></tr>`).join('');
const foundationTable = foundation.map((f) => `<tr><td>${esc(f[0])}</td><td>${cxBadge(f[1])}</td><td class="num">${hh(f[2])}</td></tr>`).join('');
const integTable = integRows.map((r) => `<tr><td><b>${esc(r.name)}</b></td><td class="num">${r.pages}</td><td>${esc(r.purpose)}</td><td>${esc(r.strategy)}</td><td>${cxBadge(r.impact === 'None' ? 'Low' : r.impact)}</td><td class="num">${hh(r.days)}</td></tr>`).join('');
const contentTable = contentRows.map((c) => `<tr><td>${esc(c[0])}</td><td class="num">${esc(c[1])}</td><td class="num">${hh(c[2])}</td></tr>`).join('');

// [label, baselineDays, aiDays, factorPct, notes]
const rollup = [
  ['Project setup / Foundation', foundationDays, aiFoundation, AI.foundation, `${foundation.length} global work items`],
  ['Block development', blockDays, aiBlocks, AI.blocks, `${blockRows.length} blocks · ${totalVariations} variations`],
  ['Template development', templateDays, aiTemplates, AI.templates, `${templateRows.length} templates`],
  ['3rd-party integrations', integDays, aiInteg, AI.integrations, `${integRows.length} integrations`],
  ['QA & Testing (a11y, responsive, cross-browser, perf, regression, UAT)', qa, aiQa, AI.qa, '~25% of build'],
  ['Documentation', docs, aiDocs, AI.docs, '~8%'],
  ['Project management', pm, aiPm, AI.pm, '~12%'],
  ['Contingency', devContingency, aiContingency, 0.12 / 0.15, '15% → 12% (lower risk)'],
];
const factorBadge = (f) => `<span class="fac">−${Math.round((1 - f) * 100)}%</span>`;
const rollupTable = rollup.map((r) => `<tr><td>${esc(r[0])}</td><td class="num base">${hh(r[1])}</td><td class="num ai">${hh(r[2])} ${factorBadge(r[3])}</td><td class="found">${esc(r[4])}</td></tr>`).join('');

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BRP-World → EDS · Estimation Summary (Sales)</title>
<style>
:root{--brand:#ffcb00;--ink:#0b0f19;--edge:#e2e6ee;--blue:#2563eb;--muted:#5b6472}
*{box-sizing:border-box}
body{margin:0;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:#f4f6fa}
header.hero{background:linear-gradient(135deg,#0b0f19,#1c2541 60%,#22357a);color:#fff;padding:44px 40px 38px}
header.hero h1{margin:0 0 8px;font-size:28px;letter-spacing:-.5px}
header.hero .sub{color:#a9b8d1;font-size:14.5px;max-width:880px}
header.hero .badge{display:inline-block;background:var(--brand);color:#111;font-weight:700;padding:3px 11px;border-radius:5px;font-size:12px;margin-bottom:14px;letter-spacing:.5px}
nav.toc{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--edge);z-index:40;padding:10px 24px;display:flex;flex-wrap:wrap;gap:4px 16px;font-size:13px}
nav.toc a{color:var(--muted);text-decoration:none;white-space:nowrap}nav.toc a:hover{color:var(--blue)}
.wrap{max-width:1140px;margin:0 auto;padding:0 24px 70px}
section{background:#fff;border:1px solid var(--edge);border-radius:14px;padding:24px 28px;margin:20px 0;box-shadow:0 1px 3px rgba(10,15,25,.05)}
h2.sec{font-size:20px;margin:0 0 4px;padding-bottom:9px;border-bottom:3px solid var(--brand);display:inline-block}
.lead{color:#28303d;max-width:900px;font-size:14px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:18px 0}
.kpi{background:linear-gradient(160deg,#f8fafc,#eef2f9);border:1px solid var(--edge);border-radius:12px;padding:16px}
.kpi .n{font-size:25px;font-weight:800;color:var(--blue);line-height:1}
.kpi .l{font-size:11.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-top:6px}
.kpi.big .n{color:#0b7a3b}
table{border-collapse:collapse;width:100%;font-size:13px;margin:10px 0}
th,td{border:1px solid var(--edge);padding:7px 9px;text-align:left;vertical-align:top}
th{background:#f0f3f8;font-weight:700}
td.num,th.num{text-align:center;white-space:nowrap}
tr:nth-child(even){background:#fafbfd}
.found{color:var(--muted);font-size:12px}
.cx{padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;display:inline-block}
.cx-Low{background:#dcfce7;color:#166534}.cx-Medium{background:#fef9c3;color:#854d0e}.cx-High{background:#ffedd5;color:#9a3412}.cx-VeryHigh{background:#ede9fe;color:#5b21b6}
.total-row td{background:#0b0f19!important;color:#fff;font-weight:800;border-color:#333}
.grand td{background:#0b7a3b!important;color:#fff;font-weight:800;border-color:#0b7a3b;font-size:15px}
.subtotal td{background:#eef2f9!important;font-weight:700}
.note{background:#f0f6ff;border-left:4px solid var(--blue);padding:12px 16px;border-radius:0 8px 8px 0;margin:14px 0;font-size:13px}
.note.disc{background:#fef2f2;border-color:#ef4444}
.note.reco{background:#eefbf1;border-color:#0b7a3b}
td.base{color:var(--muted);text-decoration:line-through;text-decoration-color:#c7ced9}
td.ai{font-weight:700;color:#0b7a3b}
.fac{display:inline-block;background:#dcfce7;color:#166534;font-size:10px;font-weight:800;padding:1px 6px;border-radius:20px;margin-left:4px;text-decoration:none}
.subtotal td.base{font-weight:700}
.subtotal td.ai{font-weight:800}
.evidence{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.evidence a{font-size:12px;background:#eef2f9;border:1px solid #dfe6f1;color:#1a4bcc;padding:4px 11px;border-radius:20px;text-decoration:none;font-weight:600}
.evidence a:hover{background:var(--blue);color:#fff}
.assume li{font-size:13px;margin:3px 0}
footer{text-align:center;color:var(--muted);font-size:12px;padding:24px}
.hrsbadge{font-size:11px;color:var(--muted);font-weight:600}
@media print{nav.toc{display:none}section{break-inside:avoid;box-shadow:none}}
</style></head>
<body>
<header class="hero">
  <div class="badge">ADOBE EDGE DELIVERY SERVICES · ESTIMATION SUMMARY</div>
  <h1>BRP-World.com → EDS · Migration Estimation Summary</h1>
  <div class="sub">Sales-ready effort summary for migrating <code>www.brp-world.com/int/en/</code> to Adobe Edge Delivery Services. Based on analysis of <b>all ${pages.length.toLocaleString()}</b> in-scope URLs. All effort in <b>hours</b> (8h/day). Shows a traditional <b>baseline</b> alongside the recommended <b>AI-assisted (Claude-leveraged)</b> estimate. Evidence links to the detailed reports are provided in each section.</div>
</header>
<nav class="toc">
  <a href="#top">Top-line</a>
  <a href="#setup">Project Setup</a>
  <a href="#blocks">Blocks & Variations</a>
  <a href="#templates">Templates</a>
  <a href="#integ">Integrations</a>
  <a href="#content">Content Migration</a>
  <a href="#rollup">Total Estimate</a>
  <a href="#assume">Assumptions</a>
  <a href="#evidence">Evidence Files</a>
</nav>
<div class="wrap">

<section id="top">
<h2 class="sec">Top-line Estimate</h2>
<div class="kpis">
  <div class="kpi"><div class="n">${pages.length.toLocaleString()}</div><div class="l">Pages in scope</div></div>
  <div class="kpi"><div class="n">${blockRows.length}</div><div class="l">Blocks</div></div>
  <div class="kpi"><div class="n">${totalVariations}</div><div class="l">Variations</div></div>
  <div class="kpi"><div class="n">${templateRows.length}</div><div class="l">Templates</div></div>
  <div class="kpi"><div class="n">${integRows.length}</div><div class="l">Integrations</div></div>
  <div class="kpi"><div class="n">${H(grand).toLocaleString()}h</div><div class="l">Baseline total</div></div>
  <div class="kpi big"><div class="n">${H(aiGrand).toLocaleString()}h</div><div class="l">AI-assisted total</div></div>
  <div class="kpi big"><div class="n">−${savePct}%</div><div class="l">Efficiency gain</div></div>
</div>
<div class="note reco"><b>Recommended (AI-assisted) estimate: ≈ ${H(aiGrand).toLocaleString()}h (${aiGrand}d, ~${(aiGrand / 20).toFixed(1)} person-months)</b> — a <b>${savePct}% reduction</b> vs the ${H(grand).toLocaleString()}h traditional baseline, achieved by leveraging Claude for block/template code generation, import parsers/transformers and documentation. Split: AI-assisted development ≈ <b>${H(aiTotalDev).toLocaleString()}h</b> + content migration ≈ <b>${H(aiContent).toLocaleString()}h</b>.</div>
<div class="note"><b>How the reduction is derived:</b> we apply a transparent productivity factor per work category (see §6) rather than a flat cut. AI leverage is highest where code/config is pattern-generated (blocks, templates, import parsers, docs ≈ 55–60% saved) and lowest where human judgement dominates (navigation UX, commerce integration, project management, author QA). The baseline column remains visible so the assumptions are auditable.</div>
</section>

<section id="setup">
<h2 class="sec">1 · Project Setup / Foundation</h2>
<p class="lead">One-time global build required before templates and content: repo & environments, global header/footer, navigation, theming, localization scaffolding and core decoration.</p>
<table>
<thead><tr><th>Work item</th><th>Complexity</th><th class="num">Effort</th></tr></thead>
<tbody>${foundationTable}
<tr class="total-row"><td>Foundation subtotal</td><td>—</td><td class="num">${hh(foundationDays)}</td></tr>
</tbody></table>
</section>

<section id="blocks">
<h2 class="sec">2 · Block Inventory, Variations & Effort</h2>
<p class="lead"><b>${blockRows.length} blocks → ${totalVariations} DOM-verified variations</b> (+ ${totalCapabilities} optional capabilities). Effort covers block build + its variations.</p>
<table>
<thead><tr><th>Block</th><th class="num">Pages</th><th class="num">Variations</th><th class="num">Capabilities</th><th>Complexity</th><th class="num">Effort</th></tr></thead>
<tbody>${blockTable}
<tr class="total-row"><td>TOTAL — ${blockRows.length} blocks</td><td class="num">—</td><td class="num">${totalVariations}</td><td class="num">${totalCapabilities}</td><td>—</td><td class="num">${hh(blockDays)}</td></tr>
</tbody></table>
<div class="evidence"><a href="dashboard.html#inventory" target="_blank">▸ Block inventory (detail)</a><a href="dashboard.html#blocks" target="_blank">▸ Per-block variation deep-dive</a><a href="data/variations.json" target="_blank">▸ variations.json (raw evidence)</a></div>
</section>

<section id="templates">
<h2 class="sec">3 · Template Inventory & Effort</h2>
<p class="lead"><b>${templateRows.length} templates</b> across ${pages.length.toLocaleString()} pages. Effort is net-new EDS template scaffolding (block wiring); per-page authoring is in Content Migration.</p>
<table>
<thead><tr><th>Template</th><th class="num">Pages</th><th class="num">% Site</th><th>Complexity</th><th class="num">Effort</th></tr></thead>
<tbody>${templateTable}
<tr class="total-row"><td>TOTAL — ${templateRows.length} templates</td><td class="num">${pages.length}</td><td class="num">100%</td><td>—</td><td class="num">${hh(templateDays)}</td></tr>
</tbody></table>
<div class="evidence"><a href="dashboard.html#templates" target="_blank">▸ Template deep-dive</a><a href="dashboard.html#tbv" target="_blank">▸ Template → Block → Variation map</a><a href="dashboard.html#matrix" target="_blank">▸ Coverage matrix</a></div>
</section>

<section id="integ">
<h2 class="sec">4 · Third-Party Integrations & Effort</h2>
<p class="lead">${integRows.length} integrations detected across the site. "Pages" = pages where the integration was observed.</p>
<table>
<thead><tr><th>Integration</th><th class="num">Pages</th><th>Purpose</th><th>Migration strategy</th><th>Impact</th><th class="num">Effort</th></tr></thead>
<tbody>${integTable}
<tr class="total-row"><td>TOTAL — ${integRows.length} integrations</td><td class="num">—</td><td colspan="3"></td><td class="num">${hh(integDays)}</td></tr>
</tbody></table>
<div class="note disc"><b>Flag for sales:</b> <b>Adobe Commerce (Magento) middleware runs on 100% of pages</b>, and the <b>BYO configurator</b> (168 pages) is an external app embedded via iframe. Both need scoping with BRP's commerce/product team and may expand scope beyond this content-migration estimate.</div>
<div class="evidence"><a href="index.html#integ" target="_blank">▸ Integration report (full)</a><a href="data/aggregates.json" target="_blank">▸ aggregates.json (raw evidence)</a></div>
</section>

<section id="content">
<h2 class="sec">5 · Content Migration Effort</h2>
<p class="lead">Separate from development. Covers importing, cleaning, and validating all ${pages.length.toLocaleString()} pages and their assets. Excludes per-locale translation.</p>
<table>
<thead><tr><th>Work stream</th><th class="num">Volume</th><th class="num">Effort</th></tr></thead>
<tbody>${contentTable}
<tr class="total-row"><td>TOTAL CONTENT MIGRATION</td><td class="num">—</td><td class="num">${hh(contentDays)}</td></tr>
</tbody></table>
<div class="evidence"><a href="index.html#content" target="_blank">▸ Content migration report (full)</a><a href="index.html#urls" target="_blank">▸ Per-URL analysis (all 1,172)</a></div>
</section>

<section id="rollup">
<h2 class="sec">6 · Total Estimate — Baseline vs AI-Assisted</h2>
<p class="lead">The <b>Baseline</b> column is a traditional senior-team estimate. The <b>AI-assisted</b> column applies a per-category productivity factor (shown as −%) for delivery leveraging Claude. The recommended figure for this engagement is the AI-assisted total.</p>
<table>
<thead><tr><th>Category</th><th class="num">Baseline</th><th class="num">AI-assisted (Claude)</th><th>Notes</th></tr></thead>
<tbody>
${rollupTable}
<tr class="subtotal"><td>Development subtotal</td><td class="num base">${hh(totalDev)}</td><td class="num ai">${hh(aiTotalDev)}</td><td class="found">${totalDev}d → ${aiTotalDev}d</td></tr>
<tr class="subtotal"><td>Content migration</td><td class="num base">${hh(contentDays)}</td><td class="num ai">${hh(aiContent)}</td><td class="found">${contentDays}d → ${aiContent}d</td></tr>
<tr class="grand"><td>GRAND TOTAL</td><td class="num">${H(grand).toLocaleString()}h</td><td class="num">${H(aiGrand).toLocaleString()}h</td><td>${aiGrand}d · ~${(aiGrand / 20).toFixed(1)} pm · <b>−${savePct}%</b></td></tr>
</tbody></table>
<div class="note">Figures assume a senior EDS delivery team leveraging Claude, an 8-hour person-day, and ~20 working days/month. The AI-assisted column reflects code/parser/documentation generation acceleration; it is not a flat discount. Excludes per-locale content translation, rebuild of the external configurator app, and any net-new visual design. To be confirmed in a discovery workshop.</div>
</section>

<section id="assume">
<h2 class="sec">7 · Key Assumptions & Exclusions</h2>
<ul class="assume">
<li>Scope is the <b>/int/en/</b> locale; other locales reuse the same blocks/templates (content translated separately — <b>excluded</b>).</li>
<li>The <b>BYO configurator</b> remains an external app to be re-embedded, <b>not rebuilt</b> in EDS.</li>
<li><b>Adobe Commerce</b> integration effort here is indicative only; full commerce scope to be confirmed with BRP.</li>
<li>Scene7 / BRP DAM assets are referenced or migrated <b>without re-mastering</b>.</li>
<li>Design remains visually equivalent (<b>no redesign</b>); pixel-parity theming per brand.</li>
<li>Estimates are <b>planning-grade</b> and to be refined in discovery.</li>
</ul>
</section>

<section id="evidence">
<h2 class="sec">8 · Evidence & Detailed Reports</h2>
<p class="lead">This summary is backed by the following deliverables (same repository, <code>report/</code> folder):</p>
<div class="evidence">
  <a href="dashboard.html" target="_blank">▸ Interactive Dashboard (blocks, variations, templates, mapping)</a>
  <a href="index.html" target="_blank">▸ Full 12-section consulting report</a>
  <a href="blocks-templates.html" target="_blank">▸ Blocks & Templates reference</a>
</div>
<div class="evidence" style="margin-top:10px">
  <a href="data/pages.json" target="_blank">◦ pages.json — per-page extraction (1,172)</a>
  <a href="data/aggregates.json" target="_blank">◦ aggregates.json — templates, blocks, integrations</a>
  <a href="data/variations.json" target="_blank">◦ variations.json — block variations</a>
  <a href="data/template-block-variations.json" target="_blank">◦ template-block-variations.json — mapping</a>
  <a href="data/template-detail.json" target="_blank">◦ template-detail.json — per-template metrics</a>
</div>
<div class="note">Every count in this summary is derived from live DOM analysis of all ${pages.length.toLocaleString()} URLs (fetched HTTP 200, 0 errors). Effort figures are planning-grade estimates.</div>
</section>

<footer>Prepared for sales estimation · ${esc('2026-08-04')} · All effort in hours (8h/day) · Planning-grade, to be refined in discovery.</footer>
</div>
</body></html>`;

fs.writeFileSync(path.join(ROOT, 'report', 'summary.html'), html);
console.log('Written report/summary.html', (html.length / 1024).toFixed(0), 'KB');
console.log('Foundation:', hh(foundationDays), '| Blocks:', hh(blockDays), '| Templates:', hh(templateDays), '| Integrations:', hh(integDays));
console.log('Content:', hh(contentDays), '| Dev total:', hh(totalDev), '| GRAND baseline:', hh(grand));
console.log('AI-assisted → Dev:', hh(aiTotalDev), '| Content:', hh(aiContent), '| GRAND:', hh(aiGrand), `(−${savePct}%)`);
