// Exhaustive scan of ALL external hosts, script srcs, iframe srcs, /api/ endpoints,
// link rel, form actions, and known vendor signatures across every cached HTML file.
// No reliance on a hard-coded pattern list — discover every external domain first.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT = path.join(ROOT, 'dentsplysirona-report');
const CACHE = path.join(OUT, 'pages_cache');
const files = fs.readdirSync(CACHE).filter((f) => f.endsWith('.html'));

const OWN = /(^|\.)dentsplysirona\.com$/i; // treat as first-party
const hostPages = {};       // host -> Set(file)
const scriptHostPages = {}; // host -> Set(file) for <script src>
const apiEndpoints = {};     // path -> Set(file)
const iframeHosts = {};      // host -> Set(file)
const formActions = {};      // action -> count

function addSet(map, key, f) { (map[key] = map[key] || new Set()).add(f); }

// unescape common JSON-escaped URL forms so we catch hosts inside inline JSON
const unesc = (s) => s.replace(/\\u002[dD]/g, '-').replace(/\\\//g, '/').replace(/\\x22|\\"/g, '"');

for (const f of files) {
  let html = fs.readFileSync(path.join(CACHE, f), 'utf8');
  html = unesc(html);

  // every absolute URL host
  for (const m of html.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})(?:[:/?#]|["'\\])/gi)) {
    const host = m[1].toLowerCase();
    if (OWN.test(host)) continue;
    addSet(hostPages, host, f);
  }
  // <script src>
  for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    try { const h = new URL(m[1], 'https://www.dentsplysirona.com').host.toLowerCase(); if (!OWN.test(h)) addSet(scriptHostPages, h, f); } catch {}
  }
  // <iframe src>
  for (const m of html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)) {
    try { const h = new URL(m[1], 'https://www.dentsplysirona.com').host.toLowerCase(); addSet(iframeHosts, OWN.test(h) ? '(self) ' + new URL(m[1], 'https://www.dentsplysirona.com').pathname.split('/').slice(0, 4).join('/') : h, f); } catch {}
  }
  // /api/ endpoints (first path segments)
  for (const m of html.matchAll(/["'(]\/(api|bin|graphql|content\/[a-z-]+\/[a-z-]+\/api)\/[a-z0-9/_.-]*/gi)) {
    const p = m[0].replace(/^["'(]/, '').split('?')[0].split('#')[0];
    const norm = p.split('/').slice(0, 4).join('/');
    addSet(apiEndpoints, norm, f);
  }
  // form actions
  for (const m of html.matchAll(/<form[^>]+action=["']([^"']*)["']/gi)) {
    const a = m[1] || '(none)';
    formActions[a] = (formActions[a] || 0) + 1;
  }
}

const N = files.length;
const toSorted = (map) => Object.entries(map).map(([k, s]) => [k, s.size]).sort((a, b) => b[1] - a[1]);

const result = {
  filesScanned: N,
  externalHosts: toSorted(hostPages),
  scriptHosts: toSorted(scriptHostPages),
  iframeSrcs: toSorted(iframeHosts),
  apiEndpoints: toSorted(apiEndpoints),
  formActions: Object.entries(formActions).sort((a, b) => b[1] - a[1]),
};
fs.writeFileSync(path.join(OUT, 'data', 'external-scan.json'), JSON.stringify(result, null, 2));

console.log('files scanned:', N);
console.log('\n=== EXTERNAL HOSTS (host -> #pages) ===');
for (const [h, c] of result.externalHosts) console.log(String(c).padStart(5), h);
console.log('\n=== SCRIPT SRC HOSTS ===');
for (const [h, c] of result.scriptHosts) console.log(String(c).padStart(5), h);
console.log('\n=== IFRAME SRCS ===');
for (const [h, c] of result.iframeSrcs.slice(0, 30)) console.log(String(c).padStart(5), h);
console.log('\n=== API ENDPOINTS ===');
for (const [p, c] of result.apiEndpoints.slice(0, 30)) console.log(String(c).padStart(5), p);
console.log('\n=== FORM ACTIONS (top) ===');
for (const [a, c] of result.formActions.slice(0, 15)) console.log(String(c).padStart(5), a || '(empty)');
