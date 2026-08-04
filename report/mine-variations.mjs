// Mine evidence-backed block variations from cached HTML — scoped per block.
// For each block: find pages containing the block root, then test each
// variation/capability ONLY within those pages. Distinguishes:
//   - variations  : structurally distinct configurations of the block
//   - capabilities : optional features that can co-occur on the same instance
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const CACHE = path.join(ROOT, 'report', 'pages_cache');
const files = fs.readdirSync(CACHE).filter((f) => f.endsWith('.html'));
const docs = files.map((f) => ({ f, h: fs.readFileSync(path.join(CACHE, f), 'utf8') }));

// pages containing root; return subset of docs
function pagesWithRoot(root) { return docs.filter((d) => root.test(d.h)); }
// within a subset, count pages matching detector + total occurrences
function scanIn(subset, re) {
  let pages = 0; let occ = 0;
  for (const d of subset) {
    const m = d.h.match(re);
    if (m) { pages += 1; occ += m.length; }
  }
  return { pages, occ };
}

const BLOCKS = {
  'Hero / Hero-Block': {
    root: /cmp-hero-block(?![\w-])/,
    purpose: 'Full-width brand statement at the top of a page: media (image/video) with an animated headline, optional eyebrow/subtitle, sub-content overlay and CTA actions. The single most brand-critical block.',
    variations: [
      { name: 'Standard image hero', d: /cmp-hero-block__media/, diff: 'Static background image in the media slot. The default hero used across product & editorial pages.' },
      { name: 'Video hero (inline autoplay)', d: /js-hero-block-video/, diff: 'A muted, looping <video> replaces the background image. Needs poster frame, reduced-motion fallback and lazy source loading for LCP.' },
    ],
    capabilities: [
      { name: 'Sticky / scroll-pinned media', d: /cmp-hero-block__sticky-container/, diff: 'Media pins while sub-content scrolls over it — scroll-driven, IntersectionObserver.' },
      { name: 'Two-line animated headline', d: /cmp-hero-block__second-line/, diff: 'Headline split into two lines for a staggered reveal animation.' },
      { name: 'Sub-content overlay', d: /cmp-hero-block__subcontent-container/, diff: 'Secondary content layered over the hero (badges/copy).' },
      { name: 'Eyebrow / subtitle', d: /cmp-hero-block__subtitle/, diff: 'Small label above the main title.' },
      { name: 'CTA actions bar', d: /cmp-hero-block__actions-container/, diff: 'One or more CTA buttons in a dedicated container.' },
    ],
  },
  'Teaser / Card': {
    root: /cmp-teaser(?![\w-])/,
    purpose: 'The universal content promo/navigation unit. Renders image + optional pretitle/title/description + optional CTA, and composes into 2/3/4-up grids and horizontal rails everywhere on the site.',
    variations: [
      { name: 'CTA teaser (with action link)', d: /cmp-teaser__action-container|cmp-teaser__action-link/, diff: 'Includes explicit CTA link(s) — a promotional card that drives a click. The dominant teaser form.' },
      { name: 'Descriptive teaser', d: /cmp-teaser__description/, diff: 'Adds a body-copy paragraph under the title (editorial / feature promo).' },
      { name: 'Title-only navigation teaser', d: /no-subtitle|empty-text/, diff: 'Minimal tile — image + linked title only, no description or CTA. Used as menu/navigation tiles.' },
      { name: 'Image Card (named component)', d: /data-component-name="Image Card"/, diff: 'An explicitly named "Image Card" variant used inside product/model rails and grids.' },
    ],
    capabilities: [
      { name: 'Pretitle / eyebrow', d: /cmp-teaser__pretitle/, diff: 'Adds an eyebrow label above the title.' },
      { name: 'Image slot', d: /cmp-teaser__image/, diff: 'Teaser leads with an image (vs text-only).' },
    ],
  },
  'Carousel / Slider': {
    root: /data-cmp-is="carousel"|cmp-carousel(?![\w-])/,
    purpose: 'Horizontal slider for media, product rails and spec switching. BRP uses one rich carousel component that bundles arrows, dot indicators, peek/blur edges, tabbed navigation and 5-second auto-advance.',
    variations: [
      { name: 'Standard media carousel', d: /data-cmp-is="carousel"/, diff: 'WCM core carousel driven by arrows + dot indicators.' },
      { name: 'Tabbed carousel', d: /cmp-carousel-tab/, diff: 'Slides switched via tab controls instead of arrows — used for spec/feature switching on product pages.' },
    ],
    capabilities: [
      { name: 'Peek / blurry edges', d: /cmp-carousel__blurry/, diff: 'Adjacent slides peek in with a blur (product-rail styling).' },
      { name: 'Dot indicators', d: /cmp-carousel__indicator/, diff: 'Dot indicators show position/state.' },
      { name: 'Auto-advance (5s)', d: /data-cmp-delay="[1-9]/, diff: 'Rotates automatically every 5s; must pause on interaction for a11y.' },
    ],
  },
  'Accordion': {
    root: /data-cmp-is="accordion"/,
    purpose: 'Collapsible panels for dense content — specifications, support how-tos and FAQs. Core WCM accordion.',
    variations: [
      { name: 'Standard accordion', d: /data-cmp-is="accordion"/, diff: 'Single-open collapsible panel set (default).' },
      { name: 'FAQ accordion', d: /faq/i, diff: 'Q&A-styled accordion on support/FAQ pages (heading = question).' },
      { name: 'Multi-expand accordion', d: /cmp-accordion__item--expanded[\s\S]{0,4000}cmp-accordion__item--expanded/, diff: 'Allows multiple panels open at once (≥2 expanded items observed).' },
    ],
    capabilities: [],
  },
  'Gallery / Image Grid': {
    root: /cmp-gallery|cmp-image-grid|data-cmp-is="tilemosaic"/,
    purpose: 'Clustered image presentation — grids, lightbox galleries and marketing mosaics.',
    variations: [
      { name: 'Lightbox gallery', d: /cmp-gallery/, diff: 'Image cluster that opens a modal/lightbox on click.' },
      { name: 'Image grid', d: /cmp-image-grid/, diff: 'Fixed responsive grid of images (no lightbox).' },
      { name: 'Tile mosaic', d: /data-cmp-is="tilemosaic"|cmp-tilemosaic/, diff: 'Mixed-size mosaic of feature/marketing tiles.' },
    ],
    capabilities: [],
  },
  'Video / Video Embed': {
    root: /js-hero-block-video|cmp-video|cmp-videoembed|data-yt-id|data-webm/,
    purpose: 'Video delivery via YouTube façade, self-hosted WebM/MP4, hero background loops, or click-to-play modals.',
    variations: [
      { name: 'YouTube embed (façade)', d: /data-yt-id/, diff: 'Stores a YouTube id and swaps to an iframe on play — keeps LCP light.' },
      { name: 'Self-hosted WebM/MP4', d: /data-webm/, diff: 'Local video source (webm/mp4), no third-party player.' },
      { name: 'Inline hero background video', d: /js-hero-block-video/, diff: 'Muted autoplay loop used as a hero background.' },
    ],
    capabilities: [
      { name: 'Click-to-play modal', d: /data-toggle="modal"/, diff: 'Opens the video in a modal dialog.' },
    ],
  },
  'Image (Core)': {
    root: /data-cmp-is="image"/,
    purpose: 'Responsive core image bound to the AEM DAM/rendition service, with lazy-loading and optional Scene7 delivery.',
    variations: [
      { name: 'Responsive DAM image', d: /data-cmp-src|data-cmp-filereference/, diff: 'srcset generated from AEM DAM renditions.' },
      { name: 'Scene7 / Dynamic Media image', d: /scene7\.com|\/is\/image\//, diff: 'Served via Adobe Scene7 (smart-crop / auto-format).' },
    ],
    capabilities: [
      { name: 'Lazy loading', d: /data-cmp-hook-image|loading="lazy"/, diff: 'Deferred load for below-the-fold images.' },
      { name: 'Focal-position modifiers', d: /background-position-(center|right|left)/, diff: 'Controls focal point of background/cover images.' },
    ],
  },
  'Iframe / BYO Configurator Embed': {
    root: /cmp-iframe|data-byo-productfinderservice|zlthunder\.net/,
    purpose: 'Embeds the external Build-Your-Own configurator application (product-finder service) and other third-party tools inside the page shell.',
    variations: [
      { name: 'BYO configurator embed', d: /data-byo-productfinderservice|zlthunder\.net/, diff: 'Full external configurator app (sitebuild-*.brp.zlthunder.net) embedded via iframe.' },
      { name: 'Generic content iframe', d: /cmp-iframe/, diff: 'Core iframe component for arbitrary embedded content.' },
    ],
    capabilities: [
      { name: 'Locale parameterisation', d: /data-byo-locale/, diff: 'Passes a locale param to localize the embedded app.' },
    ],
  },
  'Dealer Locator / Map': {
    root: /data-google-maps-api-key|data-markers|data-pin|data-event-lat/,
    purpose: 'Interactive Google Maps surfaces for finding dealers, plotting event locations and showing points of interest.',
    variations: [
      { name: 'Google Maps locator', d: /data-google-maps-api-key/, diff: 'Interactive map initialised with a Maps API key.' },
      { name: 'Marker/pin dataset map', d: /data-markers|data-pin/, diff: 'Map seeded with multiple marker/pin datasets (dealers/POIs).' },
      { name: 'Single event-location map', d: /data-event-lat|data-event-lng/, diff: 'Bound to one lat/lng for an event location.' },
    ],
    capabilities: [],
  },
  'Configurator Package Selector': {
    root: /data-package-lead|data-packages|data-package-heading/,
    purpose: 'In-page selector for model packages/trims that feeds the configurator and lead flows.',
    variations: [
      { name: 'Package lead selector', d: /data-package-lead/, diff: 'Selects a lead package/trim and captures intent.' },
      { name: 'Multi-package chooser', d: /data-packages=/, diff: 'Presents multiple packages/trims for comparison/selection.' },
    ],
    capabilities: [],
  },
};

const out = {};
for (const [block, def] of Object.entries(BLOCKS)) {
  const subset = pagesWithRoot(def.root);
  const mk = (arr) => arr.map((v) => {
    const { pages, occ } = scanIn(subset, v.d);
    return { name: v.name, diff: v.diff, pages, occ, pct: subset.length ? Math.round((pages / subset.length) * 100) : 0 };
  }).filter((v) => v.pages > 0).sort((a, b) => b.pages - a.pages);
  out[block] = { blockPages: subset.length, purpose: def.purpose, variations: mk(def.variations), capabilities: mk(def.capabilities) };
}

out.__meta = { totalPages: docs.length, commercePages: pagesWithRoot(/data-magento-middleware-base-url/).length };
fs.writeFileSync(path.join(ROOT, 'report', 'data', 'variations.json'), JSON.stringify(out, null, 2));

for (const [b, d] of Object.entries(out)) {
  if (b === '__meta') continue;
  console.log(`\n${b}  [${d.blockPages} pages]`);
  console.log('  variations:');
  for (const v of d.variations) console.log(`   ${String(v.pages).padStart(4)} pg (${v.pct}%) — ${v.name}`);
  if (d.capabilities.length) { console.log('  capabilities:'); for (const v of d.capabilities) console.log(`   ${String(v.pages).padStart(4)} pg (${v.pct}%) — ${v.name}`); }
}
console.log('\nCommerce (Magento) pages:', out.__meta.commercePages, '/', out.__meta.totalPages);
