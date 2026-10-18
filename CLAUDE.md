# ahmedfarid2.github.io

Personal portfolio site deployed to GitHub Pages. Claude Design exports (`index*.html`, …) are the source; `scripts/build.mjs` renders them into a static `dist/`. Validate with `npm run copy:check` and `npm run build`. Never edit `CNAME` or `google*.html`.

## Repository facts

**What it is.** Ahmed Farid's personal portfolio, published to GitHub Pages at the custom domain in `CNAME`, pitched at clients (projects and consulting; hiring/CV lives on `/about/`). Five locales (`en` at `/`, `ar` RTL, `de`, `es`, `fr` under `/<code>/`), each with 9 pages: home, `/work/`, `/work/<slug>/` for the 5 flagships, `/services/`, `/about/` — 45 pages, 47 sitemap URLs. Plus `checklist.html`, `get-checklist.html`, `demo.html` and `lead-magnet/`.

**Stack.** Static HTML produced from Claude Design exports by a Node 20 ESM build pipeline (`scripts/build.mjs`: puppeteer renders the export, snapshots the DOM, strips React/Babel, inlines fonts, adds a small vanilla-JS layer; `html-minifier-terser`). No framework at runtime.

**Structure.**
- `index*.html`, `checklist.html`, `get-checklist.html`, `demo.html`, `lead-magnet/*.html` — Claude Design exports (source of truth for the site). There is no per-page export: every page in a locale is cut from that locale's `index*.html`.
- `scripts/build.mjs` — builds `dist/` (gitignored). Renders each locale once, then cuts every page from that render; `PAGE_SPECS` is the page map (which sections each page keeps, its JSON-LD, sitemap priority, verify floors). Runs build gates (page inventory/coverage, accessibility, forbidden strings, dead anchors, internal links, head limits + JSON-LD, page roles, locale routing, public PDFs). **Fails closed:** any error exits 1 and nothing is deployed, so the last good deploy stays live.
- `scripts/site-facts.mjs` — single source of truth for location, contact links, proof metrics, per-page SEO titles/descriptions (`SEO`), localized nav labels (`NAV`), the flagship slugs (`FLAGSHIP`), the IndexNow key and the analytics switch (`ANALYTICS.umamiWebsiteId`: empty = no analytics script; the build always tags key clicks with `data-umami-event`; `ANALYTICS.adPixelId`: empty = no ChatGPT Ads pixel and no consent banner, held by a forbidden-string gate)
- `scripts/edit-copy.mjs` — applies idempotent copy edits inside the export's `__bundler/manifest` bundle; `npm run copy:apply` / `npm run copy:check`
- `scripts/build-cv.mjs`, `scripts/build-checklist.mjs` — render `cv/cv.html` and the lead magnet to the committed root PDFs (`npm run cv:build`, `npm run checklist:build`); `scripts/pdf-check.mjs` backs the public-PDF gate
- `scripts/indexnow.mjs` + `.github/workflows/indexnow.yml` — after each successful deploy of `main`, submit the live sitemap to IndexNow (Bing and others; not Google). `npm run indexnow -- --dry-run` prints the payload from `dist/sitemap.xml` without sending
- `.github/workflows/deploy.yml` — on pull requests to `main`: build only; on push to `main`: `npm ci` → `npm run copy:apply -- --soft` → `npm run build` → deploy `dist/` to Pages (with one retry)
- `TRANSLATION-*.md` — translation sources; `docs/*.md` — marketing playbooks (not site content); `CNAME`; `google*.html` — Search Console verification files

**Conventions.**
- Never hand-edit the compressed `__bundler/manifest` script inside an export; add an edit to `scripts/edit-copy.mjs` instead so it survives re-exports.
- Never modify `CNAME` or the `google*.html` verification files, or the IndexNow key file `<INDEXNOW_KEY>.txt` at the root (rotate it only together with `INDEXNOW_KEY` in `site-facts.mjs`).
- Changes to `deploy.yml` affect production deploys; treat as infrastructure.
- To add or move a page or section, change `PAGE_SPECS` (plus `SEO`/`NAV` in `site-facts.mjs`); the build refuses a spec missing any of them. Never relax a build gate to get green.
- Old `/#<id>` links to sections that left home are redirected by the build (`REDIRECTS`); keep section ids stable.

**Sensitive areas (treat changes as higher blast radius).**
- `scripts/build.mjs`
- `scripts/edit-copy.mjs`
- `scripts/site-facts.mjs`
- `.github/workflows/deploy.yml`
- `CNAME`
- `google*.html`

**Validation commands.**
- `npm ci` — installs `puppeteer` and `html-minifier-terser`; `node_modules/` is absent in a fresh clone
- `npm run copy:check` — reports whether each copy edit is applied; must not report a failed match
- `npm run build` — produces `dist/`; needs a Chromium. In a sandbox where puppeteer cannot download one, set `PUPPETEER_EXECUTABLE_PATH` to an installed Chromium (this cloud environment provides `/opt/pw-browsers/chromium`)
- Known sandbox quirk: the cloud sandbox has the Inter font installed, so Chromium renders the checklist's `system-ui`/`sans-serif` text in Inter instead of DejaVu Sans (what CI on ubuntu and the committed PDF use), and the last gate fails with `multi-tenant-saas-checklist.pdf: out of date with lead-magnet source (text differ)` even on an untouched `main`. Fix: hide Inter from fontconfig for both `checklist:build` and `build` — write a `fonts.conf` that includes `/etc/fonts/fonts.conf` and adds `<selectfont><rejectfont><glob>*/Inter*</glob></rejectfont></selectfont>`, then run with `FONTCONFIG_FILE=<that file>`. Verify with `pdffonts multi-tenant-saas-checklist.pdf` (DejaVuSans + LiberationSerif only, no Inter). Without that override, never commit a sandbox-rendered PDF; the PR's CI run stays the authoritative full pass
- Inspect `dist/` — confirm React/Babel scripts are gone, the copy edits are present, and the gate lines report 45 pages / 47 sitemap URLs

## Engineering orchestration

@.claude/orchestration/POLICY.md

Project-specific inputs to that policy are the sections above: **Sensitive areas** get `standard-reviewer` (or `critical-reviewer` on a critical path) before COMPLETE, and **Validation commands** are what to run and report verbatim, with skipped manual checks listed under "Manual checks required".
