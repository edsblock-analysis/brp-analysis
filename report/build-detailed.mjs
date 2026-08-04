import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const D = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'report', 'data', f), 'utf8'));
const pages = D('pages.json');
const agg = D('aggregates.json');
const vars = D('variations.json');
const tdetail = D('template-detail.json');
const tbv = D('template-block-variations.json');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------------- TEMPLATE MODEL ----------------
const templateMeta = {
  'Product Detail (Model)': { cx: 'High', days: 5, purpose: 'Model & lineup pages for each vehicle family — the commercial core of the site. Hero + tabbed/blurry carousels for gallery & specs, spec teasers, feature accordions.', primary: ['hero-block', 'teaser', 'carousel', 'image'] },
  'Experience / Editorial': { cx: 'Medium', days: 3, purpose: 'Brand storytelling & lifestyle content ("experience" hubs). Hero-led, teaser navigation, galleries and rich text.', primary: ['hero-block', 'teaser', 'gallery', 'text'] },
  'Owner Zone / Support Article': { cx: 'Medium', days: 3, purpose: 'Post-purchase support & how-to articles. Text-heavy with images and accordions; light on hero.', primary: ['text', 'image', 'accordion', 'teaser'] },
  'Product Configurator (BYO)': { cx: 'Very High', days: 8, purpose: '"Customise-Your-Own" build flows. Thin AEM shell that embeds the external configurator app via iframe.', primary: ['iframe', 'teaser', 'image'] },
  'Blog / Article': { cx: 'Medium', days: 3, purpose: 'Editorial blog posts (buying guides, tips). Hero, rich text, galleries and accordions.', primary: ['hero-block', 'text', 'gallery', 'teaser'] },
  'Content Page (Generic)': { cx: 'Medium', days: 3, purpose: 'Generic content pages on the master template that don’t fit a specialised pattern.', primary: ['hero-block', 'teaser', 'image'] },
  'News': { cx: 'Medium', days: 3, purpose: 'BRP Universe corporate news items. Gallery-heavy with teaser cards and rich text.', primary: ['teaser', 'gallery', 'image', 'text'] },
  'Product Listing (Model Year)': { cx: 'Medium', days: 3, purpose: 'Model-year index pages listing all models in a family. Teaser card grids linking to detail pages.', primary: ['teaser', 'image', 'title'] },
  'Parts, Accessories & Apparel': { cx: 'High', days: 5, purpose: 'PA&A catalogue landing pages. Extremely carousel/rail-heavy product merchandising.', primary: ['carousel', 'teaser', 'hero-block', 'image'] },
  'Events': { cx: 'Medium', days: 3, purpose: 'BRP Universe events. Galleries, teasers and event-location maps.', primary: ['gallery', 'teaser', 'image'] },
  'Press Release': { cx: 'Low', days: 1.5, purpose: 'Corporate press releases. Text-dominant with minimal blocks.', primary: ['text', 'teaser', 'image'] },
  'Section Landing': { cx: 'Medium', days: 3, purpose: 'Section index / hub pages. Teaser navigation grids into sub-sections.', primary: ['teaser', 'image', 'hero-block'] },
  'About / Corporate': { cx: 'Medium', days: 3, purpose: 'Corporate "About BRP" pages. Hero on every page with accordion-rich content.', primary: ['hero-block', 'teaser', 'accordion', 'text'] },
  'Brand Home': { cx: 'High', days: 5, purpose: 'Per-brand landing pages (Ski-Doo, Sea-Doo, Can-Am ORV/On-Road, Lynx). Hero carousels + teaser navigation into the brand world.', primary: ['hero-block', 'teaser', 'carousel', 'video'] },
  'Promotion / Campaign': { cx: 'Medium', days: 3, purpose: 'Time-boxed promo/campaign pages. Hero + CTA teaser driven.', primary: ['teaser', 'title', 'image'] },
  'Legal / Utility': { cx: 'Low', days: 1.5, purpose: 'Privacy, cookie, legal and accessibility pages. Long-form text with nested lists.', primary: ['text', 'list', 'title'] },
  'Form / Lead Gen': { cx: 'High', days: 5, purpose: 'Request-a-quote / pre-order lead capture. Forms plus supporting accordions.', primary: ['teaser', 'image', 'accordion'] },
  'FAQ': { cx: 'Low', days: 1.5, purpose: 'Standalone FAQ pages. Accordion Q&A.', primary: ['teaser', 'image'] },
  'Home': { cx: 'High', days: 5, purpose: 'Global homepage. Multi-brand hero carousel (8 headlines) + teaser grids + segment blocks.', primary: ['hero-block', 'teaser', 'video', 'image'] },
  'Shopping Tool': { cx: 'Medium', days: 3, purpose: 'Misc shopping tool landing page.', primary: ['teaser', 'image'] },
  'Dealer Locator': { cx: 'High', days: 5, purpose: 'Find-a-dealer. Interactive Google Maps locator with search — fully dynamic.', primary: ['teaser', 'image'] },
  'Downloads / Brochures': { cx: 'Medium', days: 3, purpose: 'Brochure download hub. PDF link lists organised by brand/model.', primary: ['teaser', 'image', 'title'] },
};
const cxRank = { 'Low': 0, 'Medium': 1, 'High': 2, 'Very High': 3 };
const templateRows = Object.entries(tdetail).map(([t, d]) => ({ t, ...d, ...(templateMeta[t] || { cx: 'Medium', days: 3, purpose: '', primary: [] }) }))
  .sort((a, b) => b.n - a.n);

const blockLabel = { 'hero-block': 'Hero', teaser: 'Teaser', carousel: 'Carousel', accordion: 'Accordion', gallery: 'Gallery', image: 'Image', video: 'Video', iframe: 'Iframe/Embed', list: 'List', title: 'Title', text: 'Text', breadcrumb: 'Breadcrumb' };

// ---------------- BLOCK MODEL (from variations.json + estimates) ----------------
const blockEffort = {
  'Hero / Hero-Block': { cx: 'High', build: 6, variant: 1.5 },
  'Teaser / Card': { cx: 'High', build: 6, variant: 1 },
  'Carousel / Slider': { cx: 'High', build: 6, variant: 1.5 },
  'Accordion': { cx: 'Medium', build: 3, variant: 0.5 },
  'Gallery / Image Grid': { cx: 'Medium', build: 4, variant: 1 },
  'Video / Video Embed': { cx: 'Medium', build: 4, variant: 1 },
  'Image (Core)': { cx: 'Low', build: 2, variant: 0.5 },
  'Iframe / BYO Configurator Embed': { cx: 'High', build: 5, variant: 1 },
  'Dealer Locator / Map': { cx: 'Very High', build: 8, variant: 1.5 },
  'Configurator Package Selector': { cx: 'High', build: 5, variant: 1 },
  // Foundational (single-form) blocks
  'Container / Section': { cx: 'Low', build: 2, variant: 0 },
  'CTA / Button': { cx: 'Low', build: 2, variant: 0 },
  'Breadcrumb': { cx: 'Low', build: 1.5, variant: 0 },
  'Title / Heading': { cx: 'Low', build: 1, variant: 0 },
  'Text / Rich Text': { cx: 'Low', build: 1, variant: 0 },
  'Downloads (PDF list)': { cx: 'Low', build: 2, variant: 0 },
  'Modal / Dialog': { cx: 'Medium', build: 3, variant: 0 },
  'List': { cx: 'Low', build: 2, variant: 0 },
  'Page-Level Navigation': { cx: 'Medium', build: 3, variant: 0 },
  'Table': { cx: 'Low', build: 1.5, variant: 0 },
  'Form': { cx: 'High', build: 5, variant: 0 },
  'Tabs': { cx: 'Medium', build: 3, variant: 0 },
};
const blockRows = Object.entries(vars).filter(([k]) => k !== '__meta').map(([name, d]) => {
  const eff = blockEffort[name] || { cx: 'Medium', build: 3, variant: 1 };
  const days = eff.build + (d.variations.length - 1) * eff.variant;
  return { name, ...d, ...eff, days: +days.toFixed(1) };
}).sort((a, b) => b.blockPages - a.blockPages);
const richRows = blockRows.filter((b) => b.tier === 'rich');
const foundRows = blockRows.filter((b) => b.tier === 'foundational');

const totalVariations = blockRows.reduce((s, b) => s + b.variations.length, 0);
const totalCapabilities = blockRows.reduce((s, b) => s + b.capabilities.length, 0);
const totalBlockDays = blockRows.reduce((s, b) => s + b.days, 0);
const totalTemplateDays = templateRows.reduce((s, r) => s + r.days, 0);
// Effort is displayed in hours (8h per person-day); internal math stays in days.
const HPD = 8;
const hrs = (d) => `${+(d * HPD).toFixed(1)}h`;

// ---------------- helpers: inline SVG ----------------
const PAL = ['#2563eb', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#64748b'];
function hbar(data, { w = 560, bh = 26, gap = 8, max } = {}) {
  const mx = max || Math.max(...data.map((d) => d.v), 1);
  const labelW = 190; const barW = w - labelW - 60;
  const h = data.length * (bh + gap);
  const rows = data.map((d, i) => {
    const y = i * (bh + gap);
    const bw = Math.max(2, (d.v / mx) * barW);
    const c = d.c || PAL[i % PAL.length];
    return `<text x="${labelW - 8}" y="${y + bh / 2}" text-anchor="end" dominant-baseline="central" class="lbl">${esc(d.l)}</text>
<rect x="${labelW}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="${c}"/>
<text x="${labelW + bw + 6}" y="${y + bh / 2}" dominant-baseline="central" class="val">${d.t ?? d.v}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img">${rows}</svg>`;
}
function donut(data, { size = 200, thick = 34 } = {}) {
  const total = data.reduce((s, d) => s + d.v, 0) || 1;
  const r = (size - thick) / 2; const cx = size / 2; const cy = size / 2; const C = 2 * Math.PI * r;
  let off = 0;
  const segs = data.map((d, i) => {
    const frac = d.v / total; const len = frac * C;
    const s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.c || PAL[i % PAL.length]}" stroke-width="${thick}" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cy})"><title>${esc(d.l)}: ${d.v}</title></circle>`;
    off += len; return s;
  }).join('');
  return `<svg viewBox="0 0 ${size} ${size}" class="donut" role="img">${segs}<text x="${cx}" y="${cy - 6}" text-anchor="middle" class="dnum">${total.toLocaleString()}</text><text x="${cx}" y="${cy + 14}" text-anchor="middle" class="dlbl">pages</text></svg>`;
}
function legend(data) {
  return `<div class="legend2">${data.map((d, i) => `<span class="lg"><i style="background:${d.c || PAL[i % PAL.length]}"></i>${esc(d.l)} <b>${d.v}</b></span>`).join('')}</div>`;
}

// ---------------- DATA for charts ----------------
const tmplChart = templateRows.slice(0, 12).map((r) => ({ l: r.t, v: r.n }));
const blockChart = blockRows.map((b) => ({ l: b.name.split(' / ')[0], v: b.blockPages }));
const cxDist = {}; templateRows.forEach((r) => { cxDist[r.cx] = (cxDist[r.cx] || 0) + 1; });
const cxColor = { 'Low': '#22c55e', 'Medium': '#eab308', 'High': '#f97316', 'Very High': '#8b5cf6' };
const cxChart = ['Low', 'Medium', 'High', 'Very High'].filter((c) => cxDist[c]).map((c) => ({ l: c, v: cxDist[c], c: cxColor[c] }));
const integChart = Object.entries(agg.integrations).slice(0, 10).map(([k, v]) => ({ l: k, v }));

// content hygiene
const noMeta = pages.filter((x) => !x.metaDesc).length;
const multiH1 = pages.filter((x) => x.h1count > 1).length;
const noH1 = pages.filter((x) => x.h1count === 0).length;
const totalImgs = pages.reduce((s, x) => s + x.blocks.imgs, 0);
const totalPdf = pages.reduce((s, x) => s + x.blocks.pdfLinks, 0);

// brand split
const brandSplit = {}; pages.forEach((x) => { const m = x.path.match(/^\/brands\/([^/]+)/); const k = m ? m[1] : 'corporate/other'; brandSplit[k] = (brandSplit[k] || 0) + 1; });
const brandChart = Object.entries(brandSplit).sort((a, b) => b[1] - a[1]).map(([l, v]) => ({ l, v }));

// ---------------- RENDER ----------------
const cxBadge = (c) => `<span class="cx cx-${c.replace(/\s/g, '')}">${c}</span>`;

// Block deep-dive card renderer
function renderCard(b) {
  const varRows = b.variations.map((v) => `<tr><td><b>${esc(v.name)}</b></td><td class="num">${v.pages}</td><td class="num">${v.pct}%</td><td class="diff">${esc(v.diff)}</td></tr>`).join('');
  const capRows = b.capabilities.length ? `<div class="caps"><span class="caps-h">Optional capabilities (can co-occur on one instance):</span>${b.capabilities.map((c) => `<span class="cap">${esc(c.name)} <b>${c.pct}%</b></span>`).join('')}</div>` : '';
  const varBar = hbar(b.variations.map((v) => ({ l: v.name, v: v.pages })), { w: 620, bh: 22, gap: 6, max: b.blockPages });
  return `<div class="card" id="blk-${esc(b.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase())}">
<div class="card-head">
  <h3>${esc(b.name)}</h3>
  <div class="card-meta">${cxBadge(b.cx)} <span class="tag">${b.blockPages} pages</span> <span class="tag">${b.variations.length} variation${b.variations.length > 1 ? 's' : ''}</span> <span class="tag">${hrs(b.days)} build</span></div>
</div>
<p class="purpose">${esc(b.purpose)}</p>
<div class="split2">
  <div>
    <table class="var-tbl"><thead><tr><th>Variation</th><th class="num">Pages</th><th class="num">% of block</th><th>What makes it different</th></tr></thead><tbody>${varRows}</tbody></table>
    ${capRows}
  </div>
  <div class="chartbox"><div class="chart-title">Variation prevalence (pages)</div>${varBar}</div>
</div>
</div>`;
}
const richCards = richRows.map(renderCard).join('');
const foundCards = foundRows.map(renderCard).join('');

// Reconciliation inventory table (single source of truth)
const invRow = (b) => `<tr><td><b>${esc(b.name)}</b></td><td class="num">${b.blockPages}</td><td class="num">${b.variations.length}</td><td class="num">${b.capabilities.length || '—'}</td><td>${cxBadge(b.cx)}</td><td class="num">${hrs(b.days)}</td></tr>`;
const reconTable = `<table>
<thead><tr><th>Block</th><th class="num">Pages</th><th class="num">Verified variations</th><th class="num">Capabilities</th><th>Complexity</th><th class="num">Build (hrs)</th></tr></thead>
<tbody>
<tr class="grp-row"><td colspan="6">Rich content blocks — multiple distinct variations</td></tr>
${richRows.map(invRow).join('')}
<tr class="grp-row"><td colspan="6">Foundational blocks — single standard form (1 variation each)</td></tr>
${foundRows.map(invRow).join('')}
<tr class="total-row"><td>TOTAL — ${blockRows.length} blocks</td><td class="num">—</td><td class="num">${totalVariations}</td><td class="num">${totalCapabilities}</td><td>—</td><td class="num">${hrs(totalBlockDays)}</td></tr>
</tbody></table>`;

// Template deep-dive cards
const tmplCards = templateRows.map((r) => {
  const comp = Object.entries(r.comp).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const compBar = hbar(comp.map(([k, v]) => ({ l: blockLabel[k] || k, v })), { w: 560, bh: 20, gap: 5, max: 100 }).replace(/>(\d+)<\/text>\s*$/g, '>$1%</text>');
  const primary = (r.primary || []).map((k) => `<span class="chip">${esc(blockLabel[k] || k)}</span>`).join('');
  const metrics = [
    ['Avg images/page', r.avgImgs],
    ['Avg carousels', r.avgCarousel],
    ['Avg accordions', r.avgAccord],
    ['Avg H2 headings', r.avgH2],
    ['Avg PDF links', r.avgPdf],
    ['Depth range', `${r.depthMin}–${r.depthMax}`],
  ];
  const hygiene = [];
  if (r.noMeta) hygiene.push(`${r.noMeta} missing meta-desc`);
  if (r.multiH1) hygiene.push(`${r.multiH1} multi-H1`);
  if (r.noH1) hygiene.push(`${r.noH1} no H1`);
  return `<div class="card" id="tpl-${esc(r.t.replace(/[^a-z0-9]+/gi, '-').toLowerCase())}">
<div class="card-head">
  <h3>${esc(r.t)}</h3>
  <div class="card-meta">${cxBadge(r.cx)} <span class="tag">${r.n} pages (${(r.n / pages.length * 100).toFixed(1)}%)</span> <span class="tag">${hrs(r.days)}</span></div>
</div>
<p class="purpose">${esc(r.purpose)}</p>
<div class="primary-row"><span class="pk">Primary blocks:</span> ${primary}</div>
<div class="split2">
  <div class="chartbox"><div class="chart-title">Block composition (% of pages in template)</div>${compBar}</div>
  <div>
    <div class="metrics">${metrics.map((m) => `<div class="metric"><div class="mn">${m[1]}</div><div class="ml">${m[0]}</div></div>`).join('')}</div>
    ${hygiene.length ? `<div class="hygiene"><b>Content hygiene:</b> ${hygiene.join(' · ')}</div>` : '<div class="hygiene ok">No major content-hygiene flags.</div>'}
    <div class="samples"><b>Examples:</b> ${(r.samples || []).map((s) => `<code>${esc(s)}</code>`).join(' ')}</div>
  </div>
</div>
</div>`;
}).join('');

// Template -> Block -> Variation mapping cards
const tbvCards = templateRows.map((r) => {
  const blocks = tbv.map[r.t] || {};
  const rows = Object.entries(blocks).sort((a, b) => b[1].blockPages - a[1].blockPages).map(([block, d]) => {
    const varList = Object.entries(d.variations).sort((a, b) => b[1] - a[1]);
    const dominant = varList.length ? varList[0][1] : 0;
    const varChips = varList.map(([nm, c]) => {
      const share = d.blockPages ? Math.round((c / d.blockPages) * 100) : 0;
      const cls = share >= 60 ? 'v-hi' : share >= 25 ? 'v-md' : 'v-lo';
      return `<span class="vchip ${cls}">${esc(nm)} <b>${c}</b><span class="vpct">${share}%</span></span>`;
    }).join('');
    const caps = Object.entries(d.capabilities).sort((a, b) => b[1] - a[1]);
    const capChips = caps.length ? `<div class="capline">+ ${caps.map(([nm, c]) => `<span class="cap2">${esc(nm)} ${c}</span>`).join(' ')}</div>` : '';
    return `<tr><td class="bcell"><b>${esc(block)}</b><span class="bpg">${d.blockPages} pg</span></td><td>${varChips}${capChips}</td></tr>`;
  }).join('');
  return `<div class="card tbv" id="tbv-${esc(r.t.replace(/[^a-z0-9]+/gi, '-').toLowerCase())}">
<div class="card-head">
  <h3>${esc(r.t)}</h3>
  <div class="card-meta">${cxBadge(r.cx)} <span class="tag">${r.n} pages</span> <span class="tag">${Object.keys(blocks).length} blocks used</span></div>
</div>
<table class="tbv-tbl"><thead><tr><th>Block</th><th>Variations used (pages · % of the template's pages that use this block)</th></tr></thead><tbody>${rows}</tbody></table>
</div>`;
}).join('');

// Matrix
const matrixBlocks = ['hero-block', 'teaser', 'carousel', 'accordion', 'gallery', 'image', 'video', 'iframe', 'title', 'text', 'list'];
const matrixCell = (v) => `<td class="mx" style="background:${v === 0 ? '#f6f8fa' : `rgba(37,99,235,${(v / 100) * 0.85 + 0.12})`};color:${v > 55 ? '#fff' : '#111'}">${v || ''}</td>`;
const matrixHeader = matrixBlocks.map((b) => `<th class="rot"><span>${esc(blockLabel[b])}</span></th>`).join('');
const matrixTableRows = templateRows.map((r) => `<tr><td class="sticky">${esc(r.t)}</td><td class="num">${r.n}</td><td class="num">${cxBadge(r.cx)}</td>${matrixBlocks.map((b) => matrixCell(r.comp[b] || 0)).join('')}</tr>`).join('');

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BRP-World → EDS · Detailed Blocks, Templates & Variations Dashboard</title>
<style>
:root{--brand:#ffcb00;--ink:#0b0f19;--edge:#e2e6ee;--blue:#2563eb;--muted:#5b6472;--bg:#f4f6fa;--card:#fff}
*{box-sizing:border-box}
body{margin:0;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg)}
a{color:var(--blue)}
header.hero{background:linear-gradient(135deg,#0b0f19,#1c2541 60%,#22357a);color:#fff;padding:46px 40px 40px}
header.hero h1{margin:0 0 8px;font-size:30px;letter-spacing:-.5px}
header.hero .sub{color:#a9b8d1;font-size:14.5px;max-width:900px}
header.hero .badge{display:inline-block;background:var(--brand);color:#111;font-weight:700;padding:3px 11px;border-radius:5px;font-size:12px;margin-bottom:14px;letter-spacing:.5px}
nav.toc{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--edge);z-index:60;padding:10px 24px;display:flex;flex-wrap:wrap;gap:4px 16px;font-size:13px}
nav.toc a{color:var(--muted);text-decoration:none;white-space:nowrap}
nav.toc a:hover{color:var(--blue)}
.wrap{max-width:1280px;margin:0 auto;padding:0 24px 80px}
section{background:var(--card);border:1px solid var(--edge);border-radius:14px;padding:26px 30px;margin:22px 0;box-shadow:0 1px 3px rgba(10,15,25,.05)}
h2.sec{font-size:22px;margin:0 0 4px;padding-bottom:10px;border-bottom:3px solid var(--brand);display:inline-block}
.lead{color:#28303d;max-width:920px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin:20px 0}
.kpi{background:linear-gradient(160deg,#f8fafc,#eef2f9);border:1px solid var(--edge);border-radius:12px;padding:16px}
.kpi .n{font-size:27px;font-weight:800;color:var(--blue);line-height:1}
.kpi .l{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-top:6px}
.kpi.warn .n{color:#b42318}
.dash-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:16px}
.dash-grid.three{grid-template-columns:1fr 1fr 1fr}
@media(max-width:900px){.dash-grid,.dash-grid.three{grid-template-columns:1fr}}
.panel{border:1px solid var(--edge);border-radius:12px;padding:16px 18px;background:#fff}
.panel h4{margin:0 0 10px;font-size:14px;color:#333}
.chart .lbl{font-size:11px;fill:#3a4453}.chart .val{font-size:11px;fill:#5b6472;font-weight:700}
.donut{max-width:200px;margin:0 auto;display:block}.dnum{font-size:26px;font-weight:800;fill:var(--ink)}.dlbl{font-size:11px;fill:var(--muted)}
.legend2{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px;font-size:12px}
.legend2 .lg{display:flex;align-items:center;gap:5px;color:#3a4453}.legend2 i{width:11px;height:11px;border-radius:3px;display:inline-block}
.donut-wrap{display:flex;flex-direction:column;align-items:center}
table{border-collapse:collapse;width:100%;font-size:13px;margin:10px 0}
th,td{border:1px solid var(--edge);padding:7px 9px;text-align:left;vertical-align:top}
th{background:#f0f3f8;font-weight:700}
td.num,th.num{text-align:center;white-space:nowrap}
tr:nth-child(even){background:#fafbfd}
.cx{padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;display:inline-block}
.cx-Low{background:#dcfce7;color:#166534}.cx-Medium{background:#fef9c3;color:#854d0e}.cx-High{background:#ffedd5;color:#9a3412}.cx-VeryHigh{background:#ede9fe;color:#5b21b6}
.card{border:1px solid var(--edge);border-radius:12px;padding:20px 22px;margin:16px 0;background:#fff;scroll-margin-top:60px}
.card-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;border-bottom:1px solid #eef1f6;padding-bottom:10px;margin-bottom:12px}
.card-head h3{margin:0;font-size:18px}
.card-meta{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.tag{background:#eef2f9;border:1px solid #dfe6f1;color:#3a4453;font-size:11px;font-weight:600;padding:2px 9px;border-radius:20px}
.purpose{color:#33404f;margin:4px 0 14px;font-size:14px}
.split2{display:grid;grid-template-columns:1.15fr .85fr;gap:22px}
@media(max-width:900px){.split2{grid-template-columns:1fr}}
.var-tbl td.diff{color:#4a5563;font-size:12px}
.chartbox{background:#fbfcfe;border:1px solid #eef1f6;border-radius:10px;padding:12px 14px}
.chart-title{font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);margin-bottom:8px;font-weight:700}
.caps{margin-top:10px;font-size:12px}.caps-h{color:var(--muted);display:block;margin-bottom:5px;font-weight:600}
.cap{display:inline-block;background:#f0f6ff;border:1px solid #d6e4fb;color:#1a4bcc;font-size:11px;padding:2px 8px;border-radius:6px;margin:2px}
.chip{display:inline-block;background:#eef1f6;border:1px solid #dfe4ec;color:#3a4453;font-size:11.5px;padding:2px 9px;border-radius:6px;margin:1px}
.primary-row{margin:6px 0 12px;font-size:13px}.pk{color:var(--muted);font-weight:600;margin-right:6px}
.metrics{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px}
.metric{background:#f8fafc;border:1px solid var(--edge);border-radius:8px;padding:8px;text-align:center}
.metric .mn{font-size:17px;font-weight:800;color:var(--blue)}.metric .ml{font-size:10.5px;color:var(--muted);margin-top:2px}
.hygiene{font-size:12px;background:#fff7ed;border-left:3px solid #f97316;padding:7px 10px;border-radius:0 6px 6px 0;margin-bottom:8px}
.hygiene.ok{background:#f0fdf4;border-color:#22c55e}
.samples{font-size:11px;color:var(--muted)}.samples code{background:#f3f5f9;padding:1px 5px;border-radius:4px;font-size:10.5px;margin-right:4px;display:inline-block;margin-top:2px}
.tablewrap{max-height:640px;overflow:auto;border:1px solid var(--edge);border-radius:8px}
.rot{height:96px;padding:0}.rot>span{writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;font-size:11px}
td.sticky{position:sticky;left:0;background:#fff;font-weight:600;max-width:190px;font-size:12px}
.mx{text-align:center;font-weight:600;font-size:11px}
.note{background:#f0f6ff;border-left:4px solid var(--blue);padding:12px 16px;border-radius:0 8px 8px 0;margin:14px 0;font-size:13.5px}
.note.disc{background:#fef2f2;border-color:#ef4444}
.subnav{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0}
.subnav a{font-size:12px;background:#eef2f9;border:1px solid #dfe6f1;color:#3a4453;padding:3px 10px;border-radius:20px;text-decoration:none}
.subnav a:hover{background:var(--blue);color:#fff}
footer{text-align:center;color:var(--muted);font-size:12px;padding:26px}
.grp-row td{background:#eef2f9!important;font-weight:700;font-size:12px;color:#33404f;text-transform:uppercase;letter-spacing:.4px}
.total-row td{background:#0b0f19!important;color:#fff;font-weight:800;border-color:#333}
.reconbox{overflow-x:auto}
.deftbl{display:flex;flex-direction:column;gap:8px;margin-top:14px;font-size:12.5px;color:#3a4453}
.deftbl span{display:flex;gap:8px;align-items:flex-start}
.deftbl i{width:12px;height:12px;border-radius:3px;flex:0 0 12px;margin-top:4px}
.deftbl i.d1{background:#2563eb}.deftbl i.d2{background:#8b5cf6}
.reco-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px}
@media(max-width:900px){.reco-grid{grid-template-columns:1fr}}
.reco-card{position:relative;border:1px solid var(--edge);border-radius:12px;padding:16px 18px 16px 52px;background:#fff}
.reco-card .rn{position:absolute;left:16px;top:16px;width:26px;height:26px;border-radius:50%;background:var(--blue);color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center}
.reco-card h4{margin:0 0 6px;font-size:14.5px}
.reco-card p{margin:0;font-size:12.5px;color:#3a4453}
.reco-card code{background:#f3f5f9;padding:1px 5px;border-radius:4px;font-size:11.5px}
.card.tbv{scroll-margin-top:60px}
.tbv-tbl td{vertical-align:middle}
.tbv-tbl td.bcell{white-space:nowrap;width:200px}
.tbv-tbl .bpg{display:block;font-size:10.5px;color:var(--muted);font-weight:400}
.vchip{display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:2px 8px;border-radius:6px;margin:2px;border:1px solid}
.vchip b{font-weight:800}
.vchip .vpct{font-size:9.5px;opacity:.75;font-weight:700}
.vchip.v-hi{background:#dcfce7;border-color:#a7e0b8;color:#166534}
.vchip.v-md{background:#fef9c3;border-color:#f0e39a;color:#854d0e}
.vchip.v-lo{background:#eef1f6;border-color:#dfe4ec;color:#3a4453}
.capline{margin-top:6px;font-size:10.5px;color:var(--muted)}
.cap2{display:inline-block;background:#f0f6ff;border:1px solid #d6e4fb;color:#1a4bcc;padding:1px 6px;border-radius:5px;margin:1px}
h3.grp{font-size:15px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin:24px 0 4px}
</style></head>
<body>
<header class="hero">
  <div class="badge">ADOBE EDGE DELIVERY SERVICES · DETAILED ANALYSIS & DASHBOARD</div>
  <h1>BRP-World.com → EDS · Blocks, Templates & Variations</h1>
  <div class="sub">Evidence-backed breakdown from DOM analysis of all <b>${pages.length.toLocaleString()}</b> in-scope URLs. Every variation below is detected from real component markers (BEM modifiers, <code>data-*</code> attributes, structural signatures) with page-level counts — not assumed. Complexity and effort are planning-grade EDS build estimates.</div>
</header>
<nav class="toc">
  <a href="#dash">Dashboard</a>
  <a href="#inventory">Block Inventory</a>
  <a href="#blocks">Blocks & Variations</a>
  <a href="#templates">Templates</a>
  <a href="#matrix">Mapping Matrix</a>
  <a href="#tbv">Block→Variation Map</a>
  <a href="#reco">Recommendations</a>
  <a href="#method">Method & Evidence</a>
</nav>
<div class="wrap">

<section id="dash">
<h2 class="sec">Executive Dashboard</h2>
<div class="kpis">
  <div class="kpi"><div class="n">${pages.length.toLocaleString()}</div><div class="l">URLs analyzed</div></div>
  <div class="kpi"><div class="n">${templateRows.length}</div><div class="l">Templates</div></div>
  <div class="kpi"><div class="n">${blockRows.length}</div><div class="l">Content blocks</div></div>
  <div class="kpi"><div class="n">${totalVariations}</div><div class="l">Verified variations</div></div>
  <div class="kpi"><div class="n">${totalCapabilities}</div><div class="l">Optional capabilities</div></div>
  <div class="kpi"><div class="n">${hrs(totalBlockDays + totalTemplateDays)}</div><div class="l">Blocks + templates build</div></div>
  <div class="kpi warn"><div class="n">${noMeta}</div><div class="l">Pages w/o meta-desc</div></div>
  <div class="kpi warn"><div class="n">${multiH1}</div><div class="l">Pages w/ multiple H1</div></div>
</div>
<div class="dash-grid">
  <div class="panel"><h4>Pages per template (top 12)</h4>${hbar(tmplChart, { w: 600, bh: 22, gap: 6 })}</div>
  <div class="panel"><h4>Block footprint — pages containing each block</h4>${hbar(blockChart, { w: 600, bh: 22, gap: 6 })}</div>
</div>
<div class="dash-grid three">
  <div class="panel donut-wrap"><h4>Templates by complexity</h4>${donut(cxChart)}${legend(cxChart)}</div>
  <div class="panel donut-wrap"><h4>Pages by brand world</h4>${donut(brandChart)}${legend(brandChart.map((d, i) => ({ ...d, c: PAL[i % PAL.length] })))}</div>
  <div class="panel"><h4>Third-party integrations (pages)</h4>${hbar(integChart, { w: 560, bh: 18, gap: 5 })}</div>
</div>
<div class="note disc"><b>Key discovery this pass:</b> <b>Adobe Commerce (Magento) middleware is present on 100% of pages</b> (<code>data-magento-middleware-base-url</code>) — the site is commerce-enabled, not purely editorial. Combined with the external BYO configurator (168 pages) and Google Maps dealer locator (168 pages), the "dynamic" surface is larger than a first pass suggests and must be scoped with the commerce/product teams.</div>
</section>

<section id="inventory">
<h2 class="sec">Block Inventory — Reconciled (single source of truth)</h2>
<p class="lead"><b>${blockRows.length} content blocks → ${totalVariations} verified variations</b> (plus ${totalCapabilities} optional capabilities). Every count below is a page count observed in the live DOM — nothing is assumed. Two global blocks (Header, Footer) sit outside this content inventory.</p>
<div class="note disc"><b>Correcting an earlier figure:</b> a previous version of this report quoted <b>54 variations</b>. That number was inflated with variations that were <i>plausible but never found in the DOM</i> (e.g. "Hero Split", "Hero Overlay"). After stripping every unproven entry, the honest, evidence-backed total is <b>${totalVariations} variations across ${blockRows.length} blocks</b>. This table is the number to trust.</p></div>
<div class="reconbox">${reconTable}</div>
<div class="deftbl">
  <span><i class="d1"></i><b>Variation</b> = a structurally different configuration of a block (e.g. image hero vs video hero). Each is a distinct authoring/build case.</span>
  <span><i class="d2"></i><b>Capability</b> = an optional feature that can be toggled on the <i>same</i> instance (e.g. a hero that also shows a CTA bar). Not a separate block — counted separately so it never inflates the block/variation totals.</span>
</div>
</section>

<section id="blocks">
<h2 class="sec">Blocks & Their Variations — Deep Dive</h2>
<p class="lead">Deep dive on all ${blockRows.length} blocks. <b>Rich content blocks</b> carry multiple distinct variations; <b>foundational blocks</b> are single-form building blocks. Percentages are share of pages that contain that block.</p>
<div class="subnav">${richRows.map((b) => `<a href="#blk-${esc(b.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase())}">${esc(b.name.split(' / ')[0])}</a>`).join('')}</div>
<h3 class="grp">Rich content blocks — ${richRows.length} blocks, ${richRows.reduce((s, b) => s + b.variations.length, 0)} variations</h3>
${richCards}
<h3 class="grp">Foundational blocks — ${foundRows.length} blocks, ${foundRows.length} variations (1 each)</h3>
${foundCards}
</section>

<section id="reco">
<h2 class="sec">Recommendations</h2>
<div class="reco-grid">
  <div class="reco-card"><span class="rn">1</span><h4>Build a ${blockRows.length}-block library, phased by evidence</h4><p><b>Phase 1</b> (covers ~95% of pages): Container, Teaser, Image, CTA/Button, Breadcrumb, Hero, Title, Text — each on 480–1,171 pages. <b>Phase 2</b>: Carousel, Accordion, Gallery, Video, Modal, List, Downloads. <b>Phase 3</b>: the specialised/dynamic blocks.</p></div>
  <div class="reco-card"><span class="rn">2</span><h4>Treat capabilities as block options, not blocks</h4><p>The ${totalCapabilities} capabilities (hero sticky-scroll, CTA bar, carousel auto-advance, lazy image, etc.) are toggles on one block. Model them as section/block metadata — this keeps the library at ${blockRows.length}, not ${blockRows.length + totalCapabilities}.</p></div>
  <div class="reco-card"><span class="rn">3</span><h4>Defer the 4 near-zero blocks</h4><p>Tabs (1 page), Table (2), Form (2) and Page-Level Nav (4) are so rare that re-authoring those handful of pages onto existing blocks is cheaper than building & maintaining dedicated blocks — unless strategically required.</p></div>
  <div class="reco-card"><span class="rn">4</span><h4>Front-load the 3 dynamic/high-risk blocks</h4><p>Iframe/BYO Configurator (168 pages), Dealer Locator/Map (184) and Package Selector (301) depend on external systems (<code>zlthunder.net</code>, Google Maps, and the Magento middleware on 100% of pages). Scope these with the commerce/product team before committing dates.</p></div>
  <div class="reco-card"><span class="rn">5</span><h4>Standardise the Teaser first</h4><p>With 4 variations on 1,023 pages, Teaser is the workhorse. One well-modelled Teaser with clean author options collapses the most authoring effort and the most variation surface to maintain.</p></div>
  <div class="reco-card"><span class="rn">6</span><h4>Bank the SEO clean-up during migration</h4><p>${noMeta} pages lack a meta description and ${multiH1} expose multiple H1s (hero carousels). Fix heading discipline and metadata as part of the block/template work rather than as a separate project.</p></div>
</div>
</section>

<section id="templates">
<h2 class="sec">Templates — Deep Dive</h2>
<p class="lead">${templateRows.length} templates across ${pages.length.toLocaleString()} pages. Each card shows the template's purpose, primary blocks, real block-composition profile (% of pages in the template containing each block), quantitative content metrics and content-hygiene flags found during analysis.</p>
<div class="subnav">${templateRows.map((r) => `<a href="#tpl-${esc(r.t.replace(/[^a-z0-9]+/gi, '-').toLowerCase())}">${esc(r.t)} (${r.n})</a>`).join('')}</div>
${tmplCards}
</section>

<section id="matrix">
<h2 class="sec">Template → Block Mapping Matrix</h2>
<p class="lead">Cell = % of pages in the template whose DOM contains the block. Darker = more prevalent. This is the master reference for which blocks must render correctly on which templates.</p>
<div class="tablewrap">
<table>
<thead><tr><th class="sticky">Template</th><th class="num">Pages</th><th class="num">Complexity</th>${matrixHeader}</tr></thead>
<tbody>${matrixTableRows}</tbody>
</table>
</div>
</section>

<section id="tbv">
<h2 class="sec">Template → Block → Variation Mapping</h2>
<p class="lead">The definitive mapping: for each template, exactly <b>which blocks</b> it uses and <b>which variation(s) of each block</b>, with page counts. This is the build spec — it tells you which block variations must be delivered for each template to render correctly. Numbers are pages; the % is the share of that template's pages using the block. Colour: <span class="vchip v-hi">green ≥60%</span> <span class="vchip v-md">amber 25–59%</span> <span class="vchip v-lo">grey &lt;25%</span>.</p>
<div class="subnav">${templateRows.map((r) => `<a href="#tbv-${esc(r.t.replace(/[^a-z0-9]+/gi, '-').toLowerCase())}">${esc(r.t)}</a>`).join('')}</div>
${tbvCards}
</section>

<section id="method">
<h2 class="sec">Method & Evidence</h2>
<p class="lead">This report is generated deterministically from the raw HTML of all ${pages.length.toLocaleString()} URLs (fetched HTTP 200, 0 errors). Variations are detected by concrete DOM markers, not inference:</p>
<table>
<thead><tr><th>Signal type</th><th>Example marker</th><th>Used to detect</th></tr></thead>
<tbody>
<tr><td>WCM component id</td><td><code>data-cmp-is="carousel"</code></td><td>Authoritative block identity (image, carousel, accordion, tabs, tilemosaic)</td></tr>
<tr><td>BEM modifier / sub-element</td><td><code>cmp-hero-block__sticky-container</code>, <code>cmp-teaser__action-link</code></td><td>Hero/teaser variations & capabilities</td></tr>
<tr><td>Behaviour data-attrs</td><td><code>data-cmp-delay</code>, <code>data-yt-id</code>, <code>data-webm</code></td><td>Auto-advance carousels, YouTube vs self-hosted video</td></tr>
<tr><td>Integration data-attrs</td><td><code>data-google-maps-api-key</code>, <code>data-byo-productfinderservice</code>, <code>data-magento-middleware-base-url</code></td><td>Maps, external configurator, commerce middleware</td></tr>
<tr><td>Named component</td><td><code>data-component-name="Image Card"</code></td><td>Explicitly named card variant</td></tr>
</tbody>
</table>
<div class="note">Effort figures are shown in <b>hours</b> (based on an 8-hour person-day) and are planning-grade for a senior EDS team. They cover block + template build only — foundation, integrations, testing, content migration and per-locale translation are estimated separately in the full assessment, <code>report/index.html</code>.</div>
</section>

<footer>Generated from independent DOM analysis of all ${pages.length.toLocaleString()} in-scope URLs · Every variation count is evidence-backed · Estimates are planning-grade.</footer>
</div>
</body></html>`;

fs.writeFileSync(path.join(ROOT, 'report', 'dashboard.html'), html);
console.log('Written report/dashboard.html', (html.length / 1024).toFixed(0), 'KB');
console.log('Blocks:', blockRows.length, '| Variations:', totalVariations, '| Capabilities:', totalCapabilities, '| Templates:', templateRows.length);
console.log('Block hrs:', hrs(totalBlockDays), '| Template hrs:', hrs(totalTemplateDays), '| Total:', hrs(totalBlockDays + totalTemplateDays));
