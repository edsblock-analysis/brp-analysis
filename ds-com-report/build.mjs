// Build ds-com (/en) EDS discovery dashboard + CSVs + estimates.
// Traceability: page -> template -> blocks -> variations -> integrations -> migration -> estimate.
// Estimates in HOURS (8h/day basis) with Best/Expected/High. Reusable blocks are NOT re-counted per page.
// NOTE: internal model arrays are in days; H() converts to whole hours for every visible output.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT = path.join(ROOT, 'ds-com-report');
const DATA = path.join(OUT, 'data');
const pages = JSON.parse(fs.readFileSync(path.join(DATA, 'pages.json'), 'utf8'));
const agg = JSON.parse(fs.readFileSync(path.join(DATA, 'aggregates.json'), 'utf8'));
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const csvCell = (s) => { const v = String(s == null ? '' : s); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const norm = (u) => (u || '').split('?')[0].replace(/\.html$/, '').replace(/\/$/, '');
const pth = (u) => (u || '').replace(/^https?:\/\/[^/]+/, '');

// ---- distinct final pages (representatives) ----
const EXTERNAL_HOST = /coresupport\.|careers\./;
const repByFinal = {};
for (const p of pages) { if (p.error) continue; const nf = norm(p.finalUrl); if (!repByFinal[nf]) repByFinal[nf] = { ...p, sources: [] }; repByFinal[nf].sources.push(p.url); }
const reps = Object.values(repByFinal);
const edsReps = reps.filter((p) => !EXTERNAL_HOST.test(p.finalUrl)); // real EDS pages
const externalReps = reps.filter((p) => EXTERNAL_HOST.test(p.finalUrl));

// ============================================================
// TEMPLATE MODEL
// ============================================================
const TNAME = {
  'brand-page-template': 'Brand / Product Page',
  'explore-page-template': 'Explore / Category Landing',
  'basic-template0': 'Basic Content Page',
  'discover-homepage1': 'Discover Hub / Homepage',
  'academy-course-listings-page': 'Academy — Course Listing',
  'article-details': 'Article / Editorial Detail',
  'academy-content-page': 'Academy — Content',
  'academy-study-template': 'Academy — Study',
  'customer-support-contact-us-template': 'Support — Contact',
  'shop-home-page-template': 'Shop Home (Hybris)',
};
const TEMPLATE_MODEL = {
  'brand-page-template': { type: 'Product / Brand', cx: 'Medium', pd: [1.5, 2, 3], blocks: ['Hero', 'Feature / Media Row', 'Cards', 'Carousel', 'Accordion', 'Tabs', 'Step', 'Video', 'Rich Text'] },
  'explore-page-template': { type: 'Category / Landing', cx: 'High', pd: [2, 3, 4], blocks: ['Hero', 'Feature / Media Row', 'Cards', 'Carousel', 'Teaser / Promo', 'Banner', 'Video', 'Rich Text'] },
  'basic-template0': { type: 'Content', cx: 'Low', pd: [1, 1.5, 2], blocks: ['Hero', 'Rich Text', 'Cards', 'Accordion', 'Embed'] },
  'discover-homepage1': { type: 'Hub / Landing', cx: 'Medium', pd: [1.5, 2, 3], blocks: ['Hero', 'Carousel', 'Cards', 'Teaser / Promo', 'Video'] },
  'academy-course-listings-page': { type: 'Listing (Coveo)', cx: 'High', pd: [2, 3, 4], blocks: ['Hero', 'Course Listing (Coveo)', 'Cards', 'Filter'] },
  'article-details': { type: 'Editorial', cx: 'Low', pd: [1, 1.5, 2], blocks: ['Article Hero', 'Rich Text', 'Cards', 'Video'] },
  'academy-content-page': { type: 'Content', cx: 'Low', pd: [1, 1.5, 2], blocks: ['Hero', 'Rich Text', 'Cards', 'Accordion'] },
  'academy-study-template': { type: 'Editorial', cx: 'Medium', pd: [1, 1.5, 2.5], blocks: ['Hero', 'Rich Text', 'Step', 'Cards'] },
  'customer-support-contact-us-template': { type: 'Form / Contact', cx: 'Medium', pd: [1.5, 2, 3], blocks: ['Hero', 'Form (AEM Forms)', 'Contact Cards', 'Embed'] },
  'shop-home-page-template': { type: 'Commerce (Hybris)', cx: 'High', pd: [2, 3, 5], blocks: ['Shop Hero', 'Carousel', 'Cards', 'Commerce widgets'] },
};
const tmplCount = {}; for (const p of edsReps) tmplCount[p.template] = (tmplCount[p.template] || 0) + 1;
const exampleUrls = (tpl, n = 3) => edsReps.filter((p) => p.template === tpl).slice(0, n).map((p) => pth(p.finalUrl));
const templates = Object.entries(tmplCount).filter(([t]) => t !== '(none)').sort((a, b) => b[1] - a[1]).map(([t, count]) => {
  const m = TEMPLATE_MODEL[t] || { type: 'Content', cx: 'Medium', pd: [1, 1.5, 2], blocks: [] };
  return { id: t, name: TNAME[t] || t, type: m.type, cx: m.cx, count, pd: m.pd, blocks: m.blocks, examples: exampleUrls(t) };
});
const templatePD = templates.reduce((a, t) => [a[0] + t.pd[0], a[1] + t.pd[1], a[2] + t.pd[2]], [0, 0, 0]);

// ============================================================
// BLOCK INVENTORY (reusable — built once, not per page)
// ============================================================
const cmpPagesEDS = (root) => edsReps.filter((p) => (p.components[root] || 0) > 0).length;
const blkPages = (k) => edsReps.filter((p) => (p.blocks[k] || 0) > 0).length;
const exFor = (predOrKey, n = 3) => {
  const pred = typeof predOrKey === 'function' ? predOrKey : (p) => (p.blocks[predOrKey] || 0) > 0;
  return edsReps.filter(pred).slice(0, n).map((p) => pth(p.finalUrl));
};
// [name, purpose, variations[], usagePages, examples, complexity, pd[best,exp,high]]
const BLOCKS = [
  { name: 'Hero', purpose: 'Full-width page intro band: media + headline + eyebrow + CTA.', variations: ['Default', 'Image', 'Video', 'CTA', 'Shop hero'], usage: blkPages('hero'), examples: exFor('hero'), cx: 'Complex', pd: [3, 4, 6] },
  { name: 'Feature / Media Row', purpose: 'Alternating image/text content rows with optional CTA (workhorse marketing block).', variations: ['Media left', 'Media right', 'Background', 'With CTA'], usage: cmpPagesEDS('container'), examples: exFor('hero'), cx: 'Medium', pd: [2.5, 3.5, 5] },
  { name: 'Cards', purpose: 'Card grids: icon, download (asset), video, image-tile, jump/anchor, course cards.', variations: ['Icon', 'Download', 'Video', 'Image-tile', 'Jump', 'Course'], usage: blkPages('cards'), examples: exFor('cards'), cx: 'Complex', pd: [3.5, 5, 7] },
  { name: 'Carousel / Slider', purpose: 'Rotating content carousels + Swiper sliders (very high reuse).', variations: ['Core carousel', 'Swiper', 'Scrollable'], usage: blkPages('carousel'), examples: exFor('carousel'), cx: 'Complex', pd: [3, 4, 6] },
  { name: 'Teaser / Promo', purpose: 'Promotional teasers and promo/banner-ad cards.', variations: ['Teaser', 'Promo card', 'Banner ad'], usage: blkPages('teaser'), examples: exFor('teaser'), cx: 'Medium', pd: [2, 3, 4] },
  { name: 'Accordion', purpose: 'Expand/collapse FAQ & content groups.', variations: ['Default', 'FAQ'], usage: blkPages('accordion'), examples: exFor('accordion'), cx: 'Medium', pd: [1.5, 2, 3] },
  { name: 'Tabs', purpose: 'Tabbed content panels.', variations: ['Default'], usage: blkPages('tabs'), examples: exFor('tabs'), cx: 'Medium', pd: [1.5, 2.5, 3.5] },
  { name: 'Step / Process', purpose: 'Numbered step / how-it-works sequences.', variations: ['Default'], usage: blkPages('step'), examples: exFor('step'), cx: 'Simple', pd: [1, 1.5, 2] },
  { name: 'Video', purpose: 'Embedded YouTube/Vimeo with lazy facade.', variations: ['YouTube', 'Vimeo', 'Video card'], usage: blkPages('videos'), examples: exFor('videos'), cx: 'Medium', pd: [1.5, 2, 3] },
  { name: 'Banner / Callout', purpose: 'Promo banners and callout strips.', variations: ['Banner', 'Callout'], usage: blkPages('banner'), examples: exFor('banner'), cx: 'Simple', pd: [1, 1.5, 2] },
  { name: 'Embed', purpose: 'Generic third-party / iframe embeds preserved as-is.', variations: ['iFrame', 'Script'], usage: blkPages('embed'), examples: exFor('embed'), cx: 'Medium', pd: [1.5, 2, 3] },
  { name: 'Rich Text / Title / Image', purpose: 'Core authored content: rich text, titles, standalone Scene7 images, spacing/separators.', variations: ['Text', 'Title', 'Image'], usage: edsReps.length, examples: exFor(() => true), cx: 'Simple', pd: [1.5, 2, 3] },
  { name: 'List / Alphabetical (A–Z)', purpose: 'Content lists and the A–Z alphabetical brand listing.', variations: ['Content list', 'Alphabetical A–Z'], usage: blkPages('list'), examples: exFor('alphabetical').concat(exFor('list')).slice(0, 3), cx: 'Medium', pd: [2, 2.5, 3.5] },
  { name: 'Course Listing (Coveo)', purpose: 'Academy course listing with Coveo-powered filter/sort/pagination.', variations: ['Listing', 'Filtered'], usage: tmplCount['academy-course-listings-page'] || 0, examples: exampleUrls('academy-course-listings-page'), cx: 'Complex', pd: [3, 4, 6] },
  { name: 'Form (AEM Forms)', purpose: 'Native lead/contact forms (name/email/practice/topic) → CRM routing.', variations: ['Contact', 'Lead', 'Request'], usage: (tmplCount['customer-support-contact-us-template'] || 0), examples: exampleUrls('customer-support-contact-us-template'), cx: 'Complex', pd: [3, 4, 6] },
];
const blockPD = BLOCKS.reduce((a, b) => [a[0] + b.pd[0], a[1] + b.pd[1], a[2] + b.pd[2]], [0, 0, 0]);
const totalVariations = BLOCKS.reduce((s, b) => s + b.variations.length, 0);

// ============================================================
// GLOBAL COMPONENTS
// ============================================================
const GLOBAL = [
  { name: 'Header + Mega-menu', purpose: 'Multi-level mega-menu, utility nav, language navigation.', cx: 'Complex', pd: [4, 6, 8] },
  { name: 'Footer', purpose: 'Multi-column footer + social + legal + language nav.', cx: 'Medium', pd: [1.5, 2, 3] },
  { name: 'Search (Coveo)', purpose: 'Site search + type-ahead suggestions wired to Coveo org + searchkey token service.', cx: 'Complex', pd: [4, 5, 7] },
  { name: 'Breadcrumbs', purpose: 'Path breadcrumb (auto-block from path/metadata).', cx: 'Simple', pd: [0.5, 1, 1.5] },
  { name: 'Cookie Consent (OneTrust)', purpose: 'Consent banner + tag gating in delayed phase.', cx: 'Medium', pd: [1, 1.5, 2] },
  { name: 'Analytics (Adobe Launch + data layer)', purpose: 'Launch embed + digitalData data-layer parity so downstream tags fire.', cx: 'Complex', pd: [3, 4, 6] },
  { name: 'SEO / Schema / Metadata', purpose: 'Canonicals, OG, structured data, sitemap, per-page metadata framework.', cx: 'Medium', pd: [2, 3, 4] },
  { name: 'Redirect map (SEO parity)', purpose: `Recreate legacy→canonical redirects (${agg.redirected} observed among source URLs).`, cx: 'Medium', pd: [1.5, 2.5, 4] },
];
const globalPD = GLOBAL.reduce((a, g) => [a[0] + g.pd[0], a[1] + g.pd[1], a[2] + g.pd[2]], [0, 0, 0]);

// ============================================================
// INTEGRATIONS
// ============================================================
// [name, pages, purpose, edsApproach, complexity, pd[best,exp,high], validation]
const INTEG = [
  { name: 'Adobe Launch (Tag Manager)', pages: agg.integrations['Adobe DTM / Launch'] || 0, purpose: 'Loads analytics/marketing tags + owns digitalData layer.', eds: 'Re-add via delayed.js; rebuild data layer.', cx: 'Complex', pd: [3, 4, 6], val: '' },
  { name: 'Adobe Analytics', pages: agg.integrations['Adobe DTM / Launch'] || 0, purpose: 'Web analytics via Launch.', eds: 'Fires through Launch; re-instate as observed.', cx: 'Medium', pd: [1, 1.5, 2.5], val: 'Needs Validation (report suite/config)' },
  { name: 'Adobe Scene7 / Dynamic Media', pages: agg.integrations['Adobe Scene7 / Dynamic Media'] || 0, purpose: 'DAM image/video delivery.', eds: 'Keep Scene7 URLs or serve via EDS images.', cx: 'Medium', pd: [2, 3, 4], val: '' },
  { name: 'Coveo Search', pages: agg.integrations['Coveo Search'] || 0, purpose: 'Site search + suggestions + Academy course listing.', eds: 'Search + listing blocks wired to Coveo org; reuse searchkey service.', cx: 'Complex', pd: [4, 6, 8], val: '' },
  { name: 'SAP Hybris + Commerce GraphQL', pages: agg.integrations['SAP Hybris Commerce'] || 0, purpose: 'Commerce config present site-wide; only 1 shop-home page in this set.', eds: 'Minimal for /en: link to storefront; consume GraphQL only if shop pages are built.', cx: 'Medium', pd: [2, 3, 5], val: 'Needs Validation (is /en commerce in scope?)' },
  { name: 'OneTrust (Consent)', pages: agg.integrations['OneTrust'] || 0, purpose: 'Cookie consent + geo banner; gates tags.', eds: 'Load delayed with same config.', cx: 'Medium', pd: [1, 1.5, 2], val: '' },
  { name: 'reCAPTCHA v3', pages: agg.integrations['reCAPTCHA'] || 0, purpose: 'Bot protection on forms/search.', eds: 'Re-add on EDS forms; keys from DS.', cx: 'Simple', pd: [0.5, 1, 1.5], val: '' },
  { name: 'YouTube / Vimeo', pages: agg.integrations['YouTube'] || 0, purpose: 'Video embeds in content.', eds: 'Lazy facade video block.', cx: 'Simple', pd: [0.5, 1, 1.5], val: '' },
  { name: 'Salesforce (CRM + Live Agent)', pages: agg.integrations['Adobe DTM / Launch'] || 0, purpose: 'CRM lead routing + live chat (seen site-wide in /en-us; assumed same).', eds: 'Re-embed chat/CRM snippet; forms route to Salesforce.', cx: 'Medium', pd: [2, 3, 4], val: 'Needs Validation (confirm on /en + routing)' },
  { name: 'ContentSquare / Heap / Google Ads', pages: agg.integrations['Adobe DTM / Launch'] || 0, purpose: 'Runtime analytics/marketing tags injected by Launch (not in static HTML).', eds: 'Re-instated with Launch + data layer; consent-gated.', cx: 'Medium', pd: [1, 2, 3], val: 'Needs Validation (live capture confirmed on /en-us)' },
];
const integPD = INTEG.reduce((a, i) => [a[0] + i.pd[0], a[1] + i.pd[1], a[2] + i.pd[2]], [0, 0, 0]);

// ============================================================
// CONTENT MIGRATION
// ============================================================
const totalImgs = edsReps.reduce((s, p) => s + p.blocks.imgs, 0);
const totalPdf = edsReps.reduce((s, p) => s + p.blocks.pdfLinks, 0);
const noMeta = edsReps.filter((p) => !p.metaDesc).length;
const multiH1 = edsReps.filter((p) => p.h1count > 1).length;
// classify pages by migration method (based on template complexity)
const MIG_METHOD = {
  'basic-template0': 'Automated', 'article-details': 'Automated', 'academy-content-page': 'Automated',
  'discover-homepage1': 'Semi-Automated', 'brand-page-template': 'Semi-Automated', 'academy-study-template': 'Semi-Automated',
  'explore-page-template': 'Manual', 'academy-course-listings-page': 'Manual', 'customer-support-contact-us-template': 'Manual',
  'shop-home-page-template': 'Recreate',
};
const migByMethod = {};
for (const p of edsReps) { const method = MIG_METHOD[p.template] || 'Semi-Automated'; migByMethod[method] = migByMethod[method] || { count: 0, templates: new Set() }; migByMethod[method].count += 1; migByMethod[method].templates.add(TNAME[p.template] || p.template); }
// pages-per-day rates by method
const MIG_RATE = { Automated: 12, 'Semi-Automated': 5, Manual: 2.5, Recreate: 1 };
const MIG_ORDER = ['Automated', 'Semi-Automated', 'Manual', 'Recreate'];
const migRows = MIG_ORDER.filter((m) => migByMethod[m]).map((m) => {
  const c = migByMethod[m].count; const rate = MIG_RATE[m];
  const exp = c / rate; return { method: m, count: c, rate, templates: [...migByMethod[m].templates], best: exp * 0.75, expd: exp, high: exp * 1.4 };
});
const migExecPD = migRows.reduce((a, r) => [a[0] + r.best, a[1] + r.expd, a[2] + r.high], [0, 0, 0]);
// migration streams
const MIG_STREAMS = [
  { name: 'Migration tooling (importer, parsers, transforms)', best: 4, expd: 6, high: 9 },
  { name: `Migration execution (${edsReps.length} pages by method)`, best: migExecPD[0], expd: migExecPD[1], high: migExecPD[2] },
  { name: `Asset migration (~${totalImgs.toLocaleString()} images, Scene7 refs)`, best: 3, expd: 5, high: 7 },
  { name: `Document / PDF migration (${totalPdf.toLocaleString()} PDF links)`, best: 2, expd: 3, high: 5 },
  { name: `Metadata & SEO (${noMeta} no-meta, ${multiH1} multi-H1) + link fixups`, best: 3, expd: 4, high: 6 },
  { name: 'Remediation (broken links, embeds, redirects)', best: 3, expd: 5, high: 8 },
  { name: 'Migration QA (spot-check + reconcile)', best: 4, expd: 6, high: 9 },
];
const migPD = MIG_STREAMS.reduce((a, s) => [a[0] + s.best, a[1] + s.expd, a[2] + s.high], [0, 0, 0]);

// ============================================================
// PROGRAM-LEVEL ESTIMATE
// ============================================================
const rnd = (n) => Math.round(n * 10) / 10;
const HPD = 8;
const H = (days) => Math.round(days * HPD); // days -> whole hours
// Consolidated estimate — Expected hours only. Dev + content migration effort.
// Setup and block development are agreed fixed figures; integrations kept as analysed;
// content migration agreed at 300h. Global components are folded into block development.
const SETUP_HRS = 72;
const BLOCK_DEV_HRS = 240; // includes global components (header/nav, footer, search, consent, analytics, SEO, redirects)
const INTEG_HRS = H(integPD[1]); // keep integrations as analysed (Expected)
const CONTENT_HRS = 300;
const EST_HRS = [
  ['EDS setup / Foundation', SETUP_HRS],
  ['Block development (incl. global components)', BLOCK_DEV_HRS],
  ['Third-party integrations', INTEG_HRS],
  ['Content migration', CONTENT_HRS],
];
const TOTAL_HRS = EST_HRS.reduce((s, [, h]) => s + h, 0);

// ============================================================
// PER-PAGE traceability (all 478 URLs)
// ============================================================
const pageBlocksLabel = (p) => {
  if (p.error) return '—';
  const present = [];
  const map = { hero: 'Hero', teaser: 'Teaser', carousel: 'Carousel', tabs: 'Tabs', accordion: 'Accordion', step: 'Step', cards: 'Cards', videos: 'Video', banner: 'Banner', embed: 'Embed', list: 'List', search: 'Search' };
  for (const [k, label] of Object.entries(map)) if ((p.blocks[k] || 0) > 0) present.push(label);
  return present.join(', ') || 'Rich Text';
};
const pageCx = (p) => {
  if (p.error) return 'N/A';
  const m = TEMPLATE_MODEL[p.template]; return m ? m.cx : 'Medium';
};
const migCx = (p) => (p.error ? 'Excluded' : (MIG_METHOD[p.template] || 'Semi-Automated'));

// =============== WRITE CSVs ===============
const w = (name, header, rows) => fs.writeFileSync(path.join(OUT, name), [header.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n'));

w('pages.csv', ['URL', 'Final URL', 'Redirected', 'Status', 'Template', 'Blocks', 'Integrations', 'Complexity', 'Migration Method'],
  pages.map((p) => [p.url, p.finalUrl, p.redirected ? 'yes' : 'no', p.status, p.error ? '(unavailable)' : (TNAME[p.template] || p.template), pageBlocksLabel(p), (p.integrations || []).join('; '), pageCx(p), migCx(p)]));

w('templates.csv', ['Template', 'Type', 'Page Count', 'Complexity', 'Example URLs', 'Blocks', 'Estimate Expected (hrs)'],
  templates.map((t) => [t.name, t.type, t.count, t.cx, t.examples.join(' | '), t.blocks.join('; '), H(t.pd[1])]));

w('blocks.csv', ['Block', 'Purpose', 'Variations', '# Variations', 'Usage Count', 'Example URLs', 'Complexity', 'Estimate Expected (hrs)'],
  BLOCKS.map((b) => [b.name, b.purpose, b.variations.join(' | '), b.variations.length, b.usage, b.examples.join(' | '), b.cx, H(b.pd[1])]));

w('integrations.csv', ['Integration', 'Pages', 'Purpose', 'EDS Approach', 'Complexity', 'Estimate Expected (hrs)', 'Validation'],
  INTEG.map((i) => [i.name, i.pages, i.purpose, i.eds, i.cx, H(i.pd[1]), i.val || 'Verified']));

w('migration.csv', ['Page Type / Method', 'Page Count', 'Pages/Day', 'Templates', 'Effort Expected (hrs)'],
  migRows.map((r) => [r.method, r.count, r.rate, r.templates.join('; '), H(r.expd)])
    .concat(MIG_STREAMS.map((s) => [s.name, '', '', '', H(s.expd)])));

w('estimates.csv', ['Area', 'Expected (hrs)'],
  EST_HRS.map(([n, h]) => [n, h]).concat([['TOTAL', TOTAL_HRS]]));

// =============== DASHBOARD HTML ===============
const cxCls = (c) => ({ Simple: 'cx-Low', Low: 'cx-Low', Medium: 'cx-Medium', High: 'cx-High', Complex: 'cx-High', 'Very High': 'cx-VeryHigh' }[c] || 'cx-Medium');
const cx = (c) => `<span class="cx ${cxCls(c)}">${esc(c)}</span>`;
const kpi = (n, l, alt) => `<div class="kpi${alt ? ' alt' : ''}"><div class="n">${n}</div><div class="l">${l}</div></div>`;
const pdCell = (pd) => `${H(pd[1])}`; // single Expected value in hours

const pagesRows = pages.map((p) => `<tr class="prow" data-tpl="${esc(p.error ? 'unavailable' : p.template)}" data-red="${p.redirected}">
  <td><a href="${esc(p.finalUrl)}" target="_blank" rel="noopener">${esc(pth(p.finalUrl) || p.url)}</a>${p.redirected ? ` <span class="tag redir">↳ from ${esc(pth(p.url))}</span>` : ''}</td>
  <td>${esc(p.error ? '(unavailable ' + p.status + ')' : (TNAME[p.template] || p.template))}</td>
  <td class="found">${esc(pageBlocksLabel(p))}</td>
  <td class="found">${esc((p.integrations || []).slice(0, 4).join(', '))}</td>
  <td>${p.error ? '<span class="tag">N/A</span>' : cx(pageCx(p))}</td>
  <td>${esc(migCx(p))}</td></tr>`).join('\n');

const templateRows = templates.map((t) => `<tr>
  <td><b>${esc(t.name)}</b><div class="found">${esc(t.id)} · ${esc(t.type)}</div></td>
  <td class="num">${t.count}</td>
  <td class="found">${t.examples.map((u) => `<a href="https://www.dentsplysirona.com${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>`).join('<br>')}</td>
  <td class="found">${esc(t.blocks.join(', '))}</td>
  <td>${cx(t.cx)}</td>
  <td class="num">${pdCell(t.pd)}</td></tr>`).join('\n');

const blockRows = BLOCKS.map((b) => `<tr>
  <td><b>${esc(b.name)}</b><div class="found">${esc(b.purpose)}</div></td>
  <td class="found">${b.variations.map((v) => `<span class="tag">${esc(v)}</span>`).join(' ')}</td>
  <td class="num">${b.usage}</td>
  <td class="found">${b.examples.map((u) => `<a href="https://www.dentsplysirona.com${esc(u)}" target="_blank" rel="noopener">${esc(u.split('/').pop() || u)}</a>`).join('<br>')}</td>
  <td>${cx(b.cx)}</td>
  <td class="num">${pdCell(b.pd)}</td></tr>`).join('\n');

const globalRows = GLOBAL.map((g) => `<tr><td><b>${esc(g.name)}</b><div class="found">${esc(g.purpose)}</div></td><td>${cx(g.cx)}</td><td class="num">${pdCell(g.pd)}</td></tr>`).join('\n');

const integRows = INTEG.map((i) => `<tr><td><b>${esc(i.name)}</b>${i.val ? ` <span class="tag nv">${esc(i.val.startsWith('Needs') ? 'Needs Validation' : i.val)}</span>` : ''}</td><td class="num">${i.pages}</td><td class="found">${esc(i.purpose)}</td><td class="found">${esc(i.eds)}</td><td>${cx(i.cx)}</td><td class="num">${pdCell(i.pd)}</td></tr>`).join('\n');

const migMethodRows = migRows.map((r) => `<tr><td><b>${esc(r.method)}</b><div class="found">${esc(r.templates.join(', '))}</div></td><td class="num">${r.count}</td><td class="num">${r.rate}/day</td><td class="num">${pdCell([r.best, r.expd, r.high])}</td></tr>`).join('\n');
const migStreamRows = MIG_STREAMS.map((s) => `<tr><td>${esc(s.name)}</td><td class="num">${pdCell([s.best, s.expd, s.high])}</td></tr>`).join('\n');

const estRows = EST_HRS.map(([n, h]) => `<tr><td>${esc(n)}</td><td class="num ai">${h}</td></tr>`).join('\n');

const ASSUMPTIONS = [
  'Estimates are in hours on an 8h/day basis; planning-grade (Best/Expected/High), not a fixed bid.',
  'Reusable blocks are built ONCE — page volume drives content migration, not repeated block dev.',
  'Consolidated estimate uses agreed figures: setup 72h, block development 240h (includes global components), integrations as analysed, content migration 300h. The per-method migration breakdown below is indicative sizing; the estimate carries the agreed 300h.',
  'Scope is the /en global locale set in ds-com.txt; other locales reuse the same blocks/templates (translation excluded).',
  'Migration rates: Automated 12 pg/day, Semi-Automated 5, Manual 2.5, Recreate 1 (per person).',
  'Analytics/marketing tags (Launch, ContentSquare, Heap, Google Ads) are re-instated as observed via a rebuilt data layer; new tracking is separate.',
  'Scene7 assets referenced (or moved to EDS) without re-mastering.',
  'Coveo search/listing re-wired to the existing org; index/relevance owned by DS search team.',
  'External subdomains (careers., coresupport.) and the Hybris storefront are linked, not rebuilt.',
  'The 195 redirecting source URLs collapse to fewer live pages; the redirect MAP is recreated for SEO parity.',
];
const RISKS = [
  'Commerce scope on /en is ambiguous — Hybris config is site-wide but only 1 shop page appears in this set. If full commerce is required, add PDP/PLP/cart effort (see /en-us analysis).',
  'The authenticated commerce/account journey was not exercised (auth-gated).',
  'Coveo relevance/index migration depends on the DS search team\'s availability.',
  'Form → CRM (Salesforce) routing and reCAPTCHA keys must be provided by DS.',
  'The large redirect map (195 URLs) implies ongoing IA churn; the live map must be exported at cutover.',
  'Runtime-injected tags (ContentSquare/Heap/Google Ads) were confirmed on /en-us via live capture; assumed identical on /en — confirm.',
];
const UNKNOWNS = [
  'Exact Adobe Analytics report-suite / Launch property for /en.',
  'Whether /en commerce (shop) pages are in migration scope.',
  'Personalization / Adobe Target usage (not observed statically — Needs Validation via live capture).',
  'Total real asset count behind Scene7 (only on-page refs counted).',
  'DAM re-hosting requirement (keep Scene7 vs migrate).',
];
const NEEDS_VAL = INTEG.filter((i) => i.val && i.val.startsWith('Needs')).map((i) => `${i.name} — ${i.val.replace('Needs Validation', '').replace(/[()]/g, '').trim()}`);

const li = (arr) => arr.map((x) => `<li>${esc(x)}</li>`).join('');

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dentsply Sirona (/en) → EDS · Discovery Dashboard</title>
<style>
:root{--brand:#00a0df;--ink:#0b0f19;--edge:#e2e6ee;--blue:#0067a0;--muted:#5b6472;--navy:#002d5b;--green:#0b7a3b}
*{box-sizing:border-box}body{margin:0;font:14.5px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:#f4f6fa}
header.hero{background:linear-gradient(135deg,#002d5b,#004a86 60%,#0067a0);color:#fff;padding:40px}
header.hero h1{margin:0 0 8px;font-size:26px}header.hero .sub{color:#bcd6ea;font-size:14px;max-width:1040px}
header.hero .badge{display:inline-block;background:var(--brand);color:#00243f;font-weight:700;padding:3px 11px;border-radius:5px;font-size:12px;margin-bottom:12px;letter-spacing:.5px}
nav.toc{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--edge);z-index:40;padding:10px 24px;display:flex;flex-wrap:wrap;gap:4px 16px;font-size:13px}
nav.toc a{color:var(--muted);text-decoration:none;white-space:nowrap}nav.toc a:hover{color:var(--blue)}
.wrap{max-width:1280px;margin:0 auto;padding:0 24px 70px}
section{background:#fff;border:1px solid var(--edge);border-radius:14px;padding:22px 26px;margin:18px 0;box-shadow:0 1px 3px rgba(10,15,25,.05)}
h2.sec{font-size:19px;margin:0 0 6px;padding-bottom:8px;border-bottom:3px solid var(--brand);display:inline-block}
.lead{color:#28303d;max-width:1040px;font-size:13.5px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin:16px 0}
.kpi{background:linear-gradient(160deg,#f8fafc,#eef2f9);border:1px solid var(--edge);border-radius:12px;padding:14px}
.kpi .n{font-size:22px;font-weight:800;color:var(--blue);line-height:1}.kpi .l{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.3px;margin-top:5px}
.kpi.alt .n{color:var(--green)}
.flow{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:14px 0;font-size:13px}
.flow .step{background:#eef2f9;border:1px solid #dfe6f1;border-radius:8px;padding:6px 12px;font-weight:700;color:var(--navy)}
.flow .arr{color:var(--muted)}
table{border-collapse:collapse;width:100%;font-size:12.5px;margin:8px 0}
th,td{border:1px solid var(--edge);padding:6px 8px;text-align:left;vertical-align:top}
th{background:#f0f3f8;font-weight:700;position:sticky;top:0}td.num,th.num{text-align:center;white-space:nowrap}tr:nth-child(even){background:#fafbfd}
.found{color:var(--muted);font-size:11px}
.tag{display:inline-block;background:#eef2f9;border:1px solid #dfe6f1;color:#1a4bcc;padding:0 6px;border-radius:20px;font-size:10px;margin:1px}
.tag.redir{background:#fef3c7;color:#92400e;border-color:#f2d98a}.tag.nv{background:#fee2e2;color:#991b1b;border-color:#f3b4b4}
.cx{padding:2px 8px;border-radius:20px;font-size:10.5px;font-weight:700;white-space:nowrap;display:inline-block}
.cx-Low{background:#dcfce7;color:#166534}.cx-Medium{background:#fef9c3;color:#854d0e}.cx-High{background:#ffedd5;color:#9a3412}.cx-VeryHigh{background:#ede9fe;color:#5b21b6}
.total-row td,.grand td{background:#002d5b!important;color:#fff;font-weight:800}.grand td{background:var(--green)!important;font-size:14px}
td.ai{font-weight:700;color:var(--green)}
.tablewrap{max-height:520px;overflow:auto;border:1px solid var(--edge);border-radius:8px}
.controls{margin:8px 0}.controls input,.controls select{padding:5px 8px;border:1px solid var(--edge);border-radius:6px;font-size:13px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.card{background:#fbfcfe;border:1px solid var(--edge);border-radius:10px;padding:12px 16px}
.card h4{margin:0 0 6px;font-size:14px;color:var(--navy)}.card li{font-size:12.5px;margin:3px 0}
a{color:#1a4bcc}
.dl{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.dl a{font-size:12px;background:#eef2f9;border:1px solid #dfe6f1;padding:5px 11px;border-radius:20px;text-decoration:none;font-weight:600}
footer{text-align:center;color:var(--muted);font-size:12px;padding:20px}
@media print{nav.toc,.controls{display:none}section{break-inside:avoid;box-shadow:none}.tablewrap{max-height:none;overflow:visible}a{color:inherit}}
@media(max-width:800px){.cols{grid-template-columns:1fr}}
</style></head><body>
<header class="hero">
<div class="badge">ADOBE EDGE DELIVERY SERVICES · DISCOVERY &amp; ESTIMATION DASHBOARD</div>
<h1>Dentsply Sirona (<code>/en</code>) → EDS · Discovery Dashboard</h1>
<div class="sub">Rebuild + migration estimation for the <b>${pages.length} URLs</b> in <code>ds-com.txt</code> (the <code>/en</code> global locale). Platform: <b>Adobe AEM Sites (Core Components) + SAP Hybris + Coveo + Scene7 + Adobe Launch + OneTrust</b>. Blocks/templates read from AEM markup (<code>cmp-*</code>, <code>meta[template]</code>). Estimates in <b>hours</b> (8h/day basis) as <b>Best / Expected / High</b>. Evidence-based; unknowns marked <b>Needs Validation</b>.</div>
</header>
<nav class="toc">
  <a href="#summary">Summary</a><a href="#pages">Pages</a><a href="#templates">Templates</a><a href="#blocks">Blocks</a><a href="#global">Global</a><a href="#integ">Integrations</a><a href="#migration">Migration</a><a href="#estimates">Estimates</a><a href="#notes">Assumptions / Risks</a><a href="#files">Files</a>
</nav>
<div class="wrap">

<section id="summary">
<h2 class="sec">Summary</h2>
<div class="flow">
  <span class="step">${pages.length} URLs</span><span class="arr">→</span>
  <span class="step">${edsReps.length} live pages</span><span class="arr">→</span>
  <span class="step">${templates.length} templates</span><span class="arr">→</span>
  <span class="step">${BLOCKS.length} blocks</span><span class="arr">→</span>
  <span class="step">${totalVariations} variations</span><span class="arr">→</span>
  <span class="step">${INTEG.length} integrations</span><span class="arr">→</span>
  <span class="step">${CONTENT_HRS}h migration</span><span class="arr">→</span>
  <span class="step" style="background:#dcfce7;border-color:#a7e0bd">${TOTAL_HRS}h total</span>
</div>
<div class="kpis">
  ${kpi(pages.length, 'URLs in list')}
  ${kpi(edsReps.length, 'Distinct live pages')}
  ${kpi(agg.redirected, 'Redirects')}
  ${kpi(templates.length, 'Templates', true)}
  ${kpi(BLOCKS.length, 'Blocks', true)}
  ${kpi(totalVariations, 'Variations', true)}
  ${kpi(INTEG.length, 'Integrations')}
  ${kpi(BLOCK_DEV_HRS + 'h', 'Block dev', true)}
  ${kpi(CONTENT_HRS + 'h', 'Content migration', true)}
  ${kpi(TOTAL_HRS + 'h', 'Total', true)}
</div>
<p class="lead">The <code>/en</code> set is <b>content/marketing-heavy</b> (Explore, Discover, Academy) with minimal commerce (1 shop-home page in scope). ${pages.length} source URLs include <b>${agg.redirected} redirects</b> that collapse to <b>${edsReps.length} distinct live pages</b> across <b>${templates.length} templates</b>, built from <b>${BLOCKS.length} reusable blocks (${totalVariations} variations)</b>. Answers: <b>(1)</b> ~${templates.length} unique templates · <b>(2)</b> ${BLOCKS.length} blocks / ${totalVariations} variations · <b>(3)</b> ${INTEG.length} integrations · <b>(4)</b> build ≈ ${SETUP_HRS + BLOCK_DEV_HRS + INTEG_HRS}h (setup + block dev + integrations) · <b>(5)</b> content migration ≈ ${CONTENT_HRS}h · <b>(6)</b> total <b>${TOTAL_HRS}h</b> · <b>(7)</b> see Assumptions/Risks.</p>
</section>

<section id="pages">
<h2 class="sec">Pages <span class="found">(${pages.length} URLs — traceability)</span></h2>
<div class="controls">
  <input type="text" id="pfilter" placeholder="Filter by URL…" oninput="filterPages()" size="30">
  <select id="ptpl" onchange="filterPages()"><option value="">All templates</option>${templates.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}<option value="unavailable">(unavailable)</option></select>
  <label style="font-size:12px"><input type="checkbox" id="predir" onchange="filterPages()"> redirected only</label>
  <span class="found" id="pcount"></span>
</div>
<div class="tablewrap"><table id="ptable"><thead><tr><th>URL (final)</th><th>Template</th><th>Blocks</th><th>Integrations</th><th>Complexity</th><th>Migration</th></tr></thead><tbody>${pagesRows}</tbody></table></div>
</section>

<section id="templates">
<h2 class="sec">Templates <span class="found">(${templates.length})</span></h2>
<p class="lead">Unique page structures (informational — template scaffolding is absorbed into block development in the consolidated estimate). Effort shown is Expected hours.</p>
<table><thead><tr><th>Template</th><th class="num">Pages</th><th>Example URLs</th><th>Blocks</th><th>Complexity</th><th class="num">Estimate (hrs)</th></tr></thead>
<tbody>${templateRows}
<tr class="total-row"><td>TOTAL — ${templates.length} templates</td><td class="num">${edsReps.length}</td><td colspan="3"></td><td class="num">${pdCell(templatePD)}</td></tr></tbody></table>
</section>

<section id="blocks">
<h2 class="sec">Blocks <span class="found">(${BLOCKS.length} · ${totalVariations} variations · built once)</span></h2>
<p class="lead">Reusable EDS blocks. Visual differences are captured as <b>variations</b>, not duplicate blocks. Usage = distinct live pages where the block appears.</p>
<table><thead><tr><th>Block</th><th>Variations</th><th class="num">Usage</th><th>Example URLs</th><th>Complexity</th><th class="num">Estimate (hrs)</th></tr></thead>
<tbody>${blockRows}
<tr class="total-row"><td>TOTAL — ${BLOCKS.length} blocks</td><td class="num">${totalVariations} var.</td><td class="num">—</td><td colspan="2"></td><td class="num">${pdCell(blockPD)}</td></tr></tbody></table>
</section>

<section id="global">
<h2 class="sec">Global Components</h2>
<table><thead><tr><th>Component</th><th>Complexity</th><th class="num">Estimate (hrs)</th></tr></thead>
<tbody>${globalRows}
<tr class="total-row"><td>TOTAL — ${GLOBAL.length} global components</td><td>—</td><td class="num">${pdCell(globalPD)}</td></tr></tbody></table>
</section>

<section id="integ">
<h2 class="sec">Third-Party Integrations <span class="found">(${INTEG.length})</span></h2>
<p class="lead">"Pages" = pages where observed. Items assumed from the /en-us live-network capture are marked <span class="tag nv">Needs Validation</span>.</p>
<table><thead><tr><th>Integration</th><th class="num">Pages</th><th>Purpose</th><th>EDS Approach</th><th>Complexity</th><th class="num">Estimate (hrs)</th></tr></thead>
<tbody>${integRows}
<tr class="total-row"><td>TOTAL — ${INTEG.length} integrations</td><td class="num">—</td><td colspan="2"></td><td>—</td><td class="num">${pdCell(integPD)}</td></tr></tbody></table>
</section>

<section id="migration">
<h2 class="sec">Content Migration</h2>
<p class="lead">Pages classified by method (indicative sizing — the consolidated estimate carries the agreed <b>300h</b> for content migration). Rates are assumptions (see below).</p>
<div class="cols">
<div><h4 style="margin:4px 0;font-size:14px">By method</h4>
<table><thead><tr><th>Method</th><th class="num">Pages</th><th class="num">Rate</th><th class="num">Execution (hrs)</th></tr></thead><tbody>${migMethodRows}
<tr class="total-row"><td>Execution subtotal</td><td class="num">${edsReps.length}</td><td class="num">—</td><td class="num">${pdCell(migExecPD)}</td></tr></tbody></table></div>
<div><h4 style="margin:4px 0;font-size:14px">By stream (tooling + execution + remediation + QA)</h4>
<table><thead><tr><th>Stream</th><th class="num">Estimate (hrs)</th></tr></thead><tbody>${migStreamRows}
<tr class="total-row"><td>Migration TOTAL</td><td class="num">${pdCell(migPD)}</td></tr></tbody></table></div>
</div>
</section>

<section id="estimates">
<h2 class="sec">Estimates <span class="found">(Expected hours · 8h/day basis)</span></h2>
<table><thead><tr><th>Area</th><th class="num">Expected (hrs)</th></tr></thead>
<tbody>${estRows}
<tr class="grand"><td>TOTAL (hours)</td><td class="num">${TOTAL_HRS}</td></tr></tbody></table>
<p class="lead"><b>Total ≈ ${TOTAL_HRS} hours</b> — development + content migration only. Setup ${SETUP_HRS}h · block development ${BLOCK_DEV_HRS}h (includes global components) · integrations ${INTEG_HRS}h (as analysed) · content migration ${CONTENT_HRS}h. Reusable blocks are counted once; page volume (${edsReps.length} live pages) is absorbed in content migration.</p>
</section>

<section id="notes">
<h2 class="sec">Assumptions · Risks · Unknowns · Needs Validation</h2>
<div class="cols">
<div class="card"><h4>Assumptions</h4><ul>${li(ASSUMPTIONS)}</ul></div>
<div class="card"><h4>Risks</h4><ul>${li(RISKS)}</ul></div>
<div class="card"><h4>Unknowns</h4><ul>${li(UNKNOWNS)}</ul></div>
<div class="card"><h4>Needs Validation</h4><ul>${li(NEEDS_VAL)}</ul></div>
</div>
</section>

<section id="files">
<h2 class="sec">Supporting Files</h2>
<div class="dl">
  <a href="pages.csv">pages.csv</a><a href="templates.csv">templates.csv</a><a href="blocks.csv">blocks.csv</a>
  <a href="integrations.csv">integrations.csv</a><a href="migration.csv">migration.csv</a><a href="estimates.csv">estimates.csv</a>
  <a href="data/pages.json">pages.json</a><a href="data/aggregates.json">aggregates.json</a>
</div>
</section>

<footer>Dentsply Sirona /en → EDS · Discovery dashboard · Generated 2026-08-19 · ${pages.length} URLs analyzed · ${edsReps.length} live pages · Effort in hours (8h/day), planning-grade.</footer>
</div>
<script>
function filterPages(){
  var q=document.getElementById('pfilter').value.toLowerCase();
  var tpl=document.getElementById('ptpl').value;
  var red=document.getElementById('predir').checked;
  var rows=document.querySelectorAll('#ptable tbody tr.prow'),shown=0;
  rows.forEach(function(r){
    var okq=r.textContent.toLowerCase().indexOf(q)>-1;
    var okt=!tpl||r.getAttribute('data-tpl')===tpl;
    var okr=!red||r.getAttribute('data-red')==='true';
    var vis=okq&&okt&&okr;r.style.display=vis?'':'none';if(vis)shown++;
  });
  document.getElementById('pcount').textContent=shown+' shown';
}
filterPages();
</script>
</body></html>`;

fs.writeFileSync(path.join(OUT, 'dashboard.html'), html);
fs.writeFileSync(path.join(DATA, 'estimate-model.json'), JSON.stringify({ templates, blocks: BLOCKS, global: GLOBAL, integrations: INTEG, migration: { migRows, MIG_STREAMS }, estimate: EST_HRS, totalHours: TOTAL_HRS, counts: { urls: pages.length, livePages: edsReps.length, templates: templates.length, blocks: BLOCKS.length, variations: totalVariations, integrations: INTEG.length } }, null, 2));

console.log('Wrote dashboard.html + 6 CSVs + estimate-model.json');
console.log('URLs', pages.length, '| live pages', edsReps.length, '| templates', templates.length, '| blocks', BLOCKS.length, '| variations', totalVariations, '| integrations', INTEG.length);
console.log('ESTIMATE (Expected hours):', EST_HRS.map(([n, h]) => `${n}=${h}`).join(' | '), '| TOTAL', TOTAL_HRS);
