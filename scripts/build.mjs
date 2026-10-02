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
//   • fills the placeholder GitHub block with live data fetched at build time
//     (contribution calendar, repo count, pinned repos)
//   • adds a tiny vanilla-JS layer for the nav menu, FAQ accordion, scroll
//     reveal and the Calendly popup (no framework)
//
// If anything goes wrong it falls back to copying the raw export so a push never
// produces a broken deploy.

import { mkdir, writeFile, copyFile, rm, readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SITE_URL, LOCATION, LOCATION_LABEL, CONTACT, YEARS_PROSE, SEO, DRIFT_GUARDS } from './site-facts.mjs';
import { inspectPdf, pdfProblems, textFingerprint, PDF_REQUIRED_URIS } from './pdf-check.mjs';
import { renderChecklist, CHECKLIST_PDF, CHECKLIST_REQUIRED_URIS, CHECKLIST_REQUIRED_TEXT } from './build-checklist.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'index.html');
const DIST = path.join(ROOT, 'dist');
const GH_USER = 'ahmedfarid2';

// OpenAI / ChatGPT Ads measurement pixel — behind consent.
//
// It has to be injected here, not just in the export, because this build
// rebuilds the <head> from an explicit allowlist (see `pick(...)` below) —
// anything not on that list is dropped, and a tracking script that silently
// disappears at build time is worse than one that was never installed.
//
// Nothing loads until the visitor says yes. Three of the five locales target
// the EU, where a pixel that sets a first-party cookie needs opt-in consent,
// not opt-out — so the default is off for everyone rather than a guess at
// where the reader is sitting. Declining is one click and is remembered.
//
// The Ads Manager snippet's `debug: true` is deliberately dropped: it logs SDK
// chatter to the console, and the people most likely to open devtools here are
// the engineers this site is meant to impress.
// Pinterest domain verification: lets Pinterest attribute Pins from this site to
// his account. Public by design (it only proves control of the domain). Lives
// here, not in the export, because the head is rebuilt below from an
// allowlist that would drop an unknown <meta>.
const PINTEREST_VERIFY_TAG = '<meta name="p:domain_verify" content="08bdb959e921275dc5041af6f822622a"/>';

const AD_PIXEL_ID = '9ceAHjhY9TXnV8VVdRpZEx';
// Banner copy per locale. The page language decides; consent behaviour is the
// same everywhere (opt-in, nothing loads until "Allow", choice remembered).
const CONSENT_COPY = {
  en: { label: 'Measurement consent', text: "I'd like to load one advertising-measurement pixel to see which referrals reach this site. Nothing loads unless you agree.", no: 'No thanks', yes: 'Allow' },
  ar: { label: 'الموافقة على القياس', text: 'أودّ تحميل بكسل واحد لقياس الإعلانات لمعرفة مصادر الزيارات التي تصل إلى هذا الموقع. لن يُحمَّل أي شيء ما لم توافق.', no: 'لا، شكرًا', yes: 'أوافق' },
  de: { label: 'Einwilligung zur Messung', text: 'Ich würde gern ein Werbe-Messpixel laden, um zu sehen, über welche Verweise Besucher hierherkommen. Es wird nichts geladen, solange Sie nicht zustimmen.', no: 'Nein, danke', yes: 'Erlauben' },
  es: { label: 'Consentimiento de medición', text: 'Me gustaría cargar un píxel de medición publicitaria para ver qué referencias traen visitas a este sitio. No se carga nada a menos que aceptes.', no: 'No, gracias', yes: 'Permitir' },
  fr: { label: 'Consentement à la mesure', text: "J'aimerais charger un pixel de mesure publicitaire pour voir quelles sources amènent des visiteurs sur ce site. Rien ne se charge sans votre accord.", no: 'Non merci', yes: 'Autoriser' },
};
const adPixel = (lang) => {
  const c = CONSENT_COPY[lang] || CONSENT_COPY.en;
  return `<style>
.cbar{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;margin:0 auto;max-width:640px;
display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;
padding:14px 16px;border-radius:14px;font:400 13.5px/1.5 ui-sans-serif,system-ui,sans-serif;
background:rgba(16,18,22,.94);color:#e7e2d8;border:1px solid rgba(255,255,255,.14);
box-shadow:0 10px 40px rgba(0,0,0,.45)}
.cbar p{margin:0;flex:1 1 300px;min-width:0}
.cbar button{font:inherit;font-weight:600;cursor:pointer;border-radius:99px;padding:8px 16px;
border:1px solid rgba(255,255,255,.18);background:transparent;color:#e7e2d8}
.cbar button.y{background:#E6C8A0;color:#0B0D10;border-color:#E6C8A0}
</style>
<script>(function(){
  var KEY='af-measure-consent';
  function load(){
    if(window.oaiq)return;
    !function(w,d,s,u){var q=function(){q.q.push(arguments)};q.q=[];w.oaiq=q;
      var j=d.createElement(s);j.async=1;j.src=u;var f=d.getElementsByTagName(s)[0];
      f.parentNode.insertBefore(j,f)}(window,document,"script","https://bzrcdn.openai.com/sdk/oaiq.min.js");
    oaiq("init",{pixelId:"${AD_PIXEL_ID}"});
  }
  var saved=null;
  try{saved=localStorage.getItem(KEY)}catch(e){}
  if(saved==='yes'){load();return}
  if(saved==='no')return;
  function ask(){
    var b=document.createElement('div');
    var C=${JSON.stringify(c).replace(/</g, '\\u003c')};
    b.className='cbar';b.setAttribute('role','dialog');b.setAttribute('aria-label',C.label);
    b.lang=document.documentElement.lang||'en';b.dir=document.documentElement.dir||'ltr';
    var p=document.createElement('p');
    p.textContent=C.text;
    function pick(v){try{localStorage.setItem(KEY,v)}catch(e){}b.remove();if(v==='yes')load()}
    var no=document.createElement('button');no.textContent=C.no;no.onclick=function(){pick('no')};
    var yes=document.createElement('button');yes.className='y';yes.textContent=C.yes;yes.onclick=function(){pick('yes')};
    b.appendChild(p);b.appendChild(no);b.appendChild(yes);document.body.appendChild(b);
  }
  if(document.readyState!=='loading')setTimeout(ask,900);
  else document.addEventListener('DOMContentLoaded',function(){setTimeout(ask,900)});
})();</script>`;
};

// ── Accessibility & touch baseline ──────────────────────────────────────────
// Shared by every emitted page: the rendered locales get it in their build-fix
// <style>, the standalone pages through the shell step.
const SKIP_LABEL = {
  en: 'Skip to content', ar: 'تخطَّ إلى المحتوى', de: 'Zum Inhalt springen',
  es: 'Saltar al contenido', fr: 'Aller au contenu',
};
const skipLink = (lang) => `<a class="skip-link" href="#main">${SKIP_LABEL[lang] || SKIP_LABEL.en}</a>`;

// First tab stop on every page, off-screen until focused.
const SKIP_CSS =
  '.skip-link{position:fixed;left:12px;top:12px;z-index:10001;padding:10px 16px;border-radius:10px;' +
  'background:#E6C8A0;color:#0B0D10;font:600 14px/1.2 ui-sans-serif,system-ui,sans-serif;' +
  'text-decoration:none;transform:translateY(-200%);transition:transform .15s ease}' +
  '[dir="rtl"] .skip-link{left:auto;right:12px}' +
  '.skip-link:focus{transform:none;outline:2px solid #F4F1EA;outline-offset:2px}' +
  // Focus arrives on <main> programmatically (tabindex=-1); a ring round the
  // whole page would read as a glitch, and the skip link already showed where.
  'main:focus{outline:none}';

const A11Y_CSS = SKIP_CSS +
  // 44×44 is the floor (Apple HIG; Material asks 48). The burger shipped at
  // 36×31 and it is the only way into the navigation on a phone; the drawer's
  // language links were 38px and the wordmark 26px.
  '.nav-burger{min-width:44px;min-height:44px}' +
  '.dl-lang{min-height:44px}' +
  '.brand{min-height:44px}' +
  // The intro faded its name out *together* with the curtain behind it, so for
  // ~0.6s the name sat at half opacity on top of the hero headline — two
  // headlines, neither readable, as the first thing anyone sees. Take the name
  // away first, then lift the curtain. Same total length.
  '.intro-ov.intro-hide .intro-inner{opacity:0;transition:opacity .2s ease}' +
  '.intro-ov.intro-hide{transition:opacity .45s ease .2s,visibility 0s linear .65s}';

// ── Give the standalone pages the site's shell ──────────────────────────────
// demo.html, checklist.html and get-checklist.html carry forms and long-form
// content that do not exist in the Claude-design export, so unlike /services
// they cannot be sliced out of a render. What they can have is the same shell:
// the real nav, the real footer, the real fonts and the real colour tokens,
// lifted out of the freshly built home page so the font hashes and values stay
// tied to the source instead of being copied and left to rot.
//
// Everything lifted is *scoped* under `.site-shell`, the wrapper the nav and
// footer are injected into. The first cut of this merged the two stylesheets
// flat and they fought: both define `.wrap`, the page's 620px reading column
// won, and the footer's four columns shipped squeezed into strips. Scoped, the
// shell always wins inside itself and can never reach the page's own content.

// Split minified CSS into top-level rules by walking brace depth.
function splitCssRules(css) {
  const rules = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const sel = css.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    rules.push({ sel, body: css.slice(open + 1, j - 1) });
    i = j;
  }
  return rules;
}

// `html`, `body` and `:root` describe the page itself. Inside the shell the
// wrapper plays that part, so they collapse onto it instead of leaking out —
// which is also how the design tokens (all declared on `:root`) follow the nav
// and footer across without overwriting the page's own palette.
function scopeSelector(sel, scope) {
  const rest = sel.replace(/^(html|body|:root)\b/, '').trim();
  if (!rest) return scope;
  if (sel === rest) return `${scope} ${rest}`;
  return /^[.#:[]/.test(rest) ? `${scope}${rest}` : `${scope} ${rest}`;
}

function scopeCss(css, scope, keep) {
  let out = '';
  for (const { sel, body } of splitCssRules(css)) {
    if (/^@(media|supports)/i.test(sel)) {
      const inner = scopeCss(body, scope, keep);
      if (inner) out += `${sel}{${inner}}`;
    } else if (/^@(font-face|(-\w+-)?keyframes)/i.test(sel)) {
      out += `${sel}{${body}}`;   // no selectors inside: keep verbatim
    } else if (sel.startsWith('@')) {
      continue;                   // @page, @layer … nothing the shell needs
    } else {
      const parts = sel.split(',').map((x) => x.trim()).filter(Boolean).filter(keep);
      if (!parts.length) continue;
      out += `${parts.map((x) => scopeSelector(x, scope)).join(',')}{${body}}`;
    }
  }
  return out;
}

async function applyShellToStandalonePages() {
  const home = await readFile(path.join(DIST, 'index.html'), 'utf8');

  const grab = (tag) => {
    const m = home.match(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`));
    return m ? m[0] : '';
  };
  // In-page anchors have to become absolute or they point at sections these
  // pages do not have — which the dead-anchor gate would (correctly) fail on.
  const absolutize = (html) => html.replace(/href="#([^"]*)"/g, (_m, id) => `href="/${id === 'top' ? '' : '#' + id}"`);
  const nav = absolutize(grab('nav'));
  const footer = absolutize(grab('footer'));

  // Which rules to carry: the ones the shell markup can actually match. A rule
  // is kept when every class it names appears in the nav or the footer, so
  // `.foot-grid` and `.brand-mark` come along and the other ~1,500 rules of the
  // home page do not. Element-only rules (`a`, `ul`, `h5`) are kept too — they
  // are what stops the nav links rendering as underlined browser-default blue —
  // and are harmless once scoped.
  const markup = nav + footer;
  const shellClasses = new Set(
    [...markup.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean));
  const keep = (sel) => (sel.match(/\.[A-Za-z0-9_-]+/g) || [])
    .every((c) => shellClasses.has(c.slice(1)));

  const css = [...home.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('');
  const shellCss = scopeCss(css, '.site-shell', keep);

  if (!nav || !footer || !shellCss.trim()) {
    throw Object.assign(new Error(
      '[build] could not lift the nav, footer or shell CSS out of dist/index.html — ' +
      'the standalone pages would ship without the site shell.'), { fatal: true });
  }

  // Nothing here is interactive without the enhancement JS, so the burger and
  // the language globe are hidden rather than shipped inert; below the mobile
  // breakpoint the nav is the wordmark alone, which is still the way back.
  // The nav also stops being fixed: these pages scroll their own content and
  // never allotted it any top padding.
  //
  // The reset underneath it is the other half of the scoping. Scoping stops the
  // shell reaching the page; it does not stop the page reaching the shell, and
  // checklist.html styles bare `li` — so the first pass drew its little tick
  // box beside every link in the footer's four columns. These are deliberately
  // the least specific rules that can win against an unscoped element selector:
  // every real footer rule (`.foot-col ul li`) outranks them and is untouched.
  const extra = '<style>' +
    '.site-shell .nav-burger,.site-shell .nav-mobile,.site-shell .locale{display:none!important}' +
    '.site-shell .nav{position:static}' +
    '.site-shell{display:block}' +
    '.site-shell ul,.site-shell ol{list-style:none;padding:0;margin:0}' +
    '.site-shell li{padding:0;margin:0;border:0;position:static}' +
    '.site-shell li:before,.site-shell li:after{content:none}' +
    SKIP_CSS +
    '</style>';

  const PAGES = ['demo.html', 'checklist.html', 'get-checklist.html'];
  for (const name of PAGES) {
    const file = path.join(DIST, name);
    if (!existsSync(file)) continue;
    let doc = await readFile(file, 'utf8');
    if (doc.includes('data-site-shell')) continue;
    // Their own one-line footer goes: the real one says the same thing and more,
    // and two copyright lines stacked is how the first pass shipped.
    doc = doc.replace(/\s*<footer>[\s\S]*?<\/footer>/, '');
    doc = doc.replace('</head>', `<style data-site-shell>${shellCss}</style>${extra}</head>`);
    // Skip link first, so it is the first tab stop; its target is each page's
    // own <main class="wrap" id="main">.
    doc = doc.replace(/<body([^>]*)>/, `<body$1>${skipLink('en')}<div class="site-shell">${nav}</div>`);
    doc = doc.replace('</body>', `<div class="site-shell">${footer}</div></body>`);
    await writeFile(file, doc, 'utf8');
    console.log(`  shell applied: ${name} (+${Math.round(shellCss.length / 1024)}KB css)`);
  }
}

// ── Final passes over every emitted page ────────────────────────────────────
// Run after the shell step, so the standalone pages are judged with the nav
// and footer they actually ship with. google*.html are verification files and
// are never touched (CLAUDE.md).
async function emittedPages() {
  const out = [];
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'assets') await walk(p); }
      else if (e.name.endsWith('.html') && !/^google[0-9a-f]+\.html$/.test(e.name)) out.push(p);
    }
  };
  await walk(DIST);
  return out.sort();
}

// Blank out <script>/<style> so markup-shaped text inside JS strings (the
// intro builds its overlay from an innerHTML string) is never mistaken for
// the document's own headings.
function maskCode(html) {
  const masks = [];
  const masked = html.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, (m) => `\u0000${masks.push(m) - 1}\u0000`);
  return { masked, unmask: (s) => s.replace(/\u0000(\d+)\u0000/g, (_m, i) => masks[+i]) };
}

// Heading levels are how a screen reader user skims a page. The export skips
// them — h2 → h4 in the stack band, h3 → h5 in the footer — and on the
// standalone pages the lifted footer jumps h1 → h3. Re-tagging would move them
// off the CSS that styles them, so the level is corrected with aria-level,
// which is what assistive tech reads. The rule: a heading sits at most one
// level below the heading it falls under; siblings stay siblings.
function fixHeadingOutline(html) {
  const { masked, unmask } = maskCode(html);
  const stack = [];   // { actual, eff } of the headings still "open"
  let changed = 0;
  const out = masked.replace(/<h([1-6])(\s[^>]*)?>/gi, (_tag, lvl, attrs = '') => {
    const actual = +lvl;
    const clean = attrs.replace(/\s+aria-level="\d"/g, '');
    while (stack.length && stack[stack.length - 1].actual >= actual) stack.pop();
    const eff = stack.length ? stack[stack.length - 1].eff + 1 : actual;
    stack.push({ actual, eff });
    if (eff === actual) return `<h${lvl}${clean}>`;
    changed++;
    return `<h${lvl}${clean} aria-level="${eff}">`;
  });
  return { html: unmask(out), changed };
}

// The levels a screen reader will actually announce, in document order.
function announcedHeadingLevels(html) {
  const { masked } = maskCode(html);
  return [...masked.matchAll(/<h([1-6])(\s[^>]*)?>/gi)].map((m) => {
    const aria = /\saria-level="(\d)"/.exec(m[2] || '');
    return aria ? +aria[1] : +m[1];
  });
}

async function fixHeadingOutlines(files) {
  let total = 0;
  for (const f of files) {
    const before = await readFile(f, 'utf8');
    const { html, changed } = fixHeadingOutline(before);
    if (html !== before) await writeFile(f, html, 'utf8');
    total += changed;
  }
  console.log(`  ✓ heading outline: ${total} heading(s) given a corrected aria-level`);
}

// Every <img> pointing at somebody else's server — client logos, and favicons
// through Google's s2 service — is fetched once at build time and served from
// /assets/ext/. A client renaming a logo file no longer takes it off the brand
// wall without anyone noticing, and a visitor's browser no longer reports the
// visit to Google and a dozen client servers. Whatever cannot be fetched stays
// remote, which is exactly how it behaved before: a slow or blocked host
// degrades the page to its old state rather than failing the build.
async function vendorExternalImages(files) {
  const { createHash } = await import('node:crypto');
  const EXT = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp',
    'image/gif': 'gif', 'image/avif': 'avif', 'image/svg+xml': 'svg',
    'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico',
  };
  const MAX_BYTES = 1.5e6;
  const docs = new Map();
  const urls = new Set();
  for (const f of files) {
    const html = await readFile(f, 'utf8');
    docs.set(f, html);
    for (const m of html.matchAll(/<img\b[^>]*?\ssrc="(https?:\/\/[^"]+)"/gi)) urls.add(m[1]);
  }
  if (!urls.size) return;

  const dir = path.join(DIST, 'assets', 'ext');
  await mkdir(dir, { recursive: true });
  const local = new Map();   // url as written in the HTML → /assets/ext/<file>
  const kept = [];
  const fetchOne = async (attr) => {
    const url = attr.replace(/&amp;/g, '&');
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: 'follow' });
      const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const ext = EXT[type];
      if (!res.ok || !ext) throw new Error(`${res.status} ${type || 'no content-type'}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length || buf.length > MAX_BYTES) throw new Error(`${buf.length} bytes`);
      // An <img> cannot run an SVG's script, but the file would also be
      // reachable directly on this origin, where it could. Only inert SVG.
      if (ext === 'svg' && /<script|\son[a-z]+\s*=|javascript:|<foreignObject/i.test(buf.toString('utf8'))) {
        throw new Error('active content in SVG');
      }
      const name = `${createHash('sha1').update(url).digest('hex').slice(0, 12)}.${ext}`;
      await writeFile(path.join(dir, name), buf);
      local.set(attr, `/assets/ext/${name}`);
    } catch (e) {
      kept.push(`${new URL(url).host} (${e.name === 'TimeoutError' ? 'timeout' : e.message || e.cause?.code || e})`);
    }
  };
  const queue = [...urls];
  await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await fetchOne(queue.shift()); }));

  for (const [f, html] of docs) {
    let out = html;
    for (const [attr, file] of local) out = out.split(`src="${attr}"`).join(`src="${file}"`);
    if (out !== html) await writeFile(f, out, 'utf8');
  }
  console.log(`  ✓ external images: ${local.size}/${urls.size} now served from /assets/ext/`);
  if (kept.length) console.log(`    kept remote (unreachable at build time): ${[...new Set(kept)].join(', ')}`);
}

// What the UI/UX audit found missing, kept from coming back. The export is
// replaced wholesale on every design change, so none of the above is safe
// from silently disappearing without a check that knows what it looks like.
async function assertA11yBaseline(files) {
  const problems = [];
  for (const f of files) {
    const rel = path.relative(DIST, f);
    if (rel === '404.html') continue;   // no repeated nav to skip; see its template
    const html = await readFile(f, 'utf8');
    const { masked } = maskCode(html);
    const mains = (masked.match(/<main\b[^>]*\sid="main"/g) || []).length;
    if (mains !== 1) problems.push(`${rel}: ${mains} <main id="main"> (want 1)`);
    const skip = masked.indexOf('class="skip-link" href="#main"');
    const nav = masked.indexOf('<nav');
    if (skip < 0 || (nav >= 0 && skip > nav)) problems.push(`${rel}: skip link missing or not before the nav`);
    const h1 = (masked.match(/<h1[\s>]/g) || []).length;
    if (h1 !== 1) problems.push(`${rel}: ${h1} <h1> (want 1)`);
    const levels = announcedHeadingLevels(html);
    levels.forEach((l, i) => {
      if (i && l > levels[i - 1] + 1) problems.push(`${rel}: heading level jumps ${levels[i - 1]} → ${l}`);
    });
    const faqQ = masked.match(/<button class="faq-q"[^>]*>/g) || [];
    if (faqQ.some((b) => !/aria-expanded=/.test(b))) problems.push(`${rel}: FAQ button without aria-expanded`);
  }
  if (problems.length) {
    throw Object.assign(new Error(`[build] accessibility baseline failed:\n  ${problems.join('\n  ')}`), { fatal: true });
  }
  const checked = files.filter((f) => path.relative(DIST, f) !== '404.html').length;
  console.log(`  ✓ accessibility baseline: ${checked} page(s) — landmark, skip link, one h1, no heading jumps, FAQ state`);
}

// ── Content-transform safety net ────────────────────────────────────────────
// split/join, not String.replace: `replace` with a *string* needle substitutes
// only the first occurrence, which is how a value that appears twice can
// half-survive a transform that looks correct in review.
//
// And it throws. A transform that matches nothing is the failure this exists to
// catch: the export gets replaced wholesale on every design change, so "the
// string moved" is the normal case, not the exotic one.
function mustReplaceAll(source, needle, replacement, { min = 1, label } = {}) {
  const parts = source.split(needle);
  const count = parts.length - 1;
  if (count < min) {
    throw new Error(
      `[build] transform "${label ?? needle}" matched ${count} times, expected >= ${min}. ` +
      'The export probably renamed or reworded this string. Fix the transform, do not skip it.'
    );
  }
  return parts.join(replacement);
}

// Strings that must never reach dist/. `max` is a ceiling, not a ban, for the
// few strings allowed a fixed number of times.
//
// Scanned as bytes over the emitted text files rather than through a parsed
// DOM, so a string hiding in an href, a tel: link, a JSON blob or an inline
// script cannot slip past a text-node walk.
const FORBIDDEN = [
  { s: 'Five years', max: 0 },
  { s: '5+ yrs', max: 0 },
  { s: '<em>5+</em>', max: 0 },
  { s: '25,000', max: 0 },
  { s: 'followers on LinkedIn', max: 0 },
  { s: 'OPEN TO RELOCATION', max: 0 },
  { s: 'Open to relocation', max: 0 },
  { s: 'open to relocation', max: 0 },
  // Same claim, different verb — the wording the first sweep missed.
  { s: 'Open to relocate', max: 0 },
  { s: 'No tracking', max: 0 },
  // Guards hero, nav and About against the old bare export CTA. The
  // owner-approved client-path CTA is the 30-minute variant below, which does
  // not contain this string; it belongs only in the EN contact block.
  { s: 'Book a scoping call', max: 0 },
  // EN home contact, EN services contact, EN services pricing CTA, and the
  // checklist page's call CTA.
  { s: 'Book a 30-minute scoping call', max: 4 },
  // Pricing moved to /work-with-me.html. Banned on the home page, expected on
  // the page that now owns the offer — so these skip that one file rather than
  // being dropped from the list, which would stop guarding the home page too.
  { s: 'Discuss retainer', max: 0, except: 'services/index.html' },
  { s: 'Scope a build', max: 0, except: 'services/index.html' },
  { s: 'Book a free demo', max: 0, except: 'services/index.html', alsoExcept: ['demo.html'] },
  // /demo.html is the freelance landing page. It stays live and indexable, but
  // the home pages must not route anyone to it — only /services may.
  { s: 'demo.html', max: 0, except: 'services/index.html',
    alsoExcept: ['demo.html', 'get-checklist.html', 'checklist.html', 'sitemap.xml', 'llms.txt', '404.html'] },
  { s: 'fast learner', max: 0 },
  { s: 'adapt to whatever stack', max: 0 },
  { s: 'Available now', max: 0 },
  // No phone number is published (Oct 2026): WhatsApp goes through the
  // Business link, and the work email stays off the personal site.
  { s: '+20 10', max: 0 },
  { s: 'wa.me/20', max: 0 },
  { s: 'tel:+20', max: 0 },
  { s: '+971 58', max: 0 },
  { s: 'wa.me/971', max: 0 },
  { s: 'tel:+971', max: 0 },
  { s: 'a.farid@recoveryadvisers.com', max: 0 },
  // LinkedIn moved to /in/iamahmedfarid; the old slug no longer resolves.
  { s: 'ahmed-farid-b46a5221b', max: 0 },
  // "View CV" used to open a CV uploaded to LinkedIn and frozen there, while
  // "Download CV" served the live PDF — two buttons, two different documents.
  { s: 'single-media-viewer', max: 0 },
  // Facts that drifted before (years, brand count, LinkedIn slug, tracking
  // params). Kept next to the values they protect, in site-facts.mjs.
  ...DRIFT_GUARDS,
];
const forbiddenKey = (f) => f.s ?? String(f.re);
const countForbidden = (body, f) =>
  f.re ? (body.match(f.re) || []).length : body.split(f.s).length - 1;

async function assertNoForbiddenStrings() {
  const exts = new Set(['.html', '.txt', '.xml', '.json', '.svg']);
  const counts = new Map(FORBIDDEN.map((f) => [forbiddenKey(f), 0]));
  const where = new Map();
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { await walk(full); continue; }
      if (!exts.has(path.extname(e.name).toLowerCase())) continue;
      const body = await readFile(full, 'utf8');
      const rel = path.relative(DIST, full);
      for (const f of FORBIDDEN) {
        if (f.except && (rel === f.except || rel.endsWith('/' + f.except))) continue;
        if (f.alsoExcept && f.alsoExcept.includes(rel)) continue;
        const n = countForbidden(body, f);
        if (!n) continue;
        const k = forbiddenKey(f);
        counts.set(k, counts.get(k) + n);
        where.set(k, [...(where.get(k) || []), `${rel}×${n}`]);
      }
    }
  };
  await walk(DIST);
  const bad = FORBIDDEN.filter((f) => counts.get(forbiddenKey(f)) > f.max);
  if (bad.length) {
    const err = new Error(
      '[build] forbidden strings reached dist/:\n' +
      bad.map((f) => `   "${forbiddenKey(f)}" — ${counts.get(forbiddenKey(f))} occurrence(s), max ${f.max} ` +
                     `(${(where.get(forbiddenKey(f)) || []).join(', ')})`).join('\n') +
      '\n   A correction was dropped, or a retired claim came back. Not deploying.'
    );
    // The raw-export fallback is the wrong answer here: the raw export is
    // exactly where these strings come from, so falling back would ship the
    // thing the scan just refused. Flagged fatal so `fallback()` rethrows.
    err.fatal = true;
    throw err;
  }
  console.log(`  ✓ forbidden-string scan clean (${FORBIDDEN.length} patterns)`);
}

// Moving sections between pages leaves nav items and cross-references pointing
// at anchors that no longer exist on the page being viewed. That failure is
// silent — the link simply does nothing when clicked — so it gets its own gate.
async function assertNoDeadAnchors() {
  const walk = async (dir, out = []) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full, out);
      else if (e.name.endsWith('.html')) out.push(full);
    }
    return out;
  };
  const dead = [];
  for (const file of await walk(DIST)) {
    const body = await readFile(file, 'utf8');
    const ids = new Set([...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    for (const m of body.matchAll(/href="#([^"]+)"/g)) {
      const target = m[1];
      if (target === 'top' || ids.has(target)) continue;
      dead.push(`${path.relative(DIST, file)} → #${target}`);
    }
  }
  if (dead.length) {
    const err = new Error(
      '[build] in-page links point at anchors that do not exist:\n' +
      [...new Set(dead)].map((d) => `   ${d}`).join('\n') +
      '\n   A section probably moved. Clicking these does nothing, silently.'
    );
    err.fatal = true;
    throw err;
  }
  console.log('  ✓ no dead in-page anchors');
}

// Every locale exists twice — home and /services/ — and a visitor who
// switches language, or follows the footer's services link, must stay in the
// same language and on the same kind of page. Checked against the written
// files (footer link, drawer language links, canonical, hreflang) and, for the
// language menu the export's script builds at runtime, in a browser that sees
// dist/ under the real site origin, so the script takes its production path.
async function assertLocaleRouting(locales) {
  const codes = locales.map((l) => l.lang);
  const target = (code, suffix) => (code === 'en' ? '/' : `/${code}/`) + suffix;
  const bad = [];
  const pagesToCheck = [];
  for (const l of locales) {
    for (const suffix of ['', 'services/']) {
      const page = l.urlPath + suffix;
      const file = path.join(DIST, page, 'index.html');
      if (!existsSync(file)) { bad.push(`${page}: not built`); continue; }
      pagesToCheck.push({ page, code: l.lang, suffix });
      const body = await readFile(file, 'utf8');
      const canon = (body.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
      if (canon !== SITE_URL + page) bad.push(`${page}: canonical ${canon}`);
      for (const c of codes) {
        if (!body.includes(`<link rel="alternate" hreflang="${c}" href="${SITE_URL}${target(c, suffix)}">`))
          bad.push(`${page}: hreflang ${c} should be ${target(c, suffix)}`);
      }
      if (!body.includes(`<link rel="alternate" hreflang="x-default" href="${SITE_URL}/${suffix}">`))
        bad.push(`${page}: x-default should be /${suffix}`);
      const drawer = [...body.matchAll(/<a class="dl-lang[^"]*" href="([^"]*)" hreflang="([a-z]{2})"/g)];
      const drawerCodes = drawer.map((m) => m[2]).sort().join(',');
      if (drawerCodes !== [...codes].sort().join(',')) bad.push(`${page}: drawer languages [${drawerCodes}], expected [${[...codes].sort()}]`);
      for (const m of drawer)
        if (m[1] !== target(m[2], suffix)) bad.push(`${page}: drawer ${m[2]} → ${m[1]}, expected ${target(m[2], suffix)}`);
      const foot = body.slice(body.indexOf('<footer'));
      const svc = [...foot.matchAll(/href="((?:\/[a-z]{2})?\/services\/)"/g)].map((m) => m[1]);
      if (!svc.length) bad.push(`${page}: footer has no services link`);
      for (const h of svc) if (h !== `${l.urlPath}services/`) bad.push(`${page}: footer services link → ${h}, expected ${l.urlPath}services/`);
    }
  }
  const puppeteer = (await import('puppeteer')).default;
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    for (const p of pagesToCheck) {
      const tab = await b.newPage();
      await tab.setRequestInterception(true);
      tab.on('request', async (req) => {
        const u = new URL(req.url());
        if (u.origin !== SITE_URL || req.resourceType() !== 'document') return req.abort();
        const f = path.join(DIST, decodeURIComponent(u.pathname), u.pathname.endsWith('/') ? 'index.html' : '');
        try { req.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: await readFile(f) }); }
        catch { req.respond({ status: 404, body: '' }); }
      });
      await tab.goto(SITE_URL + p.page, { waitUntil: 'domcontentloaded', timeout: 60000 });
      // The export's script builds the menu a few frames after load.
      await tab.waitForSelector('a.locale-item[hreflang], .lang-switch a[hreflang]', { timeout: 8000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 300));
      const menu = await tab.evaluate(() =>
        [...document.querySelectorAll('a.locale-item[hreflang], .lang-switch a[hreflang]')]
          .map((a) => [a.getAttribute('hreflang'), a.getAttribute('href')]));
      await tab.close();
      const menuCodes = menu.map(([c]) => c).sort().join(',');
      if (menuCodes !== [...codes].sort().join(',')) bad.push(`${p.page}: language menu [${menuCodes}], expected [${[...codes].sort()}]`);
      for (const [c, h] of menu) if (h !== target(c, p.suffix)) bad.push(`${p.page}: menu ${c} → ${h}, expected ${target(c, p.suffix)}`);
    }
  } finally { await b.close(); }
  if (bad.length) {
    const err = new Error('[build] locale routing broken:\n' + bad.map((x) => `   ${x}`).join('\n') +
      '\n   A language switch or services link would drop the visitor on the wrong page.');
    err.fatal = true;
    throw err;
  }
  console.log(`  ✓ locale routing: ${pagesToCheck.length} pages — footer services link, language menu + drawer, canonical, hreflang`);
}

// Every PDF the site serves (the CV, the checklist) is read the way a visitor
// sees it — visible text and link targets — because the HTML forbidden-string
// scan cannot look inside a PDF. The checklist is also re-rendered from its
// source: if the committed PDF no longer says what the source says, it was
// replaced by hand or not rebuilt, and the deploy stops.
async function assertPublicPdfs() {
  // Any error in here — not just a failed check, but a Chrome launch or a
  // parse error — must stop the deploy. A plain error would send the build
  // to the raw-export fallback, which copies the same PDFs unchecked.
  try { await checkPublicPdfs(); } catch (e) { e.fatal = true; throw e; }
}
async function checkPublicPdfs() {
  const pdfs = (await readdir(DIST)).filter((f) => f.toLowerCase().endsWith('.pdf'));
  const bad = [];
  // The repo's lead-magnet/ copy is handed out too; hold it to the same rules.
  const leadCopy = path.join(ROOT, 'lead-magnet', CHECKLIST_PDF);
  if (existsSync(leadCopy)) {
    for (const p of pdfProblems(await inspectPdf(leadCopy), { requireUris: CHECKLIST_REQUIRED_URIS, requireText: CHECKLIST_REQUIRED_TEXT }))
      bad.push(`lead-magnet/${CHECKLIST_PDF}: ${p}`);
  }
  for (const f of pdfs) {
    const info = await inspectPdf(path.join(DIST, f));
    const isChecklist = f === CHECKLIST_PDF;
    const problems = pdfProblems(info, isChecklist
      ? { requireUris: CHECKLIST_REQUIRED_URIS, requireText: CHECKLIST_REQUIRED_TEXT }
      : { requireUris: PDF_REQUIRED_URIS });
    for (const p of problems) bad.push(`${f}: ${p}`);
    if (isChecklist) {
      const puppeteer = (await import('puppeteer')).default;
      const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
      let fresh;
      try { fresh = await inspectPdf(await renderChecklist(b)); } finally { await b.close(); }
      const sameText = textFingerprint(fresh.text) === textFingerprint(info.text);
      const sameLinks = [...fresh.uris].sort().join(' ') === [...info.uris].sort().join(' ');
      if (!sameText || !sameLinks) bad.push(`${f}: out of date with lead-magnet source (${sameText ? 'links' : 'text'} differ) — run npm run checklist:build`);
    }
  }
  if (!pdfs.includes(CHECKLIST_PDF)) bad.push(`${CHECKLIST_PDF} missing from dist/`);
  if (bad.length) {
    const err = new Error('[build] public PDF check failed:\n' + bad.map((x) => `   ${x}`).join('\n'));
    err.fatal = true;
    throw err;
  }
  console.log(`  ✓ public PDFs: ${pdfs.join(', ')} — text + links clean; checklist matches its source`);
}

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
  // /services exists once per locale (/services/, /ar/services/, …), each with
  // its own canonical, so each is listed.
  const servicesPages = locales.map((l) => ({ path: `${l.urlPath}services/`, priority: '0.7', changefreq: 'monthly' }));

  const urls = locales
    .map((l, i) =>
      `  <url><loc>${SITE_URL}${l.urlPath}</loc><lastmod>${today}</lastmod>` +
      `<changefreq>monthly</changefreq><priority>${i === 0 ? '1.0' : '0.9'}</priority></url>`)
    .concat([...EXTRA_PAGES, ...servicesPages].map((p) =>
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
    `> Senior Software Engineer based in ${LOCATION_LABEL}. ` +
    `${YEARS_PROSE.en[0].toUpperCase()}${YEARS_PROSE.en.slice(1)} building real-time, multi-tenant SaaS, AI tools and mobile ` +
    `apps shipped to production across the Gulf, US, and UK. Open to senior roles and selected consulting.\n\n` +
    `## About\n\n` +
    `- Name: Ahmed Farid\n` +
    `- Role: Senior Software Engineer\n` +
    `- Location: ${LOCATION_LABEL} — remote and on-site\n` +
    `- Currently: full-time at Recovery Advisers (Dubai)\n` +
    `- Availability: a small number of freelance/contract engagements per quarter; open to full-time roles\n\n` +
    `## Core skills\n\n` +
    `Laravel, PHP, Next.js, React, React Native, TypeScript, FastAPI, Python, Flutter, AWS, ` +
    `PostgreSQL, multi-tenant SaaS architecture, real-time systems, AI integration.\n\n` +
    `## Ways to work together\n\n` +
    `- Fixed-scope product build — a defined slice with a clear deliverable (typically 4–8 weeks)\n` +
    `- Ongoing engineering retainer or longer contract\n` +
    `- Technical advisory & architecture review\n\n` +
    `## Links\n\n` +
    `- Website: ${SITE_URL}\n` +
    `- LinkedIn: ${CONTACT.linkedin}\n` +
    `- GitHub: ${CONTACT.github}\n` +
    `- Instagram: https://www.instagram.com/iamahmedfarid\n` +
    `- X: https://x.com/iamahmedfarid\n` +
    `- YouTube: https://www.youtube.com/@iamahmedfarid\n` +
    `- TikTok: https://www.tiktok.com/@iamahmedfarid\n` +
    `- Behance: https://www.behance.net/ahmedfarid20\n` +
    `- CV (PDF): ${SITE_URL}${CONTACT.cv}\n\n` +
    `## Contact\n\n` +
    `- Senior roles: email ${CONTACT.email}, or LinkedIn\n` +
    `- Project work: book a 30-minute scoping call (${CONTACT.calendly}) or WhatsApp Business (${CONTACT.whatsapp})\n`, 'utf8');

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
    `position:relative;transition:transform .2s}a:hover{transform:translateY(-2px)}` +
    `main{display:flex;flex-direction:column;align-items:center;gap:18px;position:relative}</style></head>` +
    `<body><main><div class="code">4<em>0</em>4</div>` +
    `<h1>This page wandered off.</h1>` +
    `<p>The link may be broken or the page may have moved.</p>` +
    `<a href="/">← Back to Ahmed Farid's portfolio</a></main></body></html>\n`, 'utf8');

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
    <div class="eyebrow"><span class="dot"></span>Senior Software Engineer · ${LOCATION.city} · Multi-tenant SaaS \u0026 real-time</div>
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
  // Most build failures are worth absorbing: a flaky render or a missing
  // external asset should not take the site down, and the raw export still
  // works. A content-correctness failure is the opposite — the raw export is
  // precisely what carries the retired claim, so deploying it would publish
  // the thing that just failed the check. Refuse instead.
  // A ReferenceError or TypeError is a bug in this file, not a flaky render.
  // Falling back on one ships the raw export — which is exactly where every
  // retired claim still lives — while the log reads like a graceful recovery.
  // This happened once, for real: a careless edit deleted the forbidden-string
  // check and the build "passed" by deploying the unchecked export.
  const isProgrammerError =
    reason instanceof ReferenceError || reason instanceof TypeError || reason instanceof SyntaxError;
  if ((reason && reason.fatal) || isProgrammerError) {
    console.error('\n✗ Build refused — this failure must not be papered over.');
    console.error(reason.message);
    process.exitCode = 1;
    return;
  }
  console.warn('\n⚠️  Optimized build failed — deploying raw export instead.');
  console.warn('   Reason:', reason && reason.stack ? reason.stack : reason);
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  await copyFile(SRC, path.join(DIST, 'index.html'));
  await copyStaticAssets();
  // The fallback still publishes the PDFs; they get the same retired-fact
  // check (no browser needed), and a failure stops the deploy.
  const pdfBad = [];
  for (const f of (await readdir(DIST)).filter((x) => x.toLowerCase().endsWith('.pdf'))) {
    for (const p of pdfProblems(await inspectPdf(path.join(DIST, f)), { requireUris: PDF_REQUIRED_URIS })) pdfBad.push(`${f}: ${p}`);
  }
  if (pdfBad.length) {
    console.error('\n✗ Fallback refused — a public PDF fails the brand check:\n' + pdfBad.map((x) => `   ${x}`).join('\n'));
    process.exitCode = 1;
    return;
  }
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
// `variant` decides which half of the rendered page survives the snapshot:
//   'home'     — everything except the commercial sections
//   'services' — only the commercial sections
// Both come from the same render, so the shell, nav, fonts, reveals, texture
// and footer are identical by construction rather than by reimplementation.
const FAQ_BUYER_KEYS = {
  en: ['typical engagement', 'clients based', 'your rate'],
  ar: ['التعاقد النموذجي', 'يقع عملاؤك', 'ما سعرك'],
  de: ['typisches Engagement', 'sitzen Ihre Kunden', 'hoch ist Ihr Satz'],
  es: ['colaboración típica', 'están tus clientes', 'tu tarifa'],
  fr: ['mission type', 'sont vos clients', 'votre tarif'],
};

// /services is cut from the home render and has no hero. The export's
// enhancement layer waits for `.hero-stats` before it starts, so on /services
// it never started: no language menu, no Arabic numerals, a dead Personalize
// button. On that page it waits for the nav alone. Its first-visit intro
// splash stays home-only, as it was. Every other feature in the layer is
// null-safe when the hero is missing. A re-export that changes these strings
// leaves the page as before, and assertLocaleRouting then fails the build
// because the language menu is missing.
// Matched on the extracted layer as the export ships it (already minified),
// tolerant of whitespace and quote style.
const ENHANCE_READY = /document\.querySelector\((['"])\.hero-stats\1\)\s*&&\s*(document\.querySelector\((['"])\.nav-links a\3\))/;
const ENHANCE_INTRO_SEEN = /if\s*\(\s*sessionStorage\.getItem\((['"])af_intro_done\1\)\s*\)\s*return/;
function enhanceForVariant(js, variant) {
  if (!js || variant !== 'services') return js;
  const count = (rx) => (js.match(new RegExp(rx.source, 'g')) || []).length;
  if (count(ENHANCE_READY) !== 1 || count(ENHANCE_INTRO_SEEN) !== 1) {
    console.warn('  ⚠ enhancement layer changed shape; /services runs without it (routing gate will flag the menu)');
    return js;
  }
  return js.replace(ENHANCE_READY, '$2').replace(ENHANCE_INTRO_SEEN, 'return');
}

// Page-layout data for the in-page pass. Brand names are not translated, and
// the writing categories render in English on every locale.
const PAGE_LAYOUT = {
  flagship: ['Yelo Sale', 'Qoralia', 'KhebraOS', 'Phonic Maps', 'Recovery Advisers'],
  expectedCollapsed: 7,
  writingRank: ['Debugging', 'Testing', 'Fundamentals', 'Hiring', 'Career'],
};

async function buildPage({ browser, src, outDir, lang, dir, locales, ghData, enhanceJS, assetSeen, variant = 'home' }) {
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
  const result = await page.evaluate(async (ghUser, gh, hasEnhance, localeCodes, pageVariant, faqBuyerKeys, localePrefix, layout) => {
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
    // ── Slice the page ──────────────────────────────────────────────────
    // The freelance offer and the hiring pitch are both in this render. Which
    // one survives depends on the variant; the other is removed from the DOM
    // before the snapshot is taken.
    // Only these two move between pages. #faq and #contact appear on both —
    // a buyer reading prices needs the answers and a way to reach him, and the
    // FAQ is filtered item by item just below rather than wholesale.
    // Every <section>, not just section[id] — three of them carry no id at all
    // (the trust marquee and two unnamed bands), and filtering on `[id]` left
    // them on /services showing the hiring pitch above the price list.
    const commercial = ['pricing', 'services'];
    const sharedOnServices = ['faq', 'contact'];
    document.querySelectorAll('section').forEach((sec) => {
      const id = sec.id || '';
      const isCommercial = commercial.includes(id);
      if (pageVariant === 'services') {
        if (!isCommercial && !sharedOnServices.includes(id)) sec.remove();
      } else if (isCommercial) {
        sec.remove();
      }
    });
    // The FAQ is split item by item rather than wholesale: three of its
    // questions belong to a buyer, the rest to anyone.
    const buyerFaq = faqBuyerKeys;
    document.querySelectorAll('.faq-item').forEach((item) => {
      const q = (item.textContent || '').slice(0, 120);
      const isBuyer = buyerFaq.some((k) => q.includes(k));
      if (pageVariant === 'services' ? !isBuyer : isBuyer) item.remove();
    });
    // Nav links point at sections that may no longer be on this page. On
    // /services they become absolute links back to the home page, so nothing
    // resolves to a dead anchor.
    if (pageVariant === 'services') {
      const homeHref = localePrefix || '/';
      document.querySelectorAll('a[href^="#"]').forEach((a) => {
        const t = a.getAttribute('href');
        a.setAttribute('href', t === '#top' ? homeHref : homeHref + t);
      });
    }

    if (pageVariant === 'services') {
      // Section numbers are displayed. After the cut they would read 13, 14,
      // 15 on a page whose first section is the first thing on it.
      let n = 0;
      document.querySelectorAll('section .eyebrow').forEach((eb) => {
        if (!/·\s*[0-9٠-٩]{2}\s*$/.test(eb.textContent || '')) return;
        n += 1;
        const ar = /[٠-٩]/.test(eb.textContent);
        const num = String(n).padStart(2, '0');
        const shown = ar ? num.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]) : num;
        eb.textContent = (eb.textContent || '').replace(/·\s*[0-9٠-٩]{2}\s*$/, '· ' + shown);
      });
    }

    // ── Link hygiene ────────────────────────────────────────────────────
    // Compass Med serves its site over HTTPS (search engines index the https
    // pages); the export still links the http:// form.
    document.querySelectorAll('a[href^="http://www.compass-egy.com"], a[href^="http://compass-egy.com"]').forEach((a) => {
      a.setAttribute('href', a.getAttribute('href').replace(/^http:/, 'https:'));
    });
    // LinkedIn appends a tracking/geo parameter to company URLs copied from
    // the app; the bare URL resolves to the same page.
    document.querySelectorAll('a[href*="linkedin.com/company/"]').forEach((a) => {
      try {
        const u = new URL(a.getAttribute('href'));
        if (!u.searchParams.has('originalSubdomain')) return;
        u.searchParams.delete('originalSubdomain');
        a.setAttribute('href', u.toString());
      } catch { /* not a parseable URL — leave it */ }
    });

    const warnings = [];
    if (pageVariant === 'home') {
      // ── Writing: engineering topics before career notes ───────────────
      // Stable sort by category rank; unknown categories keep their order at
      // the end. Every card still links to the same LinkedIn activity feed —
      // per-post URLs are not invented here.
      const grid = document.querySelector('#writing .writing-grid');
      if (grid) {
        const cards = [...grid.querySelectorAll(':scope > .writing-card')];
        const rank = (c) => {
          const cat = (c.querySelector('.writing-card-cat')?.textContent || '').trim();
          const i = layout.writingRank.indexOf(cat);
          return i < 0 ? layout.writingRank.length : i;
        };
        const unknown = cards.filter((c) => rank(c) === layout.writingRank.length);
        if (unknown.length) warnings.push(`writing: ${unknown.length} card(s) with an unranked category`);
        cards.map((c, i) => ({ c, i, r: rank(c) }))
          .sort((x, y) => x.r - y.r || x.i - y.i)
          .forEach(({ c }) => grid.appendChild(c));
      } else {
        warnings.push('writing: #writing .writing-grid not found');
      }

      // ── Case studies: progressive disclosure ───────────────────────────
      // The five flagship cases stay fully open. The others keep their
      // header, screenshot, Impact and tech notes visible, and fold Problem +
      // Approach into a native <details>: indexed by search engines, opened
      // by find-in-page, keyboard-accessible, no JS required.
      const cases = [...document.querySelectorAll('article.case')].filter((c) => {
        const name = (c.querySelector('.case-name')?.textContent || '').trim();
        return !layout.flagship.includes(name);
      });
      if (cases.length !== layout.expectedCollapsed) {
        warnings.push(`cases: expected ${layout.expectedCollapsed} non-flagship cases, found ${cases.length} — disclosure skipped`);
      } else {
        cases.forEach((c) => {
          const body = c.querySelector('.case-body');
          const problem = body && body.querySelector(':scope > .case-block.problem');
          if (!problem) { warnings.push('cases: a case has no Problem block'); return; }
          const moved = [];
          for (let n = problem; n; n = n.nextElementSibling) {
            if (n.querySelector('.case-impact') || n.classList.contains('case-mock')) break;
            moved.push(n);
          }
          const labels = moved
            .map((n) => (n.querySelector(':scope > .lbl')?.textContent || '').trim())
            .filter(Boolean).slice(0, 2);
          const details = document.createElement('details');
          details.className = 'case-more';
          const summary = document.createElement('summary');
          summary.className = 'case-more-summary';
          const text = document.createElement('span');
          text.textContent = labels.join(' · ');
          const chev = document.createElement('span');
          chev.className = 'case-more-chev';
          chev.setAttribute('aria-hidden', 'true');
          chev.textContent = '↓';
          summary.append(text, chev);
          const inner = document.createElement('div');
          inner.className = 'case-more-inner';
          body.insertBefore(details, problem);
          moved.forEach((n) => {
            if (n.classList.contains('reveal')) n.classList.add('in');
            n.classList.remove('reveal');
            inner.appendChild(n);
          });
          details.append(summary, inner);
        });
      }
    }

    // Footer email: let it break after the "@" rather than mid-domain in a
    // narrow footer column.
    document.querySelectorAll('footer a[href^="mailto:"]').forEach((a) => {
      if (a.children.length || !a.textContent.includes('@')) return;
      const [local, domain] = a.textContent.split('@');
      a.textContent = local + '@';
      a.appendChild(document.createElement('wbr'));
      a.appendChild(document.createTextNode(domain));
    });

    // Language links keep the visitor on the page they are reading: on
    // /services each language goes to that language's /services/. The drawer
    // links are baked into the snapshot; the runtime menu is fixed up by the
    // vanilla layer (it is built after the snapshot by the export's script).
    if (pageVariant === 'services') {
      document.querySelectorAll('a.dl-lang[hreflang]').forEach((a) => {
        const code = a.getAttribute('hreflang');
        if (localeCodes.includes(code)) a.setAttribute('href', (code === 'en' ? '/' : `/${code}/`) + 'services/');
      });
    }

    // On /services the contact block leads with the project path (call,
    // WhatsApp, brief); on home the hiring path stays first.
    if (pageVariant === 'services') {
      const paths = document.querySelectorAll('#contact .contact-paths > .contact-path');
      if (paths.length === 2) paths[0].parentNode.insertBefore(paths[1], paths[0]);
      else warnings.push(`services: expected 2 contact paths, found ${paths.length}`);
    }

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

    // ── Accessibility structure ─────────────────────────────────────────
    // Done here, before the snapshot, so it is in the static HTML rather than
    // depending on the enhancement JS having run.
    //
    // A <main> around everything between the nav and the footer: the landmark
    // a screen reader jumps to, and the target of the skip link. Every section
    // is a direct child of #root and no rule targets `main` or `#root >`, so
    // re-parenting them changes nothing visually.
    const root = document.getElementById('root');
    const navEl = root && root.querySelector(':scope > nav');
    const footEl = root && root.querySelector(':scope > footer');
    if (navEl && footEl && !document.getElementById('main')) {
      const main = document.createElement('main');
      main.id = 'main';
      main.tabIndex = -1;   // so the skip link moves focus, not just scroll
      root.insertBefore(main, navEl.nextSibling);
      while (main.nextSibling && main.nextSibling !== footEl) main.appendChild(main.nextSibling);
    }

    // /services is a slice of the home render, so its <h1> — the hero — was cut
    // away with the hero and the page opened on an <h2>. Promote the first
    // section title. Its look is carried by `.section-title` (and
    // `.section-title em`), not by the tag, so the swap is invisible.
    if (pageVariant === 'services' && !document.querySelector('h1')) {
      const first = document.querySelector('#main h2');
      if (first) {
        const h1 = document.createElement('h1');
        for (const a of first.attributes) h1.setAttribute(a.name, a.value);
        while (first.firstChild) h1.appendChild(first.firstChild);
        first.replaceWith(h1);
      }
    }

    // The FAQ accordion toggled a data attribute nothing but CSS could see, so
    // a screen reader announced every question as a plain button with no state.
    document.querySelectorAll('.faq-item').forEach((item, i) => {
      const q = item.querySelector('.faq-q');
      const a = item.querySelector('.faq-a');
      if (!q || !a) return;
      if (!a.id) a.id = `faq-a-${i + 1}`;
      q.setAttribute('aria-controls', a.id);
      q.setAttribute('aria-expanded', item.getAttribute('data-open') === 'true' ? 'true' : 'false');
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
      title, lang, meta, css, bodyClass, rootAttrs, bodyAttrs, hasOwnSwitcher, faq, warnings,
      body: document.getElementById('root').innerHTML,
      blobCount: blobUrls.length,
    };
  }, GH_USER, ghData, !!enhanceJS, locales.map((l) => l.lang),
     variant, FAQ_BUYER_KEYS[lang] || FAQ_BUYER_KEYS.en, lang === 'en' ? '/' : `/${lang}/`, PAGE_LAYOUT);

  await page.close();

  // Layout passes are best-effort: a re-export that renames a class leaves the
  // page as the export drew it, which is valid, so warn rather than fail.
  for (const w of result.warnings || []) console.warn(`  [${lang}/${variant}] ⚠ ${w}`);

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
      `Senior Software Engineer in ${LOCATION.city} with ${YEARS_PROSE.en} building real-time, ` +
      'multi-tenant SaaS, AI tools and mobile apps shipped to production across the Gulf, US and UK.',
    url: `${SITE_URL}/`,
    image: `${SITE_URL}/og.png`,
    email: CONTACT.email,
    nationality: { '@type': 'Country', name: 'Egypt' },
    // Nationality stays Egyptian — that is a fact about him, not about where he
    // works from. Address/homeLocation are the "where do I hire from" signal.
    address: { '@type': 'PostalAddress', addressLocality: LOCATION.city, addressCountry: LOCATION.countryCode },
    homeLocation: { '@type': 'Place', name: LOCATION_LABEL },
    worksFor: { '@type': 'Organization', name: 'Recovery Advisers' },
    alumniOf: { '@type': 'CollegeOrUniversity', name: 'Helwan University' },
    knowsLanguage: ['English', 'Arabic'],
    knowsAbout: [
      'Laravel', 'PHP', 'Next.js', 'React', 'React Native', 'TypeScript', 'FastAPI', 'Python',
      'Flutter', 'AWS', 'PostgreSQL', 'Multi-tenant SaaS', 'Real-time systems',
      'AI integration', 'Software Architecture',
    ],
    hasOccupation: {
      '@type': 'Occupation',
      name: 'Software Engineer',
      occupationalCategory: '15-1252.00',
      skills:
        'Laravel, PHP, Next.js, React, React Native, TypeScript, FastAPI, Python, Flutter, ' +
        'AWS, PostgreSQL, multi-tenant SaaS architecture, real-time systems, AI integration',
    },
    // Grounded in the site's "Ways to work together" section — helps AI
    // assistants surface Ahmed for "recommend an engineer to hire" queries.
    // He is available for hire, not only for engagements. Without this the
    // only machine-readable intent on the page is `makesOffer`, which reads
    // as a vendor listing.
    seeks: {
      '@type': 'Demand',
      name: 'Senior Software Engineer role',
      availableAtOrFrom: { '@type': 'Place', name: LOCATION_LABEL },
    },
    makesOffer: [
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Fixed-scope product build', serviceType: 'Software development' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Ongoing engineering retainer', serviceType: 'Software development' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Technical advisory & architecture review', serviceType: 'Technical consulting' } },
    ],
    sameAs: [
      CONTACT.linkedin,
      CONTACT.github,
      'https://www.instagram.com/iamahmedfarid',
      'https://x.com/iamahmedfarid',
      'https://www.youtube.com/@iamahmedfarid',
      'https://www.tiktok.com/@iamahmedfarid',
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
        // Facts owned by site-facts.mjs win over whatever the export says, so
        // a stale years/location claim in the export cannot reach JSON-LD.
        for (const k of ['description', 'address', 'homeLocation']) obj[k] = personLd[k];
        return `${mm[1]}${JSON.stringify(obj)}${mm[3]}`;
      }
    } catch { /* leave malformed ld+json untouched */ }
    return m;
  });

  // /services is its own page per locale, with its own canonical: pointing it
  // at the home page told search engines to drop it.
  const pageSuffix = variant === 'services' ? 'services/' : '';
  const pageUrl = `${SITE_URL}${urlPath}${pageSuffix}`;
  const seo = (SEO[variant] || SEO.home)[lang] || (SEO[variant] || SEO.home).en;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  // Point og:image / twitter:image at the generated card (drop the export's
  // square-avatar one), set og:url to THIS locale's URL, and override the
  // export's canonical with this locale's canonical.
  const hasLd = result.meta.some((m) => /ld\+json/i.test(m));
  // Drop tags we (re)generate deterministically below so they never duplicate:
  // og:image/url, canonical, robots, og:site_name, og:locale.
  const cleanedMeta = result.meta.filter(
    (m) =>
      !/og:image|twitter:image|og:url|og:site_name|og:locale/i.test(m) &&
      !/name=["']?description["'\s>]|og:title|og:description|twitter:title|twitter:description/i.test(m) &&
      !/rel=["']?canonical/i.test(m) &&
      !/name=["']?robots/i.test(m)
  );
  // Facebook-style locale codes per language, plus alternates for the others.
  const ogLocale = { en: 'en_US', ar: 'ar_AR', de: 'de_DE', es: 'es_ES', fr: 'fr_FR' };
  const ogMeta = [
    // Let Google show large image previews + full-length snippets (better CTR).
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">`,
    `<meta name="description" content="${esc(seo.description)}">`,
    `<link rel="canonical" href="${pageUrl}">`,
    `<meta property="og:title" content="${esc(seo.title)}">`,
    `<meta property="og:description" content="${esc(seo.description)}">`,
    `<meta name="twitter:title" content="${esc(seo.title)}">`,
    `<meta name="twitter:description" content="${esc(seo.description)}">`,
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
        .map((l) => `<link rel="alternate" hreflang="${l.lang}" href="${SITE_URL}${l.urlPath}${pageSuffix}">`)
        .concat(`<link rel="alternate" hreflang="x-default" href="${SITE_URL}/${pageSuffix}">`)
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
          `<a href="${l.urlPath}${pageSuffix}" hreflang="${l.lang}"${l.lang === lang ? ' aria-current="true"' : ''}>` +
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
      document.querySelectorAll('.faq-item').forEach(function(i){
        i.setAttribute('data-open','false');
        var b=i.querySelector('.faq-q'); if(b) b.setAttribute('aria-expanded','false');
      });
      item.setAttribute('data-open',String(!isOpen));
      q.setAttribute('aria-expanded',String(!isOpen));
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
  // Language menu: the export's script builds it with home-page targets
  // ("/" and "/<code>/"). On /services, point each language at its own
  // /services/ so switching language never drops the visitor on home.
  // The menu is built a few frames after load, so watch for it.
  var PAGE_SUFFIX=${JSON.stringify(pageSuffix)};
  if(PAGE_SUFFIX){
    var fixLangLinks=function(){
      document.querySelectorAll('a.locale-item[hreflang],a.dl-lang[hreflang],.lang-switch a[hreflang]').forEach(function(a){
        var c=a.getAttribute('hreflang');
        if(/^[a-z]{2}$/.test(c)){var h=(c==='en'?'/':'/'+c+'/')+PAGE_SUFFIX;if(a.getAttribute('href')!==h)a.setAttribute('href',h);}
      });
      return document.querySelector('a.locale-item[hreflang]')!==null;
    };
    // No time limit: in a background tab the export's rAF loop is paused, so
    // the menu can appear long after load. The observer stops once it has.
    if(!fixLangLinks()&&'MutationObserver' in window){
      var mo=new MutationObserver(function(){if(fixLangLinks())mo.disconnect();});
      mo.observe(document.body,{childList:true,subtree:true});
    }
    // Backstop at click time, whatever the timing was.
    document.addEventListener('click',function(e){
      var a=e.target&&e.target.closest&&e.target.closest('a.locale-item[hreflang],a.dl-lang[hreflang],.lang-switch a[hreflang]');
      if(a)fixLangLinks();
    },true);
  }
  // Printing (or saving as PDF) shows every case study in full, then puts
  // the folds back the way the reader left them.
  addEventListener('beforeprint',function(){
    document.querySelectorAll('details.case-more:not([open])').forEach(function(d){d.open=true;d.setAttribute('data-print-opened','');});
  });
  addEventListener('afterprint',function(){
    document.querySelectorAll('details.case-more[data-print-opened]').forEach(function(d){d.open=false;d.removeAttribute('data-print-opened');});
  });
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
${PINTEREST_VERIFY_TAG}
${adPixel(lang)}
<title>${esc(seo.title)}</title>
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
/* Build fix: .why-grid is two columns, so an odd number of principle cards
   leaves the last one half-width beside an empty cell. Span it instead.
   Written for any odd count, not hard-coded to five. */
.why-grid > :last-child:nth-child(odd){grid-column:1 / -1}
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
/* Small screens: grid items default to min-width:auto, so one long
   unbreakable line (a repo name, a German footer heading, the email
   address) widened the GitHub card and the footer grid past a 320px
   column. Let the tracks shrink and wrap long tokens instead. */
.gh>*{min-width:0}
@media (max-width:760px){.foot-grid>*{min-width:0}.foot-col{overflow-wrap:break-word}}
/* The GitHub stats row (three uppercase labels, 16px cell padding) needed
   289–304px inside a 254px card at 360px. Tighten it on phones only. */
@media (max-width:420px){.gh-card{padding:24px 20px}.gh-stat{padding:0 10px}.gh-stat .l{letter-spacing:.06em}
  .gh-heat-foot{gap:10px}.gh-heat-foot>:nth-child(2){text-align:center}}
/* Italic gradient text (background-clip:text) is painted only inside the
   element's box, so the last letter's italic overhang was cut off. Widen
   the box without moving the text; clone repeats that on every line the
   phrase wraps onto. */
.cta h2 em,.hero-h1 .it{padding-inline-end:.12em;margin-inline-end:-.12em;
  -webkit-box-decoration-break:clone;box-decoration-break:clone}
/* .cta-inner's own padding shorthand zeroed the .wrap gutter, so the closing
   copy touched the screen edge on phones. On phones the gutter now lives
   here and the contact rows drop the inline padding that compensated for
   it; wider layouts are unchanged. */
@media (max-width:760px){.cta-inner{padding-left:var(--gutter);padding-right:var(--gutter)}
  .cta-inner .contact-paths{padding-left:0!important;padding-right:0!important}}
/* Case studies outside the flagship five fold Problem + Approach into a
   native <details>; Impact and the tech notes stay visible. */
.case-more-summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;gap:16px;
  padding:14px 18px;border:1px solid var(--line-strong);border-radius:12px;font-family:var(--mono);
  font-size:12.5px;letter-spacing:.02em;color:var(--ink-mute);transition:border-color .2s,color .2s}
.case-more-summary::-webkit-details-marker{display:none}
.case-more-summary:hover{border-color:var(--accent);color:var(--accent)}
.case-more-chev{transition:transform .2s}
.case-more[open] .case-more-chev{transform:rotate(180deg)}
.case-more-inner{display:grid;gap:32px;padding-top:24px}
:root[data-corners=sharp] .case-more-summary{border-radius:2px}
@media print{.case-more-summary{display:none}}
${A11Y_CSS}
${switcherCss}
</style>
</head>
<body class="${result.bodyClass}"${bodyDataAttrs ? ' ' + bodyDataAttrs : ''}>
${skipLink(lang)}
${switcher}
<div id="root">${result.body}</div>
<script src="https://assets.calendly.com/assets/external/widget.js" async></script>
${enhanceJS ? `<script>${enhanceForVariant(enhanceJS, variant)}</script>` : ''}
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
      browser, src: loc.src, outDir: loc.outDir, lang: loc.lang, dir: loc.dir,
      locales, ghData, enhanceJS, assetSeen, variant: 'home',
    });
    // Second cut of the same render: the freelance offer, on its own URL, in
    // the site's own design rather than a hand-built page beside it.
    await buildPage({
      browser, src: loc.src, outDir: path.join(loc.outDir, 'services'),
      lang: loc.lang, dir: loc.dir,
      locales, ghData, enhanceJS, assetSeen, variant: 'services',
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

  // Last gate before the artifact is considered good. Runs against what was
  // actually written to disk, so it catches a correction that was dropped
  // anywhere upstream — a copy edit that stopped matching, a transform that
  // matched nothing, or a stale string that came back with a re-export.
  await applyShellToStandalonePages();
  const pages = await emittedPages();
  await vendorExternalImages(pages);
  await fixHeadingOutlines(pages);
  await assertA11yBaseline(pages);
  await assertNoForbiddenStrings();
  await assertNoDeadAnchors();
  await assertLocaleRouting(locales);
  await assertPublicPdfs();

  console.log(`\n✓ Built ${locales.length} locale page(s); removed React/ReactDOM/Babel-standalone/editor scaffolding.`);
}

try {
  if (!existsSync(SRC)) throw new Error('index.html not found at repo root');
  await build();
} catch (err) {
  await fallback(err);
}
