# ahmedfarid2.github.io

Personal portfolio of **Ahmed Farid** — Senior Software Engineer.
Live at **https://ahmedfarid2.github.io**

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
- **Swaps** the placeholder GitHub block for **live, auto-updating**
  github-readme-stats images.
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

## ✍️ Copy fixes to make in Claude design

These are small content inconsistencies. The build can't safely guess the right
values, so edit them at the source (Claude design) and re-export:

- **Product count:** the hero says “20+ products” / “12+ apps”, the About block
  says “23 products.” Pick one canonical number and use it everywhere.
- **Services section** (“Ways to work together”) is the only section header
  missing its sequence number — it sits between “Why me · 12” and
  “Trust signals · 13.” Add `· 13` (and bump the rest) or leave it unnumbered
  intentionally.
- Consider adding an **`og:image`** meta tag (e.g. your portrait or a branded
  card) so LinkedIn/Twitter link previews show an image.
