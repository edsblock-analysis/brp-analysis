// Fetch all URLs from analysis-urls.txt with bounded concurrency, cache raw HTML.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const URLS = fs.readFileSync(path.join(ROOT, 'analysis-urls.txt'), 'utf8')
  .split('\n').map((s) => s.trim()).filter(Boolean);
const CACHE = path.join(ROOT, 'report', 'pages_cache');
fs.mkdirSync(CACHE, { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const CONCURRENCY = 12;

function keyFor(u) {
  return u.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 180) + '.html';
}

const results = [];
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
      const res = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, signal: ctrl.signal, redirect: 'follow' });
      clearTimeout(t);
      const body = await res.text();
      fs.writeFileSync(file, body);
      done += 1;
      return { url: u, status: res.status, bytes: body.length, finalUrl: res.url };
    } catch (e) {
      if (attempt === 2) { done += 1; return { url: u, status: 'ERROR', error: String(e).slice(0, 120) }; }
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  return { url: u, status: 'ERROR' };
}

async function run() {
  const queue = [...URLS];
  async function worker() {
    while (queue.length) {
      const u = queue.shift();
      const r = await fetchOne(u);
      results.push(r);
      if (done % 50 === 0) process.stderr.write(`  fetched ${done}/${URLS.length}\n`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  fs.writeFileSync(path.join(ROOT, 'report', 'data', 'fetch-log.json'), JSON.stringify(results, null, 2));
  const errs = results.filter((r) => r.status === 'ERROR' || (typeof r.status === 'number' && r.status >= 400));
  process.stderr.write(`DONE. total=${results.length} errors/4xx=${errs.length}\n`);
}
run();
