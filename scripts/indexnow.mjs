// scripts/indexnow.mjs
//
// Tells IndexNow search engines (Bing, Yandex, Seznam, Naver…) about every URL
// in the live sitemap, so new and changed pages are crawled in hours rather
// than whenever the crawler next drops by. Google does not use IndexNow; it
// reads the Sitemap line in robots.txt.
//
//   npm run indexnow             submit the live sitemap
//   npm run indexnow -- --dry-run  print what would be sent, send nothing
//
// Runs from .github/workflows/indexnow.yml after each successful deploy of
// main. Before submitting it waits until the deployed site serves the key
// file, because IndexNow verifies ownership by fetching it. No dependencies:
// built-in fetch only, so the workflow needs no npm ci.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_URL, INDEXNOW_KEY } from './site-facts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const DRY_RUN = process.argv.includes('--dry-run');
const KEY_URL = `${SITE_URL}/${INDEXNOW_KEY}.txt`;
const MAX_URLS = 10000; // IndexNow's per-request limit

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(msg) {
  console.error(`✗ IndexNow: ${msg}`);
  process.exit(1);
}

// The key is 8–128 chars of [a-zA-Z0-9-] (IndexNow spec), and the committed
// key file must hold exactly the key, or verification fails on their side.
async function checkLocalKey() {
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(INDEXNOW_KEY)) fail(`INDEXNOW_KEY "${INDEXNOW_KEY}" is not a valid key`);
  let body;
  try {
    body = await readFile(path.join(ROOT, `${INDEXNOW_KEY}.txt`), 'utf8');
  } catch {
    fail(`${INDEXNOW_KEY}.txt is missing from the repo root`);
  }
  if (body.trim() !== INDEXNOW_KEY) fail(`${INDEXNOW_KEY}.txt does not contain the key`);
}

// A fresh Pages deploy can take a minute or two to serve; poll until it does.
async function waitForLiveKey() {
  for (let i = 1; i <= 20; i++) {
    try {
      const res = await fetch(`${KEY_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok && (await res.text()).trim() === INDEXNOW_KEY) {
        console.log(`  key file live: ${KEY_URL}`);
        return;
      }
      console.log(`  key file not live yet (HTTP ${res.status}), attempt ${i}/20`);
    } catch (e) {
      console.log(`  key file not reachable (${e.message}), attempt ${i}/20`);
    }
    await sleep(15000);
  }
  fail(`${KEY_URL} never served the key — is the deploy live?`);
}

// A dry run reads the local build (dist/sitemap.xml) so it works offline;
// a real run reads what is actually deployed.
async function sitemapXml() {
  if (DRY_RUN) {
    try { return await readFile(path.join(ROOT, 'dist', 'sitemap.xml'), 'utf8'); } catch { /* fall back to live */ }
  }
  const res = await fetch(`${SITE_URL}/sitemap.xml?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) fail(`sitemap.xml returned HTTP ${res.status}`);
  return res.text();
}

async function sitemapUrls() {
  const xml = await sitemapXml();
  const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  const host = new URL(SITE_URL).host;
  const own = urls.filter((u) => { try { return new URL(u).host === host; } catch { return false; } });
  if (!own.length) fail('sitemap.xml lists no URLs on this host');
  if (own.length !== urls.length) console.log(`  skipped ${urls.length - own.length} off-host URL(s)`);
  return [...new Set(own)].slice(0, MAX_URLS);
}

// 200 = accepted, 202 = accepted while the key is still being verified.
// Everything else is a real problem worth a red run.
const REASONS = {
  400: 'bad request (malformed payload)',
  403: 'key not valid (key file missing or wrong)',
  422: 'URLs do not belong to the host, or the key does not match',
  429: 'too many requests (rate-limited)',
};

async function submit(urlList) {
  const payload = { host: new URL(SITE_URL).host, key: INDEXNOW_KEY, keyLocation: KEY_URL, urlList };
  if (DRY_RUN) {
    console.log(JSON.stringify(payload, null, 2));
    console.log(`✓ IndexNow dry run: ${urlList.length} URL(s), nothing sent`);
    return;
  }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });
  if (res.status === 200 || res.status === 202) {
    console.log(`✓ IndexNow: submitted ${urlList.length} URL(s) — HTTP ${res.status}`);
    return;
  }
  const text = (await res.text().catch(() => '')).slice(0, 300);
  fail(`HTTP ${res.status} — ${REASONS[res.status] || 'unexpected response'}${text ? `: ${text}` : ''}`);
}

await checkLocalKey();
if (!DRY_RUN) await waitForLiveKey();
await submit(await sitemapUrls());
