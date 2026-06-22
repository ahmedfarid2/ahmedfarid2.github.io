// scripts/build.mjs
//
// Turns the raw Claude-design export (index.html — a React app that ships React,
// ReactDOM and a 3 MB in-browser Babel compiler and renders client-side) into a
// fast, crawlable, fully static site in dist/.
//
// Strategy: render the export in a real headless browser, then snapshot the
// rendered DOM. Because we capture *output*, this does not depend on Claude
// design's internal bundle format — only on the rendered HTML/CSS — so it keeps
// working across re-exports. The script:
//   • drops React / ReactDOM / Babel-standalone / editor scaffolding entirely
//   • converts <image-slot> custom elements to plain <img> (keeps the photos)
//   • re-embeds blob: fonts as data: URLs so they survive as static assets
//   • swaps the placeholder "illustrative" GitHub block for live, auto-updating
//     github-readme-stats images
//   • adds a tiny vanilla-JS layer for the nav menu, FAQ accordion, scroll
//     reveal and the Calendly popup (no framework)
//
// If anything goes wrong it falls back to copying the raw export so a push never
// produces a broken deploy.

import { mkdir, writeFile, copyFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'index.html');
const DIST = path.join(ROOT, 'dist');
const GH_USER = 'ahmedfarid2';
const SITE_URL = 'https://ahmedfarid2.github.io';

// ── Locale discovery (by convention) ────────────────────────────────────────
// English lives in the root export `index.html` and builds to dist/ root.
// Any sibling matching `index.<code>.html` (two-letter ISO code) is a
// translation and builds to dist/<code>/index.html. Direction is RTL for
// Arabic, LTR otherwise. This is purely file-name driven, so adding a new
// language is "drop in index.fr.html, rebuild" — zero pipeline edits.
async function discoverLocales() {
  const entries = await readdir(ROOT, { withFileTypes: true });
  const locales = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    const m = /^index\.([a-z]{2})\.html$/.exec(e.name);
    if (!m) continue;
    const code = m[1];
    locales.push({
      lang: code,
      dir: code === 'ar' ? 'rtl' : 'ltr',
      urlPath: `/${code}/`,
      src: path.join(ROOT, e.name),
      outDir: path.join(DIST, code),
    });
  }
  // English is always first / the default.
  locales.unshift({ lang: 'en', dir: 'ltr', urlPath: '/', src: SRC, outDir: DIST });
  // Stable, deterministic order: English then the rest alphabetically.
  return [locales[0], ...locales.slice(1).sort((a, b) => a.lang.localeCompare(b.lang))];
}

// Static-asset files (anything that isn't the source HTML or repo plumbing)
// that should be copied verbatim into dist/, e.g. the CV PDF.
async function copyStaticAssets() {
  const entries = await readdir(ROOT, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isFile()) continue;
    const name = e.name;
    if (name === 'index.html') continue;
    if (/^index\.[a-z]{2}\.html$/.test(name)) continue; // locale source exports
    if (name.startsWith('.')) continue;
    if (/\.(md)$/i.test(name)) continue;
    if (name === 'package.json' || name === 'package-lock.json') continue;
    await copyFile(path.join(ROOT, name), path.join(DIST, name));
    console.log('  copied asset:', name);
  }
}

// Fetch real GitHub data at build time to fill the custom GitHub section.
// REST works unauthenticated (rate-limited); the contribution calendar needs a
// token via GraphQL — GITHUB_TOKEN is provided automatically in GitHub Actions.
// Any failure returns nulls and the build leaves that part of the design as-is.
async function fetchGitHub() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  const headers = { 'User-Agent': 'af-portfolio-build', Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const out = { publicRepos: null, followers: null, calendar: null };

  try {
    const r = await fetch(`https://api.github.com/users/${GH_USER}`, { headers });
    if (r.ok) {
      const j = await r.json();
      out.publicRepos = j.public_repos;
      out.followers = j.followers;
    } else {
      console.log(`  (GitHub REST returned ${r.status} — keeping placeholder counts)`);
    }
  } catch (e) {
    console.log('  (GitHub REST unreachable — keeping placeholder counts)');
  }

  if (token) {
    try {
      const query =
        'query($l:String!){user(login:$l){contributionsCollection{contributionCalendar{weeks{contributionDays{contributionCount}}}}}}';
      const r = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { l: GH_USER } }),
      });
      if (r.ok) {
        const j = await r.json();
        const weeks = j?.data?.user?.contributionsCollection?.contributionCalendar?.weeks || [];
        const counts = [];
        for (const w of weeks) for (const d of w.contributionDays) counts.push(d.contributionCount);
        if (counts.length) {
          const max = Math.max(1, ...counts);
          out.calendar = counts.map((c) => {
            if (c <= 0) return 0;
            const r2 = c / max;
            if (r2 <= 0.25) return 1;
            if (r2 <= 0.5) return 2;
            if (r2 <= 0.75) return 3;
            return 4;
          });
        }
      } else {
        console.log(`  (GitHub GraphQL returned ${r.status} — keeping placeholder heatmap)`);
      }
    } catch (e) {
      console.log('  (GitHub GraphQL unreachable — keeping placeholder heatmap)');
    }
  } else {
    console.log('  (no GITHUB_TOKEN — heatmap stays as-is; set in CI for real data)');
  }

  return out;
}

// Pull the original vanilla "UI/UX enhancement layer" out of the export's
// asset bundle so the static build keeps the exact same effects as Claude
// design (cursor ring, Personalize palette, spotlight, tilt, magnetic buttons,
// parallax, count-up, scroll progress, intro loader, heatmap ripple, etc.).
// Found by content signature rather than asset id, so it survives re-exports.
async function extractEnhancementLayer() {
  const zlib = await import('node:zlib');
  const raw = (await import('node:fs')).readFileSync(SRC, 'utf8');
  // The bundle is a single JSON object mapping asset-id → { mime, compressed, data(base64) }.
  for (const line of raw.split('\n')) {
    const s = line.trim();
    if (s.length < 200 || s[0] !== '{') continue;
    let obj;
    try { obj = JSON.parse(s); } catch { continue; }
    if (!obj || typeof obj !== 'object') continue;
    const first = Object.values(obj)[0];
    if (!first || typeof first !== 'object' || !('data' in first)) continue;
    for (const asset of Object.values(obj)) {
      const mime = asset.mime || '';
      if (!/javascript/.test(mime)) continue;
      let buf;
      try {
        buf = Buffer.from(asset.data, 'base64');
        if (asset.compressed) buf = zlib.gunzipSync(buf);
      } catch { continue; }
      const text = buf.toString('utf8');
      if (text.includes('cursorRing') && text.includes('palettePicker')) {
        return text;
      }
    }
  }
  return null;
}

// sitemap.xml + robots.txt + a styled 404.html. No browser needed, so this
// runs in both the optimized build and the raw-export fallback.
async function writeSeoFiles(locales = [{ urlPath: '/' }]) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = locales
    .map((l, i) =>
      `  <url><loc>${SITE_URL}${l.urlPath}</loc><lastmod>${today}</lastmod>` +
      `<changefreq>monthly</changefreq><priority>${i === 0 ? '1.0' : '0.9'}</priority></url>`)
    .join('\n');
  await writeFile(path.join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls}\n` +
    `</urlset>\n`, 'utf8');

  await writeFile(path.join(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`, 'utf8');

  await writeFile(path.join(DIST, '404.html'),
    `<!doctype html><html lang="en"><head><meta charset="utf-8">\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
    `<title>404 — Ahmed Farid</title><meta name="robots" content="noindex">\n` +
    `<style>:root{color-scheme:dark}*{margin:0;box-sizing:border-box}` +
    `body{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;` +
    `gap:18px;text-align:center;padding:24px;background:#0B0D10;color:#F4F1EA;` +
    `font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;position:relative;overflow:hidden}` +
    `body::before{content:"";position:absolute;top:-30%;left:50%;transform:translateX(-50%);width:700px;height:700px;` +
    `border-radius:50%;background:radial-gradient(circle,rgba(230,200,160,.14),transparent 60%);pointer-events:none}` +
    `.code{font-family:Georgia,serif;font-size:clamp(72px,18vw,160px);line-height:1;letter-spacing:-.03em;position:relative}` +
    `.code em{font-style:italic;color:#E6C8A0}` +
    `h1{font-size:clamp(20px,4vw,28px);font-weight:500;letter-spacing:-.01em}` +
    `p{color:#a8a297;max-width:440px;line-height:1.5}` +
    `a{margin-top:8px;display:inline-flex;align-items:center;gap:8px;padding:12px 22px;border-radius:99px;` +
    `border:1px solid rgba(255,255,255,.18);color:#0B0D10;background:#E6C8A0;text-decoration:none;font-weight:600;` +
    `position:relative;transition:transform .2s}a:hover{transform:translateY(-2px)}</style></head>` +
    `<body><div class="code">4<em>0</em>4</div>` +
    `<h1>This page wandered off.</h1>` +
    `<p>The link may be broken or the page may have moved.</p>` +
    `<a href="/">← Back to Ahmed Farid's portfolio</a></body></html>\n`, 'utf8');

  console.log('  wrote sitemap.xml, robots.txt, 404.html');
}

// Generate a real 1200×630 Open Graph card (branded, on-theme) so LinkedIn /
// Twitter / Slack previews show a proper landscape image instead of the square
// avatar. Rendered with the same headless browser.
async function generateOgImage(browser) {
  const card = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;box-sizing:border-box}html,body{width:1200px;height:630px}
    body{background:#0B0D10;color:#F4F1EA;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
      position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:center;padding:92px 90px}
    .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),
      linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:46px 46px;
      -webkit-mask-image:linear-gradient(180deg,#000,transparent 75%)}
    .glow{position:absolute;top:-220px;right:-160px;width:760px;height:760px;border-radius:50%;
      background:radial-gradient(circle,rgba(230,200,160,.20),transparent 60%)}
    .eyebrow{font-size:21px;letter-spacing:.26em;text-transform:uppercase;color:#9a948a;margin-bottom:30px;position:relative}
    .dot{display:inline-block;width:11px;height:11px;border-radius:50%;background:#E6C8A0;margin-right:14px;vertical-align:middle}
    h1{font-family:Georgia,'Times New Roman',serif;font-size:100px;line-height:1.03;letter-spacing:-.02em;font-weight:600;position:relative}
    h1 em{font-style:italic;color:#E6C8A0}
    .sub{margin-top:32px;font-size:28px;color:#c9c3b8;max-width:940px;line-height:1.45;position:relative}
    .foot{position:absolute;left:90px;bottom:64px;font-size:22px;color:#8b857b;letter-spacing:.02em}
    .foot b{color:#F4F1EA;font-weight:600}
    .tags{position:absolute;right:90px;bottom:64px;font-size:19px;color:#8b857b;letter-spacing:.05em}
  </style></head><body>
    <div class="grid"></div><div class="glow"></div>
    <div class="eyebrow"><span class="dot"></span>Senior Software Engineer · Cairo · Open to relocation</div>
    <h1>I build the systems<br>other teams <em>depend on.</em></h1>
    <div class="sub">Multi-tenant SaaS · real-time platforms · AI tools · mobile apps shipped across the Gulf, US &amp; UK.</div>
    <div class="foot"><b>Ahmed Farid</b> &nbsp;·&nbsp; ahmedfarid2.github.io</div>
    <div class="tags">Laravel · Next.js · FastAPI · Flutter</div>
  </body></html>`;
  const p = await browser.newPage();
  await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await p.setContent(card, { waitUntil: 'load', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 300));
  await p.screenshot({ path: path.join(DIST, 'og.png'), type: 'png' });
  await p.close();
  console.log('  generated og.png (1200×630)');
}

async function fallback(reason) {
  console.warn('\n⚠️  Optimized build failed — deploying raw export instead.');
  console.warn('   Reason:', reason && reason.stack ? reason.stack : reason);
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  await copyFile(SRC, path.join(DIST, 'index.html'));
  await copyStaticAssets();
  await writeSeoFiles();
  console.log('✓ Raw export copied to dist/ (site stays functional, unoptimized).');
}

// Build a single locale page end-to-end: render its source export, run the
// in-page transforms, assemble a clean head/body, externalize data: URLs into
// the SHARED dist/assets/ folder (root-absolute /assets/ refs), minify, and
// write to outDir/index.html. Returns per-page stats. Everything that is
// one-time work (og.png, GitHub fetch, enhancement-layer extraction,
// sitemap/robots/404, copying static assets) is done by the orchestrator and
// passed in — buildPage is called once per locale.
async function buildPage({ browser, src, outDir, lang, dir, locales, ghData, enhanceJS, assetSeen }) {
  const isRoot = outDir === DIST;
  const urlPath = (locales.find((l) => l.lang === lang) || {}).urlPath || '/';
  const multi = locales.length > 1;

  await mkdir(outDir, { recursive: true });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 2 });

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  console.log(`→ [${lang}] Rendering export in headless Chromium…`);
  await page.goto(pathToFileURL(src).href, { waitUntil: 'load', timeout: 90000 });
  // Wait for React to mount the app and for image-slots to settle.
  await page.waitForSelector('#root > *', { timeout: 60000 });
  await page.waitForFunction(
    () => document.getElementById('root') && document.getElementById('root').innerText.length > 5000,
    { timeout: 60000 }
  );
  await new Promise((r) => setTimeout(r, 2500));

  console.log(`→ [${lang}] Transforming + extracting static DOM…`);
  const result = await page.evaluate(async (ghUser, gh, hasEnhance, localeCodes) => {
    // ── Convert <image-slot> → <img> (image lives in shadow DOM otherwise) ──
    document.querySelectorAll('image-slot').forEach((slot) => {
      const src = slot.getAttribute('src') || '';
      const fit = slot.getAttribute('fit') || 'cover';
      const shape = (slot.getAttribute('shape') || 'rounded').toLowerCase();
      const position = slot.getAttribute('position') || '50% 50%';
      let radius = '';
      if (shape === 'circle') radius = '50%';
      else if (shape === 'pill') radius = '9999px';
      else if (shape === 'rounded') {
        const n = parseFloat(slot.getAttribute('radius'));
        radius = (Number.isFinite(n) ? n : 12) + 'px';
      }
      const mask = slot.getAttribute('mask');

      const wrap = document.createElement('div');
      wrap.className = slot.className;
      wrap.setAttribute('style',
        (slot.getAttribute('style') || '') +
        ';position:relative;overflow:hidden;' +
        (mask ? `clip-path:${mask};` : `border-radius:${radius};`));

      if (src) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = slot.getAttribute('alt') || '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.setAttribute('style',
          `display:block;width:100%;height:100%;object-fit:${fit};object-position:${position};`);
        wrap.appendChild(img);
      } else {
        // No author image — keep the box so layout is preserved.
        wrap.style.background = 'rgba(255,255,255,.04)';
      }
      slot.replaceWith(wrap);
    });

    // ── Content self-heal: region badge counts ──────────────────────────────
    // The export hard-codes a count per region that can drift from the actual
    // number of countries listed (e.g. Africa showed "03" with 4 flags).
    // Recompute from the DOM so it's always right, across re-exports.
    document.querySelectorAll('.region-col').forEach((col) => {
      const n = col.querySelectorAll('.region-flag').length;
      const badge = col.querySelector('.region-n');
      if (badge && n > 0) badge.textContent = String(n).padStart(2, '0');
    });

    // ── Brand-logo resilience ───────────────────────────────────────────────
    // The React build gave brand/trust/company logos an onError handler that
    // fell back to a favicon/mono mark; that's lost in static output, so a
    // broken logo would show a broken-image icon and log a console error.
    // Restore graceful fallback, and point known-dead brand assets straight at
    // a favicon so there's no failed request in the console at all.
    document.querySelectorAll('img.logo-img, img.trust-mark, img.co-logo').forEach((img) => {
      const a = img.closest('a[href]');
      let host = '';
      try { host = a ? new URL(a.href).hostname : ''; } catch {}
      const fav = host ? `https://www.google.com/s2/favicons?domain=${host}&sz=128` : '';
      const src = img.getAttribute('src') || '';
      // Known-dead brand asset (ezhal-qtr.com root doesn't resolve) → favicon.
      if (fav && /ezhal-qtr\.com\/argon/i.test(src)) {
        img.setAttribute('src', fav);
      }
      // On any future failure: try the favicon once, then hide cleanly.
      if (!img.getAttribute('onerror')) {
        img.setAttribute('onerror',
          fav
            ? `if(this.src.indexOf('s2/favicons')<0){this.src='${fav}'}else{this.style.display='none'}`
            : `this.style.display='none'`);
      }
    });

    // ── GitHub section: keep the custom design, fill in REAL data ────────────
    // Restores the original hand-designed card/heatmap/repo cards. The React
    // build animated the heatmap in (and set its levels) via JS that no longer
    // runs in static output — the snapshot catches every cell hidden
    // (.cell-pre) at level 0. So we always make the cells visible and assign
    // levels: real contributions when fetched, otherwise a deterministic
    // pattern so the grid never looks empty.
    if (gh) {
      // Public-repos stat (first .gh-stat value).
      if (gh.publicRepos != null) {
        const v = document.querySelector('#github .gh-stat .v');
        if (v) v.textContent = String(gh.publicRepos);
      }

      const cells = [...document.querySelectorAll('#github .gh-heat .cell')];
      if (cells.length) {
        const real = gh.calendar && gh.calendar.length ? gh.calendar : null;
        let levels;
        if (real) {
          levels = cells.map((_, i) => {
            const idx = real.length - cells.length + i;
            return idx >= 0 ? real[idx] : 0;
          });
        } else {
          // Mirror the export's original generator so a tokenless build still
          // shows a lively (clearly illustrative) heatmap.
          let seed = 7;
          const rand = () => ((seed = (seed * 9301 + 49297) % 233280), seed / 233280);
          levels = cells.map((_, i) => {
            const w = Math.floor(i / 7);
            const r = rand();
            let l = 0;
            if (r > 0.4) l = 1;
            if (r > 0.62) l = 2;
            if (r > 0.82) l = 3;
            if (r > 0.94) l = 4;
            if (w < 3 && r < 0.7) l = Math.max(0, l - 2);
            return l;
          });
        }
        cells.forEach((c, i) => c.setAttribute('data-l', String(levels[i])));
        // If the enhancement layer is included it owns the ripple-in animation
        // (cell-pre → cell-in on scroll). Without it, reveal the cells now so
        // the heatmap isn't stuck hidden.
        if (!hasEnhance) {
          cells.forEach((c) => { c.classList.remove('cell-pre'); c.classList.add('cell-in'); c.style.removeProperty('--wd'); });
        }
        // Drop the "· illustrative" qualifier only when the data is actually real.
        if (real) {
          document.querySelectorAll('#github .gh-heat-foot span').forEach((s) => {
            if (/illustrative/i.test(s.textContent)) {
              s.textContent = s.textContent.replace(/\s*[·.|-]?\s*illustrative/i, '').trim() || 'Contribution activity';
            }
          });
        }
      }

      // The repo cards are real repos with real descriptions — drop the
      // "illustrative" metadata disclaimer.
      document.querySelectorAll('#github .fineprint').forEach((el) => {
        if (/illustrative/i.test(el.textContent)) el.remove();
      });
    }

    // ── Re-embed blob: fonts (and any blob assets) as data: URLs ────────────
    const styleEls = [...document.querySelectorAll('style')];
    let css = styleEls.map((s) => s.textContent).join('\n');
    const blobUrls = [...new Set((css.match(/blob:[^"')\s]+/g) || []))];
    const blobToDataUrl = (blob) =>
      new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = rej;
        fr.readAsDataURL(blob);
      });
    for (const u of blobUrls) {
      try {
        const blob = await fetch(u).then((r) => r.blob());
        const dataUrl = await blobToDataUrl(blob);
        css = css.split(u).join(dataUrl);
      } catch (e) {
        /* leave as-is; worst case a font falls back */
      }
    }

    // ── Capture head metadata (rebuilt clean on the Node side) ──────────────
    const pick = (sel) => [...document.querySelectorAll(sel)].map((el) => el.outerHTML);
    const meta = [
      ...pick('meta[name="description"]'),
      ...pick('meta[name="author"]'),
      ...pick('meta[name="theme-color"]'),
      ...pick('meta[property^="og:"]'),
      ...pick('meta[name^="twitter:"]'),
      ...pick('link[rel="icon"]'),
      ...pick('link[rel="canonical"]'),
      ...pick('link[rel="apple-touch-icon"]'),
      ...pick('script[type="application/ld+json"]'),
    ];
    const title = document.title;
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const bodyClass = document.body.className || '';
    const rootAttrs = {};
    for (const a of document.documentElement.attributes) rootAttrs[a.name] = a.value;
    // Body data-* (e.g. data-grain) drives texture/theme rules — preserve them.
    const bodyAttrs = {};
    for (const a of document.body.attributes) if (a.name.startsWith('data-')) bodyAttrs[a.name] = a.value;

    // The export ships its OWN language switcher (`.locale`), but in static
    // output the snapshot bakes in a DEAD copy — its click handlers don't
    // survive, and the enhancement JS rebuilds a fresh, live one at runtime
    // (correct dropdown + deployed-URL routing). So remove every baked copy
    // here; the runtime build produces exactly one working switcher. (If a
    // future export ships no such JS, the assembler injects a static fallback.)
    const ownSwitchers = [...document.querySelectorAll('.locale, .lang-switcher, [data-locale-switcher]')];
    const hasOwnSwitcher = ownSwitchers.length > 0;
    ownSwitchers.forEach((el) => el.remove());
    document.querySelectorAll('a[href]').forEach((a) => {
      const bare = (a.getAttribute('href') || '').replace(/^\.?\//, '');
      if (bare === 'index.html') a.setAttribute('href', '/');
      else {
        const m = /^index\.([a-z]{2})\.html$/.exec(bare);
        if (m && localeCodes.includes(m[1])) a.setAttribute('href', `/${m[1]}/`);
      }
    });

    return {
      title, lang, meta, css, bodyClass, rootAttrs, bodyAttrs, hasOwnSwitcher,
      body: document.getElementById('root').innerHTML,
      blobCount: blobUrls.length,
    };
  }, GH_USER, ghData, !!enhanceJS, locales.map((l) => l.lang));

  await page.close();

  if (pageErrors.length) {
    console.log(`  [${lang}] (${pageErrors.length} non-fatal page errors during render — expected for blocked external assets)`);
  }
  console.log(`  [${lang}] re-embedded ${result.blobCount} blob asset(s) as data: URLs`);

  // ── Assemble the static document ──────────────────────────────────────────
  // Force this locale's lang (and RTL direction for Arabic) onto <html> while
  // preserving the export's other root attributes (notably data-theme="dark"
  // and any other captured data-*). lang/dir are set explicitly below, so we
  // drop any captured lang/dir to avoid duplicates.
  // Force dark as the default theme (the headless snapshot captures light from
  // prefers-color-scheme). Client JS still honors a returning visitor's choice.
  if (result.rootAttrs['data-theme']) result.rootAttrs['data-theme'] = 'dark';
  const dataAttrs = Object.entries(result.rootAttrs)
    .filter(([k]) => (k.startsWith('data-') || k === 'lang' || k === 'dir'))
    .filter(([k]) => k !== 'lang' && k !== 'dir')
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  const langDirAttrs = `lang="${lang}"${dir === 'rtl' ? ' dir="rtl"' : ''}`;
  const htmlAttrs = [langDirAttrs, dataAttrs].filter(Boolean).join(' ');
  const bodyDataAttrs = Object.entries(result.bodyAttrs || {})
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');

  // Point og:image / twitter:image at the generated 1200×630 card (drop the
  // square-avatar one from the export) and ensure og:url is present.
  const ogImg = `${SITE_URL}/og.png`;

  // Canonical Person structured data — used to inject a block if the export has
  // none, and to enrich an existing export block with fields it may lack.
  const personLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Ahmed Farid',
    jobTitle: 'Senior Software Engineer',
    url: `${SITE_URL}/`,
    image: `${SITE_URL}/og.png`,
    email: 'ahmedfareed2025@gmail.com',
    address: { '@type': 'PostalAddress', addressLocality: 'Cairo', addressCountry: 'EG' },
    worksFor: { '@type': 'Organization', name: 'Recovery Advisers' },
    alumniOf: { '@type': 'CollegeOrUniversity', name: 'Helwan University' },
    knowsAbout: ['Laravel', 'Next.js', 'FastAPI', 'Flutter', 'React', 'TypeScript', 'PHP', 'AWS', 'Multi-tenant SaaS'],
    sameAs: [
      'https://www.linkedin.com/in/ahmed-farid-b46a5221b/',
      'https://github.com/ahmedfarid2',
      'https://www.behance.net/ahmedfarid20',
    ],
  };

  // Enrich an existing Person JSON-LD from the export with knowsAbout /
  // worksFor / alumniOf when those fields are missing — keeps the export's own
  // name/sameAs/etc. untouched, just fills the skill/affiliation gaps for SEO.
  result.meta = result.meta.map((m) => {
    const mm = /^(<script[^>]*ld\+json[^>]*>)([\s\S]*?)(<\/script>)$/i.exec(m.trim());
    if (!mm) return m;
    try {
      const obj = JSON.parse(mm[2]);
      if (obj && obj['@type'] === 'Person') {
        for (const k of ['knowsAbout', 'worksFor', 'alumniOf']) {
          if (obj[k] == null) obj[k] = personLd[k];
        }
        return `${mm[1]}${JSON.stringify(obj)}${mm[3]}`;
      }
    } catch { /* leave malformed ld+json untouched */ }
    return m;
  });

  const pageUrl = `${SITE_URL}${urlPath}`;

  // Point og:image / twitter:image at the generated card (drop the export's
  // square-avatar one), set og:url to THIS locale's URL, and override the
  // export's canonical with this locale's canonical.
  const hasLd = result.meta.some((m) => /ld\+json/i.test(m));
  const cleanedMeta = result.meta.filter(
    (m) => !/og:image|twitter:image|og:url/i.test(m) && !/rel=["']?canonical/i.test(m)
  );
  const ogMeta = [
    `<link rel="canonical" href="${pageUrl}">`,
    `<meta property="og:url" content="${pageUrl}">`,
    `<meta property="og:image" content="${ogImg}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:type" content="image/png">`,
    `<meta property="og:image:alt" content="Ahmed Farid — Senior Software Engineer">`,
    `<meta name="twitter:image" content="${ogImg}">`,
  ].join('\n');

  // hreflang alternates — only meaningful when more than one locale exists.
  // Lists every locale plus x-default → English root.
  const hreflang = multi
    ? locales
        .map((l) => `<link rel="alternate" hreflang="${l.lang}" href="${SITE_URL}${l.urlPath}">`)
        .concat(`<link rel="alternate" hreflang="x-default" href="${SITE_URL}/">`)
        .join('\n')
    : '';

  const headMeta = `${cleanedMeta.join('\n')}\n${ogMeta}${hreflang ? '\n' + hreflang : ''}`;
  const jsonLd = hasLd ? '' : `<script type="application/ld+json">${JSON.stringify(personLd)}</script>`;

  // ── Language switcher (only when multiple locales exist) ──────────────────
  // Minimal, on-theme: mono font, accent color, fixed top-right, sits below the
  // nav (z-index < nav). When only English exists this is empty → no visual
  // change vs today.
  const langName = { en: 'EN', es: 'ES', fr: 'FR', ar: 'AR', de: 'DE', pt: 'PT', it: 'IT' };
  // Prefer the export's OWN switcher (the .locale globe dropdown built by the
  // enhancement JS). Current exports build a single switcher that routes by
  // deployed URL (/es/, /fr/) on the live site and by filename in the design
  // preview, and queue not-yet-shipped languages as "soon" — so Claude design
  // stays the single source of truth. We only fall back to injecting our own
  // reliable static switcher if a future export ships without one.
  const hasDesignSwitcher =
    !!enhanceJS && enhanceJS.includes('localeSwitcher') && enhanceJS.includes('locale-menu');
  const injectSwitcher = multi && !hasDesignSwitcher;
  const switcherCss = injectSwitcher ? `
.locale{display:none!important}
.lang-switch{position:fixed;top:18px;right:20px;z-index:120;display:flex;gap:2px;align-items:center;
  font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11px;letter-spacing:.08em;
  padding:4px 6px;border-radius:99px;background:rgba(11,13,16,.55);backdrop-filter:blur(8px);
  border:1px solid rgba(255,255,255,.12)}
.lang-switch a{color:#a8a297;text-decoration:none;padding:3px 7px;border-radius:99px;transition:color .15s,background .15s}
.lang-switch a:hover{color:#F4F1EA}
.lang-switch a[aria-current="true"]{color:#0B0D10;background:#E6C8A0;font-weight:600}
[dir="rtl"] .lang-switch{right:auto;left:16px}` : '';
  const switcher = injectSwitcher
    ? `<nav class="lang-switch" aria-label="Language">` +
      locales
        .map((l) =>
          `<a href="${l.urlPath}"${l.lang === lang ? ' aria-current="true"' : ''}>` +
          `${langName[l.lang] || l.lang.toUpperCase()}</a>`)
        .join('') +
      `</nav>`
    : '';

  const interactivity = `
// Minimal vanilla interactivity — replaces the React runtime for the few
// dynamic bits of an otherwise-static page.
(function(){
  var nav=document.querySelector('.nav');
  if(nav){
    var onScroll=function(){nav.setAttribute('data-scrolled', window.scrollY>24);};
    onScroll(); addEventListener('scroll',onScroll,{passive:true});
    var burger=nav.querySelector('.nav-burger');
    if(burger) burger.addEventListener('click',function(){
      var open=nav.getAttribute('data-menu')==='true';
      nav.setAttribute('data-menu',String(!open));
      burger.setAttribute('aria-expanded',String(!open));
    });
    nav.querySelectorAll('a[href^="#"]').forEach(function(a){
      a.addEventListener('click',function(){nav.setAttribute('data-menu','false');});
    });
  }
  // FAQ accordion (one open at a time, click to toggle).
  document.querySelectorAll('.faq-item').forEach(function(item){
    var q=item.querySelector('.faq-q');
    if(!q) return;
    q.addEventListener('click',function(){
      var isOpen=item.getAttribute('data-open')==='true';
      document.querySelectorAll('.faq-item').forEach(function(i){i.setAttribute('data-open','false');});
      item.setAttribute('data-open',String(!isOpen));
    });
  });
  // Case-study "Read the case study" deep-dive expanders.
  document.querySelectorAll('.deepdive-toggle').forEach(function(btn){
    btn.addEventListener('click',function(){
      var dd=btn.closest('.deepdive');
      if(!dd) return;
      var open=dd.classList.toggle('open');
      btn.setAttribute('aria-expanded',String(open));
    });
  });
  // Scroll-reveal: animate in on view; show immediately if IO is unavailable.
  var reveals=document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){
      if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}
    });},{threshold:0.12,rootMargin:'0px 0px -60px 0px'});
    reveals.forEach(function(el){io.observe(el);});
  } else { reveals.forEach(function(el){el.classList.add('in');}); }
  // Calendly popup for any calendly link (keeps the in-page popup behaviour).
  document.querySelectorAll('a[href*="calendly.com"]').forEach(function(a){
    a.addEventListener('click',function(e){
      if(window.Calendly){e.preventDefault();window.Calendly.initPopupWidget({url:a.getAttribute('href')});}
    });
  });
})();`.trim();

  const html = `<!doctype html>
<html ${htmlAttrs}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${result.title}</title>
${headMeta}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://assets.calendly.com/assets/external/widget.css">
<noscript><style>.reveal,.cell-pre{opacity:1!important;transform:none!important}</style></noscript>
${jsonLd}
<style>${result.css}</style>
<style>
/* Build fix: the Personalize widget's closed popup keeps its layout space
   (opacity:0, not display:none), so the container's box was intercepting
   clicks/hover over the bottom-left — buttons there only worked after
   scrolling them out of that zone. Make the container click-through except
   its toggle and the open panel. */
.palette{pointer-events:none}
.palette-toggle,.palette.open .palette-pop{pointer-events:auto}${switcherCss}
</style>
</head>
<body class="${result.bodyClass}"${bodyDataAttrs ? ' ' + bodyDataAttrs : ''}>
${switcher}
<div id="root">${result.body}</div>
<script src="https://assets.calendly.com/assets/external/widget.js" async></script>
${enhanceJS ? `<script>${enhanceJS}</script>` : ''}
<script>${interactivity}</script>
</body>
</html>`;

  // ── Externalize large data: URLs (fonts + images) into cacheable files ────
  // Assets live in the SHARED dist/assets/ folder and are referenced
  // ROOT-ABSOLUTE as /assets/<hash>.<ext> so sub-locale pages (served from
  // /<code>/) resolve them too. The assetSeen map is shared across locales so
  // identical (content-hashed) assets are written once and deduped.
  const { createHash } = await import('node:crypto');
  const EXT = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'font/woff2': 'woff2', 'font/woff': 'woff', 'application/font-woff2': 'woff2' };
  const INLINE_LIMIT = 2048; // bytes of decoded data — below this, leave inline
  await mkdir(path.join(DIST, 'assets'), { recursive: true });
  let assetCount = 0, assetBytes = 0;
  let externalized = html;
  const dataUrlRe = /data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/gi;
  const matches = [...new Set(externalized.match(dataUrlRe) || [])];
  for (const full of matches) {
    const m = /^data:([^;]+);base64,(.*)$/s.exec(full);
    if (!m) continue;
    const mime = m[1].toLowerCase();
    const ext = EXT[mime];
    if (!ext) continue;
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length < INLINE_LIMIT) continue;
    let file = assetSeen.get(full);
    if (!file) {
      const hash = createHash('sha1').update(buf).digest('hex').slice(0, 12);
      file = `/assets/${hash}.${ext}`; // root-absolute
      if (!existsSync(path.join(DIST, file.slice(1)))) {
        await writeFile(path.join(DIST, file.slice(1)), buf);
        assetCount++; assetBytes += buf.length;
      }
      assetSeen.set(full, file);
    }
    externalized = externalized.split(full).join(file);
  }
  console.log(`  [${lang}] externalized ${assetCount} new asset(s) (${(assetBytes / 1e6).toFixed(2)} MB) to dist/assets/`);

  // ── Rewrite root-relative resource links that would break under /<code>/ ──
  // The CV PDF is referenced relatively (href="Ahmed-Farid-CV.pdf"); under a
  // sub-locale path that resolves to /<code>/Ahmed-Farid-CV.pdf which 404s.
  // Make it root-absolute. Resolves identically for the root English page, so
  // English stays functionally identical. In-page anchors (#work), data: and
  // absolute (http/https//, /...) URLs are left untouched.
  externalized = externalized.replace(
    /(href|src)=("|')(?!https?:|\/\/|\/|#|data:|mailto:|tel:)(Ahmed-Farid-CV\.pdf)\2/gi,
    (_, attr, q, file) => `${attr}=${q}/${file}${q}`
  );

  // ── Minify (best-effort; skip if minifier unavailable) ────────────────────
  let out = externalized;
  try {
    const { minify } = await import('html-minifier-terser');
    out = await minify(externalized, {
      collapseWhitespace: true,
      removeComments: true,
      minifyCSS: true,
      minifyJS: true,
      keepClosingSlash: true,
    });
  } catch {
    console.log('  (html-minifier-terser not present — writing unminified)');
  }

  await writeFile(path.join(outDir, 'index.html'), out, 'utf8');

  const before = (await import('node:fs')).statSync(src).size;
  const after = Buffer.byteLength(out);
  console.log(`✓ [${lang}] Built ${path.relative(ROOT, path.join(outDir, 'index.html'))}`);
  console.log(`  source export: ${(before / 1e6).toFixed(2)} MB  →  static HTML: ${(after / 1e6).toFixed(3)} MB (+ shared assets, lazy/cacheable)`);

  return { lang, urlPath, htmlPath: path.join(outDir, 'index.html'), pageErrors: pageErrors.length };
}

async function build() {
  const puppeteer = (await import('puppeteer')).default;

  const locales = await discoverLocales();
  console.log(`→ Locales discovered: ${locales.map((l) => `${l.lang}${l.dir === 'rtl' ? '(rtl)' : ''} → ${l.urlPath}`).join(', ')}`);

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  });

  // ── One-time shared work (run once, not per locale) ───────────────────────
  console.log('→ Fetching real GitHub data…');
  const ghData = await fetchGitHub();
  console.log(`  publicRepos=${ghData.publicRepos ?? 'n/a'}  followers=${ghData.followers ?? 'n/a'}  calendarDays=${ghData.calendar ? ghData.calendar.length : 'n/a'}`);

  console.log('→ Extracting original UI/UX enhancement layer…');
  let enhanceJS = await extractEnhancementLayer();
  console.log(enhanceJS ? `  found (${(enhanceJS.length / 1024).toFixed(1)} KB) — effects preserved` : '  not found — using fallback interactivity only');
  // Default theme = dark for everyone on first visit (export follows OS
  // prefers-color-scheme). Returning visitors' saved choice still wins.
  if (enhanceJS) {
    enhanceJS = enhanceJS.replace(
      /window\.matchMedia\(\s*(["'])\(prefers-color-scheme:\s*light\)\1\s*\)\.matches\s*\?\s*(["'])light\2\s*:\s*(["'])dark\3/g,
      '"dark"'
    );
  }

  console.log('→ Generating Open Graph card…');
  try { await generateOgImage(browser); } catch (e) { console.log('  (og.png generation skipped:', e.message + ')'); }

  // ── Per-locale pages (shared assets folder, deduped via assetSeen) ────────
  const assetSeen = new Map();
  for (const loc of locales) {
    await buildPage({
      browser,
      src: loc.src,
      outDir: loc.outDir,
      lang: loc.lang,
      dir: loc.dir,
      locales,
      ghData,
      enhanceJS,
      assetSeen,
    });
  }

  await browser.close();

  // ── One-time SEO + static assets ──────────────────────────────────────────
  await copyStaticAssets();
  await writeSeoFiles(locales);

  // ── Verify each built page actually renders ───────────────────────────────
  console.log('→ Verifying built output…');
  const vb = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'] });
  for (const loc of locales) {
    const vp = await vb.newPage();
    const vErrors = [];
    vp.on('pageerror', (e) => vErrors.push(String(e)));
    await vp.goto(pathToFileURL(path.join(loc.outDir, 'index.html')).href, { waitUntil: 'load', timeout: 60000 });
    const check = await vp.evaluate(() => ({
      text: (document.body.innerText || '').length,
      sections: document.querySelectorAll('section[id]').length,
      imgs: document.querySelectorAll('img').length,
      hasReact: typeof window.React !== 'undefined',
      faq: document.querySelectorAll('.faq-item').length,
    }));
    await vp.close();
    if (check.text < 5000 || check.sections < 8) {
      await vb.close();
      throw new Error(`[${loc.lang}] Verification failed: text=${check.text} sections=${check.sections}`);
    }
    console.log(`  ✓ [${loc.lang}] renders: ${check.text} chars, ${check.sections} sections, ${check.imgs} images, ${check.faq} FAQ items, React shipped=${check.hasReact}`);
    if (vErrors.length) console.log(`    ([${loc.lang}] ${vErrors.length} non-fatal errors — expected for blocked external assets in CI)`);
  }
  await vb.close();

  console.log(`\n✓ Built ${locales.length} locale page(s); removed React/ReactDOM/Babel-standalone/editor scaffolding.`);
}

try {
  if (!existsSync(SRC)) throw new Error('index.html not found at repo root');
  await build();
} catch (err) {
  await fallback(err);
}
