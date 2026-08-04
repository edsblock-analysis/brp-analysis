// Build the template -> block -> variation mapping.
// For each page: know its template (from pages.json) and test every
// block-variation detector against its HTML. Aggregate per template so we
// can say "Template X uses Block Y in variations A, B" with page counts.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const CACHE = path.join(ROOT, 'report', 'pages_cache');
const pages = JSON.parse(fs.readFileSync(path.join(ROOT, 'report', 'data', 'pages.json'), 'utf8'));

function keyFor(u) {
  return u.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 180) + '.html';
}

// Variation detectors — MUST mirror mine-variations.mjs (rich blocks + capabilities).
// Foundational blocks are single-form, so their "variation" is just the block itself.
const BLOCKS = {
  'Hero': {
    root: /cmp-hero-block(?![\w-])/,
    variations: [
      { name: 'Standard image hero', d: /cmp-hero-block__media/ },
      { name: 'Video hero (inline autoplay)', d: /js-hero-block-video/ },
    ],
    capabilities: [
      { name: 'Sticky scroll-pinned', d: /cmp-hero-block__sticky-container/ },
      { name: 'Two-line animated headline', d: /cmp-hero-block__second-line/ },
      { name: 'Sub-content overlay', d: /cmp-hero-block__subcontent-container/ },
      { name: 'Eyebrow/subtitle', d: /cmp-hero-block__subtitle/ },
      { name: 'CTA actions bar', d: /cmp-hero-block__actions-container/ },
    ],
  },
  'Teaser': {
    root: /cmp-teaser(?![\w-])/,
    variations: [
      { name: 'CTA teaser', d: /cmp-teaser__action-container|cmp-teaser__action-link/ },
      { name: 'Descriptive teaser', d: /cmp-teaser__description/ },
      { name: 'Title-only nav teaser', d: /no-subtitle|empty-text/ },
      { name: 'Image Card (named)', d: /data-component-name="Image Card"/ },
    ],
    capabilities: [{ name: 'Pretitle/eyebrow', d: /cmp-teaser__pretitle/ }],
  },
  'Carousel': {
    root: /data-cmp-is="carousel"|cmp-carousel(?![\w-])/,
    variations: [
      { name: 'Standard media carousel', d: /data-cmp-is="carousel"/ },
      { name: 'Tabbed carousel', d: /cmp-carousel-tab/ },
    ],
    capabilities: [
      { name: 'Peek/blurry edges', d: /cmp-carousel__blurry/ },
      { name: 'Auto-advance (5s)', d: /data-cmp-delay="[1-9]/ },
    ],
  },
  'Accordion': {
    root: /data-cmp-is="accordion"/,
    variations: [
      { name: 'Standard accordion', d: /data-cmp-is="accordion"/ },
      { name: 'FAQ accordion', d: /faq/i },
    ],
    capabilities: [],
  },
  'Gallery': {
    root: /cmp-gallery|cmp-image-grid|data-cmp-is="tilemosaic"/,
    variations: [
      { name: 'Lightbox gallery', d: /cmp-gallery/ },
      { name: 'Image grid', d: /cmp-image-grid/ },
      { name: 'Tile mosaic', d: /data-cmp-is="tilemosaic"|cmp-tilemosaic/ },
    ],
    capabilities: [],
  },
  'Video': {
    root: /js-hero-block-video|cmp-video|cmp-videoembed|data-yt-id|data-webm/,
    variations: [
      { name: 'YouTube embed (façade)', d: /data-yt-id/ },
      { name: 'Self-hosted WebM/MP4', d: /data-webm/ },
      { name: 'Inline hero background video', d: /js-hero-block-video/ },
    ],
    capabilities: [{ name: 'Click-to-play modal', d: /data-toggle="modal"/ }],
  },
  'Image': {
    root: /data-cmp-is="image"/,
    variations: [
      { name: 'Responsive DAM image', d: /data-cmp-src|data-cmp-filereference/ },
      { name: 'Scene7 / Dynamic Media', d: /scene7\.com|\/is\/image\// },
    ],
    capabilities: [
      { name: 'Lazy loading', d: /data-cmp-hook-image|loading="lazy"/ },
      { name: 'Focal-position modifier', d: /background-position-(center|right|left)/ },
    ],
  },
  'Iframe / Configurator Embed': {
    root: /cmp-iframe|data-byo-productfinderservice|zlthunder\.net/,
    variations: [
      { name: 'BYO configurator embed', d: /data-byo-productfinderservice|zlthunder\.net/ },
      { name: 'Generic content iframe', d: /cmp-iframe/ },
    ],
    capabilities: [{ name: 'Locale parameterised', d: /data-byo-locale/ }],
  },
  'Dealer Locator / Map': {
    root: /data-google-maps-api-key|data-markers|data-pin|data-event-lat/,
    variations: [
      { name: 'Google Maps locator', d: /data-google-maps-api-key/ },
      { name: 'Marker/pin dataset map', d: /data-markers|data-pin/ },
      { name: 'Single event-location map', d: /data-event-lat|data-event-lng/ },
    ],
    capabilities: [],
  },
  'Configurator Package Selector': {
    root: /data-package-lead|data-packages|data-package-heading/,
    variations: [
      { name: 'Package lead selector', d: /data-package-lead/ },
      { name: 'Multi-package chooser', d: /data-packages=/ },
    ],
    capabilities: [],
  },
  // Foundational single-form blocks
  'Container / Section': { root: /cmp-container|segment-block|responsivegrid/, variations: [{ name: 'Standard', d: /cmp-container|segment-block|responsivegrid/ }], capabilities: [] },
  'CTA / Button': { root: /cmp-button|action-link|cmp-teaser__action/, variations: [{ name: 'Standard', d: /cmp-button|action-link|cmp-teaser__action/ }], capabilities: [] },
  'Breadcrumb': { root: /cmp-breadcrumb/, variations: [{ name: 'Standard', d: /cmp-breadcrumb/ }], capabilities: [] },
  'Title / Heading': { root: /cmp-title(?![\w-])/, variations: [{ name: 'Standard', d: /cmp-title(?![\w-])/ }], capabilities: [] },
  'Text / Rich Text': { root: /cmp-text(?![\w-])/, variations: [{ name: 'Standard', d: /cmp-text(?![\w-])/ }], capabilities: [] },
  'Downloads (PDF list)': { root: /href="[^"]+\.pdf/, variations: [{ name: 'Standard', d: /href="[^"]+\.pdf/ }], capabilities: [] },
  'Modal / Dialog': { root: /data-toggle="modal"|cmp-modal/, variations: [{ name: 'Standard', d: /data-toggle="modal"|cmp-modal/ }], capabilities: [] },
  'List': { root: /cmp-list(?![\w-])/, variations: [{ name: 'Standard', d: /cmp-list(?![\w-])/ }], capabilities: [] },
  'Page-Level Navigation': { root: /cmp-page-level-navigation/, variations: [{ name: 'Standard', d: /cmp-page-level-navigation/ }], capabilities: [] },
  'Table': { root: /<table[\s>]/, variations: [{ name: 'Standard', d: /<table[\s>]/ }], capabilities: [] },
  'Form': { root: /<form[\s>]/, variations: [{ name: 'Standard', d: /<form[\s>]/ }], capabilities: [] },
  'Tabs': { root: /data-cmp-is="tabs"|cmp-tabs(?![\w-])/, variations: [{ name: 'Standard', d: /data-cmp-is="tabs"|cmp-tabs(?![\w-])/ }], capabilities: [] },
};

// template -> block -> { blockPages, variations:{name:pages}, capabilities:{name:pages} }
const map = {};
const templateCounts = {};

for (const p of pages) {
  const t = p.template;
  templateCounts[t] = (templateCounts[t] || 0) + 1;
  let html = '';
  try { html = fs.readFileSync(path.join(CACHE, keyFor(p.url)), 'utf8'); } catch { continue; }
  map[t] ??= {};
  for (const [block, def] of Object.entries(BLOCKS)) {
    if (!def.root.test(html)) continue;
    map[t][block] ??= { blockPages: 0, variations: {}, capabilities: {} };
    map[t][block].blockPages += 1;
    for (const v of def.variations) if (v.d.test(html)) map[t][block].variations[v.name] = (map[t][block].variations[v.name] || 0) + 1;
    for (const c of def.capabilities) if (c.d.test(html)) map[t][block].capabilities[c.name] = (map[t][block].capabilities[c.name] || 0) + 1;
  }
}

const out = { templateCounts, map };
fs.writeFileSync(path.join(ROOT, 'report', 'data', 'template-block-variations.json'), JSON.stringify(out, null, 2));

// print a readable summary for the biggest templates
const tOrder = Object.entries(templateCounts).sort((a, b) => b[1] - a[1]);
for (const [t, n] of tOrder.slice(0, 4)) {
  console.log(`\n=== ${t}  (${n} pages) ===`);
  const blocks = Object.entries(map[t] || {}).sort((a, b) => b[1].blockPages - a[1].blockPages);
  for (const [b, d] of blocks) {
    const vars = Object.entries(d.variations).sort((a, b2) => b2[1] - a[1]).map(([nm, c]) => `${nm} (${c})`).join(', ');
    console.log(`  ${b} [${d.blockPages}pg]: ${vars || '—'}`);
  }
}
console.log('\nWritten report/data/template-block-variations.json for', Object.keys(map).length, 'templates');
