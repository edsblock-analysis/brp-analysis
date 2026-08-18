// Build the all-in-one SUMMARY report for Dentsply Sirona → EDS.
// Condenses everything (estimate, blocks, templates, integrations, assumptions) into one
// shareable page, with links out to the detailed reports. Covers the live 1,141 pages only
// (404/403/loop excluded everywhere). Reconciles exactly with the detailed report via model JSON.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT = path.join(ROOT, 'dentsplysirona-report');
const m = JSON.parse(fs.readFileSync(path.join(OUT, 'data', 'estimate-model.json'), 'utf8'));
const scan = JSON.parse(fs.readFileSync(path.join(OUT, 'data', 'external-scan.json'), 'utf8'));
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cx = (c) => `<span class="cx cx-${c.replace(/\s/g, '')}">${esc(c)}</span>`;
const R = m.rollup;

const kpi = (n, l, alt) => `<div class="kpi${alt ? ' alt' : ''}"><div class="n">${n}</div><div class="l">${l}</div></div>`;

// ---- Blocks (content + commerce) ----
const blockRows = m.blocks.map((b) => `<tr><td><b>${esc(b.name)}</b></td><td class="num">${b.pages}</td><td class="num">${b.nVar}</td><td>${cx(b.cx)}</td><td class="num">${b.hrs}h</td></tr>`).join('')
  + m.commerceBlocks.map((b) => `<tr><td><b>${esc(b.name)}</b> <span class="cbadge">commerce</span></td><td class="num">${b.pages}</td><td class="num">${b.nVar}</td><td>${cx(b.cx)}</td><td class="num">${b.hrs}h</td></tr>`).join('');
const blockTotalHrs = R.blockHrs + R.commerceHrs;

// ---- Templates ----
const tmplRows = m.templates.map((t) => `<tr><td><b>${esc(t.name)}</b>${t.commerce ? ' <span class="cbadge">commerce</span>' : ''}</td><td class="num">${t.n}</td><td class="num">${(t.n / m.livePages * 100).toFixed(1)}%</td><td>${cx(t.cx)}</td><td class="num">${t.hrs}h</td></tr>`).join('');

// ---- Integrations (in-scope estimated + full-inventory highlights) ----
const integRows = m.integrations.map((r) => `<tr><td><b>${esc(r.name)}</b></td><td class="num">${r.pages}</td><td>${esc(r.purpose)}</td><td>${esc(r.strategy)}</td><td class="num">${r.days * R.HPD}h</td></tr>`).join('');

// Full 29-integration highlights (from the dedicated report) — grouped, concise
const INTEG_HIGHLIGHTS = [
  ['Platform / Commerce', 'Adobe AEM Sites (source CMS) · SAP Hybris + Adobe CIF GraphQL dispatcher · Coveo (search + commerce PLP + recommendations)'],
  ['Analytics (site-wide)', 'Adobe Launch (tag manager + digitalData) · Adobe Analytics · ContentSquare (session recording/heatmaps) · Heap · Google Analytics / GTM'],
  ['Marketing', 'Google Ads + DoubleClick (conversion + remarketing, AW-876574706)'],
  ['Payment (checkout)', 'SnapPay (ACH) · CardConnect / Fiserv (card tokenizer)'],
  ['CRM / Support', 'Salesforce CRM + Live Agent chat · AEM Forms (native lead forms) · reCAPTCHA v3'],
  ['Consent / Media', 'OneTrust (consent) · Adobe Scene7 / Dynamic Media (DAM) · YouTube / Vimeo embeds'],
  ['Commerce add-on', 'Zoovu (guided selling / product advisor)'],
  ['External apps (linked out)', 'DS Core · SureSmile · SuccessFactors (careers) · Cvent (events) · Order Digital Solutions · Egnyte · EthicsPoint · dsqform.com'],
];
const runtimeNote = 'ContentSquare, Heap, Google Ads/DoubleClick and Zoovu are injected at runtime by Adobe Launch and do NOT appear in static HTML — they were caught via live Playwright network capture.';

// ---- Assumptions (condensed, scope-critical) ----
const scopeBadge = (s) => { const cls = /Out of/.test(s) ? 'sc-out' : /Confirm/.test(s) ? 'sc-conf' : 'sc-in'; return `<span class="scope ${cls}">${esc(s)}</span>`; };
const ASSUMPTIONS = [
  ['Commerce cart/checkout/account journey not yet seen', 'The authenticated commerce journey (cart→checkout→payment→order/account) is auth-gated and could not be exercised. The Cart/Checkout/My-Account block is a high-side <b>300h placeholder</b> pending a guided walkthrough with DS — scope may move materially once the journey is confirmed.', 'Confirm'],
  ['Commerce storefront (Hybris) stays external; APIs reused', `${m.content.commercePages.toLocaleString()} commerce pages run on SAP Hybris via the Adobe CIF GraphQL dispatcher. EDS commerce blocks consume the existing GraphQL/CIF APIs for display; the transactional storefront (cart/checkout/account/loyalty) remains Hybris and is linked, not rebuilt.`, 'Confirm'],
  ['Payment gateways out of scope', 'SnapPay (ACH) and CardConnect/Fiserv (card tokenizer) live in the Hybris checkout; no PCI-scoped payment work on the EDS side.', 'Out of Scope'],
  ['Coveo search/PLP re-wired, not rebuilt', 'EDS search + listing blocks call the existing Coveo org and reuse the searchkey token service; index/relevance owned by DS search team.', 'In Scope (reuse API)'],
  ['Analytics & marketing re-instated as observed', 'Adobe Launch + GTM re-added; the digitalData data layer is reproduced so ContentSquare/Heap/Analytics/Google Ads keep firing. New tracking/data-layer design is separate.', 'Confirm'],
  ['Consent gates non-essential tags', 'OneTrust re-added in the delayed phase with the same config; consent gates analytics/marketing.', 'In Scope'],
  ['Native forms rebuilt; CRM routing preserved', 'AEM Forms lead/contact forms rebuilt as EDS form blocks with reCAPTCHA v3 and the same Salesforce/email routing; external forms (dsqform.com) linked out.', 'Confirm'],
  ['Scene7 / DAM referenced without re-mastering', '~13.9k Scene7 image refs; kept on Scene7 or served via EDS optimized delivery, no re-mastering.', 'Confirm'],
  ['External SaaS apps linked, not rebuilt', 'DS Core, SureSmile, SuccessFactors, Cvent, Order Digital Solutions, Egnyte, EthicsPoint remain separate apps; EDS links out.', 'Out of Scope'],
  ['Scope is /en-us; other locales reuse blocks', 'Blocks/templates built once for en-US; per-locale content translation excluded.', 'Out of Scope (other locales)'],
  ['SEO redirect parity', `${m.redirects} source URLs redirect to canonical targets; recreate the redirect map in EDS.`, 'In Scope'],
  ['Dead/archived URLs excluded', 'Non-live (404/403/redirect-loop) URLs are excluded from all counts and effort; recreate only if DS confirms.', 'Out of Scope'],
  ['Design parity, not redesign', 'EDS reproduces the current design; no redesign included.', 'Out of Scope'],
  ['Planning-grade estimate', 'Numbers are for discussion, not a fixed bid; commerce drives the biggest variance.', 'In Scope'],
];
const assumeRows = ASSUMPTIONS.map((a) => `<tr><td>${a[1]}</td><td>${scopeBadge(a[2])}</td></tr>`).join('');
// actually render with a short label column
const assumeRows2 = ASSUMPTIONS.map((a) => `<tr><td><b>${esc(a[0])}</b><div class="found">${a[1]}</div></td><td>${scopeBadge(a[2])}</td></tr>`).join('');

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dentsply Sirona → EDS · Executive Summary</title>
<style>
:root{--brand:#00a0df;--ink:#0b0f19;--edge:#e2e6ee;--blue:#0067a0;--muted:#5b6472;--navy:#002d5b;--green:#0b7a3b}
*{box-sizing:border-box}body{margin:0;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:#f4f6fa}
header.hero{background:linear-gradient(135deg,#002d5b,#004a86 60%,#0067a0);color:#fff;padding:44px 40px 38px}
header.hero h1{margin:0 0 8px;font-size:27px;letter-spacing:-.5px}header.hero .sub{color:#bcd6ea;font-size:14.5px;max-width:1000px}
header.hero .badge{display:inline-block;background:var(--brand);color:#00243f;font-weight:700;padding:3px 11px;border-radius:5px;font-size:12px;margin-bottom:14px;letter-spacing:.5px}
nav.toc{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--edge);z-index:40;padding:10px 24px;display:flex;flex-wrap:wrap;gap:4px 16px;font-size:13px}
nav.toc a{color:var(--muted);text-decoration:none;white-space:nowrap}nav.toc a:hover{color:var(--blue)}
.wrap{max-width:1180px;margin:0 auto;padding:0 24px 70px}
section{background:#fff;border:1px solid var(--edge);border-radius:14px;padding:24px 28px;margin:20px 0;box-shadow:0 1px 3px rgba(10,15,25,.05)}
h2.sec{font-size:20px;margin:0 0 4px;padding-bottom:9px;border-bottom:3px solid var(--brand);display:inline-block}
.lead{color:#28303d;max-width:1000px;font-size:14px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin:18px 0}
.kpi{background:linear-gradient(160deg,#f8fafc,#eef2f9);border:1px solid var(--edge);border-radius:12px;padding:16px}
.kpi .n{font-size:24px;font-weight:800;color:var(--blue);line-height:1}.kpi .l{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-top:6px}
.kpi.big .n{color:var(--green)}
table{border-collapse:collapse;width:100%;font-size:13px;margin:10px 0}
th,td{border:1px solid var(--edge);padding:7px 9px;text-align:left;vertical-align:top}
th{background:#f0f3f8;font-weight:700}td.num,th.num{text-align:center;white-space:nowrap}tr:nth-child(even){background:#fafbfd}
.cx{padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;display:inline-block}
.cx-Low{background:#dcfce7;color:#166534}.cx-Medium{background:#fef9c3;color:#854d0e}.cx-High{background:#ffedd5;color:#9a3412}.cx-VeryHigh{background:#ede9fe;color:#5b21b6}
.total-row td{background:#002d5b!important;color:#fff;font-weight:800}.subtotal td{background:#eef2f9!important;font-weight:700}.grand td{background:var(--green)!important;color:#fff;font-weight:800;font-size:15px}
td.ai{font-weight:700;color:var(--green)}
.cbadge{display:inline-block;background:var(--blue);color:#fff;font-size:10px;font-weight:800;padding:1px 7px;border-radius:20px;margin-left:6px;text-transform:uppercase}
.scope{padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;display:inline-block}
.sc-in{background:#dcfce7;color:#166534}.sc-out{background:#fee2e2;color:#991b1b}.sc-conf{background:#fef3c7;color:#92400e}
.found{color:var(--muted);font-size:11.5px}
.callout{background:#eff5ff;border-left:4px solid var(--blue);padding:10px 14px;border-radius:6px;font-size:13px;margin:12px 0}
.note{background:#fff8e6;border-left:4px solid #d99400;padding:10px 14px;border-radius:6px;font-size:13px;margin:12px 0}
.links{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
.links a{font-size:13px;background:#eef2f9;border:1px solid #dfe6f1;color:#1a4bcc;padding:6px 13px;border-radius:20px;text-decoration:none;font-weight:600}
.links a:hover{background:var(--blue);color:#fff}
.ig dt{font-weight:700;color:var(--navy);margin-top:8px;font-size:13px}.ig dd{margin:1px 0 0;font-size:12.5px;color:#28303d}
a{color:#1a4bcc}
footer{text-align:center;color:var(--muted);font-size:12px;padding:24px}
@media print{nav.toc{display:none}section{break-inside:avoid;box-shadow:none}a{color:inherit}}
</style></head><body>
<header class="hero">
<div class="badge">ADOBE EDGE DELIVERY SERVICES · EXECUTIVE SUMMARY</div>
<h1>Dentsply Sirona → EDS · Executive Summary</h1>
<div class="sub">One-page summary of the migration of <code>www.dentsplysirona.com/en-us</code> to Adobe Edge Delivery Services, for estimation and customer discussion. Covers the <b>${m.livePages.toLocaleString()} live pages</b> (dead/archived URLs excluded). Current stack: <b>AEM Sites (Core Components) + SAP Hybris commerce + Scene7 + Adobe Launch + Coveo</b>. Effort in hours (8h/person-day), planning-grade. Detailed reports linked in each section.</div>
</header>
<nav class="toc">
  <a href="#top">Top-line</a><a href="#estimate">Estimate</a><a href="#blocks">Blocks</a><a href="#templates">Templates</a><a href="#integ">Integrations</a><a href="#assume">Assumptions</a><a href="#links">Detailed reports</a>
</nav>
<div class="wrap">

<section id="top">
<h2 class="sec">Top-line</h2>
<div class="kpis">
  ${kpi(m.livePages.toLocaleString(), 'Live pages')}
  ${kpi(m.templatesCount, 'Templates')}
  ${kpi(m.totalBlocks, 'Blocks', true)}
  ${kpi(m.totalVariations, 'Variations', true)}
  ${kpi('29', 'Integrations')}
  ${kpi(R.buildSubtotal.toLocaleString() + 'h', 'Development', true)}
  ${kpi(R.contentHrs.toLocaleString() + 'h', 'Content migration', true)}
  ${kpi(R.grand.toLocaleString() + 'h', 'Grand total', true)}
</div>
<p class="lead">Dentsply Sirona is an <b>AEM Sites</b> marketing + <b>SAP Hybris</b> commerce site. Blocks are read from the AEM <code>cmp-*</code> markup and templates from <code>meta[name=template]</code>, so the inventory is evidence-based. <b>Grand total ${R.grand.toLocaleString()}h ≈ ${Math.round(R.grand / R.HPD).toLocaleString()} person-days</b> (Development ${R.buildSubtotal.toLocaleString()}h + Content migration ${R.contentHrs.toLocaleString()}h).</p>
<div class="note"><b>Biggest scope driver &amp; caveat:</b> the authenticated <b>cart / checkout / my-account journey has not been seen</b> (auth-gated). It is carried as a high-side <b>300h placeholder</b>; the number may move materially once DS walks us through the live journey. Commerce overall (Hybris + CIF GraphQL + payments) is the key scope decision.</div>
</section>

<section id="estimate">
<h2 class="sec">Estimate roll-up</h2>
<table><thead><tr><th>Category</th><th class="num">Hours</th><th>Notes</th></tr></thead><tbody>
<tr><td>Project setup / Foundation</td><td class="num ai">${R.foundationHrs}h</td><td class="found">Repo, tokens, decoration, SEO, analytics/consent, commerce scaffolding</td></tr>
<tr><td>Block development (content)</td><td class="num ai">${R.blockHrs}h</td><td class="found">${m.blocks.length} content blocks</td></tr>
<tr><td>Commerce block development</td><td class="num ai">${R.commerceHrs}h</td><td class="found">${m.commerceBlocks.length} Hybris-backed blocks (incl. 300h cart/checkout/account placeholder)</td></tr>
<tr><td>Template development</td><td class="num ai">${R.templateHrs}h</td><td class="found">${m.templatesCount} templates</td></tr>
<tr><td>3rd-party integrations</td><td class="num ai">${R.integHrs}h</td><td class="found">${m.integrations.length} integrations carrying build effort (commerce counted above)</td></tr>
<tr><td>Production readiness</td><td class="num ai">${R.prodReadyHrs}h</td><td class="found">Perf/CWV, a11y, cross-browser, launch hardening</td></tr>
<tr class="subtotal"><td>Development subtotal</td><td class="num ai">${R.buildSubtotal.toLocaleString()}h</td><td class="found">≈ ${Math.round(R.buildSubtotal / R.HPD)} person-days</td></tr>
<tr class="total-row"><td>Content migration</td><td class="num">${R.contentHrs}h</td><td>~${m.content.totalImgs.toLocaleString()} images · ${m.content.totalPdf.toLocaleString()} PDF links · ${m.livePages.toLocaleString()} pages QA</td></tr>
<tr class="grand"><td>GRAND TOTAL</td><td class="num">${R.grand.toLocaleString()}h</td><td>≈ ${Math.round(R.grand / R.HPD).toLocaleString()} person-days</td></tr>
</tbody></table>
</section>

<section id="blocks">
<h2 class="sec">Block inventory</h2>
<p class="lead"><b>${m.totalBlocks} blocks</b> (${m.blocks.length} content + ${m.commerceBlocks.length} commerce) · <b>${m.totalVariations} variations</b>. "Pages" = live pages where the block appears.</p>
<table><thead><tr><th>Block</th><th class="num">Pages</th><th class="num">Var.</th><th>Complexity</th><th class="num">Effort</th></tr></thead>
<tbody>${blockRows}
<tr class="total-row"><td>TOTAL — ${m.totalBlocks} blocks</td><td class="num">—</td><td class="num">${m.totalVariations}</td><td>—</td><td class="num">${blockTotalHrs.toLocaleString()}h</td></tr></tbody></table>
<div class="links"><a href="dentsplysirona-eds-report.html#blockdetail">▸ Block detail (full report)</a></div>
</section>

<section id="templates">
<h2 class="sec">Templates</h2>
<p class="lead"><b>${m.templatesCount} templates</b> across ${m.livePages.toLocaleString()} live pages, from the AEM <code>meta[name=template]</code>.</p>
<table><thead><tr><th>Template</th><th class="num">Pages</th><th class="num">% Site</th><th>Complexity</th><th class="num">Effort</th></tr></thead>
<tbody>${tmplRows}
<tr class="total-row"><td>TOTAL — ${m.templatesCount} templates</td><td class="num">${m.livePages.toLocaleString()}</td><td class="num">100%</td><td>—</td><td class="num">${R.templateHrs}h</td></tr></tbody></table>
<div class="links"><a href="dentsplysirona-eds-report.html#templates">▸ Templates (full report)</a></div>
</section>

<section id="integ">
<h2 class="sec">Third-party integrations</h2>
<p class="lead"><b>29 integrations across 15 categories</b> were verified via an exhaustive static scan of all pages plus <b>live Playwright network capture</b>. ${esc(runtimeNote)}</p>
<dl class="ig">${INTEG_HIGHLIGHTS.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
<h4 style="margin:14px 0 4px;font-size:14px">Integrations carrying build effort in this estimate</h4>
<table><thead><tr><th>Integration</th><th class="num">Pages</th><th>Purpose</th><th>Migration strategy</th><th class="num">Effort</th></tr></thead>
<tbody>${integRows}
<tr class="total-row"><td>Integration effort (commerce counted in blocks)</td><td class="num">—</td><td colspan="2"></td><td class="num">${R.integHrs}h</td></tr></tbody></table>
<div class="links"><a href="third-party-integrations.html">▸ Full third-party integrations report (all 29 + evidence + ${scan.externalHosts.length} hosts)</a></div>
</section>

<section id="assume">
<h2 class="sec">Assumptions &amp; scope boundaries</h2>
<p class="lead">Scope-defining assumptions. The commerce journey and the runtime analytics stack are the two areas to confirm with DS.</p>
<table><thead><tr><th>Assumption</th><th>Scope</th></tr></thead><tbody>${assumeRows2}</tbody></table>
<div class="links"><a href="assumptions.html">▸ Full assumptions report (20 items, API reuse vs rebuild)</a></div>
</section>

<section id="links">
<h2 class="sec">Detailed reports</h2>
<div class="links">
  <a href="dentsplysirona-eds-report.html">▸ Full migration estimation &amp; discovery report (all ${m.livePages.toLocaleString()} live pages)</a>
  <a href="third-party-integrations.html">▸ Third-party integrations report</a>
  <a href="assumptions.html">▸ Assumptions &amp; scope report</a>
</div>
<div class="links" style="margin-top:10px">
  <a href="data/pages.json">◦ pages.json</a>
  <a href="data/aggregates.json">◦ aggregates.json</a>
  <a href="data/external-scan.json">◦ external-scan.json</a>
  <a href="data/runtime-network.json">◦ runtime-network.json</a>
  <a href="data/estimate-model.json">◦ estimate-model.json</a>
</div>
</section>

<footer>Dentsply Sirona → EDS · Executive summary · Generated 2026-08-18 · ${m.livePages.toLocaleString()} live pages · Effort in hours (8h/day), planning-grade · Reconciles with the detailed report.</footer>
</div></body></html>`;

fs.writeFileSync(path.join(OUT, 'summary.html'), html);
console.log('Wrote dentsplysirona-report/summary.html', (html.length / 1024).toFixed(1) + 'KB');
console.log('Grand', R.grand, 'h | commerce', R.commerceHrs, 'h | live pages', m.livePages);
