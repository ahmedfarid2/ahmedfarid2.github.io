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
// The build fails closed: if it cannot produce the full page set and pass every
// gate it exits 1 and writes nothing deployable, so the workflow skips the Pages
// deploy and the last good deploy stays live. There is no raw-export fallback.

import { mkdir, writeFile, copyFile, rm, readdir, readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SITE_URL, LOCATION, LOCATION_LABEL, CONTACT, YEARS_PROSE, SEO, NAV, FLAGSHIP, DRIFT_GUARDS, ANALYTICS, METRICS, CLIENT_QUOTES } from './site-facts.mjs';
import { inspectPdf, pdfProblems, textFingerprint, PDF_REQUIRED_URIS } from './pdf-check.mjs';
import { faviconSvg, appleIconSvg, badgeSvg, ICON_LINKS } from './brand-mark.mjs';
import { renderChecklist, CHECKLIST_PDF, CHECKLIST_REQUIRED_URIS, CHECKLIST_REQUIRED_TEXT } from './build-checklist.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'index.html');
const DIST = path.join(ROOT, 'dist');
const GH_USER = 'ahmedfarid2';

// OpenAI / ChatGPT Ads measurement pixel — behind consent, and off unless
// ANALYTICS.adPixelId is set in site-facts.mjs. Off means no pixel and no
// banner anywhere, the standalone pages included (applyShellToStandalonePages
// strips their copy of the loader), and a forbidden-string gate holds it.
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

const AD_PIXEL_ID = ANALYTICS.adPixelId || '';
if (AD_PIXEL_ID && !/^[A-Za-z0-9_-]{8,64}$/.test(AD_PIXEL_ID)) {
  throw new Error(`[build] ANALYTICS.adPixelId "${AD_PIXEL_ID}" is not a pixel id`);
}
// Where the loader comes from; also what the gate looks for when it is off.
const AD_PIXEL_SRC = 'https://bzrcdn.openai.com/sdk/oaiq.min.js';
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
  if (!AD_PIXEL_ID) return '';
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
      f.parentNode.insertBefore(j,f)}(window,document,"script","${AD_PIXEL_SRC}");
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

// Visitor analytics — Umami Cloud, cookieless, so it needs no consent banner
// (unlike the ad pixel above). Nothing loads until ANALYTICS.umamiWebsiteId is
// set in site-facts.mjs. A malformed id stops the build instead of shipping a
// script that silently records nothing.
const UMAMI_ID = ANALYTICS.umamiWebsiteId || '';
if (UMAMI_ID && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(UMAMI_ID)) {
  throw new Error(`[build] ANALYTICS.umamiWebsiteId "${UMAMI_ID}" is not an Umami website id (a UUID)`);
}
const analyticsTag = UMAMI_ID
  ? `<script defer src="https://cloud.umami.is/script.js" data-website-id="${UMAMI_ID}" data-domains="${new URL(SITE_URL).hostname}"></script>`
  : '';

// Names the clicks that matter, so analytics can count them: every way to
// book, message or hire, and every project card. Umami reads data-umami-event
// on click; without the script the attributes are inert. Matched on the link
// target, so it survives copy changes and works in every locale.
const CLICK_EVENTS = [
  [/calendly\.com\//, 'book-call'],
  [/^https:\/\/wa\.me\//, 'whatsapp'],
  [/^mailto:/, 'email'],
  [/Ahmed-Farid-CV\.pdf$/, 'cv'],
  [/linkedin\.com\/in\//, 'linkedin'],
  [/\/services\/(#[\w-]*)?$/, 'services'],
  [/checklist/, 'checklist'],
];
const PROJECT_HREF = /^(?:\/[a-z]{2})?\/work\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/;
// The nav badge's text "AF" becomes the drawn monogram (scripts/brand-mark.mjs),
// so it matches the favicon instead of falling back to the visitor's own
// monospace font. A re-export that changes the badge markup keeps the text and
// warns rather than failing: the page is still correct, only less polished.
const BRAND_MARK_TEXT = '<span class="brand-mark">AF</span>';
function drawBrandMark(html, lang, key) {
  if (!html.includes(BRAND_MARK_TEXT)) {
    console.warn(`  [${lang}/${key}] ⚠ nav badge markup changed; kept the text "AF" instead of the drawn mark`);
    return html;
  }
  return html.split(BRAND_MARK_TEXT).join(`<span class="brand-mark brand-mark--drawn">${badgeSvg()}</span>`);
}

// Language-switcher links (they carry hreflang) are navigation, not intent, and
// are skipped. Attributes go at the end of the tag so existing attribute order —
// which the routing gate reads — is left exactly as it was.
function tagClicks(html) {
  return html.replace(/<a\b([^>]*?)\shref="([^"]+)"([^>]*)>/g, (tag, _pre, href) => {
    if (/data-umami-event|\shreflang=/.test(tag)) return tag;
    const project = href.match(PROJECT_HREF);
    const attrs = project
      ? ` data-umami-event="project" data-umami-event-project="${project[1]}"`
      : (() => { const hit = CLICK_EVENTS.find(([re]) => re.test(href)); return hit ? ` data-umami-event="${hit[1]}"` : ''; })();
    return attrs ? tag.slice(0, -1) + attrs + '>' : tag;
  });
}

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
  '.brand{min-height:44px}';

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
    // The pages' own headings were Georgia with a gold-italic second half,
    // the formula the rest of the site dropped. Same face and weight as the
    // site's section titles (Geist, from the shell's font faces).
    '#main h1,#main h2,#main h3{font-family:Geist,ui-sans-serif,system-ui,sans-serif;font-weight:500;letter-spacing:-.03em}' +
    '#main h1 em{font-style:normal;color:inherit}' +
    "#main h2 .num{font-family:'JetBrains Mono',ui-monospace,monospace;font-style:normal;font-size:.62em;letter-spacing:0;vertical-align:.2em}" +
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
    doc = doc.replace(/\s*<link rel="(?:icon|apple-touch-icon)"[^>]*>/g, '');
    // These pages carry their own copy of the pixel loader (it only runs for a
    // visitor who already said yes on the main site). With the pixel off,
    // nobody can say yes, so the loader goes too.
    if (!AD_PIXEL_ID) {
      const stripped = doc.replace(/\s*<!-- OpenAI \/ ChatGPT Ads[\s\S]*?<\/script>/, '');
      // A re-export that rewords the comment leaves the loader in place; the
      // forbidden-string gate then fails the build, and this says why.
      if (stripped === doc && doc.includes(AD_PIXEL_SRC)) console.warn(`  ⚠ ${name}: pixel loader found but not stripped (its comment changed?)`);
      doc = stripped;
    }
    doc = doc.replace('</head>', `${ICON_LINKS}<style data-site-shell>${shellCss}</style>${extra}${analyticsTag}</head>`);
    // Skip link first, so it is the first tab stop; its target is each page's
    // own <main class="wrap" id="main">.
    doc = doc.replace(/<body([^>]*)>/, `<body$1>${skipLink('en')}<div class="site-shell">${nav}</div>`);
    doc = doc.replace('</body>', `<div class="site-shell">${footer}</div></body>`);
    doc = tagClicks(doc);
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

// Strings that must never reach dist/. `max` is a ceiling across all of dist/,
// `maxPerFile` a ceiling for any single file — not a ban — for the few strings
// allowed a fixed number of times. A string with neither is banned outright.
// Per-file, because a total grows with every page that carries the same block
// (the contact section is on every page) and a total that has to be raised
// each time a page is added stops guarding anything.
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
  // The ad pixel is off (ANALYTICS.adPixelId empty): no page may load it.
  ...(AD_PIXEL_ID ? [] : [{ s: AD_PIXEL_SRC, max: 0 }]),
  // Calendly does not redirect a renamed user: the old link is a dead page.
  { s: 'calendly.com/ahmedfareed2025', max: 0 },
  // Guards hero, nav and About against the old bare export CTA. The
  // owner-approved client-path CTA is the 30-minute variant below, which does
  // not contain this string; it belongs only in the EN contact block.
  { s: 'Book a scoping call', max: 0 },
  // The contact block carries it once (every page that has one); a second
  // copy is allowed on the EN services page (its pricing CTA) and on EN home
  // (the hero's primary button, by design). The checklist page's call CTA is
  // a third file with one. Each project page is at the ceiling too: its
  // contact block plus the side-column button (.case-cta).
  { s: 'Book a 30-minute scoping call', maxPerFile: 2 },
  // The pricing ladder and the free demo live on /services/ only (all five
  // locales' copies of that page). Banned on every other page — home, /work/,
  // /about/ and the project pages — and expected on the one that owns the
  // offer, so these skip that one file rather than being dropped from the list,
  // which would stop guarding the rest of the site too.
  { s: 'Discuss retainer', max: 0, except: 'services/index.html' },
  { s: 'Scope a build', max: 0, except: 'services/index.html' },
  { s: 'Book a free demo', max: 0, except: 'services/index.html', alsoExcept: ['demo.html'] },
  // /demo.html is the freelance landing page. It stays live and indexable, but
  // no page may route anyone to it except /services/ (home included: its hero
  // books the scoping call and links to /services/ instead).
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
  const perFile = new Map();   // key → [{ rel, n }]
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
        perFile.set(k, [...(perFile.get(k) || []), { rel, n }]);
      }
    }
  };
  await walk(DIST);
  // Over the total ceiling, or any one file over its own.
  const total = (f) => f.max ?? (f.maxPerFile == null ? 0 : Infinity);
  const overFiles = (f) => f.maxPerFile == null ? []
    : (perFile.get(forbiddenKey(f)) || []).filter((x) => x.n > f.maxPerFile);
  const bad = FORBIDDEN.filter((f) => counts.get(forbiddenKey(f)) > total(f) || overFiles(f).length);
  if (bad.length) {
    const err = new Error(
      '[build] forbidden strings reached dist/:\n' +
      bad.map((f) => {
        const k = forbiddenKey(f);
        const ceiling = [f.max != null || f.maxPerFile == null ? `max ${total(f)}` : '',
          f.maxPerFile != null ? `max ${f.maxPerFile} per file` : ''].filter(Boolean).join(', ');
        return `   "${k}" — ${counts.get(k)} occurrence(s), ${ceiling} (${(where.get(k) || []).join(', ')})`;
      }).join('\n') +
      '\n   A correction was dropped, or a retired claim came back. Not deploying.'
    );
    // Flagged fatal: a deliberate gate failure, reported by message (no stack).
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

// Every locale carries every page type in PAGE_SPECS (home, /services/, …), and
// a visitor who switches language, or follows the footer's services link, must
// stay in the same language and on the same kind of page. Checked against the written
// files (footer link, drawer language links, canonical, hreflang) and, for the
// language menu the export's script builds at runtime, in a browser that sees
// dist/ under the real site origin, so the script takes its production path.
async function assertLocaleRouting(locales) {
  const codes = locales.map((l) => l.lang);
  const target = (code, suffix) => (code === 'en' ? '/' : `/${code}/`) + suffix;
  const bad = [];
  const pagesToCheck = [];
  for (const l of locales) {
    for (const suffix of PAGE_SPECS.map((spec) => spec.suffix)) {
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

// ── Page inventory ──────────────────────────────────────────────────────────
// Every page the build is supposed to write, from the one table that drives it.
function localePages(locales) {
  return locales.flatMap((loc) => PAGE_SPECS.map((spec) => ({
    loc, spec, urlPath: loc.urlPath + spec.suffix,
    rel: path.posix.join(loc.urlPath.slice(1), spec.suffix, 'index.html'),
  })));
}

// Pages are cut from a render, so "a page was written" proves little: the cut
// is where content is lost. This checks the files and the sitemap against the
// table, and — per locale — that every section, case study and FAQ question the
// export holds is published on at least one page.
async function assertPageInventory(locales, coverage) {
  const bad = [];
  const pages = localePages(locales);
  const expected = new Set(pages.map((p) => p.rel));
  for (const p of pages) if (!existsSync(path.join(DIST, p.rel))) bad.push(`${p.rel}: not written`);

  const found = [];
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'assets') await walk(full); }
      else if (e.name === 'index.html') found.push(path.relative(DIST, full).split(path.sep).join('/'));
    }
  };
  await walk(DIST);
  for (const f of found) if (!expected.has(f)) bad.push(`${f}: written but not in the page map`);

  const sitemap = await readFile(path.join(DIST, 'sitemap.xml'), 'utf8');
  const listed = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  const want = new Set(sitemapPages(locales).map((x) => SITE_URL + x.path));
  for (const u of want) if (!listed.has(u)) bad.push(`sitemap.xml: missing ${u}`);
  for (const u of listed) if (!want.has(u)) bad.push(`sitemap.xml: unexpected ${u}`);

  const counts = [];
  for (const { lang, shared, snaps } of coverage) {
    const published = (pick) => new Set(snaps.flatMap(pick));
    const keys = published((s) => s.keptKeys);
    const cases = published((s) => s.caseNames);
    const qs = published((s) => s.faq.map((f) => f.q));
    for (const k of new Set(shared.pristineKeys)) if (!keys.has(k)) bad.push(`[${lang}] section "${k || '(unnamed)'}" is on no page`);
    for (const c of new Set(shared.caseNames)) if (!cases.has(c)) bad.push(`[${lang}] case study "${c}" is on no page`);
    for (const q of new Set(shared.faqQs)) if (!qs.has(q)) bad.push(`[${lang}] FAQ question "${q}" is on no page`);
    counts.push(`${new Set(shared.pristineKeys).size}/${new Set(shared.caseNames).size}/${new Set(shared.faqQs).size}`);
  }
  if (bad.length) {
    const err = new Error('[build] page inventory incomplete:\n' + bad.map((x) => `   ${x}`).join('\n') +
      '\n   A page was not written, or a cut dropped content that no other page carries.');
    err.fatal = true;
    throw err;
  }
  console.log(`  ✓ page inventory: ${pages.length} pages (${locales.length} locales × ${PAGE_SPECS.length}), sitemap ${listed.size} URLs; ` +
    `every section, case study and FAQ question is published (${[...new Set(counts)].join(' | ')} per locale)`);
}

// Every link that stays on this site has to land somewhere: a file in dist/,
// and — when it names a fragment — an id in that file. The dead-anchor gate
// covers `#id` on the same page; this covers `/path/` and `/path/#id`, which is
// what pages cut from one render link each other with.
async function assertInternalLinks(files, locales = []) {
  const idsCache = new Map();
  const idsOf = async (file) => {
    if (!idsCache.has(file)) {
      const { masked } = maskCode(await readFile(file, 'utf8'));
      idsCache.set(file, new Set([...masked.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
    }
    return idsCache.get(file);
  };
  const resolveFile = (pathname) => {
    let p;
    try { p = decodeURIComponent(pathname); } catch { return null; }
    const abs = path.join(DIST, p);
    if (abs !== DIST && !abs.startsWith(DIST + path.sep)) return null;
    const isFile = (f) => existsSync(f) && statSync(f).isFile();
    if (!p.endsWith('/') && isFile(abs)) return abs;
    const index = path.join(abs, 'index.html');
    return isFile(index) ? index : null;
  };
  const dead = [];
  let checked = 0;
  for (const f of files) {
    const { masked } = maskCode(await readFile(f, 'utf8'));
    const rel = path.relative(DIST, f);
    for (const m of masked.matchAll(/\shref="([^"]*)"/g)) {
      let href = m[1].replace(/&amp;/g, '&');
      if (href.startsWith(SITE_URL + '/') || href === SITE_URL) href = href.slice(SITE_URL.length) || '/';
      if (!href.startsWith('/') || href.startsWith('//')) continue;
      checked += 1;
      const [pathAndQuery, fragment] = href.split('#');
      const target = resolveFile(pathAndQuery.split('?')[0]);
      if (!target) { dead.push(`${rel} → ${href} (no such file)`); continue; }
      if (fragment && fragment !== 'top' && target.endsWith('.html') && !(await idsOf(target)).has(fragment))
        dead.push(`${rel} → ${href} (no #${fragment} in ${path.relative(DIST, target)})`);
    }
  }
  // The home page's forwarding of old deep links (REDIRECTS): each id must be
  // on the page it forwards to, in every locale.
  for (const l of locales) {
    for (const [id, suffix] of Object.entries(REDIRECTS)) {
      const target = path.join(DIST, l.urlPath, suffix, 'index.html');
      const ids = existsSync(target) ? await idsOf(target) : new Set();
      if (!ids.has(id)) dead.push(`redirect #${id} → ${l.urlPath}${suffix} (no #${id} there)`);
    }
  }
  if (dead.length) {
    const err = new Error('[build] internal links point at nothing:\n' +
      [...new Set(dead)].map((d) => `   ${d}`).join('\n') +
      '\n   A page or section moved. Clicking these lands on a 404 or the top of the wrong page.');
    err.fatal = true;
    throw err;
  }
  console.log(`  ✓ internal links: ${checked} on-site href(s) all resolve — to a file, and to an id where they name one; ` +
    `${Object.keys(REDIRECTS).length} legacy #id redirect(s) land on a page that has the id`);
}

// Each page type has a job, and the file is where a cut can quietly get it
// wrong: the order of the contact paths, the four-link navigation, the cards
// that reach the project pages, the one h1, the structured data. Checked on the
// written pages, from the same table that drives them.
const LD_TYPES = {
  service: 'ProfessionalService', project: 'CreativeWork', profile: 'ProfilePage',
  collection: 'CollectionPage', breadcrumb: 'BreadcrumbList', faq: 'FAQPage',
};
async function assertPageRoles(locales) {
  const bad = [];
  const pages = localePages(locales);
  for (const { loc, spec, urlPath, rel } of pages) {
    const body = await readFile(path.join(DIST, rel), 'utf8');
    const { masked } = maskCode(body);
    // The navigation: exactly these four links, in this order.
    const navBlock = (masked.match(/<div class="nav-links">([\s\S]*?)<\/div>/) || [])[1] || '';
    const navHrefs = [...navBlock.matchAll(/<a href="([^"]*)"/g)].map((m) => m[1]);
    const wantNav = [`${loc.urlPath}work/`, `${loc.urlPath}services/`, `${loc.urlPath}about/`, '#contact'];
    if (navHrefs.join(' ') !== wantNav.join(' ')) bad.push(`${urlPath}: nav links [${navHrefs.join(', ')}], expected [${wantNav.join(', ')}]`);
    // Who the contact block addresses first.
    const at = masked.indexOf('class="contact-path"');
    const end = (() => {
      const next = masked.indexOf('class="contact-path"', at + 1);
      return next > 0 ? next : masked.indexOf('</section>', at);
    })();
    const first = at < 0 ? '' : masked.slice(at, end);
    const wantFirst = spec.contactFirst === 'project' ? CONTACT.calendly : CONTACT.cv;
    if (!first.includes(wantFirst)) bad.push(`${urlPath}: the first contact path should be the ${spec.contactFirst === 'project' ? 'project (scoping call)' : 'hiring (CV)'} path`);
    // Home opens on the project path: no CV in the hero.
    if (spec.key === 'home') {
      const top = masked.indexOf('id="top"');
      const topEnd = masked.indexOf('</section>', top);
      if (top < 0) bad.push(`${urlPath}: no #top hero`);
      else if (masked.slice(top, topEnd).includes('Ahmed-Farid-CV.pdf')) bad.push(`${urlPath}: the hero links to the CV`);
    }
    // Cards to the five project pages.
    if (spec.work === 'teaser') {
      const cards = masked.match(/<a [^>]*data-flagship="[^"]*"[^>]*>/g) || [];
      for (const f of FLAGSHIP) {
        if (!cards.some((c) => c.includes(`href="${loc.urlPath}work/${f.slug}/"`) && c.includes(`data-flagship="${f.slug}"`)))
          bad.push(`${urlPath}: no card linking to ${loc.urlPath}work/${f.slug}/`);
      }
    }
    // A project page's one h1 is the case name.
    if (spec.work === 'single') {
      const h1 = ((masked.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '').replace(/<[^>]+>/g, '').trim();
      if (h1 !== spec.flagship.name) bad.push(`${urlPath}: h1 is "${h1}", expected "${spec.flagship.name}"`);
    }
    // Structured data: the types this page type owns, and no others.
    const want = new Set(['Person', 'WebSite', ...spec.ld.map((k) => LD_TYPES[k]).filter(Boolean)]);
    const got = new Set();
    for (const m of body.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      try { for (const o of [].concat(JSON.parse(m[1]))) got.add(o['@type']); }
      catch { bad.push(`${urlPath}: a JSON-LD block does not parse`); }
    }
    const diff = [...want].filter((t) => !got.has(t)).map((t) => `missing ${t}`)
      .concat([...got].filter((t) => !want.has(t)).map((t) => `unexpected ${t}`));
    if (diff.length) bad.push(`${urlPath}: JSON-LD types — ${diff.join(', ')}`);
  }
  if (bad.length) {
    const err = new Error('[build] page roles broken:\n' + bad.map((x) => `   ${x}`).join('\n') +
      '\n   A page no longer does the job its type is for.');
    err.fatal = true;
    throw err;
  }
  console.log(`  ✓ page roles: ${pages.length} pages — four-link nav, contact order, project cards, one h1, JSON-LD types`);
}

// What search engines and share cards read: the title and description of every
// locale page, and its structured data. Limits are what a result snippet shows
// before cutting; uniqueness is what keeps 45 pages from competing as one.
const HEAD_LIMITS = { title: 80, description: 170 };
async function assertHeadMeta(locales) {
  const bad = [];
  const attr = (s) => String(s ?? '').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const seen = { title: new Map(), description: new Map() };
  let blocks = 0;
  for (const { urlPath, rel } of localePages(locales)) {
    const body = await readFile(path.join(DIST, rel), 'utf8');
    const head = {
      title: attr((body.match(/<title>([\s\S]*?)<\/title>/) || [])[1]),
      description: attr((body.match(/<meta name="description" content="([^"]*)"/) || [])[1]),
    };
    for (const k of ['title', 'description']) {
      if (!head[k]) { bad.push(`${urlPath}: no ${k}`); continue; }
      if (head[k].length > HEAD_LIMITS[k]) bad.push(`${urlPath}: ${k} is ${head[k].length} chars (max ${HEAD_LIMITS[k]})`);
      if (seen[k].has(head[k])) bad.push(`${urlPath}: ${k} duplicates ${seen[k].get(head[k])}`);
      else seen[k].set(head[k], urlPath);
    }
    for (const m of body.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      blocks += 1;
      try { JSON.parse(m[1]); } catch { bad.push(`${urlPath}: a JSON-LD block does not parse`); }
      // A "<" inside a JSON string can close the <script> early.
      if (m[1].includes('<')) bad.push(`${urlPath}: a JSON-LD block holds a raw "<" (escape it as \\u003c)`);
    }
  }
  if (bad.length) {
    const err = new Error('[build] page head or structured data broken:\n' + bad.map((x) => `   ${x}`).join('\n'));
    err.fatal = true;
    throw err;
  }
  console.log(`  ✓ page heads: ${seen.title.size} unique titles (≤${HEAD_LIMITS.title}) and descriptions (≤${HEAD_LIMITS.description}); ${blocks} JSON-LD blocks parse and are script-safe`);
}

// Every PDF the site serves (the CV, the checklist) is read the way a visitor
// sees it — visible text and link targets — because the HTML forbidden-string
// scan cannot look inside a PDF. The checklist is also re-rendered from its
// source: if the committed PDF no longer says what the source says, it was
// replaced by hand or not rebuilt, and the deploy stops.
async function assertPublicPdfs() {
  // Any error in here — not just a failed check, but a Chrome launch or a
  // parse error — must stop the deploy. Flagged fatal so it is reported by
  // message, like every other gate.
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

// Hand-written pages that live outside the design export. They are copied
// into dist/ by copyStaticAssets, but nothing else would put them in the
// sitemap. /demo.html gets the higher priority of the two: it is the page a
// conversion actually happens on.
//
// The checklist is public on purpose: it's the strongest topical content on
// the site, it targets exactly the people who hire for this work, and it ends
// in a "Book a call" CTA. Ranking and being cited by AI assistants is worth
// more here than gating it behind the capture form (which stays the primary
// path from the site and from LinkedIn).
const EXTRA_PAGES = [
  { path: '/demo.html', priority: '0.9', changefreq: 'monthly' },
  { path: '/checklist.html', priority: '0.8', changefreq: 'yearly' },
];

// Every URL the sitemap lists, in order: the locale homes, the hand-written
// pages, then every other page type per locale. Each page type exists once per
// locale with its own canonical, so each is listed. The inventory gate reads
// the same list.
function sitemapPages(locales, specs = PAGE_SPECS) {
  const own = (spec) => locales.map((l, i) => ({
    path: `${l.urlPath}${spec.suffix}`,
    priority: i === 0 && spec.primaryPriority ? spec.primaryPriority : spec.priority,
    changefreq: 'monthly',
  }));
  return [
    ...specs.filter((s) => s.key === 'home').flatMap(own),
    ...EXTRA_PAGES,
    ...specs.filter((s) => s.key !== 'home').flatMap(own),
  ];
}

// sitemap.xml + robots.txt + a styled 404.html. No browser needed, so this
// runs in the full build only (there is no raw-export fallback to cover).
async function writeSeoFiles(locales, specs, projects = null, prices = null) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = sitemapPages(locales, specs)
    .map((p) =>
      `  <url><loc>${SITE_URL}${p.path}</loc><lastmod>${today}</lastmod>` +
      `<changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`)
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

  // The page list for llms.txt. The project taglines come from the English render.
  const pagesBlock = projects
    ? `## Pages\n\n` + [
        `- [Work](${SITE_URL}/work/): ${SEO.work.en.description}`,
        ...FLAGSHIP.filter((f) => projects[f.slug]).map((f) => `- [${f.name}](${SITE_URL}/work/${f.slug}/): ${projects[f.slug].tagline}`),
        `- [Services](${SITE_URL}/services/): ${SEO.services.en.description}`,
        `- [About](${SITE_URL}/about/): ${SEO.about.en.description}`,
      ].join('\n') + `\n\n`
    : '';

  // The ways to work, with the starting prices /services/ shows (read from its
  // English price cards, so an assistant quotes what the page says).
  const priced = prices && prices.length && prices.every((p) => p.name && p.amount);
  if (!priced) console.warn('  ⚠ llms.txt: the /services/ price cards were not found — ways to work listed without prices');
  const waysBlock = priced
    ? prices.map((p) => `- ${p.name}: ${p.amount}${p.note ? ` (${p.note})` : ''}${p.tag ? `. ${p.tag}` : ''}`).join('\n') + '\n' +
      `- Every project is quoted as a flat price after a 30-minute scoping call; no hourly billing\n` +
      `- Free demo: one real screen of your product, built and deployed in five business days (${SITE_URL}/demo.html)\n\n`
    : `- Fixed-scope product build: a defined slice with a clear deliverable\n` +
      `- Ongoing engineering retainer\n` +
      `- Technical advisory & architecture review\n\n`;

  // llms.txt — an emerging convention (llmstxt.org) that gives AI assistants a
  // clean, structured Markdown summary of who this is and how to work with him,
  // so tools like ChatGPT/Claude/Perplexity can recommend him accurately.
  await writeFile(path.join(DIST, 'llms.txt'),
    `# Ahmed Farid — Senior Software Engineer\n\n` +
    `> Senior Software Engineer based in ${LOCATION_LABEL}, taking on fixed-scope builds, retainers and architecture reviews — ` +
    `also open to senior roles. ` +
    `${YEARS_PROSE.en[0].toUpperCase()}${YEARS_PROSE.en.slice(1)} building real-time, multi-tenant SaaS, AI tools and mobile ` +
    `apps shipped to production across the Gulf, US, and UK.\n\n` +
    `## About\n\n` +
    `- Name: Ahmed Farid\n` +
    `- Role: Senior Software Engineer\n` +
    `- Location: ${LOCATION_LABEL} — remote and on-site\n` +
    `- Currently: full-time at Recovery Advisers (Dubai)\n` +
    `- Availability: a few client projects at a time, alongside the full-time role\n\n` +
    `## Core skills\n\n` +
    `Laravel, PHP, Next.js, React, React Native, TypeScript, FastAPI, Python, Flutter, AWS, ` +
    `PostgreSQL, multi-tenant SaaS architecture, real-time systems, AI integration.\n\n` +
    `## Ways to work together\n\n` +
    waysBlock +
    pagesBlock +
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
    `- Project work: book a 30-minute scoping call (${CONTACT.calendly}) or WhatsApp Business (${CONTACT.whatsapp})\n` +
    `- Senior roles: email ${CONTACT.email}, or LinkedIn\n`, 'utf8');

  await writeFile(path.join(DIST, '404.html'),
    `<!doctype html><html lang="en"><head><meta charset="utf-8">\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
    `<title>404 — Ahmed Farid</title><meta name="robots" content="noindex">\n${ICON_LINKS}\n` +
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
// The AF monogram as files every page links to: /favicon.svg as drawn, and the
// iPhone home-screen icon rendered to a 180px PNG (iOS takes no SVG there).
async function generateIcons(browser) {
  await writeFile(path.join(DIST, 'favicon.svg'), faviconSvg(), 'utf8');
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 180, height: 180, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><html><head><style>*{margin:0}html,body{width:180px;height:180px}svg{display:block;width:180px;height:180px}</style></head><body>${appleIconSvg()}</body></html>`);
    await page.screenshot({ path: path.join(DIST, 'apple-touch-icon.png'), clip: { x: 0, y: 0, width: 180, height: 180 } });
  } finally {
    await page.close();
  }
}

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

// Fail closed. Any failure — a gate, a render timeout, a bug in this file — ends
// the run with exit code 1 and writes nothing new: in particular NOT the raw
// export, which is exactly where every retired claim still lives and carries
// none of the checks. The workflow's build step then fails, the Pages artifact
// is never uploaded and the deploy job (needs: build) is skipped, so the last
// good deploy stays live. A fatal error is a deliberate gate failure and is
// reported by message; anything else is reported with its stack. A dist/ left
// behind by the failed run is incomplete and must not be published.
function refuseBuild(reason) {
  console.error('\n✗ Build refused — the full page set could not be produced and verified. Nothing was published; the last deploy stays live.');
  console.error(reason && reason.fatal ? reason.message : (reason && reason.stack) || reason);
  console.error('  Any dist/ left by this run is incomplete: do not deploy it.');
  // Exit now rather than set exitCode: a failure mid-render leaves headless
  // Chromium running, which keeps the event loop alive, so the process (and the
  // CI job) would hang instead of failing. puppeteer kills its browser on exit.
  process.exit(1);
}

// A stable fragment of each buyer-side FAQ question, per locale: those items
// belong on /services, the rest on the pages that serve everyone else.
const FAQ_BUYER_KEYS = {
  en: ['typical engagement', 'clients based', 'your rate'],
  ar: ['التعاقد النموذجي', 'يقع عملاؤك', 'ما سعرك'],
  de: ['typisches Engagement', 'sitzen Ihre Kunden', 'hoch ist Ihr Satz'],
  es: ['colaboración típica', 'están tus clientes', 'tu tarifa'],
  fr: ['mission type', 'sont vos clients', 'votre tarif'],
};

// Home's "Four ways to put me to work" cards, client-first: the full-time role
// is the hiring path and goes last. Each entry is the card heading as the
// export ships it, per locale; a card is found by its heading, so a re-export
// that rewords one is warned about at build time rather than silently left in
// the old order.
const HOME_SERVICE_ORDER = {
  en: ['Fixed-scope build', 'Ongoing partner', 'Technical advisory', 'Full-time role'],
  ar: ['بناء بنطاق محدّد', 'شريك مستمرّ', 'استشارة تقنية', 'دور بدوام كامل'],
  de: ['Festumfang-Build', 'Laufender Partner', 'Technische Beratung', 'Vollzeitstelle'],
  es: ['Proyecto de alcance cerrado', 'Socio continuo', 'Asesoría técnica', 'Puesto a jornada completa'],
  fr: ['Projet à périmètre fixe', 'Partenaire au long cours', 'Conseil technique', 'Poste à temps plein'],
};

// Buyer-facing copy the build sets on the home page (and the pricing badge),
// per locale. Each piece replaces export text found by its class, and warns —
// never fails — when a re-export moves it.
//   tag          the hero label: what is sold and where, not a job title
//   trust        the strip of shipped products: labelled as products, not as
//                client logos ("Trusted across …" read as a logo wall)
//   svcHeading   [from, to] — home shows three ways to work; the full-time
//                role is a hiring path and lives on /services/ and /about/
//   direct       next to the portrait in the closing block
//   notReady / checklist  a low-commitment step for visitors not ready to call
//   recommended  replaces the "Most popular" pricing badge, which had no
//                numbers behind it
//   terms        owner-confirmed working terms (Oct 2026), shown under the
//                project contact path on every page that leads with it
const HOME_COPY = {
  en: {
    tag: { 'tag-full': 'Laravel & Next.js SaaS builds · Dubai, UAE 🇦🇪', 'tag-short': 'SaaS builds · Dubai 🇦🇪', 'tag-tiny': 'SaaS · Dubai 🇦🇪' },
    trust: 'Products<br>I\'ve shipped',
    svcHeading: ['Four ways', 'Three ways'],
    direct: 'You talk to me directly. No account managers, no middlemen.',
    notReady: 'Not ready for a call?',
    checklist: 'Get the free multi-tenant SaaS architecture checklist →',
    recommended: 'Recommended',
    terms: ['Reply within 24 hours', 'NDA before the first call', 'You own all code & IP once paid', 'Contract & invoice directly with me', 'A few projects at a time'],
  },
  ar: {
    tag: { 'tag-full': 'بناء منصّات SaaS بـ Laravel وNext.js · دبي، الإمارات 🇦🇪', 'tag-short': 'بناء منصّات SaaS · دبي 🇦🇪', 'tag-tiny': 'SaaS · دبي 🇦🇪' },
    trust: 'منتجات<br>أطلقتُها',
    svcHeading: ['أربع طرق', 'ثلاث طرق'],
    direct: 'ستتحدث معي مباشرةً — بلا وسطاء.',
    notReady: 'هل الوقت مبكر لمكالمة؟',
    checklist: 'حمّل قائمة التحقق المجانية لمعمارية SaaS متعدّدة المستأجرين (بالإنجليزية) →',
    recommended: 'موصى به',
    terms: ['ردّ خلال ٢٤ ساعة', 'اتفاقية سرّية قبل أول مكالمة', 'الكود والملكية الفكرية لك بعد السداد', 'العقد والفاتورة معي مباشرةً', 'عدد محدود من المشاريع في الوقت نفسه'],
  },
  de: {
    tag: { 'tag-full': 'SaaS-Entwicklung mit Laravel & Next.js · Dubai, VAE 🇦🇪', 'tag-short': 'SaaS-Entwicklung · Dubai 🇦🇪', 'tag-tiny': 'SaaS · Dubai 🇦🇪' },
    trust: 'Produkte, die<br>ich gebaut habe',
    svcHeading: ['Vier Wege', 'Drei Wege'],
    direct: 'Sie sprechen direkt mit mir — ohne Account-Manager, ohne Zwischenstellen.',
    notReady: 'Noch nicht bereit für ein Gespräch?',
    checklist: 'Kostenlose Checkliste zur Multi-Tenant-SaaS-Architektur (Englisch) →',
    recommended: 'Empfohlen',
    terms: ['Antwort innerhalb von 24 Stunden', 'NDA vor dem ersten Gespräch', 'Code und IP gehören Ihnen nach Zahlung', 'Vertrag und Rechnung direkt mit mir', 'Nur wenige Projekte gleichzeitig'],
  },
  es: {
    tag: { 'tag-full': 'Desarrollo SaaS con Laravel y Next.js · Dubái, EAU 🇦🇪', 'tag-short': 'Desarrollo SaaS · Dubái 🇦🇪', 'tag-tiny': 'SaaS · Dubái 🇦🇪' },
    trust: 'Productos que<br>he lanzado',
    svcHeading: ['Cuatro formas', 'Tres formas'],
    direct: 'Hablas directamente conmigo, sin gestores de cuenta ni intermediarios.',
    notReady: '¿Aún no estás listo para una llamada?',
    checklist: 'Descarga gratis la checklist de arquitectura SaaS multi-tenant (en inglés) →',
    recommended: 'Recomendado',
    terms: ['Respuesta en menos de 24 horas', 'NDA antes de la primera llamada', 'Código y PI son tuyos tras el pago', 'Contrato y factura directamente conmigo', 'Pocos proyectos a la vez'],
  },
  fr: {
    tag: { 'tag-full': 'Développement SaaS Laravel & Next.js · Dubaï, EAU 🇦🇪', 'tag-short': 'Développement SaaS · Dubaï 🇦🇪', 'tag-tiny': 'SaaS · Dubaï 🇦🇪' },
    trust: 'Produits que<br>j’ai livrés',
    svcHeading: ['Quatre façons', 'Trois façons'],
    direct: 'Vous parlez directement avec moi — sans chef de projet ni intermédiaire.',
    notReady: 'Pas encore prêt pour un appel ?',
    checklist: 'Téléchargez la checklist gratuite d’architecture SaaS multi-tenant (en anglais) →',
    recommended: 'Recommandé',
    terms: ['Réponse sous 24 heures', 'NDA avant le premier appel', 'Code et PI à vous après paiement', 'Contrat et facture directement avec moi', 'Peu de projets à la fois'],
  },
};

// Copy that reads as a person wrote it (Oct 2026 review). The export's section
// headings all followed one formula ("Plain words, *gold italic words.*"), its
// prose leaned on em dashes, and the person behind the site first appeared at
// the bottom of the page. Applied on every page of the locale; a heading or
// sentence a re-export rewords is reported once per locale, never fatal.
//   hi        next to a small portrait in the home hero
//   caseCta   above the call button in a project page's side column
//   headings  section heading text → plain replacement (en, ar; de/es/fr keep
//             their wording and only lose the gold-italic styling, in CSS)
//   text      exact sentence fragments → rewrites without the em dashes (en)
//   position  the home position statement, rewritten without metaphors
//   navCta    the nav pill, which now books the call
//   caseCount the label of /about/'s first number (METRICS.caseStudies)
//   recs      the testimonials eyebrow (the export says "Trust signals")
//   hireAsk   the closing block's opening question, which also pitches a
//             hire; dropped on every page but /about/ (the hiring page)
//   rateQ     the services FAQ question about price; its answer is rebuilt
//             from the price cards on the same page (rateIntro … rateOutro)
//   outcomes  one plain line per flagship card (slug → text): what it changed
//             for the people using it, in place of an engineering metric
const HUMAN_COPY = {
  en: {
    navCta: 'Book a call',
    caseCount: 'Case studies, each linked to the live product',
    recs: 'Recommendations',
    hireAsk: 'Need a system built, or hiring a senior engineer?',
    rateQ: "What's your rate?",
    rateIntro: 'Starting points:',
    rateOutro: 'After a 30-minute scoping call you get one flat quote for your scope, never an hourly bill.',
    outcomes: {
      'yelo-sale': 'Fleet owners sell cars in live online auctions instead of closed deals',
      'qoralia': 'Cities see which climate projects are feasible, and which grants fit them',
      'khebraos': 'A teacher launches a branded Arabic academy, with course drafts written by AI',
      'phonic-maps': "Every location's reviews and replies in one place",
      'recovery-advisers': 'Clients follow their case live in their own portal',
    },
    hi: "Hi, I'm Ahmed. You'll work with me directly, from the first call to launch.",
    caseCta: 'Need something like this built?',
    headings: {
      'Every system, shipped & linked.': "Live products I've built.",
      'Four steps, then we ship.': 'How a project runs.',
      'Three ways to put me to work.': 'Three ways to work with me.',
      'What colleagues actually said.': "What people I've worked with say.",
      'Ship the system you actually need.': "Tell me what you're building.",
      'Clear packages, scoped to you.': 'Prices, up front.',
      'The questions everyone asks.': 'Common questions.',
      'Six lanes I work in fluently.': 'What I build.',
      "Domains I've shipped real systems for.": "Industries I've worked in.",
      'Concepts, demos, and recent builds.': 'Smaller client builds.',
      "Logos of teams & products I've shipped.": "Teams and products I've shipped for.",
      'The stack, without the buzzwords.': 'The stack I use.',
      "Code I'm willing to publish.": 'Open-source code.',
      'Roles, in order of arrival.': 'Experience.',
      'What you usually get vs. what I bring.': 'Why clients work with me directly.',
      'Find me where you work.': 'Find me online.',
    },
    text: [
      ['real-time, multi-tenant SaaS — live bidding', 'real-time, multi-tenant SaaS: live bidding'],
      ['Architecture, backend, web, mobile and infra — one engineer who can hold the whole rope.', 'Architecture, backend, web, mobile and infra, handled by one engineer.'],
      ['Tenant isolation, role boundaries, billing-aware data — I build platforms', 'Tenant isolation, role boundaries and billing-aware data. I build platforms'],
      ['The full portfolio — flagship SaaS first, then the rest. Each entry links straight to the live product, store listing, or admin surface, pulled from my GitHub profile.', 'Flagship SaaS first, then the rest. Every entry links to the live product, its store listing or its admin panel.'],
      ["My process isn't proprietary — it's just disciplined. Same shape whether the engagement is six weeks or six months.", 'Nothing proprietary: the same four steps whether the work takes six weeks or six months.'],
      ['Docs, runbooks, and a clean README. Whether your team takes it from v2 or I stay on retainer — handoff is part of the work.', 'Docs, runbooks and a clean README. Whether your team takes over or I stay on retainer, handoff is part of the job.'],
      ["Prefer a custom or longer-term setup? Here's how we can work together — every engagement starts with one 30-minute call.", "Want something custom or longer-term? Here's how we can work together. Every engagement starts with one 30-minute call."],
      ['Retainer for continuous delivery — new features, maintenance, and scaling — with the docs and runbooks your team can run on.', 'A monthly retainer for new features, maintenance and scaling, with docs and runbooks your team can use.'],
      ['Senior Software Engineer — real-time, multi-tenant SaaS and end-to-end product engineering. Fixed-scope builds, retainers and architecture consulting.', 'Senior software engineer in Dubai. I build real-time, multi-tenant SaaS end to end, as fixed-scope builds, retainers or architecture reviews.'],
      ['Every project is quoted after a 30-minute scoping call — no surprises, no hourly drift.', 'Every project is quoted after a 30-minute scoping call, so there are no surprises and no hourly billing.'],
      ['One real screen of your product, built and deployed — free.', 'One real screen of your product, built and deployed, for free.'],
      ['One screen or one page, genuinely built — not a mockup', 'One screen or one page, really built, not a mockup'],
      ['No obligation — stop there and you owe nothing', 'No obligation: stop there and you owe nothing'],
      ["One clearly defined slice — not 'the whole product'", "One clearly defined slice, not 'the whole product'"],
      ["No lock-in — 30 days' notice", "No lock-in, 30 days' notice"],
      ['RAG or LLM features in production — retrieval, evals', 'RAG or LLM features in production: retrieval, evals'],
      ["we re-scope together — I don't run an hourly meter.", "we re-scope together. I don't run an hourly meter."],
      ["If yours isn't here, ask it directly — bottom of the page.", "If yours isn't here, ask me directly at the bottom of the page."],
      ['Most start as a 3-week scoped build — a defined slice', 'Most start as a 3-week scoped build: a defined slice'],
      ["What I actually reach for, and why. No frameworks-of-the-month — just the boring tools that survive contact with production.", "What I use, and why. Mostly proven tools that hold up in production."],
      ["Five principles I apply across every project. They're not laws — they're priors I'm willing to break with evidence.", "Five principles I apply on every project, and drop when the evidence says otherwise."],
      ["Full-time and freelance, on-site and remote. The throughline isn't the title — it's the work shipped.", "Full-time and freelance roles, on-site and remote."],
      ["Not a brag list — a spec. If any of these feel like they're missing on your current project, that's where I help.", "What you can expect when we work together."],
      ["Backend, web, mobile, infra — held together by one person.", "Backend, web, mobile and infra, handled by one person."],
      ["Quotes business outcomes — and the trade-offs to get there.", "Talks in business outcomes, and the trade-offs behind them."],
      ["Every mark is a real product I built or contributed to — from Gulf SaaS platforms to a fleet of US & UK pharmacy brands. Hover to pause; click any logo to open its live site.", "Every name here is a real product I built or contributed to, from Gulf SaaS platforms to US and UK pharmacy brands. Each one opens its live site."],
      ["A senior engineer's range, narrowed to what I actually ship — not what's on the résumé. Most projects sit across two or three of these at once.", "What I build most often. Most projects combine two or three of these."],
      ["I'm open to full-time senior engineering roles in Dubai — that's what I'm looking for now. I'm currently full-time at Recovery Advisers (remote) and take a small number of freelance engagements alongside it; those are on the services page.", "Both. I'm full-time at Recovery Advisers (remote), and I take on a few client projects at a time alongside it, so each one gets proper attention. Packages and prices are on the services page."],
      ['UAE, Saudi Arabia, the United States, and Egypt.', 'UAE, Saudi Arabia, the United States, the UK, Spain and Egypt.'],
      ['Design concepts, client demos and smaller builds — all live on my own domain, so you can click through them instead of taking my word for it. Each one is labelled for what it actually is.', 'Client work and client demos, live on my own domain so you can click through them. Each one is labelled for what it is.'],
      ['Concepts & builds', 'Client builds'],
      ['Recommendations from people who managed me directly, verified on LinkedIn.', 'Clients and the people who managed me, in their own words. The LinkedIn-verified one is marked.'],
    ],
    position: 'I treat a product as one system, not a pile of features. I design how the parts fit together, build every layer, and stay on the hook when it has to scale.',
  },
  ar: {
    navCta: 'احجز مكالمة',
    caseCount: 'دراسة حالة، كلٌّ منها مرتبط بالمنتج الحيّ',
    recs: 'توصيات',
    hireAsk: 'تحتاج إلى بناء نظام، أو تبحث عن مهندس أول؟',
    rateQ: 'ما سعرك؟',
    rateIntro: 'نقاط البداية:',
    rateOutro: 'بعد مكالمة تحديد نطاق مدتها ٣٠ دقيقة تحصل على عرض سعر ثابت لنطاقك، لا فاتورة بالساعة.',
    outcomes: {
      'yelo-sale': 'يبيع أصحاب الأساطيل سياراتهم في مزادات مباشرة على الإنترنت بدل الصفقات المغلقة',
      'qoralia': 'ترى المدن أي مشاريع المناخ ممكنة، وأي المنح تناسبها',
      'khebraos': 'يطلق المعلّم أكاديمية عربية باسمه، ويكتب الذكاء الاصطناعي مسودّات دوراته',
      'phonic-maps': 'تقييمات كل الفروع والردود عليها في مكان واحد',
      'recovery-advisers': 'يتابع العملاء قضاياهم مباشرةً من بوابتهم الخاصة',
    },
    hi: 'أهلًا، أنا أحمد. ستعمل معي مباشرةً، من أول مكالمة حتى الإطلاق.',
    caseCta: 'تحتاج إلى نظام مثل هذا؟',
    headings: {
      'كل نظام، سُلّم ورُبط.': 'منتجات بنيتها وتعمل الآن.',
      'أربع خطوات، ثم نُطلق.': 'كيف يسير المشروع.',
      'ثلاث طرق لتشغيلي.': 'ثلاث طرق للعمل معي.',
      'ما قاله الزملاء فعلًا.': 'ماذا يقول من عملوا معي.',
      'أطلق النظام الذي تحتاجه فعلًا.': 'أخبرني بما تبنيه.',
      'باقات واضحة، مصمّمة لك.': 'الأسعار بوضوح من البداية.',
      'الأسئلة التي يطرحها الجميع.': 'أسئلة شائعة.',
      'ستّة مجالات أعمل فيها بطلاقة.': 'ما أبنيه.',
      'مجالات سلّمت لها أنظمة حقيقية.': 'قطاعات عملت فيها.',
      'مفاهيم وعروض تجريبية وأعمال حديثة.': 'أعمال أصغر لعملاء.',
      'شعارات فِرَق ومنتجات سلّمتها.': 'فِرَق ومنتجات عملت معها.',
      'المنظومة التقنية، دون مصطلحات رنّانة.': 'التقنيات التي أستخدمها.',
      'شيفرة أنا مستعدّ لنشرها.': 'شيفرة مفتوحة المصدر.',
      'الأدوار، بترتيب وصولها.': 'الخبرة.',
      'ما تحصل عليه عادةً مقابل ما أقدّمه.': 'لماذا يعمل العملاء معي مباشرةً.',
      'اعثر عليّ حيث تعمل.': 'حساباتي على الإنترنت.',
    },
    text: [
      ["مرّر للإيقاف المؤقّت؛ انقر أي شعار لفتح موقعه الحيّ.", "كل اسم يفتح موقعه الحيّ."],
      ['أبحث عن أدوار هندسية أولى بدوام كامل في دبي — هذا ما أسعى إليه الآن. أعمل حاليًا بدوام كامل لدى Recovery Advisers (عن بُعد) وآخذ إلى جانبها عددًا محدودًا من التعاقدات الحرّة، وهي معروضة في صفحة الخدمات.', 'كلاهما. أعمل بدوام كامل لدى Recovery Advisers (عن بُعد)، وآخذ إلى جانبها عددًا محدودًا من مشاريع العملاء في الوقت نفسه حتى ينال كلٌّ منها حقه من الاهتمام. الباقات والأسعار في صفحة الخدمات.'],
      ['الإمارات والسعودية والولايات المتحدة ومصر.', 'الإمارات والسعودية والولايات المتحدة والمملكة المتحدة وإسبانيا ومصر.'],
      ['مفاهيم تصميمية وعروض تجريبية لعملاء وأعمال أصغر — جميعها منشورة على نطاقي الخاص، لتتصفّحها بنفسك بدل أن تأخذ كلامي. وكلٌّ منها موسوم بما هو عليه فعلًا.', 'أعمال وعروض تجريبية لعملاء، منشورة على نطاقي الخاص لتتصفّحها بنفسك. وكلٌّ منها موسوم بما هو عليه.'],
      ['مفاهيم وأعمال', 'أعمال لعملاء'],
      ['توصيات من أشخاص أداروني مباشرةً، موثّقة على LinkedIn.', 'عملاء وأشخاص أداروني، بكلماتهم. والتوصية الموثّقة على LinkedIn عليها علامة.'],
      ['احجز مكالمة تحديد نطاق مدتها ٣٠ دقيقة', 'احجز مكالمة مدتها ٣٠ دقيقة'],
    ],
    position: 'أتعامل مع المنتج كنظام واحد، لا كمجموعة مزايا متفرّقة. أصمّم كيف تترابط أجزاؤه، وأبني كل طبقاته، وأبقى مسؤولًا عنه حين يكبر.',
  },
  de: {
    navCta: 'Gespräch buchen',
    caseCount: 'Fallstudien, jede mit dem Live-Produkt verlinkt',
    recs: 'Empfehlungen',
    hireAsk: 'Sie brauchen ein System oder suchen einen Senior-Engineer?',
    rateQ: 'Wie hoch ist Ihr Satz?',
    rateIntro: 'Einstiegspreise:',
    rateOutro: 'Nach einem 30-minütigen Scoping-Call bekommen Sie ein Festpreisangebot für Ihren Umfang, keine Stundenrechnung.',
    outcomes: {
      'yelo-sale': 'Flottenbesitzer verkaufen Fahrzeuge in Live-Online-Auktionen statt in geschlossenen Deals',
      'qoralia': 'Städte sehen, welche Klimaprojekte machbar sind und welche Fördermittel passen',
      'khebraos': 'Lehrende starten eine eigene arabische Akademie, die KI entwirft die Kurse',
      'phonic-maps': 'Bewertungen und Antworten aller Standorte an einem Ort',
      'recovery-advisers': 'Mandanten verfolgen ihren Fall live im eigenen Portal',
    },
    hi: 'Hallo, ich bin Ahmed. Sie arbeiten direkt mit mir, vom ersten Gespräch bis zum Launch.',
    caseCta: 'Sie brauchen etwas Ähnliches?',
    headings: {
      'Konzepte, Demos und neuere Arbeiten.': 'Kleinere Kundenprojekte.',
    },
    text: [
      ["Every mark is a real product I built or contributed to — from Gulf SaaS platforms to a fleet of US & UK pharmacy brands. Hover to pause; click any logo to open its live site.", "Jeder Name ist ein echtes Produkt, das ich gebaut oder mitentwickelt habe, von SaaS-Plattformen am Golf bis zu Apothekenmarken in den USA und Großbritannien. Jeder Link öffnet die Live-Website."],
      ['Ich suche eine Senior-Engineering-Festanstellung in Dubai — das ist mein Ziel. Derzeit bin ich Vollzeit bei Recovery Advisers (remote) und nehme daneben einige wenige freiberufliche Projekte an; die stehen auf der Services-Seite.', 'Beides. Ich bin Vollzeit bei Recovery Advisers (remote) und übernehme daneben nur wenige Kundenprojekte gleichzeitig, damit jedes die nötige Aufmerksamkeit bekommt. Pakete und Preise stehen auf der Services-Seite.'],
      ['VAE, Saudi-Arabien, die Vereinigten Staaten und Ägypten.', 'VAE, Saudi-Arabien, die USA, Großbritannien, Spanien und Ägypten.'],
      ['Designkonzepte, Kunden-Demos und kleinere Builds — alle live auf meiner eigenen Domain, damit Sie durchklicken können, statt mir zu glauben. Jedes ist als das gekennzeichnet, was es wirklich ist.', 'Kundenarbeiten und Kunden-Demos, live auf meiner eigenen Domain zum Durchklicken. Jede ist als das gekennzeichnet, was sie ist.'],
      ['Konzepte & Builds', 'Kundenprojekte'],
      ['Empfehlungen von Personen, die mich direkt geführt haben, verifiziert auf LinkedIn.', 'Kunden und Vorgesetzte, in ihren eigenen Worten. Die auf LinkedIn verifizierte Empfehlung ist markiert.'],
    ],
    position: '',
  },
  es: {
    navCta: 'Reservar una llamada',
    caseCount: 'Casos de estudio, cada uno enlazado al producto en vivo',
    recs: 'Recomendaciones',
    hireAsk: '¿Necesitas construir un sistema o buscas un ingeniero senior?',
    rateQ: '¿Cuál es tu tarifa?',
    rateIntro: 'Precios de partida:',
    rateOutro: 'Tras una llamada de 30 minutos recibes un precio cerrado para tu alcance, nunca una factura por horas.',
    outcomes: {
      'yelo-sale': 'Los propietarios de flotas venden vehículos en subastas en vivo, no en tratos cerrados',
      'qoralia': 'Las ciudades ven qué proyectos climáticos son viables y qué subvenciones encajan',
      'khebraos': 'Un docente lanza su propia academia en árabe, con borradores de cursos escritos por IA',
      'phonic-maps': 'Las reseñas y respuestas de todas las sedes en un solo lugar',
      'recovery-advisers': 'Los clientes siguen su caso en vivo desde su propio portal',
    },
    hi: 'Hola, soy Ahmed. Trabajarás directamente conmigo, desde la primera llamada hasta el lanzamiento.',
    caseCta: '¿Necesitas algo parecido?',
    headings: {
      'Conceptos, demos y trabajos recientes.': 'Proyectos más pequeños para clientes.',
    },
    text: [
      ["Pasa el cursor para pausar; haz clic en cualquier logo para abrir su sitio en vivo.", "Cada nombre abre su sitio en vivo."],
      ['Busco un puesto senior de ingeniería a jornada completa en Dubái — es lo que quiero ahora. Actualmente estoy a jornada completa en Recovery Advisers (remoto) y acepto algunos encargos freelance en paralelo; están en la página de servicios.', 'Ambos. Estoy a jornada completa en Recovery Advisers (remoto) y acepto pocos proyectos de clientes a la vez, para que cada uno reciba la atención que merece. Los paquetes y precios están en la página de servicios.'],
      ['EAU, Arabia Saudí, Estados Unidos y Egipto.', 'EAU, Arabia Saudí, Estados Unidos, Reino Unido, España y Egipto.'],
      ['Conceptos de diseño, demos para clientes y trabajos más pequeños — todos publicados en mi propio dominio, para que los recorras en vez de creerme. Cada uno está etiquetado por lo que realmente es.', 'Trabajos y demos para clientes, publicados en mi propio dominio para que los recorras. Cada uno está etiquetado por lo que es.'],
      ['Conceptos y builds', 'Proyectos de clientes'],
      ['Recomendaciones de personas que me supervisaron directamente, verificadas en LinkedIn.', 'Clientes y personas que me supervisaron, con sus propias palabras. La recomendación verificada en LinkedIn está marcada.'],
    ],
    position: '',
  },
  fr: {
    navCta: 'Réserver un appel',
    caseCount: 'Études de cas, chacune liée au produit en ligne',
    recs: 'Recommandations',
    hireAsk: 'Vous avez un système à construire ou recrutez un ingénieur senior ?',
    rateQ: 'Quel est votre tarif ?',
    rateIntro: 'Tarifs de départ :',
    rateOutro: 'Après un appel de 30 minutes, vous recevez un devis forfaitaire pour votre périmètre, jamais une facture horaire.',
    outcomes: {
      'yelo-sale': 'Les propriétaires de flottes vendent leurs véhicules aux enchères en direct, plus en circuit fermé',
      'qoralia': 'Les villes voient quels projets climatiques sont faisables et quelles subventions conviennent',
      'khebraos': 'Un formateur lance sa propre académie en arabe, avec des brouillons de cours rédigés par l’IA',
      'phonic-maps': 'Les avis et réponses de tous les établissements au même endroit',
      'recovery-advisers': 'Les clients suivent leur dossier en direct dans leur propre portail',
    },
    hi: 'Bonjour, je suis Ahmed. Vous travaillez directement avec moi, du premier appel au lancement.',
    caseCta: 'Besoin de quelque chose de similaire ?',
    headings: {
      'Concepts, démos et travaux récents.': 'Projets clients plus courts.',
    },
    text: [
      ["Every mark is a real product I built or contributed to — from Gulf SaaS platforms to a fleet of US & UK pharmacy brands. Hover to pause; click any logo to open its live site.", "Chaque nom est un vrai produit que j’ai construit ou auquel j’ai contribué, des plateformes SaaS du Golfe aux marques de pharmacies aux États-Unis et au Royaume-Uni. Chaque lien ouvre le site en ligne."],
      ["Je cherche un poste senior en ingénierie à temps plein à Dubaï — c'est mon objectif aujourd'hui. Je suis actuellement à temps plein chez Recovery Advisers (à distance) et je prends quelques missions freelance en parallèle ; elles sont sur la page services.", 'Les deux. Je suis à temps plein chez Recovery Advisers (à distance) et je ne prends que quelques projets clients à la fois, pour que chacun reçoive l’attention qu’il mérite. Les forfaits et les tarifs sont sur la page services.'],
      ['EAU, Arabie saoudite, États-Unis et Égypte.', 'EAU, Arabie saoudite, États-Unis, Royaume-Uni, Espagne et Égypte.'],
      ['Concepts de design, démos client et réalisations plus courtes — tous en ligne sur mon propre domaine, pour que vous cliquiez plutôt que de me croire sur parole. Chacun est étiqueté pour ce qu’il est vraiment.', 'Réalisations et démos client, en ligne sur mon propre domaine pour que vous cliquiez dessus. Chacune est étiquetée pour ce qu’elle est.'],
      ['Concepts & réalisations', 'Projets clients'],
      ["Recommandations de personnes qui m'ont encadré directement, vérifiées sur LinkedIn.", 'Des clients et des personnes qui m’ont encadré, avec leurs propres mots. La recommandation vérifiée sur LinkedIn est signalée.'],
    ],
    position: '',
  },
};
// Unrequested concept sites (dental clinics no one commissioned). They stay
// live and linked from /demo.html as samples of the free demo; /work/ shows
// client work only, so they leave its "smaller builds" list.
const CONCEPT_HOSTS = ['reform.iamahmedfarid.com', 'digitdental.iamahmedfarid.com', 'itqan.iamahmedfarid.com'];
// Which HUMAN_COPY headings/text a locale's pages actually used; reported after
// the render so a re-export that rewords one shows up as a warning.
const HUMAN_HITS = new Map();

// "Ways to work together" opens with a sentence about the price list above it
// ("Those are the packaged offers above."). A page without that list drops
// exactly this sentence, as the export words it in each locale.
const PACKAGED_ABOVE = {
  en: 'Those are the packaged offers above.',
  ar: 'تلك هي الباقات في الأعلى.',
  de: 'Das sind die Pakete oben.',
  es: 'Esos son los paquetes de arriba.',
  fr: 'Ce sont les forfaits ci-dessus.',
};

// Every page but home is cut from the home render and has no hero. The
// export's enhancement layer waits for `.hero-stats` before it starts, so on
// those pages it never started: no language menu, no Arabic numerals, a dead
// Personalize button. There it waits for the nav alone. Every other feature
// in the layer is null-safe when the hero is missing. A re-export that changes these strings
// leaves the page as before, and assertLocaleRouting then fails the build
// because the language menu is missing.
// The first-visit splash (the name on a black screen for 1.5s) is off on home
// too since the Oct 2026 review: it held back the first screen for exactly
// the visitor who has never seen the site.
// Matched on the extracted layer as the export ships it (already minified),
// tolerant of whitespace and quote style.
const ENHANCE_READY = /document\.querySelector\((['"])\.hero-stats\1\)\s*&&\s*(document\.querySelector\((['"])\.nav-links a\3\))/;
const ENHANCE_INTRO_SEEN = /if\s*\(\s*sessionStorage\.getItem\((['"])af_intro_done\1\)\s*\)\s*return/;
function enhanceForVariant(js, spec) {
  if (!js) return js;
  const count = (rx) => (js.match(new RegExp(rx.source, 'g')) || []).length;
  if (spec.key === 'home') {
    if (count(ENHANCE_INTRO_SEEN) === 1) return js.replace(ENHANCE_INTRO_SEEN, 'return');
    console.warn('  ⚠ enhancement layer changed shape; the intro splash may still run on home');
    return js;
  }
  if (count(ENHANCE_READY) !== 1 || count(ENHANCE_INTRO_SEEN) !== 1) {
    console.warn(`  ⚠ enhancement layer changed shape; /${spec.suffix} runs without it (routing gate will flag the menu)`);
    return js;
  }
  return js.replace(ENHANCE_READY, '$2').replace(ENHANCE_INTRO_SEEN, 'return');
}

// Page-layout data for the in-page pass. Brand names are not translated, and
// the writing categories render in English on every locale.
const PAGE_LAYOUT = {
  flagship: FLAGSHIP.map((f) => f.name),
  flagships: FLAGSHIP,
  expectedCollapsed: 7,
  writingRank: ['Debugging', 'Testing', 'Fundamentals', 'Hiring', 'Career'],
};

// ── Page map ────────────────────────────────────────────────────────────────
// One table drives every page this build writes. Each locale is rendered ONCE
// (renderLocale) and every row below is a slice of that render (snapshotVariant)
// written to <locale>/<suffix>index.html (writeVariantPage). The shell, nav,
// fonts, reveals, texture and footer are identical by construction rather than
// by reimplementation, and adding a page is adding a row, not another render
// (a render is ~20s; a timeout in one refuses the whole build).
//
//   key          SEO[key] row, log label, and the page-type name
//   suffix       URL path under the locale ('' = the locale root)
//   sections     section keys kept (slicing only removes, so DOM order is the
//                export's own); see SECTION_KEYS / sectionKeyOf
//   keepUnknown  keep a section whose key is not in SECTION_KEYS (a re-export
//                added one) rather than dropping content silently
//   faq          'buyer' | 'other' | null — which FAQ items survive
//   anchors      'resolve': a #hash link whose id is not on this page points at
//                the page that owns it (LINK_OWNER); #top goes to the locale home
//   renumber     renumber the "· 01" eyebrows after the cut
//   work         how the case studies appear: 'teaser' puts a card per flagship
//                (linking to its own page) where the long write-ups were;
//                'single' makes the page ONE flagship's case study (the row's
//                `flagship`), with its own title and description cut from the
//                case itself, so no SEO[key] row exists for it
//   sortWriting  engineering topics before career notes in #writing
//   foldCases    fold Problem + Approach of the non-flagship cases
//   contactFirst 'project' puts the project path before the hiring path
//   promoteH1    promote the first section title to <h1> (no hero on the page)
//   ld           extra JSON-LD for the page: 'service' (ProfessionalService),
//                'project' (CreativeWork), 'profile' (ProfilePage),
//                'collection' (CollectionPage), 'breadcrumb' (BreadcrumbList —
//                needs a NAV label), 'faq' (FAQPage from the FAQ items kept;
//                home shows the buyer questions without it, so the same
//                questions are not marked up twice on the site)
//   priority     sitemap priority (primaryPriority: the default locale's)
//   verify       floor for the built-output check: innerText length and
//                section[id] count, each floor(0.7 × the first green English
//                measurement). Deliberately resizing a page means re-measuring.
// Sections the export ships that no page publishes, on purpose. Removed from
// the render before the page inventory, so the inventory gate still proves
// everything else is published. "writing": six one-line teasers that all
// linked to the same LinkedIn feed, not to any post (Oct 2026 review).
const RETIRED_SECTIONS = ['writing'];
const SECTION_KEYS = [
  'top', 'trust', 'position', 'about', 'bynumbers', 'work', 'products', 'builds', 'build',
  'domains', 'brands', 'regions', 'depth', 'arch', 'github', 'experience', 'process', 'why',
  'testimonials', 'writing', 'pricing', 'services', 'faq', 'connect', 'contact',
];
// Built-output floors for the project pages, floor(0.7 × the first green
// English measurement) per page. Deliberately resizing a case study means
// re-measuring.
const PROJECT_VERIFY = {
  'yelo-sale': { minText: 3731, minSections: 1 },          // measured 5331 chars, 2 sections
  'qoralia': { minText: 2058, minSections: 1 },            // 2940
  'khebraos': { minText: 2058, minSections: 1 },           // 2941
  'phonic-maps': { minText: 2044, minSections: 1 },        // 2920
  'recovery-advisers': { minText: 2117, minSections: 1 },  // 3025
};
const PAGE_SPECS = [
  {
    // The client-facing front door: what I do, proof in numbers, the flagship
    // work, how I work, the ways to hire me, testimonials, contact. Everything
    // longer lives on its own page. The FAQ is the one section left off to hold
    // the page-height budget (desktop 9,000px, mobile 15,192px): its buyer
    // questions stay on /services/, which owns them (and old #faq links are
    // forwarded there).
    key: 'home', suffix: '',
    sections: ['top', 'trust', 'position', 'work', 'process', 'services', 'testimonials', 'contact'],
    keepUnknown: false, faq: null, anchors: 'resolve', renumber: true, work: 'teaser',
    sortWriting: false, foldCases: false, contactFirst: 'project', promoteH1: false,
    ld: ['service'], priority: '0.9', primaryPriority: '1.0',
    verify: { minText: 4809, minSections: 5 },   // measured 6871 chars, 8 sections (FAQ moved to /services/)
  },
  {
    key: 'services', suffix: 'services/',
    // No "ways to work together": it named the three price cards above it a
    // second time, differently. It stays on home, which has no price list.
    sections: ['pricing', 'build', 'domains', 'faq', 'contact'],
    keepUnknown: false, faq: 'buyer', anchors: 'resolve', renumber: true,
    sortWriting: false, foldCases: false, contactFirst: 'project', promoteH1: true,
    ld: ['faq', 'breadcrumb'], priority: '0.8',
    verify: { minText: 3865, minSections: 2 },     // measured 5522 chars, 4 sections
  },
  {
    key: 'work', suffix: 'work/',
    sections: ['work', 'products', 'builds', 'brands', 'regions', 'contact'],
    keepUnknown: false, faq: null, anchors: 'resolve', renumber: true, work: 'teaser',
    sortWriting: false, foldCases: true, contactFirst: 'project', promoteH1: true,
    ld: ['collection', 'breadcrumb'], priority: '0.8',
    verify: { minText: 5642, minSections: 4 },      // measured 8060 chars, 6 sections (Oct 2026: "What I build" and Industries moved to /services/, the further case studies became compact cards)
  },
  {
    key: 'about', suffix: 'about/',
    sections: ['about', 'bynumbers', 'depth', 'arch', 'github', 'experience', 'why', 'faq', 'connect', 'contact'],
    keepUnknown: true, faq: 'other', anchors: 'resolve', renumber: true,
    sortWriting: false, foldCases: false, contactFirst: 'hire', promoteH1: true,
    ld: ['profile', 'faq', 'breadcrumb'], priority: '0.6',
    verify: { minText: 7350, minSections: 7 },       // measured 10501 chars, 10 sections (Oct 2026: Writing retired, 8961 chars; floor kept)
  },
  // One page per flagship case study, cut from the same #work section.
  ...FLAGSHIP.map((f) => ({
    key: `work-${f.slug}`, suffix: `work/${f.slug}/`, work: 'single', flagship: f,
    sections: ['work', 'contact'],
    keepUnknown: false, faq: null, anchors: 'resolve', renumber: true,
    sortWriting: false, foldCases: false, contactFirst: 'project', promoteH1: false,
    ld: ['project', 'breadcrumb'], priority: '0.7',
    verify: PROJECT_VERIFY[f.slug],
  })),
];

// Which page a section lives on, for links to it from a page that does not
// carry it. `contact` is on every page and `position` has no id, so neither
// is listed. Each value is a PAGE_SPECS key.
const LINK_OWNER = {
  top: 'home', 'what-i-do': 'home', trust: 'home', process: 'home', testimonials: 'home', bynumbers: 'about',
  about: 'about', depth: 'about', arch: 'about', github: 'about', experience: 'about',
  why: 'about', connect: 'about',   // no writing: retired (RETIRED_SECTIONS)
  work: 'work', products: 'work', builds: 'work', build: 'services', domains: 'services',
  brands: 'work', regions: 'work',
  pricing: 'services', services: 'home', faq: 'services',
};

// The single-page site's deep links (/#brands, /#experience …) are still out
// there: LinkedIn posts, résumés, bookmarks. Home no longer carries those
// sections, so it forwards each such hash to the page that owns the section.
// Derived, not typed: an id is forwarded exactly when some other page owns it
// and home does not carry it, so moving a section needs no second edit here.
// Sections the export ships without an id (see sectionKeyOf): nothing can link
// to them, so there is nothing to forward.
const UNNAMED_SECTIONS = ['trust', 'position', 'domains'];
const NAV_LABELS = ['work', 'services', 'about', 'contact', 'caseStudy', 'allWork', 'moreWork', 'pricing'];
const REDIRECTS = (() => {
  const home = PAGE_SPECS.find((spec) => spec.key === 'home');
  const out = {};
  for (const [id, owner] of Object.entries(LINK_OWNER)) {
    if (owner === 'home' || home.sections.includes(id) || UNNAMED_SECTIONS.includes(id)) continue;
    out[id] = PAGE_SPECS.find((spec) => spec.key === owner).suffix;
  }
  return out;
})();

// Checked before anything renders: a table that drives every page would
// otherwise turn a typo (a section key, a missing SEO row for one locale) into a
// quietly thin page or a silently borrowed English title.
function assertPageSpecs(locales) {
  const bad = [];
  const keys = new Set();
  const suffixes = new Set();
  for (const spec of PAGE_SPECS) {
    if (keys.has(spec.key)) bad.push(`duplicate page key "${spec.key}"`);
    if (suffixes.has(spec.suffix)) bad.push(`${spec.key}: duplicate suffix "${spec.suffix}"`);
    keys.add(spec.key);
    suffixes.add(spec.suffix);
    if (!/^([a-z0-9]+(-[a-z0-9]+)*\/)*$/.test(spec.suffix))
      bad.push(`${spec.key}: suffix "${spec.suffix}" must be empty or lowercase path segments each ending in "/"`);
    for (const k of spec.sections) if (!SECTION_KEYS.includes(k)) bad.push(`${spec.key}: unknown section key "${k}"`);
    if (spec.ld.includes('faq') && !spec.faq) bad.push(`${spec.key}: ld "faq" but the page keeps no FAQ items`);
    if (!spec.verify || !(spec.verify.minText > 0) || !(spec.verify.minSections > 0)) bad.push(`${spec.key}: no verify floor`);
    for (const l of locales) {
      // A project page's title and description are cut from its case study.
      if (spec.work !== 'single') {
        const seo = (SEO[spec.key] || {})[l.lang];
        if (!seo || !seo.title || !seo.description) bad.push(`SEO.${spec.key}.${l.lang} is missing`);
        if (spec.ld.includes('breadcrumb') && !(NAV[l.lang] || {})[spec.key]) bad.push(`NAV.${l.lang}.${spec.key} is missing (breadcrumb name)`);
      }
    }
  }
  // Every page's navigation, breadcrumbs and cards read these labels.
  for (const l of locales) {
    for (const k of NAV_LABELS) if (!(NAV[l.lang] || {})[k]) bad.push(`NAV.${l.lang}.${k} is missing`);
  }
  // The flagships: a slug becomes a URL segment, so it is validated here, once,
  // before anything is written; every flagship has exactly one project page.
  const slugs = new Set();
  const names = new Set();
  for (const f of FLAGSHIP) {
    if (!f.name || typeof f.name !== 'string') bad.push(`FLAGSHIP entry without a name (${JSON.stringify(f)})`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.slug || '')) bad.push(`FLAGSHIP slug "${f.slug}" must be lowercase words joined by single hyphens`);
    if (slugs.has(f.slug)) bad.push(`FLAGSHIP slug "${f.slug}" is used twice`);
    if (names.has(f.name)) bad.push(`FLAGSHIP name "${f.name}" is used twice`);
    slugs.add(f.slug);
    names.add(f.name);
    if (PAGE_SPECS.filter((spec) => spec.work === 'single' && spec.flagship.slug === f.slug).length !== 1)
      bad.push(`FLAGSHIP "${f.slug}" has no (or more than one) project page in PAGE_SPECS`);
  }
  for (const spec of PAGE_SPECS)
    if (spec.work === 'single' && !FLAGSHIP.some((f) => f.slug === spec.flagship.slug)) bad.push(`${spec.key}: flagship "${spec.flagship.slug}" is not in FLAGSHIP`);
  for (const [id, owner] of Object.entries(LINK_OWNER)) if (!keys.has(owner)) bad.push(`LINK_OWNER ${id} → unknown page "${owner}"`);
  if (!PAGE_SPECS.some((spec) => spec.key === 'home' && spec.suffix === '')) bad.push('no home page at the locale root');
  if (bad.length) {
    const err = new Error('[build] page map invalid:\n' + bad.map((x) => `   ${x}`).join('\n'));
    err.fatal = true;
    throw err;
  }
}

// A section's key: its id, or — for the three the export ships without one —
// the thing that identifies it: the trust marquee (`section.trust`), "What I do"
// (the one holding `.position-grid`) and "Industries" (the one holding
// `.industries`). Serialised into the page (renderLocale), so it must stay
// self-contained.
function sectionKeyOf(sec) {
  if (sec.id) return sec.id;
  if (sec.classList.contains('trust')) return 'trust';
  if (sec.querySelector('.position-grid')) return 'position';
  if (sec.querySelector('.industries')) return 'domains';
  return '';
}

// Everything that does not depend on which page is being cut happens here,
// once per locale: render the export, convert image slots, fill the GitHub
// block, re-embed fonts, capture the head metadata, clean links — then park a
// pristine copy of the result for snapshotVariant to cut from.
async function renderLocale({ browser, loc, ghData, enhanceJS, locales }) {
  const { lang, src } = loc;
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

  // The one definition of "which section is this", shared with the cut below.
  await page.evaluate(`window.__afSectionKey = ${sectionKeyOf.toString()};`);

  console.log(`→ [${lang}] Transforming + extracting static DOM…`);
  const shared = await page.evaluate(async (ghUser, gh, hasEnhance, localeCodes, retired) => {
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

    // Footer email: let it break after the "@" rather than mid-domain in a
    // narrow footer column.
    document.querySelectorAll('footer a[href^="mailto:"]').forEach((a) => {
      if (a.children.length || !a.textContent.includes('@')) return;
      const [local, domain] = a.textContent.split('@');
      a.textContent = local + '@';
      a.appendChild(document.createElement('wbr'));
      a.appendChild(document.createTextNode(domain));
    });

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

    // Sections taken off the site on purpose (RETIRED_SECTIONS), before the
    // inventory: what is not published is then not counted as lost.
    const retiredMissing = [];
    retired.forEach((id) => {
      const sec = document.getElementById(id);
      if (sec && sec.tagName === 'SECTION') sec.remove();
      else retiredMissing.push(id);
    });

    // ── Inventory + pristine copy ───────────────────────────────────────
    // What the export holds, so the Node side can prove every section, case
    // study and FAQ question is published on some page. The pristine copy is
    // what each page is cut from; it is taken after every transform above and
    // before any cut.
    const root = document.getElementById('root');
    const topSections = [...root.querySelectorAll('section')].filter((s) => !s.parentElement.closest('section'));
    const pristineKeys = topSections.map((s) => window.__afSectionKey(s));
    const caseNames = [...root.querySelectorAll('article.case .case-name')].map((e) => (e.textContent || '').trim());
    const faqQs = [...root.querySelectorAll('.faq-item')]
      .map((item) => (item.querySelector('.faq-q .text') || item.querySelector('.faq-q'))?.textContent?.trim() || '')
      .filter(Boolean);
    window.__afPristine = root.cloneNode(true);

    return {
      title, lang, meta, css, bodyClass, rootAttrs, bodyAttrs, hasOwnSwitcher,
      blobCount: blobUrls.length, pristineKeys, caseNames, faqQs, retiredMissing,
    };
  }, GH_USER, ghData, !!enhanceJS, locales.map((l) => l.lang), RETIRED_SECTIONS);

  if (pageErrors.length) {
    console.log(`  [${lang}] (${pageErrors.length} non-fatal page errors during render — expected for blocked external assets)`);
  }
  console.log(`  [${lang}] re-embedded ${shared.blobCount} blob asset(s) as data: URLs`);
  for (const id of shared.retiredMissing || []) console.warn(`  [${lang}] ⚠ retired section "${id}" is not a <section id="${id}"> in the export — nothing removed`);

  try { assertFlagshipsRendered(lang, shared.caseNames); }
  catch (e) { await page.close().catch(() => {}); throw e; }
  return { page, shared };
}

// The flagships are found in the render by name (FLAGSHIP). A re-export that
// renames or drops one would otherwise quietly lose its project page and its
// card: fail the build instead.
function assertFlagshipsRendered(lang, caseNames) {
  const missing = FLAGSHIP.filter((f) => !caseNames.includes(f.name)).map((f) => f.name);
  if (!missing.length) return;
  throw Object.assign(new Error(
    `[build] [${lang}] flagship case stud${missing.length > 1 ? 'ies' : 'y'} not found in the export: ${missing.join(', ')}.\n` +
    `   Found: ${caseNames.join(', ') || '(none)'}. Rename the entry in FLAGSHIP (site-facts.mjs) to match the export.`), { fatal: true });
}

// An error thrown inside page.evaluate comes back from puppeteer as a plain
// Error, never a TypeError/ReferenceError, so nothing downstream could tell a
// bug in a page cut from a flaky render. Every one is tagged fatal: it is
// reported by message and the build is refused.
async function fatalIfThrown(label, pending) {
  try { return await pending; } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    err.message = `[build] ${label}: the page cut failed in the browser — ${err.message}`;
    err.fatal = true;
    throw err;
  }
}

// One cut of the pristine render: restore a fresh copy of the page, remove what
// this page does not carry, and apply the per-page passes. replaceWith, not
// innerHTML: the copy keeps the exact nodes and attributes the render produced.
// The callback is synchronous on purpose — nothing may run between the swap
// and the read of `body` (the export's own observers would get a turn).
async function snapshotVariant({ page, spec, lang, locales }) {
  const prefix = lang === 'en' ? '/' : `/${lang}/`;
  console.log(`→ [${lang}] Cutting ${spec.key} page…`);
  const snap = await fatalIfThrown(`[${lang}] ${spec.key}`, page.evaluate((pageSpec, localeCodes, faqBuyerKeys, localePrefix, layout, knownKeys, links, labels, copy) => {
    document.getElementById('root').replaceWith(window.__afPristine.cloneNode(true));
    const warnings = [];
    // The portrait lives in #about, which home does not keep; take a copy
    // before the slice so the closing block can show who you will talk to.
    const portraitImg = document.querySelector('.about-portrait img')?.cloneNode(true) || null;

    // ── Slice the page ──────────────────────────────────────────────────
    // The freelance offer and the hiring pitch are both in this render. Which
    // sections survive depends on the page (PAGE_SPECS); the rest are removed
    // from the DOM before the snapshot is taken.
    // Every <section>, not just section[id] — three of them carry no id at all
    // (the trust marquee and two unnamed bands), and filtering on `[id]` left
    // them on /services showing the hiring pitch above the price list.
    // The three price cards, read before the cut: home names each way to work
    // by its package and starting price, as /services/ shows them.
    const priceCards = [...document.querySelectorAll('#pricing .price-grid > .price-card')].map((c) => ({
      name: (c.querySelector('.price-name')?.textContent || '').trim(),
      amount: [...(c.querySelector('.price-amount')?.childNodes || [])].map((n) => (n.textContent || '').trim()).filter(Boolean).join(' '),
      note: ((c.querySelector('.price-note')?.textContent || '').split(' · ')[0] || '').trim(),
      tag: (c.querySelector('.price-tag')?.textContent || '').trim(),
      popular: c.classList.contains('is-popular'),
    }));
    const keptKeys = [];
    document.querySelectorAll('section').forEach((sec) => {
      if (sec.parentElement.closest('section')) return;   // goes with its parent
      const key = window.__afSectionKey(sec);
      const known = knownKeys.includes(key);
      if (pageSpec.sections.includes(key) || (pageSpec.keepUnknown && !known)) {
        keptKeys.push(key);
        // "What I do" ships without an id; the hero's scroll cue points at it.
        if (key === 'position' && !sec.id) sec.id = 'what-i-do';
        if (!known) warnings.push(`section "${key || '(unnamed)'}" is not in the page map — kept on ${pageSpec.key}`);
      } else {
        sec.remove();
      }
    });
    // The FAQ is split item by item rather than wholesale: three of its
    // questions belong to a buyer, the rest to anyone.
    if (pageSpec.faq) {
      document.querySelectorAll('.faq-item').forEach((item) => {
        const q = (item.textContent || '').slice(0, 120);
        const isBuyer = faqBuyerKeys.some((k) => q.includes(k));
        if (pageSpec.faq === 'buyer' ? !isBuyer : isBuyer) item.remove();
      });
    }
    // ── Case studies: cards and project pages ───────────────────────────
    // The five flagships are written up in full on a page each. Where the long
    // write-ups sat, a card per flagship links to its page (home, /work/); on a
    // project page the section is that one case study. Cards mirror the
    // export's own product cards (writing-card …), so they need no new styling.
    // Nothing injected here carries `reveal`: it would wait for a scroll
    // observer the card does not need.
    let project = null;
    if (pageSpec.work) {
      const workSec = document.getElementById('work');
      const articles = workSec ? [...workSec.querySelectorAll('article.case')] : [];
      const nameOf = (c) => (c.querySelector('.case-name')?.textContent || '').trim();
      const caseFor = (f) => articles.find((c) => nameOf(c) === f.name);
      const missing = layout.flagships.filter((f) => !caseFor(f));
      const holder = articles.length ? articles[0].parentElement : null;
      if (!workSec || missing.length || !holder || !articles.every((c) => c.parentElement === holder)) {
        warnings.push(`work: flagship cases not found or not in one list (${missing.map((f) => f.name).join(', ') || 'layout'}) — left as exported`);
      } else {
        const el = (tag, cls, text) => {
          const e = document.createElement(tag);
          if (cls) e.className = cls;
          if (text != null) e.textContent = text;
          return e;
        };
        const card = (f) => {
          const art = caseFor(f);
          const a = el('a', 'writing-card');
          a.setAttribute('href', `${localePrefix}work/${f.slug}/`);
          a.setAttribute('data-flagship', f.slug);
          // The case study's own product screenshot (not a link favicon) on top.
          const shot = [...art.querySelectorAll('img')].find((i) => !i.closest('.case-links') && !i.classList.contains('chip-fav'));
          if (shot) {
            const box = el('div', 'wc-shot');
            const im = shot.cloneNode(true);
            im.removeAttribute('style');
            im.setAttribute('alt', '');
            box.appendChild(im);
            a.appendChild(box);
          }
          const head = el('div', 'writing-card-head');
          head.appendChild(el('span', 'writing-card-cat', (art.querySelector('.case-num')?.textContent || '').trim()));
          a.append(head, el('h3', 'writing-card-title', f.name),
            el('p', 'writing-card-desc', (art.querySelector('.case-tagline')?.textContent || '').trim()));
          // What it changed for the people using it, in plain words
          // (HUMAN_COPY outcomes). Without one, a highlight from the case
          // study's impact cells — the first with a number in it, else the
          // first — verbatim, so nothing is invented.
          const outcome = (copy.human.outcomes || {})[f.slug];
          const cells = [...art.querySelectorAll('.case-impact-cell')]
            .map((c) => ({ v: (c.querySelector('.v')?.textContent || '').trim(), l: (c.querySelector('.l')?.textContent || '').trim() }))
            .filter((c) => c.v);
          const pick = cells.find((c) => /[0-9\u0660-\u0669]/.test(c.v)) || cells[0];
          if (outcome) {
            a.appendChild(el('p', 'wc-impact wc-outcome', outcome));
          } else if (pick) {
            const hl = el('p', 'wc-impact');
            hl.append(el('strong', null, pick.v), document.createTextNode(pick.l ? ` · ${pick.l}` : ''));
            a.appendChild(hl);
          }
          const stack = art.querySelector('.case-stack');
          if (stack) a.appendChild(stack.cloneNode(true));
          a.appendChild(el('span', 'writing-card-arr', `${labels.caseStudy} →`));
          return a;
        };
        const grid = (list) => {
          const g = el('div', 'writing-grid');
          list.forEach((f) => g.appendChild(card(f)));
          return g;
        };
        const allWork = () => {
          const w = el('div', 'work-more');
          const a = el('a', 'btn btn-ghost', `${labels.allWork} →`);
          a.setAttribute('href', `${localePrefix}work/`);
          w.appendChild(a);
          return w;
        };
        if (pageSpec.work === 'teaser') {
          const g = grid(layout.flagships);
          if (pageSpec.key === 'home') {
            articles.forEach((c) => c.remove());
            holder.replaceWith(g);
            g.after(allWork());
          } else {
            layout.flagships.forEach((f) => caseFor(f).remove());
            g.classList.add('work-flagships');
            holder.before(g);
          }
        } else if (pageSpec.work === 'single') {
          const f = pageSpec.flagship;
          const art = caseFor(f);
          const more = grid(layout.flagships.filter((x) => x.slug !== f.slug));
          project = {
            name: f.name, slug: f.slug,
            tagline: (art.querySelector('.case-tagline')?.textContent || '').trim(),
            chips: [...art.querySelectorAll('.case-stack .chip')].map((c) => (c.textContent || '').trim()).filter(Boolean),
          };
          articles.forEach((c) => { if (c !== art) c.remove(); });
          const wrap = workSec.querySelector(':scope > .wrap');
          if (!wrap) throw new Error(`${pageSpec.key}: #work has no ":scope > .wrap" column to build the project page in`);
          const head = wrap.querySelector(':scope > .section-head');
          if (head) head.remove();
          workSec.id = 'case';
          // The case name is the page's heading.
          const title = art.querySelector('.case-name');
          if (!title) throw new Error(`${pageSpec.key}: the case has no .case-name to promote to the page heading`);
          const h1 = document.createElement('h1');
          for (const attr of title.attributes) h1.setAttribute(attr.name, attr.value);
          while (title.firstChild) h1.appendChild(title.firstChild);
          title.replaceWith(h1);
          // The full write-up, open: it is what the page is for.
          art.querySelectorAll('.deepdive').forEach((dd) => {
            dd.classList.add('open');
            const toggle = dd.querySelector('.deepdive-toggle');
            if (toggle) toggle.setAttribute('aria-expanded', 'true');
          });
          const crumbs = el('nav', 'crumbs');
          crumbs.setAttribute('aria-label', 'Breadcrumb');
          const ol = el('ol');
          [[localePrefix, 'Ahmed Farid'], [`${localePrefix}work/`, labels.work]].forEach(([href, text]) => {
            const li = el('li');
            const a = el('a', null, text);
            a.setAttribute('href', href);
            li.appendChild(a);
            ol.appendChild(li);
          });
          const here = el('li', null, f.name);
          here.setAttribute('aria-current', 'page');
          ol.appendChild(here);
          crumbs.appendChild(ol);
          wrap.insertBefore(crumbs, wrap.firstChild);
          wrap.append(el('h2', 'fineprint', labels.moreWork), more, allWork());
        }
      }
    }
    // The navigation is the same four links on every page: three pages and the
    // contact block. The export's six in-page anchors (Work, Brands, Engineering,
    // Experience, Process, FAQ) described a single long page. Numbers are taken
    // from the links being replaced, so Arabic keeps its Arabic-Indic digits.
    {
      const here = pageSpec.key;
      const items = [
        { key: 'work', href: `${localePrefix}work/`, label: labels.work },
        { key: 'services', href: `${localePrefix}services/`, label: labels.services },
        { key: 'about', href: `${localePrefix}about/`, label: labels.about },
        { key: 'contact', href: '#contact', label: labels.contact },
      ];
      const fill = (container, existing, anchorBefore) => {
        const nums = existing.slice(0, items.length).map((a) => (a.querySelector('.idx') || {}).textContent);
        existing.forEach((a) => a.remove());
        items.forEach((it, i) => {
          const a = document.createElement('a');
          a.setAttribute('href', it.href);
          if (it.key === here) a.setAttribute('aria-current', 'page');
          const idx = document.createElement('span');
          idx.className = 'idx';
          idx.textContent = nums[i] || String(i + 1).padStart(2, '0');
          a.append(idx, document.createTextNode(it.label));
          container.insertBefore(a, anchorBefore);
        });
      };
      const links = document.querySelector('#root > nav .nav-links');
      const drawer = document.querySelector('#root > nav .nav-mobile');
      if (links) fill(links, [...links.querySelectorAll(':scope > a')], null);
      else warnings.push('nav: .nav-links not found — navigation left as exported');
      if (drawer) {
        const own = [...drawer.querySelectorAll(':scope > a')].filter((a) => !a.classList.contains('nav-mobile-avail') && !a.classList.contains('nav-mobile-cta'));
        fill(drawer, own, drawer.querySelector(':scope > .nav-mobile-cta'));
      } else warnings.push('nav: .nav-mobile not found — drawer left as exported');
    }
    // The hero's scroll cue pointed at the Profile section, which now lives on
    // /about/. "What I do" is what comes next on this page.
    const scrollCue = document.querySelector('.hero-scroll');
    if (scrollCue && document.getElementById('what-i-do')) scrollCue.setAttribute('href', '#what-i-do');
    // Home: the hero's second ghost button was "Download CV" — the hiring path.
    // A client's next question is what it costs and how it works, so it goes to
    // Services & pricing. The CV stays in the footer, on /about/ and in the
    // hiring path of the contact block.
    if (pageSpec.key === 'home') {
      const cv = document.querySelector('.hero-meta a[href$="Ahmed-Farid-CV.pdf"]');
      if (cv) {
        cv.setAttribute('href', `${localePrefix}services/`);
        cv.removeAttribute('download');
        cv.textContent = `${labels.pricing} →`;
      } else warnings.push('hero: the CV button was not found — left as exported');
    }
    // "Ways to work together" opens with "Those are the packaged offers above."
    // On a page without the price list there is no "above"; drop that sentence.
    // It is matched as the locale's own sentence, not "everything up to the
    // first full stop", so a reworded sub-line is warned about, not trimmed.
    if (!pageSpec.sections.includes('pricing') && pageSpec.sections.includes('services')) {
      const sub = document.querySelector('#services .section-sub');
      const text = sub ? sub.textContent.trim() : '';
      if (sub && !sub.children.length && text.startsWith(copy.packagedAbove)) {
        sub.textContent = text.slice(copy.packagedAbove.length).trim();
      } else warnings.push(`services: the "packaged offers above" sentence (${copy.packagedAbove}) was not found at the start of #services .section-sub — left as exported`);
    }
    // Home: the four service cards run full-time role first, which is the
    // hiring path. For a client the fixed-scope build, the retainer and the
    // advisory call come first and the role last. The cards are found by
    // heading (HOME_SERVICE_ORDER); their numbers and stagger delays belong to
    // the position, so they stay put while the cards move. /services/ keeps the
    // export's order.
    if (pageSpec.key === 'home') {
      const grid = document.querySelector('#services .services-grid');
      const cards = grid ? [...grid.querySelectorAll(':scope > .service-card')] : [];
      const headingOf = (c) => (c.querySelector('.service-t')?.textContent || '').trim();
      const ordered = copy.serviceOrder.map((t) => cards.find((c) => headingOf(c) === t));
      if (grid && cards.length === ordered.length && ordered.every(Boolean)) {
        const nums = cards.map((c) => c.querySelector('.service-num')?.textContent);
        const delays = cards.map((c) => c.style.transitionDelay);
        ordered.forEach((c, i) => {
          grid.appendChild(c);
          const num = c.querySelector('.service-num');
          if (num && nums[i] != null) num.textContent = nums[i];
          c.style.transitionDelay = delays[i];
        });
        // The full-time role is a hiring path: on home the client sees the
        // three ways to buy, and the role stays on /services/ and /about/.
        ordered[ordered.length - 1].remove();
        const title = document.querySelector('#services .section-title');
        const first = title && [...title.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
        const [from, to] = copy.home.svcHeading;
        if (first && first.textContent.trimStart().startsWith(from)) first.textContent = first.textContent.replace(from, to);
        else warnings.push(`services: heading does not start with "${from}" — left as exported while showing three cards`);
      } else {
        warnings.push(`services: the four cards were not found by heading (${copy.serviceOrder.join(' | ')}) — left in the export's order`);
      }
    }
    // Home, buyer-facing: the hero says what is sold, the primary button books
    // the call (same link and words as the closing block), "See selected work"
    // goes (the work is the next thing on the page), the product strip is
    // labelled as products, and the closing block shows who answers.
    if (pageSpec.key === 'home') {
      const H = copy.home;
      const tag = document.querySelector('#top .hero-tag');
      for (const [cls, text] of Object.entries(H.tag)) {
        const span = tag && tag.querySelector(`.${cls}`);
        if (span) span.textContent = text;
        else warnings.push(`hero: .hero-tag .${cls} not found — left as exported`);
      }
      const heroBtns = document.querySelector('#top .hero-meta');
      const primary = heroBtns && heroBtns.querySelector('a.btn-primary');
      const call = document.querySelector('#contact a[href*="calendly.com"]');
      const callText = call ? [...call.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() : '';
      const label = primary && [...primary.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      if (primary && call && callText && label) {
        primary.setAttribute('href', call.getAttribute('href'));
        primary.setAttribute('target', '_blank');
        primary.setAttribute('rel', 'noreferrer');
        label.textContent = `${callText} `;
        heroBtns.querySelectorAll('a[href="#work"]').forEach((a) => a.remove());
      } else warnings.push('hero: primary button or the scoping-call link not found — hero buttons left as exported');
      const trustLabel = document.querySelector('.trust .trust-label');
      if (trustLabel) trustLabel.innerHTML = H.trust;
      else warnings.push('trust: .trust-label not found — left as exported');
      const paths = document.querySelector('#contact .contact-paths');
      if (paths) {
        const person = document.createElement('div');
        person.className = 'cta-person';
        if (portraitImg) {
          portraitImg.removeAttribute('style');
          portraitImg.setAttribute('alt', '');
          person.appendChild(portraitImg);
        }
        const who = document.createElement('span');
        who.textContent = H.direct;
        person.appendChild(who);
        paths.before(person);
        const alt = document.createElement('p');
        alt.className = 'contact-alt';
        alt.appendChild(document.createTextNode(`${H.notReady} `));
        const lm = document.createElement('a');
        lm.setAttribute('href', '/checklist.html');
        lm.textContent = H.checklist;
        alt.appendChild(lm);
        paths.after(alt);
      } else warnings.push('contact: .contact-paths not found — no portrait or checklist line');
    }
    document.querySelectorAll('.is-popular .price-badge').forEach((b) => { b.textContent = copy.home.recommended; });

    // ── Reads as a person, sells to a client (HUMAN_COPY) ───────────────
    const H2 = copy.human;
    const humanHits = [];
    // Section headings: one plain line, no gold-italic second half.
    const norm = (s) => s.replace(/\s+/g, ' ').trim();
    document.querySelectorAll('.section-title, #contact.cta h2').forEach((h) => {
      // A <br> separates words, but contributes nothing to textContent.
      const key = norm([...h.childNodes].map((n) => (n.nodeName === 'BR' ? ' ' : n.textContent)).join(''));
      if (Object.prototype.hasOwnProperty.call(H2.headings, key)) {
        h.textContent = H2.headings[key];
        humanHits.push(`h:${key}`);
      }
    });
    // Prose: exact fragments, so a reworded export is left alone, not mangled.
    if (H2.text.length) {
      const walker = document.createTreeWalker(document.getElementById('root'), NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        for (const [from, to] of H2.text) {
          if (n.nodeValue.includes(from)) { n.nodeValue = n.nodeValue.split(from).join(to); humanHits.push(`t:${from}`); }
        }
      }
    }
    const statement = document.querySelector('.position-statement');
    if (statement && H2.position) { statement.textContent = H2.position; humanHits.push('position'); }
    // Section numbers ("What I do · 01") and the export's build stamp read as a
    // template; the copyright line keeps the year and the name.
    document.querySelectorAll('.eyebrow').forEach((e) => {
      for (const n of e.childNodes) if (n.nodeType === 3) n.nodeValue = n.nodeValue.replace(/\s*·\s*[0-9٠-٩]{1,2}\s*$/, '');
    });
    document.querySelectorAll('.foot-bottom > span').forEach((s) => {
      const t = (s.textContent || '').trim();
      if (/^v\.\d{4}\.\d{1,2}$/.test(t)) s.remove();
      else if (t.startsWith('©')) s.textContent = t.split(' · ').slice(0, 2).join(' · ');
    });
    // The footer's services link said "Freelance & consulting"; it is the
    // same page the nav calls Services.
    document.querySelectorAll(`.foot-col a[href="${localePrefix}services/"]`).forEach((a) => { a.textContent = labels.services; });
    // Testimonials: the one about working with the business comes first; the
    // other praises a Flutter developer, which is the secondary lane.
    const tests = document.querySelector('.tests');
    if (tests && tests.children.length === 2) tests.prepend(tests.lastElementChild);
    // Home hero: a face and a first name before the buttons.
    if (pageSpec.key === 'home') {
      const sub = document.querySelector('#top .hero-sub');
      if (sub && portraitImg && H2.hi) {
        const hi = document.createElement('div');
        hi.className = 'hero-person';
        const img = portraitImg.cloneNode(true);
        img.removeAttribute('style');
        img.setAttribute('alt', '');
        img.setAttribute('width', '40');
        img.setAttribute('height', '40');
        img.setAttribute('loading', 'eager');   // first screen: never deferred
        hi.appendChild(img);
        const span = document.createElement('span');
        span.textContent = H2.hi;
        hi.appendChild(span);
        sub.after(hi);
      } else warnings.push('hero: .hero-sub or the portrait not found — no hero portrait');
    }
    // Project pages: the short "Problem" repeats the write-up's first block,
    // and "Read the case study" is a toggle for a page that is the case
    // study. The side column, empty under the links, gets the call button.
    if (pageSpec.work === 'single') {
      document.querySelectorAll('#case .case-block.problem').forEach((b) => b.remove());
      document.querySelectorAll('#case .deepdive-toggle').forEach((b) => b.remove());
      const meta = document.querySelector('#case .case-meta');
      const call = document.querySelector('#contact a[href*="calendly.com"]');
      if (meta && call && H2.caseCta) {
        const box = document.createElement('div');
        box.className = 'case-cta';
        const p = document.createElement('p');
        p.textContent = H2.caseCta;
        box.appendChild(p);
        box.appendChild(call.cloneNode(true));
        meta.appendChild(box);
      } else warnings.push('case: .case-meta or the scoping-call link not found — no side-column call button');
    }
    // About: the portrait badge said "Open to work · Now", which on a client
    // site reads as job hunting.
    document.querySelectorAll('.about-portrait-badge').forEach((b) => b.remove());
    // By the numbers: "9+ flagship platforms" contradicted the five flagships
    // the site shows; the first tile counts the case studies instead.
    const firstNum = document.querySelector('#bynumbers .bynum');
    if (firstNum && H2.caseCount) {
      const v = firstNum.querySelector('.bynum-v');
      const l = firstNum.querySelector('.bynum-l');
      const digits = localePrefix === '/ar/' ? copy.caseStudies.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]) : copy.caseStudies;
      // Only the tile that still says 9+ (any digits, either side of the
      // plus): a re-export that reorders the tiles must not lose a stat.
      if (v && l && /^\+?[9٩]\+?$/.test((v.textContent || '').trim())) {
        v.textContent = digits; l.textContent = H2.caseCount; humanHits.push('caseCount');
      } else warnings.push('about: the first number tile no longer reads 9+ — left as exported');
    }
    // Ibdaa Course left alpha: production is ibdaacourse.com, and the
    // "working title, pending the client's brand" note is out of date.
    document.querySelectorAll('a[href^="https://alpha.ibdaacourse.com"]').forEach((a) => {
      a.setAttribute('href', a.getAttribute('href').replace('https://alpha.ibdaacourse.com', 'https://ibdaacourse.com'));
    });
    document.querySelectorAll('.shot-url').forEach((u) => {
      for (const n of u.childNodes) if (n.nodeType === 3 && n.nodeValue.trim() === 'alpha.ibdaacourse.com') n.nodeValue = 'ibdaacourse.com';
    });
    document.querySelectorAll('article.case').forEach((art) => {
      if ((art.querySelector('.case-name')?.textContent || '').trim() !== 'Ibdaa Course') return;
      art.querySelectorAll('.case-meta > .fineprint').forEach((f, i) => { if (i > 0) f.remove(); });
    });
    // Nav: no "01 02 03" index numbers, and the pill beside the links books
    // the call instead of repeating the Contact link.
    document.querySelectorAll('.nav .idx').forEach((e) => e.remove());
    const navCall = document.querySelector('#contact a[href*="calendly.com"]');
    if (navCall && H2.navCta) {
      document.querySelectorAll('a.nav-cta, a.nav-mobile-avail').forEach((a) => {
        a.setAttribute('href', navCall.getAttribute('href'));
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noreferrer');
        for (const n of [...a.childNodes]) if (n.nodeType === 3) n.remove();
        a.appendChild(document.createTextNode(H2.navCta));
      });
    } else warnings.push('nav: scoping-call link not found — nav pill left as exported');
    // /work/: the logo wall loaded each mark from the product's site or from
    // Google's favicon service, so most rendered as blank tiles. Plain linked
    // names instead, once each (the marquee repeats every tile).
    if (pageSpec.key === 'work') {
      const wall = document.querySelector('#brands .logo-wall');
      if (wall) {
        const wrap = document.createElement('div');
        wrap.className = 'wrap';
        const list = document.createElement('div');
        list.className = 'brand-list';
        const seen = new Set();
        wall.querySelectorAll('a.logo-tile').forEach((t) => {
          const href = t.getAttribute('href');
          const name = (t.querySelector('.logo-tile-cap')?.textContent || t.getAttribute('title') || '').trim();
          if (!href || !name || seen.has(href)) return;
          seen.add(href);
          const a = document.createElement('a');
          a.className = 'chip';
          a.setAttribute('href', href);
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noreferrer');
          a.textContent = name;
          list.appendChild(a);
        });
        wrap.appendChild(list);
        wall.replaceWith(wrap);
      } else warnings.push('brands: .logo-wall not found — left as exported');
    }
    // /services/: what I build and the industries sit after the price list
    // (the export orders them before it).
    if (pageSpec.key === 'services') {
      const pricing = document.getElementById('pricing');
      const build = document.getElementById('build');
      const domains = document.querySelector('.industries')?.closest('section');
      if (pricing && build && domains) { pricing.after(build); build.after(domains); }
      else warnings.push('services: #pricing, #build or the industries section not found — left in export order');
    }
    // The testimonials are recommendations; "Trust signals" was the marketer
    // talking to himself.
    const recsEyebrow = document.querySelector('.tests')?.closest('section')?.querySelector('.eyebrow');
    if (recsEyebrow && H2.recs) {
      const t = [...recsEyebrow.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      if (t) { t.textContent = H2.recs; humanHits.push('k:recs'); }
    }
    // /work/ is client work: the concept sites leave the smaller-builds list.
    const builds = document.getElementById('builds');
    if (builds) {
      const hostOf = (a) => { try { return new URL(a.getAttribute('href')).host; } catch { return ''; } };
      const concepts = [...builds.querySelectorAll('a.writing-card')].filter((a) => copy.conceptHosts.includes(hostOf(a)));
      if (concepts.length === copy.conceptHosts.length) concepts.forEach((a) => a.remove());
      else warnings.push(`builds: expected ${copy.conceptHosts.length} concept cards, found ${concepts.length} — left as exported`);
    }
    // Project pages: the same plain line the flagship card carries, under the
    // tagline, so the page says what changed before how it was built.
    if (pageSpec.work === 'single') {
      const outcome = (H2.outcomes || {})[pageSpec.flagship.slug];
      const tagline = document.querySelector('#case .case-tagline');
      if (outcome && tagline) {
        const p = document.createElement('p');
        p.className = 'case-outcome';
        p.textContent = outcome;
        tagline.after(p);
      } else warnings.push('case: no outcome line or .case-tagline — none added');
    }
    // Client testimonials (CLIENT_QUOTES) first, cut from the export's own card
    // so they look the same, without the LinkedIn badge and link: those mark
    // recommendations that are on LinkedIn. The Flutter-developer
    // recommendation goes; it pitched the secondary lane.
    const testsGrid = document.querySelector('.tests');
    if (testsGrid && copy.clientQuotes.length) {
      const cards = [...testsGrid.querySelectorAll(':scope > .test')];
      const whoOf = (c) => (c.querySelector('.who')?.textContent || '').trim();
      const template = cards.find((c) => whoOf(c) !== 'Abdullah Mohamed');
      if (template && template.querySelector('.test-quote') && template.querySelector('.av') && template.querySelector('.role')) {
        cards.filter((c) => whoOf(c) === 'Abdullah Mohamed').forEach((c) => c.remove());
        const first = testsGrid.querySelector(':scope > .test');
        copy.clientQuotes.forEach((q) => {
          const card = template.cloneNode(true);
          card.querySelectorAll('.test-verified, .test-link').forEach((e) => e.remove());
          card.querySelector('.test-quote').textContent = `"${q.quote}"`;
          const av = card.querySelector('.av');
          av.textContent = q.initials;
          av.setAttribute('aria-hidden', 'true');
          card.querySelector('.who').textContent = q.name;
          card.querySelector('.role').textContent = q.role;
          testsGrid.insertBefore(card, first);
        });
        testsGrid.classList.add('tests-many');
      } else warnings.push('testimonials: no card to copy the client quotes from — left as exported');
    }
    // Numbered lists read as a template: "What I do" /01–/04 and the ways to
    // work 01–03. The process steps keep theirs; they are a sequence.
    document.querySelectorAll('.position-list .num, .service-card .service-num').forEach((e) => e.remove());
    // Home: each way to work carries its package name and starting price from
    // /services/ (the cards there were named differently and showed no price).
    // Matched by position: build → the middle card, retainer → the last,
    // advisory → the first, as the export orders the price list. The order is
    // confirmed, not assumed: the build is the recommended card, and it is in
    // the middle; a re-export that moves it gets no package lines and a warning.
    if (pageSpec.key === 'home') {
      const cards = [...document.querySelectorAll('#services .services-grid > .service-card')];
      const titleOf = (c) => (c.querySelector('.service-t')?.textContent || '').trim();
      const toPrice = [1, 2, 0];
      if (priceCards.length === 3 && priceCards.every((p) => p.name && p.amount) && cards.length === 3 &&
          priceCards.findIndex((p) => p.popular) === 1 &&
          cards.every((c, i) => titleOf(c) === copy.serviceOrder[i])) {
        cards.forEach((c, i) => {
          const p = priceCards[toPrice[i]];
          const line = document.createElement('p');
          line.className = 'service-pkg';
          line.textContent = [p.name, p.amount, p.note].filter(Boolean).join(' · ');
          c.querySelector('.service-t').after(line);
        });
      } else warnings.push('services: price cards or the three home cards not found as expected — no package line');
    }
    // /services/: "What's your rate?" answered "it depends" under the prices.
    // The answer now repeats them, read from the cards on the same page.
    if (pageSpec.key === 'services' && H2.rateQ) {
      const item = [...document.querySelectorAll('.faq-item')].find((i) => norm(i.querySelector('.faq-q .text')?.textContent || '') === norm(H2.rateQ));
      const answer = item && item.querySelector('.faq-a');
      if (answer && priceCards.length && priceCards.every((p) => p.name && p.amount)) {
        // French sets a space before the colon and the semicolon; Arabic has
        // its own semicolon.
        const fr = localePrefix === '/fr/';
        const sep = localePrefix === '/ar/' ? '؛ ' : fr ? ' ; ' : '; ';
        const list = priceCards.map((p) => `${p.name}${fr ? ' :' : ':'} ${p.amount}${p.note ? ` (${p.note})` : ''}`).join(sep);
        answer.textContent = `${H2.rateIntro} ${list}. ${H2.rateOutro}`;
        humanHits.push('k:rateQ');
      } else warnings.push(`services: the rate question (${H2.rateQ}) or the price cards not found — answer left as exported`);
    }

    // Nav and footer links point at sections that may not be on this page.
    // One that is here stays an in-page link; one that lives on another page
    // becomes a link to that page, so nothing resolves to a dead anchor. An id
    // nobody owns is left alone for the dead-anchor gate to fail on.
    if (pageSpec.anchors === 'resolve') {
      document.querySelectorAll('a[href^="#"]').forEach((a) => {
        const id = a.getAttribute('href').slice(1);
        if (id && document.getElementById(id)) return;
        if (id === 'top') { a.setAttribute('href', localePrefix); return; }
        if (!id) return;
        const owner = Object.prototype.hasOwnProperty.call(links.owner, id) ? links.owner[id] : undefined;
        const ownerPath = owner ? links.paths[owner] : undefined;
        if (ownerPath != null) a.setAttribute('href', `${localePrefix}${ownerPath}#${id}`);
      });
    }

    if (pageSpec.renumber) {
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

    if (pageSpec.sortWriting) {
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
    }

    if (pageSpec.foldCases) {
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
          // A long list after the impact strip (the RevealSite pharmacy
          // fleet, each app with its store links) folds in too: /work/ shows
          // these cases as compact cards.
          body.querySelectorAll(':scope > .case-block').forEach((b) => {
            if (b.querySelector('[class^="fleet-"]')) {
              if (b.classList.contains('reveal')) b.classList.add('in');
              b.classList.remove('reveal');
              inner.appendChild(b);
            }
          });
        });
      }
    }

    // Language links keep the visitor on the page they are reading: on a
    // page under a suffix (/services/) each language goes to that language's
    // same page. The drawer links are baked into the snapshot; the runtime
    // menu is fixed up by the vanilla layer (it is built after the snapshot
    // by the export's script).
    if (pageSpec.suffix) {
      document.querySelectorAll('a.dl-lang[hreflang]').forEach((a) => {
        const code = a.getAttribute('hreflang');
        if (localeCodes.includes(code)) a.setAttribute('href', (code === 'en' ? '/' : `/${code}/`) + pageSpec.suffix);
      });
    }

    // On client pages the contact block leads with the project path (call,
    // WhatsApp, brief); the hiring path is then dropped below, and stays
    // (first) on /about/ only.
    if (pageSpec.contactFirst === 'project') {
      const paths = document.querySelectorAll('#contact .contact-paths > .contact-path');
      if (paths.length === 2) paths[0].parentNode.insertBefore(paths[1], paths[0]);
      else warnings.push(`${pageSpec.key}: expected 2 contact paths, found ${paths.length}`);
      // The questions a buyer asks before booking — response time, NDA, IP,
      // who invoices, capacity — answered under the project path.
      const projectPath = [...document.querySelectorAll('#contact .contact-path')].find((p) => p.querySelector('a[href*="calendly.com"]'));
      if (projectPath) {
        const ul = document.createElement('ul');
        ul.className = 'contact-terms';
        copy.home.terms.forEach((t) => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
        projectPath.after(ul);
      } else warnings.push(`${pageSpec.key}: no scoping-call path found for the terms row`);
    }

    // The hiring path (CV, "contact me about a senior role") belongs to
    // /about/. Every other page is a client page: its closing block keeps the
    // project path only, and drops the opening question's "or hiring a senior
    // engineer?" half by dropping that question.
    if (pageSpec.contactFirst !== 'hire') {
      const paths = [...document.querySelectorAll('#contact .contact-paths > .contact-path')];
      const hire = paths.filter((p) => !p.querySelector('a[href*="calendly.com"]'));
      if (paths.length === 2 && hire.length === 1) hire[0].remove();
      else warnings.push(`${pageSpec.key}: expected one project and one hiring path in #contact, found ${paths.length} — left as exported`);
      const sub = document.querySelector('#contact .cta-inner > div > p');
      const text = sub ? norm(sub.textContent || '') : '';
      if (sub && H2.hireAsk && text.startsWith(norm(H2.hireAsk))) {
        sub.textContent = text.slice(norm(H2.hireAsk).length).trim();
        humanHits.push('k:hireAsk');
      } else warnings.push(`${pageSpec.key}: the closing question (${H2.hireAsk}) was not found at the start of #contact's line — left as exported`);
    }

    // Right-to-left pages read arrows the other way: "→" after an Arabic label
    // points back at the text. Only text with Arabic in it, or an arrow on its
    // own (a list bullet), is turned, so a Latin run keeps its own direction.
    if (localePrefix === '/ar/') {
      const walker = document.createTreeWalker(document.getElementById('root'), NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n.nodeValue.includes('→') && (/[\u0600-\u06FF]/.test(n.nodeValue) || n.nodeValue.trim() === '→')) n.nodeValue = n.nodeValue.replace(/→/g, '←');
      }
    }

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

    // A page cut from the home render has lost the hero — its <h1> — and
    // would open on an <h2>. Promote the first section title. Its look is
    // carried by `.section-title` (and `.section-title em`), not by the tag,
    // so the swap is invisible.
    if (pageSpec.promoteH1 && !document.querySelector('h1')) {
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
      faq, warnings, keptKeys, project, humanHits,
      priceCards: pageSpec.key === 'services' ? priceCards : null,
      caseNames: [...document.querySelectorAll('article.case .case-name')].map((e) => (e.textContent || '').trim()),
      body: document.getElementById('root').innerHTML,
    };
  }, spec, locales.map((l) => l.lang), FAQ_BUYER_KEYS[lang] || FAQ_BUYER_KEYS.en, prefix, PAGE_LAYOUT, SECTION_KEYS,
    { owner: LINK_OWNER, paths: Object.fromEntries(PAGE_SPECS.map((s) => [s.key, s.suffix])) },
    NAV[lang],
    { packagedAbove: PACKAGED_ABOVE[lang] || PACKAGED_ABOVE.en, serviceOrder: HOME_SERVICE_ORDER[lang] || HOME_SERVICE_ORDER.en, home: HOME_COPY[lang] || HOME_COPY.en, human: HUMAN_COPY[lang] || HUMAN_COPY.en, caseStudies: METRICS.caseStudies.display, conceptHosts: CONCEPT_HOSTS,
      clientQuotes: CLIENT_QUOTES.map((q) => ({ name: q.name, initials: q.initials, role: q.role[lang] || q.role.en, quote: q.quote[lang] || q.quote.en })) }));

  // Layout passes are best-effort: a re-export that renames a class leaves the
  // page as the export drew it, which is valid, so warn rather than fail.
  for (const w of snap.warnings || []) console.warn(`  [${lang}/${spec.key}] ⚠ ${w}`);
  const hits = HUMAN_HITS.get(lang) || new Set();
  for (const h of snap.humanHits || []) hits.add(h);
  HUMAN_HITS.set(lang, hits);
  return snap;
}

// JSON-LD goes inside a <script>, where a "<" in any string (an FAQ answer, a
// case name) could close the tag early. Every block is serialised through here.
const ldJson = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

// A project page's title and description, from the case study's own text and
// nothing else. Title leads with what was built (the tagline up to its first
// dash or colon), because that is what a buyer searches; when that runs past
// the head limit it falls back to the name and the first two stack chips.
// Google appends the site name itself. Description: the tagline, then as many
// tech chips as fit.
const PROJECT_DESCRIPTION_MAX = 165;
function projectSeo(project, lang) {
  const { name, tagline, chips } = project;
  // The tagline is all the page's title and description are made from. Without
  // one they would be the bare name: refuse rather than publish that.
  if (!tagline) {
    throw Object.assign(new Error(`[build] [${lang}] ${name}: the case has no .case-tagline, so its page has no title or description to build.`), { fatal: true });
  }
  const cut = tagline.search(/ — | – |: /);
  const clause = (cut > 0 ? tagline.slice(0, cut) : tagline).replace(/\.$/, '').trim();
  const label = NAV[lang].caseStudy;
  let title = `${clause} — ${label}: ${name}`;
  if (title.length > HEAD_LIMITS.title) title = [`${label}: ${name}`, chips.slice(0, 2).join(', ')].filter(Boolean).join(' — ');
  let description;
  if (tagline.length > PROJECT_DESCRIPTION_MAX) {
    const head = tagline.slice(0, PROJECT_DESCRIPTION_MAX - 1);
    description = head.slice(0, head.lastIndexOf(' ')).replace(/[\s,.;:—–-]+$/, '') + '…';
  } else {
    const keep = [...chips];
    const joined = () => (keep.length ? `${tagline} ${keep.join(' · ')}` : tagline);
    while (keep.length && joined().length > PROJECT_DESCRIPTION_MAX) keep.pop();
    description = joined();
  }
  return { title, description };
}

// Node-side assembly of one page: head, structured data, document, externalised
// assets, minify, write. Driven by the page's spec; `shared` is the locale's
// render result, `snap` this page's cut of it.
async function writeVariantPage({ loc, spec, shared, snap, locales, enhanceJS, assetSeen }) {
  const { lang, dir, urlPath } = loc;
  const multi = locales.length > 1;
  const outDir = path.join(loc.outDir, spec.suffix);
  const result = { ...shared, ...snap };

  await mkdir(outDir, { recursive: true });

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
        return `${mm[1]}${ldJson(obj)}${mm[3]}`;
      }
    } catch { /* leave malformed ld+json untouched */ }
    return m;
  });

  // /services is its own page per locale, with its own canonical: pointing it
  // at the home page told search engines to drop it.
  const pageSuffix = spec.suffix;
  const pageUrl = `${SITE_URL}${urlPath}${pageSuffix}`;
  const project = snap.project;      // a project page's case study (spec.work === 'single')
  if (spec.work === 'single' && !project) {
    throw Object.assign(new Error(`[build] [${lang}] ${spec.key}: the flagship case study could not be cut from the render.`), { fatal: true });
  }
  // SEO[key][lang] is present for every other page × locale: assertPageSpecs
  const seo = spec.work === 'single' ? projectSeo(project, lang) : SEO[spec.key][lang];
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
      !/rel=["']?(icon|apple-touch-icon)["'\s>]/i.test(m) &&
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
    spec.ld.includes('faq') && result.faq && result.faq.length
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
  // Per-page types named by the spec (see PAGE_SPECS.ld).
  const pageNode = {
    '@context': 'https://schema.org',
    url: pageUrl,
    name: seo.title,
    description: seo.description,
    inLanguage: lang,
    isPartOf: { '@id': `${SITE_URL}/#website` },
  };
  const pageLd = [
    spec.ld.includes('profile')
      ? { ...pageNode, '@type': 'ProfilePage', '@id': `${pageUrl}#profile`, mainEntity: { '@id': `${SITE_URL}/#person` } }
      : null,
    spec.ld.includes('collection')
      ? {
          ...pageNode, '@type': 'CollectionPage', '@id': `${pageUrl}#page`, about: { '@id': `${SITE_URL}/#person` },
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: FLAGSHIP.map((f, i) => ({ '@type': 'ListItem', position: i + 1, name: f.name, url: `${pageUrl}${f.slug}/` })),
          },
        }
      : null,
    spec.ld.includes('service')
      ? {
          '@context': 'https://schema.org', '@type': 'ProfessionalService', '@id': `${SITE_URL}/#service`,
          name: 'Ahmed Farid — software engineering and consulting', url: `${SITE_URL}/`, description: seo.description,
          founder: { '@id': `${SITE_URL}/#person` }, address: personLd.address, email: CONTACT.email,
          sameAs: [CONTACT.linkedin, CONTACT.github], makesOffer: personLd.makesOffer,
        }
      : null,
    spec.ld.includes('project')
      ? {
          '@context': 'https://schema.org', '@type': 'CreativeWork', '@id': `${pageUrl}#work`, url: pageUrl,
          name: project.name, description: project.tagline, inLanguage: lang,
          creator: { '@id': `${SITE_URL}/#person` }, keywords: project.chips.join(', '),
          isPartOf: { '@id': `${SITE_URL}${urlPath}work/#page` },
        }
      : null,
  ].filter(Boolean);
  const breadcrumbLd = spec.ld.includes('breadcrumb')
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: (spec.work === 'single'
          ? [['Ahmed Farid', `${SITE_URL}${urlPath}`], [NAV[lang].work, `${SITE_URL}${urlPath}work/`], [project.name, pageUrl]]
          : [['Ahmed Farid', `${SITE_URL}${urlPath}`], [NAV[lang][spec.key], pageUrl]]
        ).map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
      }
    : null;
  const jsonLd = [
    hasLd ? '' : `<script type="application/ld+json">${ldJson(personLd)}</script>`,
    `<script type="application/ld+json">${ldJson(webSiteLd)}</script>`,
    ...pageLd.map((o) => `<script type="application/ld+json">${ldJson(o)}</script>`),
    faqLd ? `<script type="application/ld+json">${ldJson(faqLd)}</script>` : '',
    breadcrumbLd ? `<script type="application/ld+json">${ldJson(breadcrumbLd)}</script>` : '',
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

  // Home only: forward the old single-page deep links (see REDIRECTS). The map
  // is a build constant and is looked up with hasOwnProperty, so a hash such as
  // "#__proto__" or "#constructor" cannot reach anything.
  const redirectScript = spec.key === 'home' && Object.keys(REDIRECTS).length
    ? `<script>(function(){var m=${JSON.stringify(REDIRECTS)},h=location.hash.slice(1);` +
      `if(h&&Object.prototype.hasOwnProperty.call(m,h))location.replace(${JSON.stringify(urlPath)}+m[h]+'#'+h)})()</script>`
    : '';

  const html = `<!doctype html>
<html ${htmlAttrs}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${redirectScript}
${PINTEREST_VERIFY_TAG}
${adPixel(lang)}
${analyticsTag}
<title>${esc(seo.title)}</title>
${headMeta}
${ICON_LINKS}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://assets.calendly.com/assets/external/widget.css">
<noscript><style>.reveal,.cell-pre{opacity:1!important;transform:none!important}</style></noscript>
${jsonLd}
<style>${result.css}</style>
<style>
/* Two minifier (clean-css) traps that silently drop every rule after them:
   a custom property with no trailing semicolon followed by a comment, so
   end each one with a semicolon; and an unmatched straight quote in a
   comment, so comments here use ’ (U+2019) instead. */
/* Build fix: the Personalize widget’s closed popup keeps its layout space
   (opacity:0, not display:none), so the container’s box was intercepting
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
   element’s box, so the last letter’s italic overhang was cut off. Widen
   the box without moving the text; clone repeats that on every line the
   phrase wraps onto. */
.cta h2 em,.hero-h1 .it{padding-inline-end:.12em;margin-inline-end:-.12em;
  -webkit-box-decoration-break:clone;box-decoration-break:clone}
/* .cta-inner’s own padding shorthand zeroed the .wrap gutter, so the closing
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
/* Project pages: breadcrumb trail, the "all work" link under a card grid, the
   flagship cards above /work/’s folded cases, and the case write-up shown open.
   Its toggle stays and works: the panel starts open (max-height lifted, as the
   write-up can outgrow the export’s 2400px cap) and collapses to the export’s
   own closed state when it is clicked. Logical properties throughout, so
   Arabic mirrors without a second rule. */
.crumbs ol{display:flex;flex-wrap:wrap;gap:8px;list-style:none;margin:0 0 28px;padding:0;font-family:var(--mono);font-size:12px;color:var(--ink-dim)}
.crumbs a{color:var(--ink-mute)}
.crumbs li+li::before{content:"/";margin-inline-end:8px}
.work-more{margin-top:32px}
.work-flagships{margin-bottom:56px}
#case .deepdive.open .deepdive-panel{max-height:none}
/* The page the visitor is on, in the four-link navigation. Same mark the
   export’s scroll-spy uses for the section in view. */
.nav-links a[aria-current="page"]{color:var(--ink)}
.nav-links a[aria-current="page"] span.idx{color:var(--accent)}
.nav-links a[aria-current="page"]::after{content:"";position:absolute;left:0;right:0;bottom:-2px;height:1px;background:var(--accent);box-shadow:0 0 8px var(--accent-glow)}
/* Hero: keep "depend on." together so "on." never ends up alone on a line.
   Not in Arabic: its two-word phrase is wider than a 320px phone and has no
   one-word widow to prevent. */
html:not([lang="ar"]) .hero-h1 .it{white-space:nowrap}
/* Product strip: the letter placeholders read as stand-in client logos. */
.trust .trust-mark{display:none}
/* Project cards: screenshot on top, one highlight under the description. */
.writing-card .wc-shot{aspect-ratio:16/9;border-radius:10px;overflow:hidden;margin:0 0 16px;border:1px solid var(--line);background:var(--bg-elev)}
.writing-card .wc-shot img{display:block;width:100%;height:100%;object-fit:cover;object-position:50% 0}
.writing-card .wc-impact{margin:2px 0 12px;font-size:13px;color:var(--ink-mute)}
.writing-card .wc-impact strong{color:var(--accent);font-weight:600}
/* Closing block: who you will talk to, and a step for visitors not ready to call. */
.cta-person{display:flex;align-items:center;justify-content:center;gap:12px;margin:22px auto 6px;color:var(--ink-mute);font-size:14px;max-width:560px}
.cta-person img{width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1px solid var(--line-strong)}
.contact-alt{margin:22px 0 0;text-align:center;font-size:14px;color:var(--ink-dim)}
.contact-alt a{color:var(--accent);text-decoration:underline;text-underline-offset:3px}
/* Home shows three service cards in what the export draws as a 2-up grid,
   which would leave an empty fourth cell; three across on desktop instead. */
@media (min-width:761px){#services .services-grid:has(> .service-card:nth-child(3):last-child){grid-template-columns:repeat(3,1fr)}}
/* Working terms under the project contact path. */
.contact-terms{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 20px;list-style:none;margin:-10px auto 0;padding:0;max-width:720px;font-size:13px;color:var(--ink-mute)}
.contact-terms li::before{content:"✓";color:var(--accent);margin-inline-end:6px}
/* The floating Personalize (theme) button is the design tool, not the
   site: on phones it landed on the second hero button, and on desktop it
   was the clearest sign the page came out of a template. Hidden everywhere. */
.palette{display:none!important}
/* One gold accent per page, the hero. Headings, the position statement,
   the hero stats and the impact numbers render their <em> as plain text
   (#root outranks the export [data-headline] variants). */
#root .section-title em,#root .cta h2 em,#root .position-statement em,#root .hero-stat .num em,#root .case-impact-cell .v em{font-style:normal;color:inherit;background:none;-webkit-text-fill-color:currentColor;animation:none}
/* Small mono labels: the export --ink-dim measured 4.4:1 on the page
   background, under the 4.5:1 WCAG AA floor for text this small. */
:root:not([data-theme=light]){--ink-dim:#908C82;}
:root[data-theme=light]{--ink-dim:#6E6A61;}
/* /work/: the seven further case studies as compact cards, two across. The
   write-up (and the RevealSite fleet list) stays behind "Problem · Approach";
   the impact strip and the code panel are flagship-page detail, not a card. */
@media (min-width:901px){#work .cases{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:20px}}
#work .cases>article.case{grid-template-columns:1fr;gap:18px;margin-bottom:20px;padding:28px;border:1px solid var(--line);border-radius:var(--radius);background:var(--bg-elev)}
#work .cases>article.case .case-name{font-size:28px}
#work .cases>article.case .case-mock,#work .cases>article.case .case-block:has(.case-impact){display:none}
#work .cases>article.case .case-meta{gap:10px}
#work .cases>article.case .case-shot>div:last-child{height:170px!important}
@media (max-width:900px){#work .cases>article.case .case-shot>div:last-child{height:150px!important}}
/* /work/: products shipped, as plain linked names. */
.brand-list{display:flex;flex-wrap:wrap;gap:10px}
.brand-list .chip{padding:7px 14px;border:1px solid var(--line);border-radius:99px;font-size:14px;text-decoration:none;color:var(--ink-mute)}
.brand-list .chip:hover{color:var(--ink);border-color:var(--line-strong)}
/* /about/ "Why clients work with me directly": what you get, as a list —
   not a struck-through "most engineers" column beside it. */
#why .why-cell{grid-template-columns:1fr;min-height:0}
#why .why-cell>div:first-child,#why .why-cell .l.me{display:none}
#why .why-cell .v{margin-top:0!important}
#why .why-cell .v::before{content:"✓";color:var(--accent);margin-inline-end:10px}
/* Home hero: a face and a first name before the buttons. */
.hero-person{display:flex;align-items:center;gap:12px;margin-top:22px;max-width:560px;color:var(--ink-mute);font-size:15px;line-height:1.45}
.hero-person img{width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1px solid var(--line-strong)}
/* Project pages: the call button in the side column, which stays in view
   while the write-up scrolls on desktop. */
.case-cta{display:flex;flex-direction:column;align-items:flex-start;gap:12px;margin-top:6px;padding-top:20px;border-top:1px solid var(--line)}
.case-cta p{margin:0;color:var(--ink);font-size:16px}
@media (min-width:901px){#case .case-meta{position:sticky;top:96px}}
/* Drawn AF badge: the SVG fills the 26px badge; its letters already carry
   their own inset, so the badge’s text padding goes. */
.brand-mark--drawn{padding:0}
.brand-mark--drawn svg{width:100%;height:100%;display:block}
/* Service-card tags: the export styles .chip only inside project and build
   cards, so these rendered as plain run-together text. */
.service-tags .chip{font-family:var(--mono);font-size:10.5px;padding:4px 9px;border:1px solid var(--line-strong);border-radius:99px;color:var(--ink-mute)}
/* "What I do" lost its /01–/04 column: the text takes the full row. */
.position-list li{grid-template-columns:1fr}
/* Home: each way to work names its package and starting price. */
.service-pkg{margin:-4px 0 12px;font-family:var(--mono);font-size:12px;color:var(--accent)}
/* Testimonials: six cards read better three across on a wide screen. */
@media (min-width:1101px){.tests.tests-many{grid-template-columns:repeat(3,1fr)}}
/* Project pages: the outcome, under the tagline. */
.case-outcome{margin:10px 0 0;color:var(--ink);font-size:17px;line-height:1.5}
/* Flagship cards: the outcome line is a sentence, not a metric. */
.writing-card .wc-outcome{color:var(--ink-dim);font-size:14px;line-height:1.5}
/* Arabic is a joined script: letter-spacing pulls its letters apart (the
   export tracks labels at 1–2px and the hero at −6px). None in Arabic. */
[dir=rtl] body,[dir=rtl] body *{letter-spacing:0!important}
/* Arrow icons point the way the text reads. */
[dir=rtl] .arr{transform:scaleX(-1)}
[dir=rtl] .btn:hover .arr{transform:scaleX(-1) translateX(3px)}
${A11Y_CSS}
${switcherCss}
</style>
</head>
<body class="${result.bodyClass}"${bodyDataAttrs ? ' ' + bodyDataAttrs : ''}>
${skipLink(lang)}
${switcher}
<div id="root">${tagClicks(drawBrandMark(result.body, lang, spec.key))}</div>
<script src="https://assets.calendly.com/assets/external/widget.js" async></script>
${enhanceJS ? `<script>${enhanceForVariant(enhanceJS, spec)}</script>` : ''}
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

  const before = (await import('node:fs')).statSync(loc.src).size;
  const after = Buffer.byteLength(out);
  console.log(`✓ [${lang}] Built ${path.relative(ROOT, path.join(outDir, 'index.html'))}`);
  console.log(`  source export: ${(before / 1e6).toFixed(2)} MB  →  static HTML: ${(after / 1e6).toFixed(3)} MB (+ shared assets, lazy/cacheable)`);

  return { lang, urlPath, htmlPath: path.join(outDir, 'index.html') };
}

async function build() {
  const puppeteer = (await import('puppeteer')).default;

  const locales = await discoverLocales();
  console.log(`→ Locales discovered: ${locales.map((l) => `${l.lang}${l.dir === 'rtl' ? '(rtl)' : ''} → ${l.urlPath}`).join(', ')}`);
  assertPageSpecs(locales);

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
  // Every page's og:image and JSON-LD image point at /og.png, so a missing
  // card is a broken page set: refuse rather than ship without it.
  try { await generateOgImage(browser); } catch (e) { e.fatal = true; e.message = `og.png could not be generated: ${e.message}`; throw e; }
  // Same reasoning as og.png: every page links to these, so a missing one is a broken page set.
  try { await generateIcons(browser); } catch (e) { e.fatal = true; e.message = `site icons could not be generated: ${e.message}`; throw e; }

  // ── Per-locale pages (shared assets folder, deduped via assetSeen) ────────
  // One render per locale; every page in PAGE_SPECS is a cut of it.
  const assetSeen = new Map();
  const coverage = [];   // per locale: what the render held, and what each cut kept
  const projects = {};   // slug → { name, tagline, chips } from the English render
  let prices = null;     // the English /services/ price cards, for llms.txt
  for (const loc of locales) {
    const { page, shared } = await renderLocale({ browser, loc, ghData, enhanceJS, locales });
    const snaps = [];
    coverage.push({ lang: loc.lang, shared, snaps });
    try {
      for (const spec of PAGE_SPECS) {
        const snap = await snapshotVariant({ page, spec, lang: loc.lang, locales });
        if (loc.lang === 'en' && snap.project) projects[snap.project.slug] = snap.project;
        if (loc.lang === 'en' && snap.priceCards) prices = snap.priceCards;
        snaps.push({ spec, keptKeys: snap.keptKeys, caseNames: snap.caseNames, faq: snap.faq });
        await writeVariantPage({ loc, spec, shared, snap, locales, enhanceJS, assetSeen });
      }
    } finally {
      await page.close().catch(() => {});
    }
  }

  await browser.close();

  // HUMAN_COPY entries no page used: the export reworded them. Not fatal (the
  // export's own wording ships), but worth knowing.
  for (const [lang, c] of Object.entries(HUMAN_COPY)) {
    const hits = HUMAN_HITS.get(lang) || new Set();
    const unused = [...Object.keys(c.headings).map((k) => `h:${k}`), ...c.text.map(([f]) => `t:${f}`),
      ...['recs', 'hireAsk', 'rateQ'].filter((k) => c[k]).map((k) => `k:${k}`)].filter((k) => !hits.has(k));
    for (const k of unused) console.warn(`  [${lang}] ⚠ human copy not applied (export reworded?): ${k.slice(2)}`);
  }

  // /about/'s first number is METRICS.caseStudies: it must still be what
  // /work/ carries (the flagship pages plus the further case studies).
  for (const { lang, snaps } of coverage) {
    const work = snaps.find((x) => x.spec.key === 'work');
    const more = work ? work.caseNames.length : 0;
    if (String(FLAGSHIP.length + more) !== METRICS.caseStudies.display) {
      throw Object.assign(new Error(`[build] /about/ says ${METRICS.caseStudies.display} case studies, but [${lang}] /work/ carries ${FLAGSHIP.length + more} (${FLAGSHIP.length} flagship + ${more}) — update METRICS.caseStudies in site-facts.mjs`), { fatal: true });
    }
  }

  // ── One-time SEO + static assets ──────────────────────────────────────────
  await copyStaticAssets();

  await writeSeoFiles(locales, PAGE_SPECS, projects, prices);

  // ── Verify each built page actually renders ───────────────────────────────
  console.log('→ Verifying built output…');
  const vb = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'] });
  for (const { loc, spec } of localePages(locales)) {
    const label = spec.suffix ? `${loc.lang} /${spec.suffix}` : loc.lang;
    const vp = await vb.newPage();
    const vErrors = [];
    vp.on('pageerror', (e) => vErrors.push(String(e)));
    await vp.goto(pathToFileURL(path.join(loc.outDir, spec.suffix, 'index.html')).href, { waitUntil: 'load', timeout: 60000 });
    const check = await vp.evaluate(() => ({
      text: (document.body.innerText || '').length,
      sections: document.querySelectorAll('section[id]').length,
      imgs: document.querySelectorAll('img').length,
      hasReact: typeof window.React !== 'undefined',
      faq: document.querySelectorAll('.faq-item').length,
    }));
    await vp.close();
    if (check.text < spec.verify.minText || check.sections < spec.verify.minSections) {
      await vb.close();
      throw Object.assign(new Error(`[${label}] Verification failed: text=${check.text} (min ${spec.verify.minText}) sections=${check.sections} (min ${spec.verify.minSections})`), { fatal: true });
    }
    console.log(`  ✓ [${label}] renders: ${check.text} chars, ${check.sections} sections, ${check.imgs} images, ${check.faq} FAQ items, React shipped=${check.hasReact}`);
    if (vErrors.length) console.log(`    ([${label}] ${vErrors.length} non-fatal errors — expected for blocked external assets in CI)`);
  }
  await vb.close();

  // Last gate before the artifact is considered good. Runs against what was
  // actually written to disk, so it catches a correction that was dropped
  // anywhere upstream — a copy edit that stopped matching, a transform that
  // matched nothing, or a stale string that came back with a re-export.
  await applyShellToStandalonePages();
  const pages = await emittedPages();
  // Gates, in order (the two transforms in between are not gates). The PDF
  // check stays last: it is the slowest and the one that needs the checklist
  // source.
  await assertPageInventory(locales, coverage);
  await vendorExternalImages(pages);
  await fixHeadingOutlines(pages);
  await assertA11yBaseline(pages);
  await assertNoForbiddenStrings();
  await assertNoDeadAnchors();
  await assertInternalLinks(pages, locales);
  await assertHeadMeta(locales);
  await assertPageRoles(locales);
  await assertLocaleRouting(locales);
  await assertPublicPdfs();

  console.log(`\n✓ Built ${locales.length} locale page(s); removed React/ReactDOM/Babel-standalone/editor scaffolding.`);
}

try {
  if (!existsSync(SRC)) throw new Error('index.html not found at repo root');
  await build();
} catch (err) {
  refuseBuild(err);
}
