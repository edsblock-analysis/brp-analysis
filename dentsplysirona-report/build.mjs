// Build Dentsply Sirona → EDS estimation + discovery reports (self-contained HTML).
// Design mirrors the BRP report/ estimation summary. Effort in HOURS (8h/person-day).
// Curated model derived from evidence in data/. Estimates are planning-grade.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT = path.join(ROOT, 'dentsplysirona-report');
const pages = JSON.parse(fs.readFileSync(path.join(OUT, 'data', 'pages.json'), 'utf8'));
const agg = JSON.parse(fs.readFileSync(path.join(OUT, 'data', 'aggregates.json'), 'utf8'));
const flog = JSON.parse(fs.readFileSync(path.join(OUT, 'data', 'fetch-log.json'), 'utf8'));
const ok = pages.filter((p) => !p.error);
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cx = (c) => `<span class="cx cx-${c.replace(/\s/g, '')}">${esc(c)}</span>`;
const HPD = 8;

// ---------------- FRIENDLY TEMPLATE NAMES ----------------
const TNAME = {
  'product-page': 'Product Detail (PDP · Hybris)',
  'category-page': 'Product Listing / Category (PLP · Hybris)',
  'basic-template0': 'Basic Content Page',
  'brand-page-template': 'Discover — Brand Page',
  'explore-page-template': 'Explore / Landing (rich)',
  'shop-brand-page-template': 'Shop — Brand Page (Hybris)',
  'academy-course-detail': 'Academy — Course Detail',
  'discover-homepage1': 'Discover — Hub / Homepage',
  'article-details': 'Article / Editorial Detail',
  'academy-course-listings-page': 'Academy — Course Listing',
  'my-account-content-page': 'My Account — Content',
  'academy-content-page': 'Academy — Content',
  'shop-page-template': 'Shop — Landing (Hybris)',
  'shop-promotions-template': 'Shop — Promotions (Hybris)',
  'news-and-press-release-template': 'News / Press Release',
  'customer-support-contact-us-template': 'Customer Support — Contact',
  'my-account-landing-page': 'My Account — Landing',
  'academy-study-template': 'Academy — Study',
};
const COMMERCE_T = new Set(['product-page', 'category-page', 'shop-brand-page-template', 'shop-page-template', 'shop-promotions-template', 'my-account-content-page', 'my-account-landing-page']);
const TEMPLATE_CX = {
  'product-page': 'High', 'category-page': 'High', 'basic-template0': 'Low', 'brand-page-template': 'Medium',
  'explore-page-template': 'High', 'shop-brand-page-template': 'Medium', 'academy-course-detail': 'High',
  'discover-homepage1': 'Medium', 'article-details': 'Low', 'academy-course-listings-page': 'Medium',
  'my-account-content-page': 'High', 'academy-content-page': 'Low', 'shop-page-template': 'Medium',
  'shop-promotions-template': 'Medium', 'news-and-press-release-template': 'Low', 'customer-support-contact-us-template': 'Medium',
  'my-account-landing-page': 'High', 'academy-study-template': 'Medium',
};

// ---------------- BLOCK INVENTORY (evidence-based) ----------------
// pages = # of the 1141 analyzed pages where the block appears (from cmp- signal).
const pgWith = (fn) => ok.filter(fn).length;
const has = (p, k) => (p.blocks[k] || 0) > 0;
const cmpPages = (root) => ok.filter((p) => (p.cmp[root] || 0) > 0).length;

const BLOCKS = [
  { name: 'Global Header + Mega-menu / Search', pages: ok.length, cx: 'Very High', nVar: 3, nCap: 4, base: 26,
    purpose: 'Site chrome: multi-level mega-menu, language navigation, and the Coveo-powered search box with type-ahead suggestions. Present on every page.',
    variations: ['Standard mega-menu header', 'Shop header (cart/account utilities)', 'Search overlay + Coveo suggestions'],
    eds: 'EDS header block from nav document + a search block wired to Coveo. reCAPTCHA/consent gating. One of the highest-effort items.' },
  { name: 'Global Footer', pages: ok.length, cx: 'Medium', nVar: 1, nCap: 0, base: 11,
    purpose: 'Multi-column footer: nav columns, social links (FB/LinkedIn/Instagram), legal, language navigation.',
    variations: ['Multi-column footer'], eds: 'EDS footer block from footer document.' },
  { name: 'Hero', pages: cmpPages('hero'), cx: 'High', nVar: 2, nCap: 3, base: 34,
    purpose: 'Full-width page hero with media, headline, eyebrow, CTA. Used on Explore/landing & shop-hero pages.',
    variations: ['Standard image hero', 'Shop hero (cmp-shophero)'], eds: 'Hero block with media/CTA variants; Scene7 image, optional video facade.' },
  { name: 'Teaser / Promo Card', pages: cmpPages('teaser') + cmpPages('promocard'), cx: 'High', nVar: 3, nCap: 1, base: 34,
    purpose: 'Image + heading + text + CTA promotional teasers and promo cards; the workhorse marketing block.',
    variations: ['Standard teaser', 'Promo card', 'Banner ad (cmp-bannerad)'], eds: 'Teaser/cards block with layout variants.' },
  { name: 'Carousel / Slider', pages: cmpPages('carousel') + cmpPages('swiper'), cx: 'High', nVar: 2, nCap: 2, base: 32,
    purpose: 'Rotating content carousels (cmp-carousel) and Swiper-based sliders. Very common across Discover/Explore/Academy.',
    variations: ['Core carousel', 'Swiper slider'], eds: 'Carousel block; autoplay/aria/keyboard; consolidate to one implementation.' },
  { name: 'Tabs', pages: cmpPages('tabs'), cx: 'High', nVar: 1, nCap: 1, base: 25,
    purpose: 'Tabbed content panels — heavily used on PDPs (86%) and Academy course detail (100%).',
    variations: ['Core tabs'], eds: 'Tabs block; ARIA tablist/tabpanel, deep-link anchors, keyboard nav.' },
  { name: 'Accordion', pages: cmpPages('accordion'), cx: 'Medium', nVar: 1, nCap: 0, base: 16,
    purpose: 'Expand/collapse FAQ & content groups.', variations: ['Core accordion'], eds: 'Accordion block; ARIA disclosure, keyboard support.' },
  { name: 'Cards (Icon / Download / Video / Course / Image-tile)', pages: pgWith((p) => has(p, 'cards')), cx: 'High', nVar: 6, nCap: 1, base: 45,
    purpose: 'Family of card grids: icon cards, download cards (PDF/asset), video cards, course cards, image tiles, jump cards.',
    variations: ['Icon card', 'Download card', 'Video card', 'Course card', 'Image tile', 'Jump/anchor card'], eds: 'One cards block with variants; download variant links to Scene7/DAM assets.' },
  { name: 'Step / Process', pages: cmpPages('step'), cx: 'Medium', nVar: 1, nCap: 0, base: 16,
    purpose: 'Numbered step/process sequences (how-it-works).', variations: ['Numbered steps'], eds: 'Presentational stepper block.' },
  { name: 'Experience Fragment (reusable content)', pages: cmpPages('experiencefragment'), cx: 'Medium', nVar: 2, nCap: 0, base: 20,
    purpose: 'Reusable authored fragments embedded across pages (promo bars, shared CTAs, banners).',
    variations: ['Content XF', 'Header/Footer XF'], eds: 'EDS fragment/section include pattern; map XF library to reusable EDS blocks.' },
  { name: 'Video (YouTube / Vimeo embed)', pages: pgWith((p) => has(p, 'videos')), cx: 'Medium', nVar: 2, nCap: 1, base: 20,
    purpose: 'Embedded YouTube (67 pages) and occasional Vimeo video players.', variations: ['YouTube embed', 'Vimeo embed'], eds: 'Video block with lazy facade; load player on interaction for CWV.' },
  { name: 'Rich Text / Title / Image (core content)', pages: ok.length, cx: 'Low', nVar: 3, nCap: 0, base: 14,
    purpose: 'Core authored content: rich text, titles/main-title, standalone Scene7 images, vertical spacing, separators.',
    variations: ['Text', 'Title / Main-title', 'Image'], eds: 'Core EDS blocks; largely default decoration.' },
  { name: 'List / Alphabetical Listing', pages: cmpPages('list'), cx: 'Medium', nVar: 2, nCap: 0, base: 17,
    purpose: 'Content lists and the alphabetical brand/A–Z listing (cmp-alphabetical).', variations: ['Content list', 'Alphabetical A–Z listing'], eds: 'List block + an A–Z index variant.' },
  { name: 'Breadcrumb', pages: pgWith((p) => (p.resourceTypes && p.resourceTypes['content/breadcrumb'] > 0)), cx: 'Low', nVar: 1, nCap: 0, base: 9,
    purpose: 'Interior-page breadcrumb trail.', variations: ['Breadcrumb'], eds: 'Breadcrumb block/auto-block from path.' },
  { name: 'Embed / Banner / Callout', pages: cmpPages('embed') + cmpPages('banner') + cmpPages('callout'), cx: 'Medium', nVar: 3, nCap: 0, base: 17,
    purpose: 'Generic embeds, banner ads and callout blocks.', variations: ['Embed', 'Banner', 'Callout'], eds: 'Embed/banner block; preserve third-party embeds.' },
];
// Commerce blocks (Hybris-backed, consume commerce APIs in EDS)
const COMMERCE_BLOCKS = [
  { name: 'Product Detail (PDP · Hybris)', pages: ok.filter((p) => p.template === 'product-page').length, cx: 'Very High', nVar: 1, nCap: 0, base: 80,
    purpose: 'Product detail: gallery, specs/tabs, pricing, add-to-cart, variants — driven by Hybris via the commerce GraphQL API.', variations: ['PDP'], eds: 'Commerce block consuming the existing GraphQL/Hybris APIs client-side in EDS.' },
  { name: 'Product Listing / Category (PLP · Hybris)', pages: ok.filter((p) => p.template === 'category-page').length, cx: 'Very High', nVar: 1, nCap: 0, base: 70,
    purpose: 'Category/PLP with faceted filtering, sort, pagination — Hybris commerce (rendered via iframe/commerce app today).', variations: ['PLP / category'], eds: 'Commerce listing block consuming Hybris/GraphQL; facets + pagination.' },
  { name: 'Cart / Checkout / My-Account (Hybris app)', pages: ok.filter((p) => p.template.startsWith('my-account') || p.template.startsWith('shop-')).length, cx: 'Very High', nVar: 3, nCap: 0, base: 300,
    purpose: 'Authenticated commerce: cart, checkout, my-account, loyalty (One DS), practice management — the Hybris storefront application. The logged-in journey (cart→checkout→payment→order/account) could NOT be exercised in this analysis (auth-gated), so this is a high-side placeholder pending a walkthrough.', variations: ['Cart/checkout', 'My-account', 'Loyalty'], eds: 'Assumed-heavy: authenticated commerce journey not yet seen. Placeholder of 300h pending a guided walkthrough of the live cart/checkout/account flow with DS; scope may move materially up or down once the journey is confirmed.' },
];

// ---------------- INTEGRATIONS (in-scope for estimate) ----------------
// [name, purpose, strategy, impact, days]
const INTEG_MODEL = {
  'Adobe DTM / Launch': ['Tag management / analytics loader', 'Re-add via delayed.js; keep Launch property', 'Medium', 5],
  'Adobe Analytics': ['Web analytics (AppMeasurement/Launch)', 'Ships via Launch; re-instate as observed', 'Medium', 3],
  'Adobe Scene7 / Dynamic Media': ['DAM image/video delivery', 'Keep Scene7 URLs or move to EDS images', 'Medium', 8],
  'SAP Hybris Commerce': ['Commerce platform (PDP/PLP/cart)', 'Consume via GraphQL in EDS blocks; storefront app stays', 'Very High', 20],
  'Commerce GraphQL API': ['Product/pricing/cart data API', 'EDS commerce blocks call the existing endpoint', 'High', 10],
  'Coveo Search': ['Site search + suggestions', 'Search block wired to Coveo org', 'High', 12],
  reCAPTCHA: ['Bot protection on forms/search', 'Re-add reCAPTCHA v3 on forms', 'Low', 2],
  OneTrust: ['Consent / cookie management', 'Load in delayed phase; gate tags', 'Medium', 4],
  YouTube: ['Video embeds', 'Lazy facade video block', 'Low', 2],
};
// Commerce (Hybris + GraphQL) effort lives in the Commerce Blocks + Foundation scaffolding,
// so it is NOT re-counted here to avoid double-counting; it is shown as a reference row (0h) below.
const IN_SCOPE_INTEG = ['Adobe DTM / Launch', 'Adobe Scene7 / Dynamic Media', 'Coveo Search', 'reCAPTCHA', 'OneTrust', 'YouTube'];
const integRows = IN_SCOPE_INTEG.filter((n) => agg.integrations[n]).map((n) => ({ name: n, pages: agg.integrations[n], purpose: INTEG_MODEL[n][0], strategy: INTEG_MODEL[n][1], impact: INTEG_MODEL[n][2], days: INTEG_MODEL[n][3] }));
const integDays = integRows.reduce((s, r) => s + r.days, 0);

// ---------------- ESTIMATION ----------------
const H = (d) => Math.round(d * HPD);
const contentBlocks = BLOCKS;
const totalVariations = BLOCKS.reduce((s, b) => s + b.nVar, 0) + COMMERCE_BLOCKS.reduce((s, b) => s + b.nVar, 0);
const blockHrs = BLOCKS.reduce((s, b) => s + b.base, 0);
const commerceHrs = COMMERCE_BLOCKS.reduce((s, b) => s + b.base, 0);

// Template dev hours by complexity tier
const TCX_HOURS = { Low: 6, Medium: 10, High: 14, 'Very High': 18 };
const templates = Object.entries(agg.templates).map(([t, n]) => ({ t, name: TNAME[t] || t, n, cx: TEMPLATE_CX[t] || 'Medium', commerce: COMMERCE_T.has(t), hrs: TCX_HOURS[TEMPLATE_CX[t] || 'Medium'] }));
const templateHrs = templates.reduce((s, r) => s + r.hrs, 0);

const foundation = [
  ['EDS project scaffolding, repo, CI/CD & environments', 'Medium', 10],
  ['Global CSS design tokens / typography', 'Medium', 12],
  ['scripts.js decoration, auto-blocking, sections', 'High', 16],
  ['Metadata / SEO framework (canonical, OG, sitemap, redirects)', 'Medium', 10],
  ['Analytics / consent scaffolding (Launch + OneTrust)', 'Medium', 10],
  ['Commerce integration scaffolding (GraphQL/Hybris client)', 'High', 20],
  ['Placeholders / i18n + site config', 'Medium', 8],
];
const foundationHrs = foundation.reduce((s, f) => s + f[2], 0);
const prodReadyHrs = 60; // perf/CWV, a11y, cross-browser, launch hardening (large site)
const integHrs = H(integDays);

// Content migration
const totalImgs = ok.reduce((s, p) => s + p.blocks.imgs, 0);
const totalPdf = ok.reduce((s, p) => s + p.blocks.pdfLinks, 0);
const noMeta = ok.filter((p) => !p.metaDesc).length;
const multiH1 = ok.filter((p) => p.h1count > 1).length;
const noH1 = ok.filter((p) => p.h1count === 0).length;
const commercePages = ok.filter((p) => COMMERCE_T.has(p.template)).length;
const editorialPages = ok.length - commercePages;
const autoPages = ok.filter((p) => ['basic-template0', 'article-details', 'academy-content-page', 'news-and-press-release-template'].includes(p.template)).length;
const assistedPages = ok.length - autoPages;
const contentRows = [
  ['Automated import (bulk importer — basic/article/academy content pages)', `${autoPages} pages`, Math.round(autoPages * 0.05)],
  ['Assisted migration (Discover/Explore/Academy/commerce templates)', `${assistedPages} pages`, Math.round(assistedPages * 0.18)],
  [`Content cleanup & re-authoring (${noMeta} no meta-desc; ${multiH1} multi-H1; ${noH1} no-H1)`, `~${(noMeta + multiH1 + noH1).toLocaleString()} fixes`, 40],
  ['Asset migration (Scene7 images → EDS/DAM references)', `~${totalImgs.toLocaleString()} images`, 30],
  ['Document / PDF migration', `${totalPdf.toLocaleString()} PDF links`, 20],
  ['Metadata & SEO migration (canonical, OG, redirects — 96 observed)', `${ok.length.toLocaleString()} pages`, 24],
  ['Content validation & author QA', `${ok.length.toLocaleString()} pages`, 50],
];
const contentHrs = contentRows.reduce((s, r) => s + r[2], 0);

const buildSubtotal = foundationHrs + blockHrs + commerceHrs + templateHrs + integHrs + prodReadyHrs;
const grand = buildSubtotal + contentHrs;

// ---------------- coverage ----------------
const nonOk = flog.filter((r) => r.status === 'ERROR' || (typeof r.status === 'number' && r.status >= 400));
const redirects = flog.filter((r) => r.redirected).length;

// ---------------- RENDER ----------------
const cxBadge = cx;
const blockTable = BLOCKS.map((b) => `<tr><td><b>${esc(b.name)}</b></td><td class="num">${b.pages}</td><td class="num">${b.nVar}</td><td class="num">${b.nCap || '—'}</td><td>${cxBadge(b.cx)}</td><td class="num">${b.base}h</td></tr>`).join('')
  + COMMERCE_BLOCKS.map((b) => `<tr><td><b>${esc(b.name)}</b> <span class="cbadge">commerce</span></td><td class="num">${b.pages}</td><td class="num">${b.nVar}</td><td class="num">—</td><td>${cxBadge(b.cx)}</td><td class="num">${b.base}h</td></tr>`).join('');
const blockDetail = [...BLOCKS, ...COMMERCE_BLOCKS].map((b) => `<div class="vblock"><h4>${esc(b.name)} ${cxBadge(b.cx)} <span class="found">· ${b.pages} pages · ${b.nVar} variation${b.nVar > 1 ? 's' : ''}</span></h4><p class="lead">${esc(b.purpose)}</p><div class="tags">${b.variations.map((v) => `<span class="tag">${esc(v)}</span>`).join('')}</div><p class="found"><b>EDS:</b> ${esc(b.eds)}</p></div>`).join('\n');
const templateTable = templates.map((r) => `<tr><td><b>${esc(r.name)}</b>${r.commerce ? ' <span class="cbadge">commerce</span>' : ''}<div class="found">${esc(r.t)}</div></td><td class="num">${r.n}</td><td class="num">${(r.n / ok.length * 100).toFixed(1)}%</td><td>${cxBadge(r.cx)}</td><td class="num">${r.hrs}h</td></tr>`).join('');
const integTable = integRows.map((r) => `<tr><td><b>${esc(r.name)}</b></td><td class="num">${r.pages}</td><td>${esc(r.purpose)}</td><td>${esc(r.strategy)}</td><td>${cxBadge(r.impact)}</td><td class="num">${H(r.days)}h</td></tr>`).join('');
const contentTable = contentRows.map((c) => `<tr><td>${esc(c[0])}</td><td class="num">${esc(c[1])}</td><td class="num">${H(c[2] / HPD) === c[2] ? c[2] : c[2]}h</td></tr>`).join('');
const foundationTable = foundation.map((f) => `<tr><td>${esc(f[0])}</td><td>${cxBadge(f[1])}</td><td class="num">${f[2]}h</td></tr>`).join('');
const rollup = [
  ['Project setup / Foundation', foundationHrs, 'Repo, tokens, decoration, SEO, analytics/consent, commerce scaffolding'],
  ['Block development (content)', blockHrs, `${BLOCKS.length} content blocks`],
  ['Commerce block development', commerceHrs, `${COMMERCE_BLOCKS.length} Hybris-backed blocks`],
  ['Template development', templateHrs, `${templates.length} templates`],
  ['3rd-party integrations', integHrs, `${integRows.length} integrations`],
  ['Production readiness', prodReadyHrs, 'Perf/CWV, a11y, cross-browser, launch hardening'],
];
const rollupTable = rollup.map((r) => `<tr><td>${esc(r[0])}</td><td class="num ai">${r[1]}h</td><td class="found">${esc(r[2])}</td></tr>`).join('');

// URL coverage table grouped by template
// 404/403/redirect-loop pages are excluded entirely — the report covers only the live (HTTP 200) site.
const byT = {};
for (const p of ok) { const t = TNAME[p.template] || p.template; (byT[t] = byT[t] || []).push(p); }
const urlSection = Object.entries(byT).sort((a, b) => b[1].length - a[1].length).map(([t, ps]) => `<tr class="grp"><td colspan="3"><b>${esc(t)}</b> · ${ps.length} URL${ps.length > 1 ? 's' : ''}</td></tr>` + ps.map((p) => `<tr><td><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.path)}</a>${p.redirected ? ' <span class="redir">redirect</span>' : ''}${p.error ? ` <span class="redir">${esc(String(p.status))}</span>` : ''}</td><td>${esc(p.title || '—')}</td><td class="found">${p.error ? esc(p.error) : esc(p.template)}</td></tr>`).join('')).join('\n');

const kpi = (n, l, alt) => `<div class="kpi${alt ? ' alt' : ''}"><div class="n">${n}</div><div class="l">${l}</div></div>`;

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dentsply Sirona → EDS · Migration Estimation &amp; Discovery</title>
<style>
:root{--brand:#00a0df;--ink:#0b0f19;--edge:#e2e6ee;--blue:#0067a0;--muted:#5b6472;--navy:#002d5b;--green:#0b7a3b}
*{box-sizing:border-box}
body{margin:0;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:#f4f6fa}
header.hero{background:linear-gradient(135deg,#002d5b,#004a86 60%,#0067a0);color:#fff;padding:44px 40px 38px}
header.hero h1{margin:0 0 8px;font-size:27px;letter-spacing:-.5px}
header.hero .sub{color:#bcd6ea;font-size:14.5px;max-width:980px}
header.hero .badge{display:inline-block;background:var(--brand);color:#00243f;font-weight:700;padding:3px 11px;border-radius:5px;font-size:12px;margin-bottom:14px;letter-spacing:.5px}
nav.toc{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--edge);z-index:40;padding:10px 24px;display:flex;flex-wrap:wrap;gap:4px 16px;font-size:13px}
nav.toc a{color:var(--muted);text-decoration:none;white-space:nowrap}nav.toc a:hover{color:var(--blue)}
.wrap{max-width:1200px;margin:0 auto;padding:0 24px 70px}
section{background:#fff;border:1px solid var(--edge);border-radius:14px;padding:24px 28px;margin:20px 0;box-shadow:0 1px 3px rgba(10,15,25,.05)}
h2.sec{font-size:20px;margin:0 0 4px;padding-bottom:9px;border-bottom:3px solid var(--brand);display:inline-block}
h4{margin:14px 0 6px;font-size:15px}
.lead{color:#28303d;max-width:1000px;font-size:14px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin:18px 0}
.kpi{background:linear-gradient(160deg,#f8fafc,#eef2f9);border:1px solid var(--edge);border-radius:12px;padding:16px}
.kpi .n{font-size:24px;font-weight:800;color:var(--blue);line-height:1}
.kpi .l{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-top:6px}
.kpi.big .n{color:var(--green)}
table{border-collapse:collapse;width:100%;font-size:13px;margin:10px 0}
th,td{border:1px solid var(--edge);padding:7px 9px;text-align:left;vertical-align:top}
th{background:#f0f3f8;font-weight:700}
td.num,th.num{text-align:center;white-space:nowrap}
tr:nth-child(even){background:#fafbfd}
tr.grp td{background:#002d5b!important;color:#fff;font-weight:700}
.found{color:var(--muted);font-size:11.5px}
.redir{color:#9a3412;font-size:10.5px;font-weight:700}
.cx{padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;display:inline-block}
.cx-Low{background:#dcfce7;color:#166534}.cx-Medium{background:#fef9c3;color:#854d0e}.cx-High{background:#ffedd5;color:#9a3412}.cx-VeryHigh{background:#ede9fe;color:#5b21b6}
.total-row td{background:#002d5b!important;color:#fff;font-weight:800}
.subtotal td{background:#eef2f9!important;font-weight:700}
.grand td{background:var(--green)!important;color:#fff;font-weight:800;font-size:15px}
td.ai{font-weight:700;color:var(--green)}
.cbadge{display:inline-block;background:var(--blue);color:#fff;font-size:10px;font-weight:800;padding:1px 7px;border-radius:20px;margin-left:6px;text-transform:uppercase}
.vblock{margin:12px 0;padding:12px 14px;border:1px solid var(--edge);border-radius:10px;background:#fbfcfe}
.vblock h4{margin:0 0 4px}
.tags{margin:4px 0}.tag{display:inline-block;background:#eef2f9;border:1px solid #dfe6f1;color:#1a4bcc;padding:1px 8px;border-radius:20px;font-size:11px;margin:2px}
.assume li{font-size:13px;margin:4px 0}
.callout{background:#eff5ff;border-left:4px solid var(--blue);padding:10px 14px;border-radius:6px;font-size:13px;margin:12px 0}
.note{background:#fff8e6;border-left:4px solid #d99400;padding:10px 14px;border-radius:6px;font-size:13px;margin:12px 0}
a{color:#1a4bcc}
footer{text-align:center;color:var(--muted);font-size:12px;padding:24px}
@media print{nav.toc{display:none}section{break-inside:avoid;box-shadow:none}a{color:inherit}}
</style></head>
<body>
<header class="hero">
  <div class="badge">ADOBE EDGE DELIVERY SERVICES · MIGRATION ESTIMATION &amp; DISCOVERY</div>
  <h1>Dentsply Sirona (dentsplysirona.com) → EDS · Estimation &amp; Discovery</h1>
  <div class="sub">Migration estimation and structural discovery for moving <code>www.dentsplysirona.com/en-us</code> to Adobe Edge Delivery Services. Every URL from the list was fetched one by one; this report covers the <b>${ok.length.toLocaleString()} live (HTTP 200) pages</b> — no sampling. Current stack: <b>Adobe AEM Sites (Core Components) + SAP Hybris commerce + Scene7 DAM + Adobe Launch + Coveo search</b>. Effort is planning-grade, in <b>hours</b> (8h/person-day), to be refined in discovery.</div>
</header>
<nav class="toc">
  <a href="#summary">1 · Summary &amp; Estimate</a>
  <a href="#coverage">2 · URL Coverage</a>
  <a href="#blocks">3 · Block Inventory</a>
  <a href="#blockdetail">3b · Block Detail</a>
  <a href="#templates">4 · Templates</a>
  <a href="#integ">5 · Integrations</a>
  <a href="#content">6 · Content Migration</a>
  <a href="#rollup">7 · Total Estimate</a>
  <a href="#assume">8 · Assumptions</a>
  <a href="#obs">9 · Observations</a>
  <a href="third-party-integrations.html" style="color:var(--brand);font-weight:700">▸ Integrations report</a>
  <a href="assumptions.html" style="color:var(--brand);font-weight:700">▸ Assumptions report</a>
</nav>
<div class="wrap">

<section id="summary">
<h2 class="sec">1 · Summary &amp; Top-line Estimate</h2>
<div class="kpis">
  ${kpi(ok.length.toLocaleString(), 'Live pages analyzed')}
  ${kpi(templates.length, 'Templates', true)}
  ${kpi(BLOCKS.length + COMMERCE_BLOCKS.length, 'Blocks', true)}
  ${kpi(totalVariations, 'Variations', true)}
  ${kpi(integRows.length, 'Integrations')}
  ${kpi(buildSubtotal.toLocaleString() + 'h', 'Development', true)}
  ${kpi(contentHrs.toLocaleString() + 'h', 'Content migration', true)}
  ${kpi(grand.toLocaleString() + 'h', 'Grand total', true)}
</div>
<p class="lead">Dentsply Sirona runs on <b>Adobe AEM Sites with Core Components</b> and a <b>SAP Hybris</b> commerce layer (product/category/cart via a commerce GraphQL API), <b>Scene7</b> for imagery, <b>Adobe Launch</b> for tags, <b>Coveo</b> for search and <b>OneTrust</b> for consent. Blocks are read from the AEM <code>cmp-*</code> markup and templates from the page <code>meta[name=template]</code>, so this inventory is evidence-based. This report covers the <b>${ok.length.toLocaleString()} live (HTTP 200) pages</b>; dead/archived URLs from the source list are excluded from all counts and effort.</p>
<div class="callout"><b>Estimate drivers:</b> (a) the <b>commerce surface</b> — ${commercePages.toLocaleString()} PDP/PLP/shop/account pages backed by Hybris (the single biggest scope decision — see Assumptions); (b) <b>global header + Coveo search</b>; (c) high-reuse content blocks (carousel, tabs, teaser/cards, hero) across ${editorialPages.toLocaleString()} editorial pages; (d) content migration of ~${totalImgs.toLocaleString()} images and ${totalPdf.toLocaleString()} PDF links.</div>
<div class="note"><b>Grand total ${grand.toLocaleString()}h</b> ≈ ${Math.round(grand / HPD).toLocaleString()} person-days (8h/day) = <b>Development ${buildSubtotal.toLocaleString()}h + Content migration ${contentHrs.toLocaleString()}h</b>. Planning-grade; commerce scope in particular must be confirmed with Dentsply Sirona (see §8).</div>
</section>

<section id="coverage">
<h2 class="sec">2 · URL Coverage (${ok.length.toLocaleString()} live pages, grouped by template)</h2>
<p class="lead">Every URL in <code>dentsplysirona.txt</code> was fetched; the ${ok.length.toLocaleString()} live (HTTP 200) pages below are what the estimate covers. ${redirects} were redirected to a canonical URL (handled by redirect parity). Links open the live page.</p>
<table><thead><tr><th>URL</th><th>Title</th><th>Template / status</th></tr></thead><tbody>${urlSection}</tbody></table>
</section>

<section id="blocks">
<h2 class="sec">3 · EDS Block Inventory &amp; Effort</h2>
<p class="lead"><b>${BLOCKS.length + COMMERCE_BLOCKS.length} blocks</b> (${BLOCKS.length} content + ${COMMERCE_BLOCKS.length} commerce) · <b>${totalVariations} variations</b>. "Pages" = analyzed pages where the block was observed (from <code>cmp-*</code> markup). Effort is net-new EDS block build in hours.</p>
<table><thead><tr><th>Block</th><th class="num">Pages</th><th class="num">Var.</th><th class="num">Cap.</th><th>Complexity</th><th class="num">Effort</th></tr></thead>
<tbody>${blockTable}
<tr class="total-row"><td>TOTAL — ${BLOCKS.length + COMMERCE_BLOCKS.length} blocks</td><td class="num">—</td><td class="num">${totalVariations}</td><td class="num">—</td><td>—</td><td class="num">${(blockHrs + commerceHrs).toLocaleString()}h</td></tr></tbody></table>
</section>

<section id="blockdetail">
<h2 class="sec">3b · Block Detail</h2>
${blockDetail}
</section>

<section id="templates">
<h2 class="sec">4 · Template Inventory &amp; Effort</h2>
<p class="lead"><b>${templates.length} templates</b> across ${ok.length.toLocaleString()} analyzed pages, taken from the AEM <code>meta[name=template]</code>. Effort is EDS template scaffolding / block wiring (per-page authoring is in Content Migration).</p>
<table><thead><tr><th>Template</th><th class="num">Pages</th><th class="num">% Site</th><th>Complexity</th><th class="num">Effort</th></tr></thead>
<tbody>${templateTable}
<tr class="total-row"><td>TOTAL — ${templates.length} templates</td><td class="num">${ok.length.toLocaleString()}</td><td class="num">100%</td><td>—</td><td class="num">${templateHrs}h</td></tr></tbody></table>
</section>

<section id="integ">
<h2 class="sec">5 · Third-Party Integrations &amp; Effort</h2>
<p class="lead">The <b>${integRows.length} integrations below are in scope</b> for this estimate (verified on-page). "Pages" = pages where observed. Facebook/LinkedIn/Instagram are footer <i>social links</i> (not pixels) and are excluded. <b>SAP Hybris commerce &amp; the commerce GraphQL API</b> are also site-wide integrations, but their effort is counted in the <b>Commerce blocks</b> (§3) and Foundation scaffolding, so they are shown here as reference only (0h) to avoid double-counting.</p>
<div class="callout"><b>Full integration inventory:</b> a deeper scan (all ${flog.length.toLocaleString()} pages) plus <b>live Playwright network capture</b> found <b>29 integrations across 15 categories</b> — including runtime-only tags that Adobe Launch injects and never appear in static HTML (<b>ContentSquare, Heap, Google Ads/DoubleClick, Zoovu</b>) and the payment/CRM/search stack (<b>SnapPay, CardConnect, Salesforce + Live Agent, Coveo Commerce, Adobe CIF</b>). See the dedicated <a href="third-party-integrations.html"><b>third-party-integrations.html</b></a> and <a href="assumptions.html"><b>assumptions.html</b></a>. The table below is the subset carrying build effort in this estimate.</div>
<table><thead><tr><th>Integration</th><th class="num">Pages</th><th>Purpose</th><th>Migration strategy</th><th>Impact</th><th class="num">Effort</th></tr></thead>
<tbody>${integTable}
<tr><td><b>SAP Hybris Commerce</b> <span class="cbadge">in §3</span></td><td class="num">${ok.length}</td><td>Commerce platform (PDP/PLP/cart)</td><td>Consume via GraphQL in EDS commerce blocks; storefront app stays</td><td>${cxBadge('Very High')}</td><td class="num">— (§3)</td></tr>
<tr><td><b>Commerce GraphQL API</b> <span class="cbadge">in §3</span></td><td class="num">${ok.length}</td><td>Product/pricing/cart data API</td><td>EDS commerce blocks call the existing endpoint</td><td>${cxBadge('High')}</td><td class="num">— (§3)</td></tr>
<tr class="total-row"><td>TOTAL — ${integRows.length} integrations (commerce counted in §3)</td><td class="num">—</td><td colspan="3"></td><td class="num">${integHrs}h</td></tr></tbody></table>
</section>

<section id="content">
<h2 class="sec">6 · Content Migration Effort</h2>
<p class="lead">Separate from development. Covers importing, cleaning and validating all ${ok.length.toLocaleString()} analyzed pages and their assets.</p>
<table><thead><tr><th>Work stream</th><th class="num">Volume</th><th class="num">Effort</th></tr></thead>
<tbody>${contentTable}
<tr class="total-row"><td>TOTAL CONTENT MIGRATION</td><td class="num">—</td><td class="num">${contentHrs}h</td></tr></tbody></table>
</section>

<section id="rollup">
<h2 class="sec">7 · Total Estimate</h2>
<p class="lead">Planning-grade production estimate, all effort in hours (8h/person-day).</p>
<table><thead><tr><th>Category</th><th class="num">Effort (hours)</th><th>Notes</th></tr></thead>
<tbody>
<tr><td>Project setup / Foundation</td><td class="num ai">${foundationHrs}h</td><td class="found">Repo, tokens, decoration, SEO, analytics/consent, commerce scaffolding</td></tr>
${rollup.slice(1).map((r) => `<tr><td>${esc(r[0])}</td><td class="num ai">${r[1]}h</td><td class="found">${esc(r[2])}</td></tr>`).join('')}
<tr class="subtotal"><td>Development subtotal</td><td class="num ai">${buildSubtotal.toLocaleString()}h</td><td class="found">≈ ${Math.round(buildSubtotal / HPD)} person-days</td></tr>
<tr class="total-row"><td>Content migration</td><td class="num">${contentHrs}h</td><td></td></tr>
<tr class="grand"><td>GRAND TOTAL</td><td class="num">${grand.toLocaleString()}h</td><td>≈ ${Math.round(grand / HPD).toLocaleString()} person-days</td></tr>
</tbody></table>
<h4>Foundation breakdown</h4>
<table><thead><tr><th>Work item</th><th>Complexity</th><th class="num">Effort</th></tr></thead><tbody>${foundationTable}
<tr class="total-row"><td>Foundation subtotal</td><td>—</td><td class="num">${foundationHrs}h</td></tr></tbody></table>
</section>

<section id="assume">
<h2 class="sec">8 · Assumptions &amp; Scope Boundaries</h2>
<ul class="assume">
<li><b>Commerce (Hybris) is the key scope decision.</b> ${commercePages.toLocaleString()} pages (PDP ${ok.filter((p) => p.template === 'product-page').length}, PLP/category ${ok.filter((p) => p.template === 'category-page').length}, shop/account) are driven by SAP Hybris via a commerce GraphQL API. The estimate assumes EDS <b>commerce blocks consume the existing Hybris/GraphQL APIs client-side</b>; the authenticated storefront (cart, checkout, my-account, loyalty) <b>remains the Hybris application</b> and EDS links to it. Full commerce rebuild is NOT included and must be confirmed with Dentsply Sirona.</li>
<li><b>Scope is the <code>/en-us</code> locale.</b> Other locales reuse the same blocks/templates; per-locale content translation is <b>excluded</b>.</li>
<li><b>Coveo search</b> is re-wired to the existing Coveo org (search block); reindexing/relevance tuning by the search team is out of scope.</li>
<li><b>Scene7 / DAM assets</b> are referenced or migrated <b>without re-mastering</b>.</li>
<li><b>Analytics &amp; consent</b> (Adobe Launch, Analytics, OneTrust) are <b>re-instated as observed</b>; new tracking, data-layer changes or tag-manager rework are estimated separately.</li>
<li><b>Design parity, not redesign</b> — pixel-reasonable parity with the current AEM site.</li>
<li><b>Authenticated & account pages</b> (my-account, loyalty, practice management) remain in the commerce app; EDS links out.</li>
<li><b>New blocks / variations</b> discovered beyond this ${BLOCKS.length + COMMERCE_BLOCKS.length}-block / ${totalVariations}-variation inventory are estimated separately.</li>
<li><b>reCAPTCHA</b> (v3, observed site-wide on forms/search) is re-added; keys provided by Dentsply Sirona.</li>
<li>Estimates are <b>planning-grade</b>, AI-assisted delivery, to be refined in discovery.</li>
</ul>
</section>

<section id="obs">
<h2 class="sec">9 · Other Observations &amp; Open Questions</h2>
<ul class="assume">
<li><b>Platform:</b> AEM Sites with Core Components (<code>cmp-*</code>, <code>/etc.clientlibs</code>, <code>data-cmp-*</code>) — a clean, well-structured source that maps deterministically to EDS blocks.</li>
<li><b>Commerce coupling:</b> category/shop-brand pages embed the Hybris storefront (iframe/commerce app). Confirm which commerce surfaces DS wants natively in EDS vs. kept in Hybris.</li>
<li><b>Search:</b> Coveo powers site search + type-ahead across all pages; the search results template and relevance config should be reviewed with the DS search team.</li>
<li><b>Content quality to fix on migration:</b> ${noMeta} pages have no meta description, ${multiH1} have multiple H1s, ${noH1} have no H1 — worth normalizing for SEO/accessibility.</li>
<li><b>Redirects:</b> ${redirects} of the source URLs redirect to a canonical target; recreate these in EDS redirect config for SEO parity.</li>
<li><b>Experience Fragments:</b> reusable XFs appear across pages; map the XF library to shared EDS blocks/sections to preserve authoring reuse.</li>
<li><b>Not verifiable from page behavior:</b> authenticated commerce flows (cart/checkout/account) and any CAPTCHA-gated form submissions could not be exercised — flagged for discovery.</li>
</ul>
</section>

<footer>Dentsply Sirona → EDS · Migration estimation &amp; discovery · Generated 2026-08-18 · ${ok.length.toLocaleString()} live pages analyzed · Effort in hours (8h/day), planning-grade · Evidence in <code>dentsplysirona-report/data/*.json</code>.</footer>
</div>
</body></html>`;

fs.writeFileSync(path.join(OUT, 'dentsplysirona-eds-report.html'), html);

// Export the computed model so the summary report reconciles exactly with the detailed report.
fs.writeFileSync(path.join(OUT, 'data', 'estimate-model.json'), JSON.stringify({
  livePages: ok.length, redirects, templatesCount: templates.length,
  blocks: BLOCKS.map((b) => ({ name: b.name, pages: b.pages, cx: b.cx, nVar: b.nVar, hrs: b.base })),
  commerceBlocks: COMMERCE_BLOCKS.map((b) => ({ name: b.name, pages: b.pages, cx: b.cx, nVar: b.nVar, hrs: b.base })),
  totalBlocks: BLOCKS.length + COMMERCE_BLOCKS.length, totalVariations,
  templates: templates.map((t) => ({ name: t.name, t: t.t, n: t.n, cx: t.cx, hrs: t.hrs, commerce: t.commerce })),
  integrations: integRows,
  rollup: { foundationHrs, blockHrs, commerceHrs, templateHrs, integHrs, prodReadyHrs, buildSubtotal, contentHrs, grand, HPD },
  content: { totalImgs, totalPdf, noMeta, multiH1, noH1, commercePages, editorialPages },
}, null, 2));

console.log('Wrote dentsplysirona-report/dentsplysirona-eds-report.html', (html.length / 1024).toFixed(1) + 'KB');
console.log('Blocks', BLOCKS.length + COMMERCE_BLOCKS.length, '| variations', totalVariations, '| templates', templates.length, '| integrations', integRows.length);
console.log('Foundation', foundationHrs, '| blocks', blockHrs, '| commerce', commerceHrs, '| templates', templateHrs, '| integ', integHrs, '| prod', prodReadyHrs);
console.log('DEV SUBTOTAL', buildSubtotal, '| CONTENT', contentHrs, '| GRAND', grand, 'h ≈', Math.round(grand / HPD), 'person-days');
