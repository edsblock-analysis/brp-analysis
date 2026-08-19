// Extract per-page signals from cached ds-com (/en) HTML. Observed signals only.
// AEM Core Components: block = cmp-<root>; template = meta[name=template].
// Non-200 pages excluded from block/template analysis (their body is the 404 root-page).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT = path.join(ROOT, 'ds-com-report');
const CACHE = path.join(OUT, 'pages_cache');
const flog = JSON.parse(fs.readFileSync(path.join(OUT, 'data', 'fetch-log.json'), 'utf8'));
const logByUrl = Object.fromEntries(flog.map((r) => [r.url, r]));

const RAW = fs.readFileSync(path.join(ROOT, 'ds-com.txt'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
const seen = new Set();
const URLS = RAW.filter((u) => { const k = u.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });

const keyFor = (u) => u.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 200) + '.html';
const dec = (s) => (s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();
const strip = (s) => dec((s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
const attr = (tag, n) => { const m = tag.match(new RegExp(`${n}="([^"]*)"`, 'i')); return m ? m[1] : null; };
const norm = (u) => (u || '').split('?')[0].replace(/\.html$/, '').replace(/\/$/, '');

const CMP_RE = /cmp-([a-z0-9]+)/g;
const INTEGRATIONS = {
  'Adobe DTM / Launch': /assets\.adobedtm\.com|_satellite/,
  'Adobe Scene7 / Dynamic Media': /scene7\.com|\/is\/image\//i,
  'SAP Hybris Commerce': /hybris/i,
  'Commerce GraphQL API': /\/api\/graphql/i,
  'Coveo Search': /coveo/i,
  'reCAPTCHA': /recaptcha|grecaptcha|isReCaptcha/i,
  OneTrust: /onetrust|cookielaw\.org|OptanonConsent/i,
  YouTube: /youtube\.com\/embed|youtube-nocookie|youtu\.be/i,
  Vimeo: /player\.vimeo\.com|vimeo\.com\/video/i,
  'Google Fonts': /fonts\.googleapis\.com/i,
};

const pages = [];
const cmpGlobal = {}; const tmplGlobal = {}; const integGlobal = {};
const distinctFinal = new Map(); // norm(final) -> [source urls]

for (const u of URLS) {
  const meta = logByUrl[u] || {};
  const okStatus = meta.status === 200 || meta.status === 'cached';
  const finalUrl = meta.finalUrl || u;
  const rec0 = { url: u, path: u.replace(/^https?:\/\/www\.dentsplysirona\.com/, ''), finalUrl, finalPath: finalUrl.replace(/^https?:\/\/www\.dentsplysirona\.com/, ''), redirected: !!meta.redirected, status: meta.status };
  if (!okStatus) { pages.push({ ...rec0, error: `non-200 (${meta.status})`, template: '(unavailable)', components: {}, blocks: {}, integrations: [] }); continue; }

  let html = '';
  try { html = fs.readFileSync(path.join(CACHE, keyFor(u)), 'utf8'); } catch { pages.push({ ...rec0, error: 'no-cache', template: '(unavailable)', components: {}, blocks: {}, integrations: [] }); continue; }

  const head = html.split(/<\/head>/i)[0] || html;
  const bStart = html.indexOf('>', html.search(/<body/i));
  const body = bStart > 0 ? html.slice(bStart) : html;
  const title = strip((head.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]);
  const template = (head.match(/<meta[^>]+name="template"[^>]+content="([^"]*)"/i) || [])[1] || '(none)';
  const mdTag = (head.match(/<meta[^>]+name="description"[^>]*>/i) || [])[0];
  const metaDesc = mdTag ? dec(attr(mdTag, 'content')) : '';
  const canonicalTag = (head.match(/<link[^>]+rel="canonical"[^>]*>/i) || [])[0];
  const canonical = canonicalTag ? attr(canonicalTag, 'href') : null;

  const classText = (body.match(/class="[^"]*"/gi) || []).join(' ');
  const cmp = {}; let m; CMP_RE.lastIndex = 0;
  while ((m = CMP_RE.exec(classText))) cmp[m[1]] = (cmp[m[1]] || 0) + 1;
  const h1s = [...body.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((x) => strip(x[1])).filter(Boolean);

  const blocks = {
    hero: cmp.hero || 0, teaser: (cmp.teaser || 0) + (cmp.promocard || 0), carousel: (cmp.carousel || 0) + (cmp.swiper || 0),
    tabs: cmp.tabs || 0, accordion: cmp.accordion || 0, step: cmp.step || 0,
    cards: (cmp.iconcard || 0) + (cmp.downloadcard || 0) + (cmp.videocard || 0) + (cmp.imagetile || 0) + (cmp.jumpcard || 0) + (cmp.card || 0),
    tier: cmp.tier || 0, list: cmp.list || 0, alphabetical: cmp.alphabetical || 0,
    xf: cmp.experiencefragment || 0, embed: cmp.embed || 0, banner: (cmp.banner || 0) + (cmp.bannerad || 0),
    search: (cmp.coveoresults || 0) + (cmp.searchresults || 0), breadcrumb: cmp.breadcrumb || 0,
    videos: (body.match(/<video|youtube\.com\/embed|player\.vimeo/gi) || []).length,
    forms: (body.match(/<form[\s>]/gi) || []).length, imgs: (body.match(/<img[\s>]/gi) || []).length,
    pdfLinks: (body.match(/href="[^"]+\.pdf(\?[^"]*)?"/gi) || []).length,
    scene7: (html.match(/scene7\.com|\/is\/image\//gi) || []).length,
  };
  const integs = []; for (const [name, re] of Object.entries(INTEGRATIONS)) if (re.test(html)) integs.push(name);

  const rec = { ...rec0, title, template, canonical, metaDesc, metaDescLen: metaDesc.length, h1count: h1s.length, components: cmp, blocks, integrations: integs, bytes: html.length };
  pages.push(rec);
  const nf = norm(finalUrl);
  if (!distinctFinal.has(nf)) distinctFinal.set(nf, []);
  distinctFinal.get(nf).push(u);
  for (const [k, v] of Object.entries(cmp)) { cmpGlobal[k] = cmpGlobal[k] || { count: 0, pages: 0 }; cmpGlobal[k].count += v; cmpGlobal[k].pages += 1; }
  for (const k of integs) integGlobal[k] = (integGlobal[k] || 0) + 1;
  tmplGlobal[template] = (tmplGlobal[template] || 0) + 1;
}

// distinct-final page representatives (first source per final) for block/template counts w/o double counting
const repByFinal = {};
for (const p of pages) { if (p.error) continue; const nf = norm(p.finalUrl); if (!repByFinal[nf]) repByFinal[nf] = p; }
const reps = Object.values(repByFinal);
const tmplReps = {}; for (const p of reps) tmplReps[p.template] = (tmplReps[p.template] || 0) + 1;

fs.writeFileSync(path.join(OUT, 'data', 'pages.json'), JSON.stringify(pages, null, 2));
fs.writeFileSync(path.join(OUT, 'data', 'aggregates.json'), JSON.stringify({
  totalUrls: pages.length,
  okUrls: pages.filter((p) => !p.error).length,
  unavailable: pages.filter((p) => p.error).length,
  redirected: pages.filter((p) => p.redirected).length,
  distinctFinalPages: reps.length,
  templatesByUrl: Object.fromEntries(Object.entries(tmplGlobal).sort((a, b) => b[1] - a[1])),
  templatesByDistinctPage: Object.fromEntries(Object.entries(tmplReps).sort((a, b) => b[1] - a[1])),
  cmpComponents: Object.fromEntries(Object.entries(cmpGlobal).sort((a, b) => b[1].pages - a[1].pages)),
  integrations: Object.fromEntries(Object.entries(integGlobal).sort((a, b) => b[1] - a[1])),
}, null, 2));

console.log('URLs:', pages.length, '| OK:', pages.filter((p) => !p.error).length, '| unavailable:', pages.filter((p) => p.error).length, '| redirected:', pages.filter((p) => p.redirected).length);
console.log('Distinct final pages:', reps.length);
console.log('\n=== TEMPLATES (by distinct final page) ===');
for (const [k, v] of Object.entries(tmplReps).sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(4), k);
console.log('\n=== INTEGRATIONS ===');
for (const [k, v] of Object.entries(integGlobal).sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(4), k);
