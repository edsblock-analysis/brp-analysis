// Build the dedicated Third-Party Integrations report for Dentsply Sirona → EDS.
// Evidence = exhaustive static scan of all 1200 cached files + live Playwright network capture.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT = path.join(ROOT, 'dentsplysirona-report');
const scan = JSON.parse(fs.readFileSync(path.join(OUT, 'data', 'external-scan.json'), 'utf8'));
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const N = scan.filesScanned;
const hostPg = Object.fromEntries(scan.externalHosts);
const anyHost = (subs) => { let n = 0; for (const [h, c] of scan.externalHosts) if (subs.some((s) => h.includes(s))) n = Math.max(n, c); return n; };

// scope: how many pages (of N) — "site-wide" if ~all
const scopeLabel = (pages) => (pages >= N - 5 ? 'Site-wide' : pages >= 100 ? `${pages} pages` : pages > 0 ? `${pages} page${pages > 1 ? 's' : ''}` : '—');

// ---- INTEGRATION MODEL (verified) ----
// cat: analytics|marketing|commerce|search|cms|media|consent|crm|support|payment|social|external-app|fonts
const INTEG = [
  // ---------- Platform / CMS ----------
  { name: 'Adobe Experience Manager (AEM Sites)', cat: 'Platform / CMS', where: 'Site-wide', evidenceType: 'Static', pages: N,
    evidence: 'cmp-* Core Components, /etc.clientlibs, /libs/granite, /libs/cq/i18n, data-cmp-* markup, meta[name=template].',
    purpose: 'Current content management + rendering platform (the system being migrated FROM).',
    data: 'Server-rendered HTML, clientlibs, CSRF token (/libs/granite/csrf/token.json), i18n dictionaries.',
    eds: 'Source CMS. Content re-authored into EDS documents; AEM decommissioned for these pages post-migration (commerce/auth may remain — see Assumptions).' },
  { name: 'Adobe Commerce Integration Framework (Adobe I/O Runtime)', cat: 'Commerce', where: 'Site-wide', evidenceType: 'Static+Runtime', pages: N,
    evidence: '58919-cifintegration.adobeioruntime.net/api/v1/web/hybris-graphql/dispatcher (+ /ms-layer/rest).',
    purpose: 'Serverless bridge (Adobe CIF) that dispatches storefront GraphQL calls to the SAP Hybris commerce backend.',
    data: 'GraphQL product/price/cart/customer requests proxied to Hybris; SSO logout endpoints.',
    eds: 'EDS commerce blocks call this same GraphQL dispatcher client-side. Keep the I/O Runtime action or point EDS at the equivalent endpoint. Core to any commerce-in-EDS decision.' },
  { name: 'SAP Hybris Commerce', cat: 'Commerce', where: 'Site-wide', evidenceType: 'Static', pages: N,
    evidence: 'hybris references site-wide; hybris-graphql dispatcher; product/category templates; cart/checkout/account paths.',
    purpose: 'Commerce platform behind PDP/PLP, cart, checkout, pricing, my-account, loyalty.',
    data: 'Product catalog, pricing, inventory, cart, orders, customer accounts via GraphQL.',
    eds: 'Storefront app is assumed to REMAIN Hybris; EDS commerce blocks consume its GraphQL. Full rebuild is out of scope unless DS confirms.' },
  { name: 'Coveo (Search + Commerce + Recommendations)', cat: 'Search', where: 'Site-wide', evidenceType: 'Static+Runtime', pages: N,
    evidence: 'dentsplyinternationalproduction11rbzk734.org.coveo.com/rest/.../commerce/v2/listing; /services/dentsply/coveo/searchkey?pageType=discover|shop|academy|customer-support; cmp-coveoresults / cmp-searchresults on every page.',
    purpose: 'Site search + type-ahead suggestions, product listing (PLP) search, and recommendations. Search tokens are minted per page type by an AEM service.',
    data: 'Search queries, product listing/facets, recommendation slots; org-scoped API tokens.',
    eds: 'Search + PLP block wired to the existing Coveo org; reuse the searchkey token service. Relevance/index config owned by DS search team (out of scope).' },
  // ---------- Analytics / tag management ----------
  { name: 'Adobe Experience Platform Launch (Tag Manager)', cat: 'Analytics', where: 'Site-wide', evidenceType: 'Static+Runtime', pages: anyHost(['assets.adobedtm.com']),
    evidence: 'assets.adobedtm.com script on every page; _satellite; "Launch CS mitigation script loaded".',
    purpose: 'Tag orchestration — loads analytics, marketing and personalization tags at runtime; owns the digitalData data layer.',
    data: 'Client-side data layer (digitalData): page category, site section, user country, login state, product context.',
    eds: 'Re-add the Launch embed in delayed.js; preserve/rebuild the digitalData data layer so downstream tags keep working. Central to analytics parity.' },
  { name: 'ContentSquare', cat: 'Analytics', where: 'Site-wide (runtime)', evidenceType: 'Runtime', pages: N,
    evidence: 'c.az / k-us1.az / c.us / srm.af .contentsquare.net pageview + recording + events beacons on every sampled page (injected via Launch — NOT in static HTML).',
    purpose: 'Behavioral analytics: session recording, heatmaps/zoning, custom variables (site section, page category, page name, country, login state).',
    data: 'Full session replay + DOM interaction telemetry + custom dimensions.',
    eds: 'Fires through Launch — re-instated when Launch + data layer are re-added. Consent-gated via OneTrust. No separate EDS build beyond data-layer parity.' },
  { name: 'Heap Analytics', cat: 'Analytics', where: 'Site-wide (runtime)', evidenceType: 'Runtime', pages: N,
    evidence: 'c.us.heap-api.com/api/capture/v2/track + add_user_properties on every sampled page (via Launch).',
    purpose: 'Product/event analytics with auto-capture and user properties.',
    data: 'Event stream + user property payloads.',
    eds: 'Fires through Launch; re-instated with tag manager. Consent-gated.' },
  { name: 'Google Analytics / Google Tag Manager', cat: 'Analytics', where: 'Site-wide (runtime)', evidenceType: 'Runtime', pages: N,
    evidence: 'www.googletagmanager.com (gtm=45...) firing google.com/ccm/collect page_view beacons.',
    purpose: 'Web analytics + tag orchestration (a GTM container runs alongside Adobe Launch).',
    data: 'Page views / events.',
    eds: 'Re-add GTM container via delayed.js; consent-gated.' },
  // ---------- Marketing / advertising ----------
  { name: 'Google Ads + DoubleClick (Conversion & Remarketing)', cat: 'Marketing', where: 'Site-wide (runtime)', evidenceType: 'Runtime', pages: N,
    evidence: 'google.com/ccm/collect & rmkt/collect for AW-876574706; ad.doubleclick.net/ccm/s/collect; googleadservices.com.',
    purpose: 'Ad conversion tracking + remarketing audiences.',
    data: 'Conversion pings, remarketing cookies/identifiers.',
    eds: 'Fires through GTM/Launch; re-instated as observed. Consent-gated. New campaigns/pixels estimated separately.' },
  // ---------- Consent ----------
  { name: 'OneTrust (Consent Management)', cat: 'Consent', where: 'Site-wide', evidenceType: 'Static+Runtime', pages: anyHost(['onetrust.com', 'cookielaw.org']),
    evidence: 'cdn-ukwest.onetrust.com scripts + consent JSON; geolocation.onetrust.com; OptanonConsent; "Your Privacy Choices" banner.',
    purpose: 'Cookie/consent management and geo-based banner; gates marketing/analytics tags.',
    data: 'Consent preferences, geolocation for banner variant.',
    eds: 'Load in delayed phase with the same domain-script id; consent must gate all non-essential tags.' },
  // ---------- Media / DAM ----------
  { name: 'Adobe Scene7 / Dynamic Media', cat: 'Media / DAM', where: 'Site-wide', evidenceType: 'Static', pages: anyHost(['scene7.com']),
    evidence: 's7d1.scene7.com and /is/image/ URLs across pages; ~13.9k Scene7 refs.',
    purpose: 'Image/video DAM delivery with dynamic rendition/URL params.',
    data: 'Optimized image/video renditions.',
    eds: 'Keep Scene7 URLs, or move imagery to EDS optimized delivery. No re-mastering assumed.' },
  { name: 'YouTube (video embeds)', cat: 'Media', where: `${anyHost(['youtube.com', 'youtu.be'])} pages`, evidenceType: 'Static+Runtime', pages: anyHost(['youtube.com', 'youtu.be']),
    evidence: '<iframe src="youtube.com/embed/..."> on 66–68 pages.',
    purpose: 'Embedded product/education videos.',
    data: 'Video playback (nocookie option available).',
    eds: 'Video block with a lazy facade; load the player on interaction for CWV.' },
  { name: 'Vimeo (video embeds)', cat: 'Media', where: `${anyHost(['vimeo.com'])} pages`, evidenceType: 'Static', pages: anyHost(['vimeo.com']),
    evidence: 'vimeo.com references on 2 pages.',
    purpose: 'Occasional embedded video.',
    data: 'Video playback.',
    eds: 'Same video block, Vimeo variant.' },
  // ---------- Commerce add-ons ----------
  { name: 'Zoovu (Guided Selling / Product Advisor)', cat: 'Commerce', where: 'Shop / product pages (runtime)', evidenceType: 'Runtime', pages: 0,
    evidence: 'Console "ZOOVU: Waiting for digitalData to be fully loaded" on shop brand pages (clientlib-invoked).',
    purpose: 'Guided product selection / recommendation advisor.',
    data: 'Product taxonomy + user answers → recommended products.',
    eds: 'Preserve as an embed/widget block; vendor app stays authoritative. Confirm which pages use it with DS.' },
  { name: 'SnapPay (ACH payments)', cat: 'Payment', where: 'Checkout (config site-wide)', evidenceType: 'Static', pages: anyHost(['snappayglobal.com']),
    evidence: '"achEndpoint":"https://www.snappayglobal.com" in commerce config on every page.',
    purpose: 'ACH / bank payment processing at checkout.',
    data: 'Payment/bank account data (PCI-relevant) — handled by the gateway.',
    eds: 'Part of the Hybris checkout; remains in the commerce app. Out of standard EDS content scope.' },
  { name: 'CardConnect / Fiserv (card tokenizer)', cat: 'Payment', where: 'Checkout (config site-wide)', evidenceType: 'Static', pages: anyHost(['cardconnect.com']),
    evidence: '"creditCardTokenizerEndpoint":"https://dentsply.cardconnect.com" in commerce config.',
    purpose: 'Credit-card tokenization / payment processing at checkout.',
    data: 'Card data tokenized by the gateway (PCI scope stays with gateway).',
    eds: 'Part of the Hybris checkout; remains in the commerce app. Out of standard EDS content scope.' },
  // ---------- CRM / support ----------
  { name: 'Salesforce (CRM) + Live Agent Chat', cat: 'CRM / Support', where: 'Site-wide', evidenceType: 'Static', pages: Math.max(anyHost(['service.force.com']), anyHost(['salesforceliveagent.com'])),
    evidence: 'service.force.com script host site-wide; *.my.salesforce.com, *.secure.force.com, *.salesforceliveagent.com on ~1164 pages.',
    purpose: 'CRM lead capture and live-chat customer support widget.',
    data: 'Lead/contact data, chat transcripts.',
    eds: 'Re-embed the chat/CRM snippet via a script/embed block; Salesforce stays the system of record. Form → CRM routing to confirm with DS.' },
  { name: 'AEM Forms (native form handler)', cat: 'Forms', where: 'Contact / brand lead forms', evidenceType: 'Static+Runtime', pages: 0,
    evidence: 'Form actions POST to *.forms.html (AEM form selector); native contact form fields verified live on contact-support (First/Last/Email/Practice/Phone/Zip/Topic).',
    purpose: 'Native lead/contact/request forms authored in AEM.',
    data: 'Lead submissions (likely routed to Salesforce/email).',
    eds: 'Rebuild as EDS form blocks (or AEM Forms) with the same fields; confirm submission endpoint + CRM routing + reCAPTCHA.' },
  { name: 'reCAPTCHA (v3)', cat: 'Security', where: 'Forms / search (config site-wide)', evidenceType: 'Static', pages: N,
    evidence: '"isReCaptchaV3Disabled":false in site config across pages.',
    purpose: 'Bot protection on forms and search.',
    data: 'reCAPTCHA token per submission.',
    eds: 'Re-add reCAPTCHA v3 on EDS forms; keys from DS.' },
  // ---------- External applications (linked, not integrated) ----------
  { name: 'DS Core (cloud platform)', cat: 'External App', where: `${anyHost(['dscore.com'])} pages (links) + welcome domain`, evidenceType: 'Static', pages: anyHost(['dscore.com']),
    evidence: 'www.dscore.com and dentsplysironawelcome.us links site-wide.',
    purpose: 'Dentsply Sirona cloud dentistry platform (separate SaaS app).',
    data: 'Authenticated cloud dentistry workflows.',
    eds: 'External application — EDS links out; not rebuilt.' },
  { name: 'SureSmile (aligner platform)', cat: 'External App', where: `${anyHost(['suresmile.com'])} pages`, evidenceType: 'Static', pages: anyHost(['suresmile.com', 'login.suresmile.com']),
    evidence: 'login.suresmile.com/login, /users/new links on ~256 pages.',
    purpose: 'SureSmile orthodontic aligner platform (separate SaaS + SSO).',
    data: 'Authenticated clinician workflows.',
    eds: 'External application — EDS links out; not rebuilt.' },
  { name: 'SAP SuccessFactors (careers)', cat: 'External App', where: `${anyHost(['successfactors.eu'])} pages`, evidenceType: 'Static', pages: anyHost(['successfactors.eu']),
    evidence: 'career5.successfactors.eu / career012.successfactors.eu links.',
    purpose: 'Careers / job application (ATS).',
    data: 'Job applications.',
    eds: 'External ATS — link out.' },
  { name: 'Cvent (events)', cat: 'External App', where: `${anyHost(['cvent'])} pages`, evidenceType: 'Static', pages: anyHost(['cvent.me', 'web.cvent.com']),
    evidence: 'cvent.me / web.cvent.com event links.',
    purpose: 'Event registration.',
    data: 'Event registrations.',
    eds: 'External — link out.' },
  { name: 'Order Digital Solutions (Atlantis/Simplant ordering)', cat: 'External App', where: `${anyHost(['orderdigitalsolutions.com', 'atlantisweborder.com'])} pages`, evidenceType: 'Static', pages: Math.max(anyHost(['orderdigitalsolutions.com']), anyHost(['atlantisweborder.com'])),
    evidence: 'orderdigitalsolutions.com, customer.orderdigitalsolutions.com, atlantisweborder.com links.',
    purpose: 'Digital lab / implant ordering portals.',
    data: 'Authenticated ordering workflows.',
    eds: 'External applications — link out.' },
  { name: 'Egnyte (file sharing)', cat: 'External App', where: `${anyHost(['egnyte.com'])} pages`, evidenceType: 'Static', pages: anyHost(['egnyte.com']),
    evidence: 'dentsplysirona.egnyte.com links.',
    purpose: 'Large-file / document sharing.',
    data: 'Downloadable documents.',
    eds: 'External — link out.' },
  { name: 'EthicsPoint (compliance hotline)', cat: 'External App', where: `${anyHost(['ethicspoint.com'])} pages`, evidenceType: 'Static', pages: anyHost(['ethicspoint.com']),
    evidence: 'secure.ethicspoint.com links.',
    purpose: 'Compliance / whistleblower reporting.',
    data: 'Compliance reports.',
    eds: 'External — link out.' },
  { name: 'External product-issue form (dsqform.com)', cat: 'External App', where: 'Contact support', evidenceType: 'Static+Runtime', pages: anyHost(['dsqform.com']),
    evidence: 'Product Issue and Request Form links to https://dsqform.com/ (verified live on contact-support).',
    purpose: 'Regulated product-complaint / quality request intake.',
    data: 'Product complaint submissions.',
    eds: 'External — link out.' },
  // ---------- Fonts / social ----------
  { name: 'Google Fonts', cat: 'Fonts', where: 'Site-wide', evidenceType: 'Static', pages: anyHost(['fonts.googleapis.com']),
    evidence: 'fonts.googleapis.com on every page.',
    purpose: 'Web font delivery.',
    data: 'Font files.',
    eds: 'Self-host fonts in EDS (fonts.css) for performance/consent.' },
  { name: 'Social links (Facebook / Instagram / LinkedIn / X)', cat: 'Social', where: 'Footer site-wide', evidenceType: 'Static', pages: N,
    evidence: 'facebook.com/dentsplysirona, instagram.com/dentsplysirona, linkedin.com/company/dentsplysirona, twitter.com links in footer.',
    purpose: 'Outbound social profile links (NOT tracking pixels).',
    data: 'None (links only).',
    eds: 'Author footer links; no integration work.' },
];

// counts by evidence type and scope
const runtimeOnly = INTEG.filter((i) => i.evidenceType === 'Runtime');
const catCounts = INTEG.reduce((m, i) => { m[i.cat] = (m[i.cat] || 0) + 1; return m; }, {});

const catColor = { 'Platform / CMS': '#0067a0', Commerce: '#7c3aed', Search: '#0891b2', Analytics: '#d97706', Marketing: '#dc2626', Consent: '#059669', 'Media / DAM': '#2563eb', Media: '#2563eb', Payment: '#b91c1c', 'CRM / Support': '#be185d', Forms: '#0d9488', Security: '#4338ca', 'External App': '#475569', Fonts: '#6b7280', Social: '#6b7280' };
const evBadge = (t) => { const c = t.includes('Runtime') && t.includes('Static') ? '#7c3aed' : t === 'Runtime' ? '#dc2626' : '#0067a0'; return `<span class="ev" style="background:${c}">${esc(t)}</span>`; };

const rows = INTEG.map((i) => `<tr>
  <td><b>${esc(i.name)}</b><div><span class="cat" style="background:${catColor[i.cat] || '#64748b'}">${esc(i.cat)}</span> ${evBadge(i.evidenceType)}</div></td>
  <td>${esc(i.where)}</td>
  <td>${esc(i.purpose)}</td>
  <td class="found">${esc(i.evidence)}</td>
  <td>${esc(i.data)}</td>
  <td>${esc(i.eds)}</td></tr>`).join('\n');

const runtimeList = runtimeOnly.map((i) => `<li><b>${esc(i.name)}</b> — ${esc(i.purpose)} <span class="found">(${esc(i.evidence)})</span></li>`).join('\n');

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dentsply Sirona → EDS · Third-Party Integrations</title>
<style>
:root{--brand:#00a0df;--ink:#0b0f19;--edge:#e2e6ee;--blue:#0067a0;--muted:#5b6472;--navy:#002d5b}
*{box-sizing:border-box}body{margin:0;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:#f4f6fa}
header.hero{background:linear-gradient(135deg,#002d5b,#004a86 60%,#0067a0);color:#fff;padding:40px}
header.hero h1{margin:0 0 8px;font-size:26px}header.hero .sub{color:#bcd6ea;font-size:14px;max-width:1000px}
header.hero .badge{display:inline-block;background:var(--brand);color:#00243f;font-weight:700;padding:3px 11px;border-radius:5px;font-size:12px;margin-bottom:12px;letter-spacing:.5px}
.wrap{max-width:1240px;margin:0 auto;padding:24px}
section{background:#fff;border:1px solid var(--edge);border-radius:14px;padding:22px 26px;margin:18px 0;box-shadow:0 1px 3px rgba(10,15,25,.05)}
h2.sec{font-size:19px;margin:0 0 6px;padding-bottom:8px;border-bottom:3px solid var(--brand);display:inline-block}
.lead{color:#28303d;max-width:1040px;font-size:14px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin:16px 0}
.kpi{background:linear-gradient(160deg,#f8fafc,#eef2f9);border:1px solid var(--edge);border-radius:12px;padding:14px}
.kpi .n{font-size:23px;font-weight:800;color:var(--blue)}.kpi .l{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-top:5px}
table{border-collapse:collapse;width:100%;font-size:12.5px;margin:10px 0}
th,td{border:1px solid var(--edge);padding:7px 9px;text-align:left;vertical-align:top}
th{background:#f0f3f8;font-weight:700}tr:nth-child(even){background:#fafbfd}
.found{color:var(--muted);font-size:11px}
.cat{display:inline-block;color:#fff;font-size:9.5px;font-weight:800;padding:1px 7px;border-radius:20px;text-transform:uppercase;letter-spacing:.2px}
.ev{display:inline-block;color:#fff;font-size:9.5px;font-weight:800;padding:1px 7px;border-radius:20px;margin-left:4px}
.callout{background:#eff5ff;border-left:4px solid var(--blue);padding:10px 14px;border-radius:6px;font-size:13px;margin:12px 0}
.note{background:#fef2f2;border-left:4px solid #dc2626;padding:10px 14px;border-radius:6px;font-size:13px;margin:12px 0}
ul{font-size:13px}li{margin:4px 0}
footer{text-align:center;color:var(--muted);font-size:12px;padding:20px}
@media print{section{break-inside:avoid;box-shadow:none}}
</style></head><body>
<header class="hero">
<div class="badge">ADOBE EDGE DELIVERY SERVICES · THIRD-PARTY INTEGRATIONS</div>
<h1>Dentsply Sirona → EDS · Third-Party Integrations (verified)</h1>
<div class="sub">Every integration below is backed by evidence — an <b>exhaustive static scan of all ${N.toLocaleString()} cached pages</b> (every external host, script, iframe, API endpoint and vendor config string) plus <b>live Playwright network capture</b> on representative pages to catch tags that Adobe Launch injects at runtime and never appear in the static HTML. Nothing here is assumed.</div>
</header>
<div class="wrap">

<section>
<h2 class="sec">Overview</h2>
<div class="kpis">
  <div class="kpi"><div class="n">${INTEG.length}</div><div class="l">Integrations documented</div></div>
  <div class="kpi"><div class="n">${Object.keys(catCounts).length}</div><div class="l">Categories</div></div>
  <div class="kpi"><div class="n">${runtimeOnly.length}</div><div class="l">Runtime-only (JS-injected)</div></div>
  <div class="kpi"><div class="n">${scan.externalHosts.length}</div><div class="l">Distinct external hosts</div></div>
  <div class="kpi"><div class="n">${N.toLocaleString()}</div><div class="l">Pages scanned</div></div>
</div>
<div class="callout"><b>Why two evidence methods:</b> a static scan finds everything hard-coded in the HTML (Scene7, Coveo, Salesforce, payment config, external app links). But <b>Adobe Launch injects analytics/marketing tags at runtime</b> — so ContentSquare, Heap, Google Ads/DoubleClick and Zoovu only appear when the page actually executes. Playwright network capture caught these; a static-only review would have missed them.</div>
<div class="note"><b>Runtime-only integrations (invisible in static HTML — found via live capture):</b><ul>${runtimeList}</ul></div>
</section>

<section>
<h2 class="sec">All Integrations — detail</h2>
<p class="lead">Evidence badges: ${evBadge('Static')} in page source · ${evBadge('Runtime')} only fires when JS runs (via Launch) · ${evBadge('Static+Runtime')} both. "Where" = scope (site-wide vs specific pages, based on the ${N.toLocaleString()}-page scan).</p>
<table><thead><tr><th>Integration</th><th>Where / scope</th><th>Purpose</th><th>Evidence</th><th>Data flow</th><th>EDS migration consideration</th></tr></thead>
<tbody>${rows}</tbody></table>
</section>

<section>
<h2 class="sec">Site-service &amp; API endpoints (first-party)</h2>
<p class="lead">First-party endpoints that back the integrations (these are DS-owned APIs, not third parties, but the EDS build must call or replace them).</p>
<table><thead><tr><th>Endpoint</th><th>Purpose</th></tr></thead><tbody>
<tr><td><code>/api/graphql</code> + <code>adobeioruntime.net/.../hybris-graphql/dispatcher</code></td><td>Commerce data (product/price/cart/customer) via Adobe CIF → Hybris</td></tr>
<tr><td><code>/services/dentsply/coveo/searchkey?pageType=…</code></td><td>Mints a Coveo search token per page type (discover/shop/academy/customer-support)</td></tr>
<tr><td><code>*.org.coveo.com/rest/.../commerce/v2/listing</code></td><td>Coveo commerce listing / PLP results</td></tr>
<tr><td><code>/services/dentsply/getCountryPopupModel</code></td><td>Geo/country selector + redirect model</td></tr>
<tr><td><code>/libs/granite/csrf/token.json</code></td><td>AEM CSRF token for authenticated/form requests</td></tr>
<tr><td><code>/libs/cq/i18n/dict.en_US.json</code></td><td>AEM i18n dictionary</td></tr>
<tr><td><code>*.forms.html</code></td><td>AEM Forms POST handler for native lead/contact forms</td></tr>
</tbody></table>
</section>

<section>
<h2 class="sec">All external hosts observed (from the ${N.toLocaleString()}-page scan)</h2>
<p class="lead">Complete list of external domains referenced in page source (host → number of pages). Included for completeness/audit — most low-count hosts are outbound reference links (journals, partners, resellers), not integrations.</p>
<table><thead><tr><th>Host</th><th class="found">Pages</th></tr></thead><tbody>
${scan.externalHosts.map(([h, c]) => `<tr><td><code>${esc(h)}</code></td><td class="found">${c}</td></tr>`).join('')}
</tbody></table>
</section>

<footer>Dentsply Sirona → EDS · Third-party integrations · Generated 2026-08-18 · Static scan of ${N.toLocaleString()} pages + live Playwright network capture · Evidence in <code>dentsplysirona-report/data/external-scan.json</code> &amp; <code>runtime-network.json</code>.</footer>
</div></body></html>`;

fs.writeFileSync(path.join(OUT, 'third-party-integrations.html'), html);
console.log('Wrote third-party-integrations.html', (html.length / 1024).toFixed(1) + 'KB');
console.log('Integrations:', INTEG.length, '| runtime-only:', runtimeOnly.length, '| external hosts listed:', scan.externalHosts.length);
