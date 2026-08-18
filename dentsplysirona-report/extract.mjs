// Extract per-page signals from cached dentsplysirona HTML. Observed signals only.
// AEM Core Components site: block signal = cmp-<root> classes; template = meta[name=template].
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT = path.join(ROOT, 'dentsplysirona-report');
const CACHE = path.join(OUT, 'pages_cache');
const fetchLog = JSON.parse(fs.readFileSync(path.join(OUT, 'data', 'fetch-log.json'), 'utf8'));
const logByUrl = Object.fromEntries(fetchLog.map((r) => [r.url, r]));

const RAW = fs.readFileSync(path.join(ROOT, 'dentsplysirona.txt'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
const seen = new Set();
const URLS = RAW.filter((u) => { const k = u.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });

const keyFor = (u) => u.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 200) + '.html';
const dec = (s) => (s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();
const strip = (s) => dec((s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
const attr = (tag, n) => { const m = tag.match(new RegExp(`${n}="([^"]*)"`, 'i')); return m ? m[1] : null; };

// Meaningful block-level cmp- roots (exclude pure utility/atomic ones from "block" inventory,
// but still count them). We keep the raw counts and classify later.
const CMP_RE = /cmp-([a-z0-9]+)/g;

const INTEGRATIONS = {
  'Adobe DTM / Launch': /assets\.adobedtm\.com|_satellite|launch-[A-Za-z0-9]+/,
  'Adobe Analytics': /omtrdc\.net|AppMeasurement|\bdemdex\b|sc\.omtrdc/i,
  'Adobe Scene7 / Dynamic Media': /scene7\.com|s7d\d\.scene7|\/is\/image\//i,
  'Adobe Target': /at\.js|target\.js|\bmbox\b|tt\.omtrdc/i,
  'SAP Hybris Commerce': /hybris/i,
  'Commerce GraphQL API': /\/api\/graphql/i,
  'Coveo Search': /coveo/i,
  'reCAPTCHA': /recaptcha|grecaptcha|isReCaptcha/i,
  OneTrust: /onetrust|cookielaw\.org|otSDKStub|OptanonConsent/i,
  'Google Tag Manager': /googletagmanager\.com|GTM-[A-Z0-9]{5,}/,
  'Google Analytics (gtag)': /gtag\(|www\.google-analytics\.com|\bG-[A-Z0-9]{8,}\b/,
  YouTube: /youtube\.com\/embed|youtube-nocookie|youtu\.be/i,
  Vimeo: /player\.vimeo\.com|vimeo\.com\/video/i,
  Brightcove: /brightcove|players\.brightcove/i,
  Wistia: /wistia/i,
  'Google Fonts': /fonts\.googleapis\.com/i,
  Typekit: /use\.typekit\.net/i,
  'Facebook (social link)': /facebook\.com\/dentsplysirona/i,
  'LinkedIn (social link)': /linkedin\.com\/company\/dentsplysirona/i,
  'Instagram (social link)': /instagram\.com\/dentsplysirona/i,
};

const pages = [];
const cmpGlobal = {}; const tmplGlobal = {}; const integGlobal = {}; const rtGlobal = {};

for (const u of URLS) {
  const meta = logByUrl[u] || {};
  const file = path.join(CACHE, keyFor(u));
  const okStatus = meta.status === 200 || meta.status === 'cached';
  // Exclude non-200 (404/403/redirect-loop) pages from block/template analysis — their
  // cached body is an error page (all report the 404 "root-page" template) and would pollute counts.
  if (!okStatus) {
    pages.push({ url: u, path: u.replace('https://www.dentsplysirona.com', '').replace(/\.html$/, ''), status: meta.status, finalUrl: meta.finalUrl || u, redirected: !!meta.redirected, error: `non-200 (${meta.status})`, template: '(unavailable)' });
    continue;
  }
  let html = '';
  try { html = fs.readFileSync(file, 'utf8'); } catch {
    pages.push({ url: u, status: meta.status, error: 'no-cache', template: '(unavailable)' });
    continue;
  }

  const head = html.split(/<\/head>/i)[0] || html;
  const bStart = html.indexOf('>', html.search(/<body/i));
  const body = bStart > 0 ? html.slice(bStart) : html;

  const title = strip((head.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]);
  const template = (head.match(/<meta[^>]+name="template"[^>]+content="([^"]*)"/i) || [])[1] || '(none)';
  const canonicalTag = (head.match(/<link[^>]+rel="canonical"[^>]*>/i) || [])[0];
  const canonical = canonicalTag ? attr(canonicalTag, 'href') : null;
  const mdTag = (head.match(/<meta[^>]+name="description"[^>]*>/i) || [])[0];
  const metaDesc = mdTag ? dec(attr(mdTag, 'content')) : '';
  const ogType = (head.match(/<meta[^>]+property="og:type"[^>]+content="([^"]*)"/i) || [])[1] || '';

  const classText = (body.match(/class="[^"]*"/gi) || []).join(' ');
  const cmp = {};
  let m; CMP_RE.lastIndex = 0;
  while ((m = CMP_RE.exec(classText))) cmp[m[1]] = (cmp[m[1]] || 0) + 1;

  // AEM resource types (from data-cmp / data-layer @type)
  const rts = {};
  for (const mm of html.matchAll(/ds-aem-webapp\/components\/([a-z0-9/_-]+)/g)) rts[mm[1]] = (rts[mm[1]] || 0) + 1;

  const h1s = [...body.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((x) => strip(x[1])).filter(Boolean);
  const h2c = (body.match(/<h2[^>]*>/gi) || []).length;

  const blocks = {
    carousels: (cmp.carousel || 0) + (cmp.swiper || 0),
    accordions: cmp.accordion || 0,
    tabs: cmp.tabs || 0,
    hero: cmp.hero || 0,
    teaser: cmp.teaser || 0,
    experienceFragment: cmp.experiencefragment || 0,
    videos: (body.match(/<video|youtube\.com\/embed|player\.vimeo|brightcove/gi) || []).length,
    iframes: (body.match(/<iframe/gi) || []).length,
    forms: (body.match(/<form[\s>]/gi) || []).length,
    imgs: (body.match(/<img[\s>]/gi) || []).length,
    scene7: (html.match(/scene7\.com|\/is\/image\//gi) || []).length,
    pdfLinks: (body.match(/href="[^"]+\.pdf(\?[^"]*)?"/gi) || []).length,
    tables: (body.match(/<table[\s>]/gi) || []).length,
    lists: cmp.list || 0,
    cards: (cmp.downloadcard || 0) + (cmp.iconcard || 0) + (cmp.promocard || 0) + (cmp.videocard || 0) + (cmp.card || 0) + (cmp.coursecard || 0) + (cmp.jumpcard || 0) + (cmp.imagetile || 0),
    search: (cmp.coveoresults || 0) + (cmp.searchresults || 0),
    steps: cmp.step || 0,
    banners: (cmp.banner || 0) + (cmp.bannerad || 0),
    embed: cmp.embed || 0,
  };

  const integs = [];
  for (const [name, re] of Object.entries(INTEGRATIONS)) if (re.test(html)) integs.push(name);

  const rec = {
    url: u, path: u.replace('https://www.dentsplysirona.com', '').replace(/\.html$/, ''),
    status: meta.status, finalUrl: meta.finalUrl || u, redirected: !!meta.redirected,
    title, template, canonical, metaDesc, metaDescLen: metaDesc.length, ogType,
    h1: h1s, h1count: h1s.length, h2count: h2c,
    depth: u.replace('https://www.dentsplysirona.com/', '').replace(/\.html$/, '').split('/').filter(Boolean).length,
    cmp, resourceTypes: rts, blocks, integrations: integs, bytes: html.length,
  };
  pages.push(rec);

  for (const [k, v] of Object.entries(cmp)) { cmpGlobal[k] = cmpGlobal[k] || { count: 0, pages: 0 }; cmpGlobal[k].count += v; cmpGlobal[k].pages += 1; }
  for (const [k, v] of Object.entries(rts)) { rtGlobal[k] = rtGlobal[k] || { count: 0, pages: 0 }; rtGlobal[k].count += v; rtGlobal[k].pages += 1; }
  for (const k of integs) integGlobal[k] = (integGlobal[k] || 0) + 1;
  tmplGlobal[template] = (tmplGlobal[template] || 0) + 1;
}

fs.writeFileSync(path.join(OUT, 'data', 'pages.json'), JSON.stringify(pages, null, 2));
fs.writeFileSync(path.join(OUT, 'data', 'aggregates.json'), JSON.stringify({
  totalUrls: pages.length,
  analyzed: pages.filter((p) => !p.error).length,
  unavailable: pages.filter((p) => p.error).length,
  templates: Object.fromEntries(Object.entries(tmplGlobal).sort((a, b) => b[1] - a[1])),
  cmpComponents: Object.fromEntries(Object.entries(cmpGlobal).sort((a, b) => b[1].pages - a[1].pages)),
  resourceTypes: Object.fromEntries(Object.entries(rtGlobal).sort((a, b) => b[1].pages - a[1].pages)),
  integrations: Object.fromEntries(Object.entries(integGlobal).sort((a, b) => b[1] - a[1])),
}, null, 2));

console.log('URLs:', pages.length, '| analyzed:', pages.filter((p) => !p.error).length, '| unavailable:', pages.filter((p) => p.error).length);
console.log('\n=== TEMPLATES ===');
for (const [k, v] of Object.entries(tmplGlobal).sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(5), k);
console.log('\n=== INTEGRATIONS (pages) ===');
for (const [k, v] of Object.entries(integGlobal).sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(5), k);
