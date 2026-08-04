// Extract structured per-page signals from cached HTML. No inference — only observed signals.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const CACHE = path.join(ROOT, 'report', 'pages_cache');
const URLS = fs.readFileSync(path.join(ROOT, 'analysis-urls.txt'), 'utf8')
  .split('\n').map((s) => s.trim()).filter(Boolean);

function keyFor(u) {
  return u.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 180) + '.html';
}
const dec = (s) => (s || '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();
const strip = (s) => dec((s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));

function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

// AEM Core Component signatures we care about (cmp-<name>__/ cmp-<name>)
const CMP_RE = /cmp-([a-z0-9]+(?:-[a-z0-9]+)*)/g;
// Custom block-level class roots seen on BRP (non cmp-)
const CUSTOM_HINTS = [
  'hero-block', 'segment-block', 'teaser', 'carousel', 'accordion', 'tabs', 'gallery',
  'slider', 'card', 'grid', 'spec', 'feature', 'download', 'faq', 'quote', 'video',
  'form', 'newsletter', 'map', 'dealer', 'filter', 'pagination', 'breadcrumb',
  'table', 'embed', 'promo', 'banner', 'cta', 'compare', 'configurator', 'modal',
  'timeline', 'statistic', 'social',
];

const INTEGRATIONS = {
  'Google Tag Manager': /googletagmanager\.com|GTM-[A-Z0-9]+/i,
  'Google Analytics (gtag)': /gtag\(|google-analytics\.com|G-[A-Z0-9]{6,}/,
  'Adobe DTM/Launch': /assets\.adobedtm\.com|_satellite|launch-[A-Za-z0-9]+\.min\.js/,
  'Adobe Analytics': /omtrdc\.net|AppMeasurement|s_code|\bdemdex\b/,
  'Adobe Target': /at\.js|target\.js|mbox|adobe\.target|tt\.omtrdc/i,
  'Adobe Scene7 / Dynamic Media': /scene7\.com|s7d\d\.scene7|\/is\/image\//i,
  'Adobe RUM (helix-rum)': /helix-rum|\.rum\/@adobe/i,
  'Dynatrace (ruxit)': /ruxitagentjs|dynatrace|dtrum/i,
  YouTube: /youtube\.com|youtu\.be|youtube-nocookie/i,
  Vimeo: /player\.vimeo\.com|vimeo\.com\/video/i,
  Brightcove: /brightcove|players\.brightcove/i,
  'Google Maps': /maps\.googleapis\.com|maps\.google\.com\/maps|google\.maps/i,
  OneTrust: /onetrust|cookielaw\.org|otBannerSdk/i,
  Cookiebot: /cookiebot/i,
  Typekit: /use\.typekit\.net/i,
  'Google Fonts': /fonts\.googleapis\.com/i,
  jQuery: /jquery(?:-|\.)[\d.]+(?:\.min)?\.js|jquery\.min\.js/i,
  Bootstrap: /bootstrap(?:\.bundle)?(?:\.min)?\.js|cdnjs.*bootstrap/i,
  Facebook: /connect\.facebook\.net|facebook\.com\/tr/i,
  'BRP DAM CDN': /cdn-dam\.brp\.com/i,
  'BRP Dealer Marketing (Azure)': /brpdealermarketing\.azureedge\.net/i,
  'Twitter/X': /platform\.twitter\.com|twitter\.com\/intent/i,
  Instagram: /instagram\.com\/embed|instagr\.am/i,
  Marketo: /marketo\.com|munchkin/i,
  HubSpot: /hs-scripts|hubspot/i,
  Salesforce: /salesforce|force\.com|pardot/i,
  Algolia: /algolia/i,
  Coveo: /coveo/i,
  Zendesk: /zendesk|zdassets/i,
};

// Template classification from URL + observed signals
function classify(u, sig) {
  const p = u.replace('https://www.brp-world.com/int/en/', '').replace(/\.html$/, '');
  const seg = p.split('/').filter(Boolean);
  const has = (c) => sig.cmp.includes(c) || sig.customClasses.includes(c);
  if (p === '' || u.endsWith('/int/en/')) return 'Home';
  if (/^brands\/[^/]+$/.test(p)) return 'Brand Home';
  if (/models-\d{4}/.test(p) && seg.length >= 4) return 'Product Detail (Model)';
  if (/models-\d{4}(-[a-z-]+)?$/.test(p)) return 'Product Listing (Model Year)';
  if (/^shopping-tools\/customise-your-own/i.test(p)) return 'Product Configurator (BYO)';
  if (/^shopping-tools\/find-a-dealer/i.test(p)) return 'Dealer Locator';
  if (/^shopping-tools\/brochures/i.test(p)) return 'Downloads / Brochures';
  if (/^shopping-tools\/request-a-quote|pre-order/i.test(p)) return 'Form / Lead Gen';
  if (/^shopping-tools/.test(p)) return 'Shopping Tool';
  if (/owner-zone/.test(p)) return 'Owner Zone / Support Article';
  if (/\/blog\//.test(p) || /\/blog$/.test(p)) return 'Blog / Article';
  if (/^brp-universe\/news/.test(p)) return 'News';
  if (/^brp-universe\/events/.test(p)) return 'Events';
  if (/^press-releases/.test(p)) return 'Press Release';
  if (/experience/.test(p)) return 'Experience / Editorial';
  if (/promotions?/.test(p)) return 'Promotion / Campaign';
  if (/^pa-a/.test(p)) return 'Parts, Accessories & Apparel';
  if (/^about-us/.test(p)) return 'About / Corporate';
  if (/privacy-policy|legal-notice|cookie-policy|accessibility|contact-us/.test(p)) return 'Legal / Utility';
  if (/faq/.test(p)) return 'FAQ';
  if (seg.length <= 1) return 'Section Landing';
  return 'Content Page (Generic)';
}

const pages = [];
const cmpGlobal = {};
const customGlobal = {};
const integGlobal = {};
const tmplGlobal = {};

for (const u of URLS) {
  const file = path.join(CACHE, keyFor(u));
  let html = '';
  try { html = fs.readFileSync(file, 'utf8'); } catch { pages.push({ url: u, error: 'no-cache' }); continue; }

  const head = (html.split(/<\/head>/i)[0] || html);
  const bodyStart = html.indexOf('>', html.search(/<body/i));
  const body = bodyStart > 0 ? html.slice(bodyStart) : html;

  const title = strip((head.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]);
  const lang = (html.match(/<html[^>]*\blang="([^"]*)"/i) || [])[1] || '';
  const canonical = (head.match(/<link[^>]+rel="canonical"[^>]*>/i) || [])[0];
  const canonicalHref = canonical ? attr(canonical, 'href') : null;
  const metaDescTag = (head.match(/<meta[^>]+name="description"[^>]*>/i) || [])[0];
  const metaDesc = metaDescTag ? dec(attr(metaDescTag, 'content')) : '';
  const ogType = (head.match(/<meta[^>]+property="og:type"[^>]+content="([^"]*)"/i) || [])[1] || '';
  const template = (head.match(/<meta[^>]+name="template"[^>]+content="([^"]*)"/i) || [])[1] || '';
  const hreflangCount = (head.match(/rel="alternate"[^>]+hreflang=/gi) || []).length;

  // headings
  const h1s = [...body.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => strip(m[1])).filter(Boolean);
  const h2s = [...body.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => strip(m[1])).filter(Boolean);
  const h3count = (body.match(/<h3[^>]*>/gi) || []).length;

  // AEM component signatures
  const cmpCounts = {};
  let m;
  const classBlob = body.match(/class="[^"]*"/gi) || [];
  const classText = classBlob.join(' ');
  CMP_RE.lastIndex = 0;
  while ((m = CMP_RE.exec(classText))) {
    // reduce cmp-hero-block__line -> hero-block (root before __)
    let name = m[1];
    cmpCounts[name] = (cmpCounts[name] || 0) + 1;
  }
  // Collapse cmp roots: keep top-level component root (first two segments max meaningful)
  const cmpRoots = {};
  for (const [k, v] of Object.entries(cmpCounts)) {
    cmpRoots[k] = v;
  }

  // custom (non-cmp) block hints
  const customCounts = {};
  for (const h of CUSTOM_HINTS) {
    const re = new RegExp(`class="[^"]*\\b${h}[a-z0-9-]*`, 'gi');
    const c = (classText.match(re) || []).length;
    if (c) customCounts[h] = c;
  }

  // structural block counts
  const carousels = (classText.match(/carousel|swiper|slick|slider/gi) || []).length;
  const accordions = (classText.match(/accordion/gi) || []).length;
  const tabs = (classText.match(/\btab(s|-panel|-list)?\b/gi) || []).length;
  const videos = (body.match(/<video|youtube|vimeo|brightcove|scene7.*\/video|js-hero-block-video/gi) || []).length;
  const iframes = (body.match(/<iframe/gi) || []).length;
  const forms = (body.match(/<form[\s>]/gi) || []).length;
  const inputs = (body.match(/<input[\s>]|<select[\s>]|<textarea[\s>]/gi) || []).length;
  const imgs = (body.match(/<img[\s>]/gi) || []).length;
  const scene7 = (html.match(/scene7\.com|s7d\d\.scene7|\/is\/image\//gi) || []).length;
  const pdfLinks = (body.match(/href="[^"]+\.pdf(\?[^"]*)?"/gi) || []).length;
  const tables = (body.match(/<table[\s>]/gi) || []).length;
  const gridCols = (classText.match(/aem-GridColumn/g) || []).length;
  const xf = (classText.match(/experiencefragment|cmp-experiencefragment|xf-/gi) || []).length;
  const breadcrumb = /cmp-breadcrumb|breadcrumb/i.test(classText);

  // integrations
  const integs = [];
  for (const [name, re] of Object.entries(INTEGRATIONS)) {
    if (re.test(html)) integs.push(name);
  }

  const cmpList = Object.keys(cmpRoots);
  const customList = Object.keys(customCounts);
  const sig = { cmp: cmpList, customClasses: customList };
  const template2 = classify(u, sig);

  const rec = {
    url: u,
    path: u.replace('https://www.brp-world.com/int/en/', '/').replace(/\.html$/, ''),
    depth: u.replace('https://www.brp-world.com/int/en/', '').replace(/\.html$/, '').split('/').filter(Boolean).length,
    title,
    lang,
    canonical: canonicalHref,
    canonicalSelf: canonicalHref === u,
    metaDesc,
    metaDescLen: metaDesc.length,
    ogType,
    aemTemplate: template,
    hreflangCount,
    template: template2,
    h1: h1s,
    h1count: h1s.length,
    h2: h2s.slice(0, 25),
    h2count: h2s.length,
    h3count,
    bytes: html.length,
    cmp: cmpRoots,
    custom: customCounts,
    blocks: {
      carousels, accordions, tabs, videos, iframes, forms, inputs, imgs,
      scene7, pdfLinks, tables, gridCols, xf, breadcrumb,
    },
    integrations: integs,
  };
  pages.push(rec);

  // globals
  for (const k of cmpList) { cmpGlobal[k] = cmpGlobal[k] || { count: 0, pages: 0 }; cmpGlobal[k].count += cmpRoots[k]; cmpGlobal[k].pages += 1; }
  for (const k of customList) { customGlobal[k] = customGlobal[k] || { count: 0, pages: 0 }; customGlobal[k].count += customCounts[k]; customGlobal[k].pages += 1; }
  for (const k of integs) { integGlobal[k] = (integGlobal[k] || 0) + 1; }
  tmplGlobal[template2] = (tmplGlobal[template2] || 0) + 1;
}

fs.writeFileSync(path.join(ROOT, 'report', 'data', 'pages.json'), JSON.stringify(pages, null, 2));
fs.writeFileSync(path.join(ROOT, 'report', 'data', 'aggregates.json'), JSON.stringify({
  totalPages: pages.length,
  templates: Object.fromEntries(Object.entries(tmplGlobal).sort((a, b) => b[1] - a[1])),
  cmpComponents: Object.fromEntries(Object.entries(cmpGlobal).sort((a, b) => b[1].pages - a[1].pages)),
  customBlocks: Object.fromEntries(Object.entries(customGlobal).sort((a, b) => b[1].pages - a[1].pages)),
  integrations: Object.fromEntries(Object.entries(integGlobal).sort((a, b) => b[1] - a[1])),
}, null, 2));

console.log('Pages processed:', pages.length);
console.log('\n=== TEMPLATES ===');
for (const [k, v] of Object.entries(tmplGlobal).sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(5), k);
console.log('\n=== TOP CMP COMPONENTS (by pages) ===');
for (const [k, v] of Object.entries(cmpGlobal).sort((a, b) => b[1].pages - a[1].pages).slice(0, 40)) console.log(String(v.pages).padStart(5), 'pg', String(v.count).padStart(6), 'tot', 'cmp-' + k);
console.log('\n=== INTEGRATIONS (pages present) ===');
for (const [k, v] of Object.entries(integGlobal).sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(5), k);
