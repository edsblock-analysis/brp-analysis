// Fetch all dentsplysirona URLs with bounded concurrency; cache raw HTML.
// Records status, redirect (final URL), bytes. Do not miss any URL.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT = path.join(ROOT, 'dentsplysirona-report');
const RAW = fs.readFileSync(path.join(ROOT, 'dentsplysirona.txt'), 'utf8')
  .split('\n').map((s) => s.trim()).filter(Boolean);
const seen = new Set();
const URLS = RAW.filter((u) => { const k = u.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });

const CACHE = path.join(OUT, 'pages_cache');
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const CONCURRENCY = 12;
const keyFor = (u) => u.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 200) + '.html';

const results = new Array(URLS.length);
let done = 0;

async function fetchOne(u) {
  const file = path.join(CACHE, keyFor(u));
  if (fs.existsSync(file) && fs.statSync(file).size > 500) {
    done += 1;
    return { url: u, status: 'cached', bytes: fs.statSync(file).size };
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 30000);
      const res = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en' }, signal: ctrl.signal, redirect: 'follow' });
      clearTimeout(t);
      const body = await res.text();
      if (body && body.length > 300) fs.writeFileSync(file, body);
      done += 1;
      return { url: u, status: res.status, bytes: body.length, finalUrl: res.url, redirected: res.url !== u };
    } catch (e) {
      if (attempt === 2) { done += 1; return { url: u, status: 'ERROR', error: String(e).slice(0, 140) }; }
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  return { url: u, status: 'ERROR' };
}

async function run() {
  const queue = URLS.map((u, i) => [u, i]);
  async function worker() {
    while (queue.length) {
      const [u, i] = queue.shift();
      results[i] = await fetchOne(u);
      if (done % 100 === 0) process.stderr.write(`  fetched ${done}/${URLS.length}\n`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  fs.writeFileSync(path.join(OUT, 'data', 'fetch-log.json'), JSON.stringify(results, null, 2));
  const errs = results.filter((r) => r.status === 'ERROR' || (typeof r.status === 'number' && r.status >= 400));
  const reds = results.filter((r) => r.redirected);
  process.stderr.write(`\nDONE. total=${results.length} unique=${URLS.length} redirected=${reds.length} errors/4xx+=${errs.length}\n`);
  if (errs.length) process.stderr.write('ERRORS: ' + errs.slice(0, 20).map((e) => e.url + ' (' + e.status + ')').join('\n  ') + '\n');
}
run();
