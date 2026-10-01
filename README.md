# ahmedfarid2.github.io

Personal portfolio of **Ahmed Farid** — Senior Software Engineer.
Live at **https://iamahmedfarid.com** (custom domain in `CNAME`)

---

## How this works

`index.html` is the **raw export from Claude design** — a React app that, as
exported, ships React, ReactDOM and a ~3 MB in-browser Babel compiler and
renders entirely on the client. Great for editing, heavy for visitors.

A build pipeline turns that export into a **fast, fully static, crawlable**
site before it goes live. You keep editing in Claude design exactly as before —
nothing about your workflow changes.

### Your update loop

1. Edit the site in **Claude design**.
2. **Export** and replace `index.html` in this repo with the new export.
3. **Commit and push to `main`.**
4. GitHub Actions ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml))
   automatically builds the optimized version and deploys it to GitHub Pages.

That's it. The optimization re-runs on every push, so it survives every
re-export.

### ⚙️ One-time setup (required)

In the repo: **Settings → Pages → Build and deployment → Source → “GitHub
Actions.”** Without this, the deploy step can't publish.

---

## What the build does

[`scripts/build.mjs`](scripts/build.mjs) renders the export in a real headless
browser and snapshots the result. Because it captures rendered *output*, it does
**not** depend on Claude design's internal bundle format — so it keeps working
across versions. It:

- **Removes** React, ReactDOM, the Babel-standalone compiler, and leftover
  editor scaffolding (the Tweaks panel, the `<image-slot>` custom element).
- **Converts** `<image-slot>` elements to plain `<img>` so your photos stay.
- **Re-embeds** fonts (and extracts large images) as cacheable files in
  `assets/`, so the HTML document is tiny and images lazy-load.
- **Fills** the GitHub block with live data fetched at build time
  (contribution calendar, repo count, pinned repos).
- **Rebuilds the `<head>`**: title, description, canonical, hreflang, Open
  Graph and JSON-LD per page, from [`scripts/site-facts.mjs`](scripts/site-facts.mjs).
- **Builds `/services/`** per locale from the same render (commercial sections
  only), with its own canonical and sitemap entry.
- **Refuses to deploy** if a retired claim reaches `dist/` (the forbidden-string
  scan; see `FORBIDDEN` in `build.mjs`).
- **Self-heals** the region count badges from the actual list.
- **Adds** a tiny vanilla-JS layer for the nav menu, FAQ accordion, scroll
  reveal, and the Calendly popup — no framework.
- **Falls back** to deploying the raw export if anything goes wrong, so a push
  never produces a broken site.

Typical result: a ~2.5 MB self-compiling bundle becomes a **~40 KB gzipped HTML
document** plus lazy, cacheable assets.

### Run it locally

```bash
npm install
npm run build      # outputs to dist/
npx serve dist     # preview (any static server works)
```

---

## ✍️ Facts and copy

- **One source of truth:** location, contact links, every proof number (6+
  years, 27+ products, 13+ brands, …) and the per-page SEO title/description
  live in [`scripts/site-facts.mjs`](scripts/site-facts.mjs), each number with
  the evidence it rests on. Change a fact there, never in a single section.
- **Copy corrections** to the export are applied by
  [`scripts/edit-copy.mjs`](scripts/edit-copy.mjs) on every deploy
  (`npm run copy:apply`; `npm run copy:check` reports their state). Never edit
  the compressed bundle inside an export by hand.
- **Lead magnet:** `multi-tenant-saas-checklist.pdf` at the repo root is the
  deployed file; [`lead-magnet/`](lead-magnet/) is its source and is not
  deployed.

---

## 📄 CV

`Ahmed-Farid-CV.pdf` (served at `/Ahmed-Farid-CV.pdf`) is generated, not
hand-made. Edit [`cv/cv.html`](cv/cv.html) and run:

```bash
npm run cv:build   # renders cv/cv.html → Ahmed-Farid-CV.pdf (needs a Chromium)
```

The script refuses to write the PDF if the CV no longer fits on one A4 page,
if it lacks a canonical contact detail from `scripts/site-facts.mjs`, or if
it carries a retired one (personal Gmail, a phone number, the relocation
line). Titles and dates follow the site's Experience section; no phone
number is published. The GitHub profile repo keeps a copy as
`Ahmed_Farid_CV.pdf`, so copy the new PDF there when it changes.

## Optional improvements

- **Writing cards → individual LinkedIn posts.** The six cards in *Writing*
  all link to the LinkedIn activity feed
  (`/in/iamahmedfarid/recent-activity/all/`). LinkedIn posts aren't indexed,
  so per-post URLs can't be looked up and are not guessed. When the owner
  supplies them ("…" → "Copy link to post" on each post), point each card at
  its own post.
- **Calendly username.** The booking link is
  `calendly.com/ahmedfareed2025/30min`, a username derived from a personal
  Gmail address. Renaming it in Calendly (and in `scripts/site-facts.mjs`
  `CONTACT.calendly` plus the GitHub README) would finish the move to the
  professional identity.

## 📈 Growth & client acquisition

Strategy docs for turning this portfolio into a client pipeline live in
[`docs/`](docs/) — start with [`docs/GROWTH-PLAN.md`](docs/GROWTH-PLAN.md).
The lead magnet ("Multi-Tenant SaaS Architecture Checklist") is in
[`lead-magnet/`](lead-magnet/) and deploys live at `/checklist.html`.
