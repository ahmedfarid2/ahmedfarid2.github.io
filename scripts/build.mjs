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

// Static-asset files (anything that isn't the source HTML or repo plumbing)
// that should be copied verbatim into dist/, e.g. the CV PDF.
async function copyStaticAssets() {
  const entries = await readdir(ROOT, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isFile()) continue;
    const name = e.name;
    if (name === 'index.html') continue;
    if (name.startsWith('.')) continue;
    if (/\.(md)$/i.test(name)) continue;
    if (name === 'package.json' || name === 'package-lock.json') continue;
    await copyFile(path.join(ROOT, name), path.join(DIST, name));
    console.log('  copied asset:', name);
  }
}

async function fallback(reason) {
  console.warn('\n⚠️  Optimized build failed — deploying raw export instead.');
  console.warn('   Reason:', reason && reason.stack ? reason.stack : reason);
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  await copyFile(SRC, path.join(DIST, 'index.html'));
  await copyStaticAssets();
  console.log('✓ Raw export copied to dist/ (site stays functional, unoptimized).');
}

async function build() {
  const puppeteer = (await import('puppeteer')).default;

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 2 });

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  console.log('→ Rendering export in headless Chromium…');
  await page.goto(pathToFileURL(SRC).href, { waitUntil: 'load', timeout: 90000 });
  // Wait for React to mount the app and for image-slots to settle.
  await page.waitForSelector('#root > *', { timeout: 60000 });
  await page.waitForFunction(
    () => document.getElementById('root') && document.getElementById('root').innerText.length > 5000,
    { timeout: 60000 }
  );
  await new Promise((r) => setTimeout(r, 2500));

  console.log('→ Transforming + extracting static DOM…');
  const result = await page.evaluate(async (ghUser) => {
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

    // ── Swap the "illustrative" GitHub block for live stats ─────────────────
    const gh = document.querySelector('#github .gh');
    if (gh) {
      const card = (src, alt) =>
        `<img src="${src}" alt="${alt}" loading="lazy" style="width:100%;max-width:495px;border-radius:14px;border:1px solid rgba(255,255,255,.08)"/>`;
      const stats =
        `https://github-readme-stats.vercel.app/api?username=${ghUser}` +
        `&show_icons=true&include_all_commits=true&count_private=true&hide_border=true` +
        `&bg_color=0B0D10&title_color=E8C39E&icon_color=E8C39E&text_color=C9D1D9`;
      const langs =
        `https://github-readme-stats.vercel.app/api/top-langs?username=${ghUser}` +
        `&layout=compact&langs_count=8&hide_border=true` +
        `&bg_color=0B0D10&title_color=E8C39E&text_color=C9D1D9`;
      const streak =
        `https://streak-stats.demolab.com?user=${ghUser}&hide_border=true&background=0B0D10` +
        `&stroke=30363D&ring=E8C39E&fire=E8C39E&currStreakLabel=E8C39E&sideLabels=C9D1D9` +
        `&currStreakNum=C9D1D9&sideNums=C9D1D9&dates=8B949E`;
      gh.outerHTML =
        `<div class="gh gh-live" style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));align-items:start">` +
        `<a href="https://github.com/${ghUser}" target="_blank" rel="noreferrer" style="display:block">${card(stats, 'GitHub stats')}</a>` +
        `<a href="https://github.com/${ghUser}" target="_blank" rel="noreferrer" style="display:block">${card(langs, 'Top languages')}</a>` +
        `<a href="https://github.com/${ghUser}" target="_blank" rel="noreferrer" style="grid-column:1/-1;display:block">${card(streak, 'GitHub streak')}</a>` +
        `</div>`;
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
    ];
    const title = document.title;
    const lang = document.documentElement.getAttribute('lang') || 'en';
    const bodyClass = document.body.className || '';
    const rootAttrs = {};
    for (const a of document.documentElement.attributes) rootAttrs[a.name] = a.value;

    return {
      title, lang, meta, css, bodyClass, rootAttrs,
      body: document.getElementById('root').innerHTML,
      blobCount: blobUrls.length,
    };
  }, GH_USER);

  await browser.close();

  if (pageErrors.length) {
    console.log(`  (${pageErrors.length} non-fatal page errors during render — expected for blocked external assets)`);
  }
  console.log(`  re-embedded ${result.blobCount} blob asset(s) as data: URLs`);

  // ── Assemble the static document ──────────────────────────────────────────
  const dataAttrs = Object.entries(result.rootAttrs)
    .filter(([k]) => k.startsWith('data-') || k === 'lang')
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');

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
<html ${dataAttrs}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${result.title}</title>
${result.meta.join('\n')}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://assets.calendly.com/assets/external/widget.css">
<noscript><style>.reveal{opacity:1!important;transform:none!important}</style></noscript>
<style>${result.css}</style>
</head>
<body class="${result.bodyClass}">
<div id="root">${result.body}</div>
<script src="https://assets.calendly.com/assets/external/widget.js" async></script>
<script>${interactivity}</script>
</body>
</html>`;

  // ── Externalize large data: URLs (fonts + images) into cacheable files ────
  // Keeps the HTML small/fast to parse and lets images lazy-load and cache,
  // instead of shipping ~megabytes of base64 inline. Tiny assets stay inline.
  const { createHash } = await import('node:crypto');
  const EXT = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'font/woff2': 'woff2', 'font/woff': 'woff', 'application/font-woff2': 'woff2' };
  const INLINE_LIMIT = 2048; // bytes of decoded data — below this, leave inline
  await mkdir(path.join(DIST, 'assets'), { recursive: true });
  let assetCount = 0, assetBytes = 0;
  let externalized = html;
  const dataUrlRe = /data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/gi;
  const seen = new Map();
  const matches = [...new Set(externalized.match(dataUrlRe) || [])];
  for (const full of matches) {
    const m = /^data:([^;]+);base64,(.*)$/s.exec(full);
    if (!m) continue;
    const mime = m[1].toLowerCase();
    const ext = EXT[mime];
    if (!ext) continue;
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length < INLINE_LIMIT) continue;
    let file = seen.get(full);
    if (!file) {
      const hash = createHash('sha1').update(buf).digest('hex').slice(0, 12);
      file = `assets/${hash}.${ext}`;
      await writeFile(path.join(DIST, file), buf);
      seen.set(full, file);
      assetCount++; assetBytes += buf.length;
    }
    externalized = externalized.split(full).join(file);
  }
  console.log(`  externalized ${assetCount} asset(s) (${(assetBytes / 1e6).toFixed(2)} MB) to dist/assets/`);

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

  await writeFile(path.join(DIST, 'index.html'), out, 'utf8');
  await copyStaticAssets();

  const before = (await import('node:fs')).statSync(SRC).size;
  const after = Buffer.byteLength(out);
  console.log(`\n✓ Built dist/index.html`);
  console.log(`  source export: ${(before / 1e6).toFixed(2)} MB  →  static HTML: ${(after / 1e6).toFixed(3)} MB (+ assets, lazy/cacheable)`);
  console.log(`  removed: React, ReactDOM, Babel-standalone, editor scaffolding`);

  // ── Verify the built page actually renders ────────────────────────────────
  console.log('→ Verifying built output…');
  const vb = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'] });
  const vp = await vb.newPage();
  const vErrors = [];
  vp.on('pageerror', (e) => vErrors.push(String(e)));
  await vp.goto(pathToFileURL(path.join(DIST, 'index.html')).href, { waitUntil: 'load', timeout: 60000 });
  const check = await vp.evaluate(() => ({
    text: (document.body.innerText || '').length,
    sections: document.querySelectorAll('section[id]').length,
    imgs: document.querySelectorAll('img').length,
    hasReact: typeof window.React !== 'undefined',
    faq: document.querySelectorAll('.faq-item').length,
  }));
  await vb.close();
  if (check.text < 5000 || check.sections < 8) {
    throw new Error(`Verification failed: text=${check.text} sections=${check.sections}`);
  }
  console.log(`  ✓ renders: ${check.text} chars of text, ${check.sections} sections, ${check.imgs} images, ${check.faq} FAQ items, React shipped=${check.hasReact}`);
  if (vErrors.length) console.log(`  (${vErrors.length} non-fatal errors — expected for blocked external assets in CI)`);
}

try {
  if (!existsSync(SRC)) throw new Error('index.html not found at repo root');
  await build();
} catch (err) {
  await fallback(err);
}
