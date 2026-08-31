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
const SITE_URL = 'https://iamahmedfarid.com';

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
  const out = { publicRepos: null, followers: null, calendar: null, pinned: null };

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
      // pinnedItems comes from the same authenticated GraphQL call as the
      // heatmap. The repo cards used to be a hand-maintained list in the design
      // export, which went stale every time the pins were rearranged on GitHub
      // — twice in one week. Reading them live means the section can never drift
      // again, and it costs nothing extra: same request, one more field.
      const query =
        'query($l:String!){user(login:$l){' +
        'contributionsCollection{contributionCalendar{weeks{contributionDays{contributionCount}}}}' +
        'pinnedItems(first:6,types:REPOSITORY){nodes{... on Repository{' +
        'name description isPrivate url primaryLanguage{name}}}}' +
        '}}';
      const r = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { l: GH_USER } }),
      });
      if (r.ok) {
        const j = await r.json();
        const pins = j?.data?.user?.pinnedItems?.nodes || [];
        if (pins.length) {
          out.pinned = pins.filter(Boolean).map((p) => ({
            name: p.name,
            desc: p.description || '',
            lang: p.primaryLanguage?.name || '',
            vis: p.isPrivate ? 'Private' : 'Public',
            url: p.url,
          }));
        }
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
  // Standalone pages that aren't locale builds but should still be discoverable.
  // The checklist is public on purpose: it's the strongest topical content on
  // the site, it targets exactly the people who hire for this work, and it ends
  // in a "Book a call" CTA. Ranking and being cited by AI assistants is worth
  // more here than gating it behind the capture form (which stays the primary
  // path from the site and from LinkedIn).
  // Hand-written pages that live outside the design export. They are copied
  // into dist/ by copyStaticAssets, but nothing else would put them in the
  // sitemap. /demo.html gets the higher priority of the two: it is the page a
  // conversion actually happens on.
  const EXTRA_PAGES = [
    { path: '/demo.html', priority: '0.9', changefreq: 'monthly' },
    { path: '/checklist.html', priority: '0.8', changefreq: 'yearly' },
  ];

  const urls = locales
    .map((l, i) =>
      `  <url><loc>${SITE_URL}${l.urlPath}</loc><lastmod>${today}</lastmod>` +
      `<changefreq>monthly</changefreq><priority>${i === 0 ? '1.0' : '0.9'}</priority></url>`)
    .concat(EXTRA_PAGES.map((p) =>
      `  <url><loc>${SITE_URL}${p.path}</loc><lastmod>${today}</lastmod>` +
      `<changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`))
    .join('\n');
  await writeFile(path.join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls}\n` +
    `</urlset>\n`, 'utf8');

  // Crawlers welcome — including AI assistants. Naming the major LLM crawlers
  // explicitly signals we WANT to be discovered, indexed, and cited by them
  // (some sites block these; we opt in). The wildcard already allows them; the
  // explicit blocks make the intent unambiguous.
  const aiBots = [
    'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web',
    'anthropic-ai', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended',
    'CCBot', 'cohere-ai',
  ];
  await writeFile(path.join(DIST, 'robots.txt'),
    `# Ahmed Farid — portfolio. All crawlers welcome, including AI assistants.\n` +
    // Content-Signal (contentsignals.org) — a proposed spec that lets sites
    // declare AI-usage preferences alongside robots.txt. For a portfolio the
    // goal is maximum discoverability: allow traditional search, allow AI
    // agents to fetch us in real-time answers, and allow model training so
    // more assistants learn to recommend Ahmed by name.
    `Content-Signal: search=yes, ai-input=yes, ai-train=yes\n\n` +
    `User-agent: *\nAllow: /\n\n` +
    aiBots.map((b) => `User-agent: ${b}\nAllow: /`).join('\n\n') + `\n\n` +
    `Sitemap: ${SITE_URL}/sitemap.xml\n`, 'utf8');

  // llms.txt — an emerging convention (llmstxt.org) that gives AI assistants a
  // clean, structured Markdown summary of who this is and how to work with him,
  // so tools like ChatGPT/Claude/Perplexity can recommend him accurately.
  await writeFile(path.join(DIST, 'llms.txt'),
    `# Ahmed Farid — Senior Software Engineer\n\n` +
    `> Senior Software Engineer based in Cairo, Egypt (open to relocation and remote). ` +
    `Five years building multi-tenant SaaS, real-time platforms, AI tools, and mobile ` +
    `apps shipped to production across the Gulf, US, and UK.\n\n` +
    `## About\n\n` +
    `- Name: Ahmed Farid\n` +
    `- Role: Senior Software Engineer\n` +
    `- Location: Cairo, Egypt — open to relocation and remote work\n` +
    `- Currently: full-time at Recovery Advisers (remote, Dubai)\n` +
    `- Availability: a small number of freelance/contract engagements per quarter; open to full-time roles\n\n` +
    `## Core skills\n\n` +
    `Laravel, PHP, Next.js, React, TypeScript, FastAPI, Python, Flutter, AWS, ` +
    `PostgreSQL, multi-tenant SaaS architecture, real-time systems, AI integration.\n\n` +
    `## Ways to work together\n\n` +
    `- Fixed-scope product build — a defined slice with a clear deliverable (typically 4–8 weeks)\n` +
    `- Ongoing engineering retainer or longer contract\n` +
    `- Technical advisory & architecture review\n\n` +
    `## Links\n\n` +
    `- Website: ${SITE_URL}\n` +
    `- LinkedIn: https://www.linkedin.com/in/ahmed-farid-b46a5221b/\n` +
    `- GitHub: https://github.com/ahmedfarid2\n` +
    `- Behance: https://www.behance.net/ahmedfarid20\n` +
    `- CV (PDF): ${SITE_URL}/Ahmed-Farid-CV.pdf\n\n` +
    `## Contact\n\n` +
    `Email: ahmed@iamahmedfarid.com\n`, 'utf8');

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

  console.log('  wrote sitemap.xml, robots.txt, llms.txt, 404.html');
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
    <div class="foot"><b>Ahmed Farid</b> &nbsp;·&nbsp; iamahmedfarid.com</div>
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
      // Public-repos count appears TWICE: the stat card and the section intro
      // prose ("… — 16 public repos spanning TypeScript tooling …"). Only the
      // card used to be synced to the live count, so the two drifted apart as
      // repos were added — the card said 19 while the sentence still said 16.
      //
      // The prose is translated per locale, so matching the words "public
      // repos" would only fix English. Instead key off the NUMBER the export
      // shipped with (whatever the card reads before we overwrite it) and
      // replace that token in the intro. That works in every locale because
      // both places started from the same hardcoded value.
      // The Arabic export renders these counts in Arabic-Indic digits (٠-٩),
      // so both the comparison and the replacement have to be numeral-system
      // aware — otherwise the card ends up reading "19" next to prose reading
      // "١٦". Write the fresh value back in whichever system the export used.
      if (gh.publicRepos != null) {
        const AR = '٠١٢٣٤٥٦٧٨٩';
        const toWestern = (s) => s.replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)));
        const matchDigits = (s, sample) =>
          /[٠-٩]/.test(sample) ? s.replace(/[0-9]/g, (d) => AR[Number(d)]) : s;

        const v = document.querySelector('#github .gh-stat .v');
        const staleRaw = v ? v.textContent.trim() : '';
        const staleWestern = toWestern(staleRaw);
        const freshWestern = String(gh.publicRepos);
        const freshLocal = matchDigits(freshWestern, staleRaw);

        if (v) v.textContent = freshLocal;

        if (/^\d+$/.test(staleWestern) && staleWestern !== freshWestern) {
          // Guard both sides with a non-digit (either numeral system) so "16"
          // inside a longer number is never partially rewritten.
          const nd = '[^0-9٠-٩]';
          const re = new RegExp('(^|' + nd + ')' + staleRaw + '(?=' + nd + '|$)', 'g');
          document.querySelectorAll('#github .section-sub').forEach((p) => {
            const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
            const nodes = [];
            while (walker.nextNode()) nodes.push(walker.currentNode);
            nodes.forEach((n) => {
              if (n.nodeValue.includes(staleRaw)) {
                n.nodeValue = n.nodeValue.replace(re, (m, before) => before + freshLocal);
              }
            });
          });
        }
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

      // ── Pinned repos, live ────────────────────────────────────────────────
      // The six repo cards were a hand-maintained list baked into the export,
      // so every time the pins were rearranged on GitHub the site showed the
      // old six. Rewrite them from the real pinnedItems instead. Repo names and
      // GitHub's own descriptions are not translated, in the same way the
      // brand and tech tokens elsewhere on the page aren't.
      //
      // Falls back to the export's cards whenever the fetch produced nothing
      // (no token locally, API down, rate limit) — a stale list still beats an
      // empty section.
      if (gh.pinned && gh.pinned.length) {
        const list = document.querySelector('#github .gh-repos');
        const cards = list ? [...list.querySelectorAll('.gh-repo')] : [];
        if (cards.length) {
          const template = cards[0];
          // "Pinned" is the label the export uses in the stats slot of each
          // card; it is translated per locale, so reuse whatever this export
          // already had rather than hardcoding an English word.
          const pinnedLabel =
            template.querySelector('.gh-repo-stats span:last-child')?.textContent?.trim() || 'Pinned';

          const built = gh.pinned.map((p) => {
            const el = template.cloneNode(true);
            el.querySelector('.name').textContent = p.name;
            const meta = el.querySelector('.meta');
            if (meta) meta.textContent = p.vis;
            const desc = el.querySelector('p');
            if (desc) desc.textContent = p.desc;
            const stats = el.querySelectorAll('.gh-repo-stats span');
            if (stats[0]) stats[0].textContent = p.lang;
            if (stats[1]) stats[1].textContent = pinnedLabel;
            // A private pin has no public page to open, so it stays plain text.
            if (!p.url || p.vis === 'Private') return el;
            const a = document.createElement('a');
            a.href = p.url;
            a.target = '_blank';
            a.rel = 'noreferrer';
            a.style.color = 'inherit';
            a.style.textDecoration = 'none';
            a.appendChild(el);
            return a;
          });

          cards.forEach((c) => c.remove());
          built.reverse().forEach((el) => list.insertBefore(el, list.firstChild));

          // The "Pinned projects" stat counts them — keep it honest if the
          // number of pins ever changes from six.
          const stat = [...document.querySelectorAll('#github .gh-stat')].find(
            (s) => s.querySelector('.v')?.textContent?.trim() === String(cards.length)
          );
          const sv = stat?.querySelector('.v');
          if (sv && cards.length !== gh.pinned.length) {
            const AR2 = '٠١٢٣٤٥٦٧٨٩';
            sv.textContent = /[٠-٩]/.test(sv.textContent)
              ? String(gh.pinned.length).replace(/[0-9]/g, (d) => AR2[Number(d)])
              : String(gh.pinned.length);
          }
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

    // Extract FAQ Q&A from the rendered DOM (per locale) so the Node side can
    // emit FAQPage structured data — rich results in Google and clean,
    // quotable Q&A for AI assistants. Grounded in the page's real content.
    const faq = [...document.querySelectorAll('.faq-item')]
      .map((item) => ({
        q: (item.querySelector('.faq-q .text') || item.querySelector('.faq-q'))?.textContent?.trim() || '',
        a: (item.querySelector('.faq-a')?.textContent || '').trim(),
      }))
      .filter((x) => x.q && x.a);

    return {
      title, lang, meta, css, bodyClass, rootAttrs, bodyAttrs, hasOwnSwitcher, faq,
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
    '@id': `${SITE_URL}/#person`,
    name: 'Ahmed Farid',
    jobTitle: 'Senior Software Engineer',
    description:
      'Senior Software Engineer with five years building multi-tenant SaaS, ' +
      'real-time platforms, AI tools, and mobile apps shipped to production ' +
      'across the Gulf, US, and UK.',
    url: `${SITE_URL}/`,
    image: `${SITE_URL}/og.png`,
    email: 'ahmed@iamahmedfarid.com',
    nationality: { '@type': 'Country', name: 'Egypt' },
    address: { '@type': 'PostalAddress', addressLocality: 'Cairo', addressCountry: 'EG' },
    homeLocation: { '@type': 'Place', name: 'Cairo, Egypt' },
    worksFor: { '@type': 'Organization', name: 'Recovery Advisers' },
    alumniOf: { '@type': 'CollegeOrUniversity', name: 'Helwan University' },
    knowsLanguage: ['English', 'Arabic'],
    knowsAbout: [
      'Laravel', 'PHP', 'Next.js', 'React', 'TypeScript', 'FastAPI', 'Python',
      'Flutter', 'AWS', 'PostgreSQL', 'Multi-tenant SaaS', 'Real-time systems',
      'AI integration', 'Software Architecture',
    ],
    hasOccupation: {
      '@type': 'Occupation',
      name: 'Software Engineer',
      occupationalCategory: '15-1252.00',
      skills:
        'Laravel, PHP, Next.js, React, TypeScript, FastAPI, Python, Flutter, ' +
        'AWS, PostgreSQL, multi-tenant SaaS architecture, real-time systems, AI integration',
    },
    // Grounded in the site's "Ways to work together" section — helps AI
    // assistants surface Ahmed for "recommend an engineer to hire" queries.
    makesOffer: [
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Fixed-scope product build', serviceType: 'Software development' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Ongoing engineering retainer', serviceType: 'Software development' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Technical advisory & architecture review', serviceType: 'Technical consulting' } },
    ],
    sameAs: [
      'https://www.linkedin.com/in/ahmed-farid-b46a5221b/',
      'https://github.com/ahmedfarid2',
      'https://www.behance.net/ahmedfarid20',
    ],
  };

  // Enrich an existing Person JSON-LD from the export with any fields it's
  // missing (skills, affiliations, occupation, offers, @id, …) — keeps the
  // export's own values untouched (name/sameAs/etc.), just fills the gaps that
  // help search engines and AI assistants understand and recommend the person.
  result.meta = result.meta.map((m) => {
    const mm = /^(<script[^>]*ld\+json[^>]*>)([\s\S]*?)(<\/script>)$/i.exec(m.trim());
    if (!mm) return m;
    try {
      const obj = JSON.parse(mm[2]);
      if (obj && obj['@type'] === 'Person') {
        for (const k of Object.keys(personLd)) {
          if (k === '@context' || k === '@type' || k === 'name') continue;
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
  // Drop tags we (re)generate deterministically below so they never duplicate:
  // og:image/url, canonical, robots, og:site_name, og:locale.
  const cleanedMeta = result.meta.filter(
    (m) =>
      !/og:image|twitter:image|og:url|og:site_name|og:locale/i.test(m) &&
      !/rel=["']?canonical/i.test(m) &&
      !/name=["']?robots/i.test(m)
  );
  // Facebook-style locale codes per language, plus alternates for the others.
  const ogLocale = { en: 'en_US', ar: 'ar_AR', de: 'de_DE', es: 'es_ES', fr: 'fr_FR' };
  const ogMeta = [
    // Let Google show large image previews + full-length snippets (better CTR).
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">`,
    `<link rel="canonical" href="${pageUrl}">`,
    `<meta property="og:site_name" content="Ahmed Farid">`,
    `<meta property="og:locale" content="${ogLocale[lang] || 'en_US'}">`,
    ...(multi
      ? locales
          .filter((l) => l.lang !== lang)
          .map((l) => `<meta property="og:locale:alternate" content="${ogLocale[l.lang] || l.lang}">`)
      : []),
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

  // ── Structured data ───────────────────────────────────────────────────────
  // Person: inject our full block only if the export shipped none (otherwise
  // the export's own block, enriched above, is used). WebSite: always emitted
  // for site identity. FAQPage: emitted from the page's real FAQ so Google can
  // show FAQ rich results and AI assistants get clean, quotable Q&A.
  const webSiteLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: `${SITE_URL}/`,
    name: 'Ahmed Farid — Senior Software Engineer',
    inLanguage: lang,
    about: { '@id': `${SITE_URL}/#person` },
  };
  const faqLd =
    result.faq && result.faq.length
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          '@id': `${pageUrl}#faq`,
          inLanguage: lang,
          mainEntity: result.faq.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }
      : null;
  const jsonLd = [
    hasLd ? '' : `<script type="application/ld+json">${JSON.stringify(personLd)}</script>`,
    `<script type="application/ld+json">${JSON.stringify(webSiteLd)}</script>`,
    faqLd ? `<script type="application/ld+json">${JSON.stringify(faqLd)}</script>` : '',
  ].filter(Boolean).join('\n');

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
.palette-toggle,.palette.open .palette-pop{pointer-events:auto}
/* RTL polish: the contact "handle" lines (URL / e-mail / phone) keep
   direction:ltr so the value reads left-to-right, but with text-align:start
   that pins them to the LEFT — detaching them from the right-aligned name and
   description (and from the icon). Re-align them to the right in RTL so each
   card reads as one tidy block. Scoped to [dir=rtl], so LTR locales are
   untouched; applies to any future RTL locale automatically. */
[dir="rtl"] .connect-handle,
[dir="rtl"] .price-amount,
[dir="rtl"] .addon-price{text-align:right}
${switcherCss}
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
  console.log(`  publicRepos=${ghData.publicRepos ?? 'n/a'}  followers=${ghData.followers ?? 'n/a'}  calendarDays=${ghData.calendar ? ghData.calendar.length : 'n/a'}  pinned=${ghData.pinned ? ghData.pinned.map((p) => p.name).join(', ') : 'n/a (keeping export cards)'}`);

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
