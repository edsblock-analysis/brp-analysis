// Build the dedicated Assumptions & Scope Boundaries report for Dentsply Sirona → EDS.
// Every assumption ties to observed evidence. Includes API-integration scope points explicitly.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT = path.join(ROOT, 'dentsplysirona-report');
const flog = JSON.parse(fs.readFileSync(path.join(OUT, 'data', 'fetch-log.json'), 'utf8'));
const pages = JSON.parse(fs.readFileSync(path.join(OUT, 'data', 'pages.json'), 'utf8'));
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ok = pages.filter((p) => !p.error);
const nonOk = flog.filter((r) => r.status === 'ERROR' || (typeof r.status === 'number' && r.status >= 400));
const redirects = flog.filter((r) => r.redirected).length;
const commerce = ok.filter((p) => ['product-page', 'category-page', 'shop-brand-page-template', 'shop-page-template', 'shop-promotions-template', 'my-account-content-page', 'my-account-landing-page'].includes(p.template)).length;

const scopeBadge = (s) => { const cls = /Out of/.test(s) ? 'sc-out' : /Confirm|Requires/.test(s) ? 'sc-conf' : 'sc-in'; return `<span class="scope ${cls}">${esc(s)}</span>`; };

// [area, observed, assumption, recommendation, scope]
const A = [
  ['Commerce storefront (Hybris) stays external', `${commerce.toLocaleString()} pages (PDP, PLP/category, shop, cart, checkout, my-account, loyalty) are driven by SAP Hybris via the Adobe CIF GraphQL dispatcher (adobeioruntime.net → hybris-graphql).`, 'The authenticated storefront application (cart, checkout, account, loyalty, practice management) REMAINS Hybris. EDS commerce blocks consume the existing GraphQL APIs client-side for display (PDP/PLP), but the transactional app is not rebuilt in EDS.', 'Confirm with DS exactly which commerce surfaces should render natively in EDS vs. stay in the Hybris storefront. This is the single biggest scope decision.', 'Requires Confirmation'],
  ['Commerce GraphQL / Adobe CIF API is reused, not rebuilt', 'EDS-facing commerce data flows through /api/graphql and 58919-cifintegration.adobeioruntime.net/.../hybris-graphql/dispatcher.', 'EDS commerce blocks CALL the existing GraphQL/CIF endpoints. No new commerce middleware or backend is built; the API contract is assumed stable and available.', 'DS provides API access, schema and rate/CORS allowances for the EDS origin. Any API changes are out of scope.', 'In Scope (reuse API)'],
  ['Payment gateways stay in the commerce app', 'Commerce config references SnapPay (ACH: snappayglobal.com) and CardConnect/Fiserv (card tokenizer: dentsply.cardconnect.com).', 'Payment capture/tokenization remains inside the Hybris checkout; EDS does not touch PCI-scoped payment flows.', 'Out of EDS scope. Keep in the commerce app; no PCI work assumed on the EDS side.', 'Out of Scope'],
  ['Coveo search/PLP is re-wired, not rebuilt', 'Coveo powers site search, type-ahead and commerce listing (org dentsplyinternationalproduction11rbzk734); tokens minted by /services/dentsply/coveo/searchkey per page type.', 'EDS search + listing blocks call the existing Coveo org and reuse the searchkey token service. Index configuration and relevance tuning remain with the DS search team.', 'Reuse the Coveo org + token service; confirm the searchkey service is exposed to the EDS origin. Reindexing/relevance out of scope.', 'In Scope (reuse API)'],
  ['Analytics & marketing tags re-instated as observed', 'Adobe Launch injects (at runtime) Adobe Analytics, ContentSquare, Heap, Google Ads/DoubleClick and GTM; all consent-gated by OneTrust. These are NOT in static HTML.', 'The estimate covers re-adding the Launch embed + GTM and rebuilding the digitalData data layer so existing tags keep firing. No new tracking design.', 'Rebuild data-layer parity is essential. Any new events, custom dimensions, or tag-manager rework is estimated separately. DS provides Launch/GTM/tag access.', 'Requires Confirmation'],
  ['digitalData data layer must be reproduced', 'ContentSquare/Heap/Analytics read a client-side digitalData object (site section, page category, page name, country, login state, product context).', 'EDS reproduces the same data-layer contract so runtime tags continue to work without vendor changes.', 'Treat the data layer as a first-class deliverable; validate each tag post-migration.', 'In Scope'],
  ['Consent (OneTrust) gates all non-essential tags', 'cdn-ukwest.onetrust.com + geolocation banner + "Your Privacy Choices" on every page.', 'OneTrust is re-added in the delayed phase with the same domain-script id; consent gates analytics/marketing.', 'Reuse the existing OneTrust config; confirm geo rules.', 'In Scope'],
  ['Scene7 / DAM assets referenced without re-mastering', '~13.9k Scene7 (/is/image/) references site-wide.', 'Images are referenced from Scene7 or moved to EDS optimized delivery without re-authoring/re-mastering originals.', 'Confirm whether DS wants to keep Scene7 URLs or serve via EDS. No re-mastering assumed.', 'Requires Confirmation'],
  ['Native forms rebuilt as EDS forms; CRM routing preserved', 'Contact/lead forms POST to AEM Forms (*.forms.html); verified live contact form (name/email/practice/phone/zip/topic); Salesforce + Live Agent present site-wide.', 'Native forms are rebuilt as EDS form blocks with the same fields, reCAPTCHA v3, and the same downstream routing (assumed Salesforce/email).', 'Confirm each form’s submission endpoint + CRM/email routing + reCAPTCHA keys. Some forms (product-issue → dsqform.com) are external and only linked.', 'Requires Confirmation'],
  ['reCAPTCHA v3 re-added on forms/search', 'Config "isReCaptchaV3Disabled":false site-wide.', 'reCAPTCHA v3 is re-added on EDS forms; keys supplied by DS.', 'DS provides reCAPTCHA site/secret keys.', 'In Scope'],
  ['CRM & live chat re-embedded (Salesforce)', 'service.force.com script site-wide; *.my.salesforce.com / *.salesforceliveagent.com on ~1164 pages.', 'The Salesforce chat/CRM snippet is re-embedded via a script/embed block; Salesforce remains the system of record.', 'Confirm chat deployment + form→CRM routing with DS.', 'In Scope (embed)'],
  ['External SaaS applications are linked, not rebuilt', 'DS Core (dscore.com), SureSmile (login.suresmile.com), SuccessFactors careers, Cvent events, Order Digital Solutions (Atlantis/Simplant), Egnyte, EthicsPoint, dsqform.com.', 'These are separate authenticated applications; EDS preserves outbound links and does not rebuild them.', 'Keep as external links. Any SSO/deep-link parity to confirm with DS.', 'Out of Scope'],
  ['Authenticated / account pages stay in commerce app', 'my-account, loyalty (One DS), practice management templates + shop/user paths.', 'Authenticated account/loyalty flows remain in the Hybris storefront; EDS links out.', 'Out of EDS content scope unless DS explicitly requests native rebuild.', 'Out of Scope'],
  ['Scope is the /en-us locale', 'All analyzed URLs are under /en-us; a languagenavigation component and country popup service exist.', 'Blocks/templates are built once for en-US; other locales reuse them. Per-locale content translation is excluded.', 'Confirm locale roll-out plan; translation handled separately.', 'Out of Scope (other locales)'],
  ['Zoovu guided-selling preserved as embed', 'Runtime "ZOOVU: Waiting for digitalData" on shop pages.', 'Zoovu advisor is preserved as a vendor embed/widget where used; not rebuilt.', 'Confirm which pages use Zoovu and whether it stays.', 'Requires Confirmation'],
  ['SEO redirect parity required', `${redirects} of ${flog.length.toLocaleString()} URLs redirect (301/308) to a canonical target.`, 'The redirect map is recreated in EDS so legacy URLs keep resolving.', 'Export the current redirect rules; recreate in EDS config at launch.', 'In Scope'],
  ['Dead / archived URLs excluded unless confirmed', `${nonOk.length} URLs in the list are unavailable (404/403/redirect-loop) — many under /shop, /academy, /archived-pages.`, 'These are treated as out of scope for migration. One redirect-loop (discover-by-category/preventive/contact.html) is a live defect on the source site.', 'DS confirms whether any dead URLs must be recreated; fix the redirect-loop at source.', 'Requires Confirmation'],
  ['Design parity, not redesign', 'Current AEM Core-Component design.', 'EDS reproduces the current design (pixel-reasonable parity); no redesign is included.', 'Any redesign is a separate workstream.', 'Out of Scope'],
  ['New blocks/variations beyond this inventory are separate', 'Inventory built from the analyzed 1,141 pages.', 'Blocks/variations discovered later (unreleased pages, campaigns, other locales) are estimated separately.', 'Re-baseline if new templates/blocks appear.', 'Requires Confirmation'],
  ['Estimates are planning-grade', 'Derived from evidence + standard EDS build effort (8h/day).', 'Numbers are planning-grade for discussion, not a fixed bid; commerce scope drives the biggest variance.', 'Refine in a discovery workshop with DS.', 'In Scope'],
];

const rows = A.map((a) => `<tr><td><b>${esc(a[0])}</b></td><td>${esc(a[1])}</td><td>${esc(a[2])}</td><td>${esc(a[3])}</td><td>${scopeBadge(a[4])}</td></tr>`).join('\n');
const counts = A.reduce((m, a) => { const k = /Out of/.test(a[4]) ? 'out' : /Confirm|Requires/.test(a[4]) ? 'conf' : 'in'; m[k] = (m[k] || 0) + 1; return m; }, {});

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dentsply Sirona → EDS · Assumptions &amp; Scope</title>
<style>
:root{--brand:#00a0df;--ink:#0b0f19;--edge:#e2e6ee;--blue:#0067a0;--muted:#5b6472;--navy:#002d5b}
*{box-sizing:border-box}body{margin:0;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:#f4f6fa}
header.hero{background:linear-gradient(135deg,#002d5b,#004a86 60%,#0067a0);color:#fff;padding:40px}
header.hero h1{margin:0 0 8px;font-size:26px}header.hero .sub{color:#bcd6ea;font-size:14px;max-width:1000px}
header.hero .badge{display:inline-block;background:var(--brand);color:#00243f;font-weight:700;padding:3px 11px;border-radius:5px;font-size:12px;margin-bottom:12px;letter-spacing:.5px}
.wrap{max-width:1200px;margin:0 auto;padding:24px}
section{background:#fff;border:1px solid var(--edge);border-radius:14px;padding:22px 26px;margin:18px 0;box-shadow:0 1px 3px rgba(10,15,25,.05)}
h2.sec{font-size:19px;margin:0 0 6px;padding-bottom:8px;border-bottom:3px solid var(--brand);display:inline-block}
.lead{color:#28303d;max-width:1040px;font-size:14px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:16px 0}
.kpi{background:linear-gradient(160deg,#f8fafc,#eef2f9);border:1px solid var(--edge);border-radius:12px;padding:14px}
.kpi .n{font-size:23px;font-weight:800;color:var(--blue)}.kpi .l{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-top:5px}
table{border-collapse:collapse;width:100%;font-size:13px;margin:10px 0}
th,td{border:1px solid var(--edge);padding:7px 9px;text-align:left;vertical-align:top}
th{background:#f0f3f8;font-weight:700}tr:nth-child(even){background:#fafbfd}
.scope{padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;display:inline-block}
.sc-in{background:#dcfce7;color:#166534}.sc-out{background:#fee2e2;color:#991b1b}.sc-conf{background:#fef3c7;color:#92400e}
.callout{background:#eff5ff;border-left:4px solid var(--blue);padding:10px 14px;border-radius:6px;font-size:13px;margin:12px 0}
footer{text-align:center;color:var(--muted);font-size:12px;padding:20px}
@media print{section{break-inside:avoid;box-shadow:none}}
</style></head><body>
<header class="hero">
<div class="badge">ADOBE EDGE DELIVERY SERVICES · ASSUMPTIONS &amp; SCOPE</div>
<h1>Dentsply Sirona → EDS · Assumptions &amp; Scope Boundaries</h1>
<div class="sub">Scope-defining assumptions for the migration, each tied to observed evidence. Special attention to <b>API integrations</b> — even where an API is only <i>consumed</i> (commerce GraphQL/CIF, Coveo, payment gateways), the boundary between "reuse the existing API" and "rebuild" is stated explicitly so the estimate and the customer conversation are unambiguous.</div>
</header>
<div class="wrap">
<section>
<h2 class="sec">At a glance</h2>
<div class="kpis">
  <div class="kpi"><div class="n">${A.length}</div><div class="l">Assumptions</div></div>
  <div class="kpi"><div class="n">${counts.in || 0}</div><div class="l">In scope</div></div>
  <div class="kpi"><div class="n">${counts.conf || 0}</div><div class="l">Requires confirmation</div></div>
  <div class="kpi"><div class="n">${counts.out || 0}</div><div class="l">Out of scope</div></div>
</div>
<div class="callout"><b>Headline:</b> the commerce surface (Hybris + CIF GraphQL + payment gateways) and the runtime analytics/marketing stack (Adobe Launch → ContentSquare, Heap, Google Ads) are the two areas where scope must be pinned down with Dentsply Sirona. The working assumption is <b>reuse existing APIs and keep transactional/authenticated apps external</b>, with EDS owning the content, presentation, forms, search UI, and data-layer parity.</div>
</section>
<section>
<h2 class="sec">Assumptions &amp; Scope Boundaries</h2>
<table><thead><tr><th>Area</th><th>Observed</th><th>Assumption</th><th>Recommendation</th><th>Scope</th></tr></thead>
<tbody>${rows}</tbody></table>
</section>
<footer>Dentsply Sirona → EDS · Assumptions &amp; scope · Generated 2026-08-18 · Evidence-based; commerce &amp; analytics scope to confirm with DS in discovery.</footer>
</div></body></html>`;

fs.writeFileSync(path.join(OUT, 'assumptions.html'), html);
console.log('Wrote assumptions.html', (html.length / 1024).toFixed(1) + 'KB', '|', A.length, 'assumptions', counts);
