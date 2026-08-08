# 🎯 Sharpened Positioning Copy (for Claude design)

**Why:** Your current copy is excellent but positions you as a generalist
("I build everything"). Generalists are hard to refer. This tightens your
**spearhead niche** — real-time, multi-tenant SaaS — while keeping your full
range. You stay full-stack; you just *lead* with the thing that's most valuable
and most referable.

---

## ✅ Status: applied and self-healing — no Claude design step needed

Three changes are **live** on all five exports (`index.html`, `.ar`, `.de`,
`.es`, `.fr`), applied via [`scripts/edit-copy.mjs`](../scripts/edit-copy.mjs):

1. **Hero paragraph** — leads with the niche
2. **Lead-magnet card** in the Connect section → `/checklist.html`
3. **Primary CTA** — "Book a scoping call" (nav, hero, about)

**You do not need to paste anything into Claude design.** The build re-applies
these automatically on every deploy (`.github/workflows/deploy.yml` → "Apply
copy edits"), so even a fresh Claude-design export that lacks them ships with
them anyway.

If you do re-export, run this once locally to bring the committed files back in
sync with what's deployed:

```bash
npm run copy:apply     # idempotent — safe to run any time
npm run copy:check     # dry run: report what would change, write nothing
```

If a future export changes the surrounding markup enough that an edit can't
find its anchor, CI logs a loud warning and **deploys anyway without that
edit** — it will never block a deploy. Fix it by updating the matching entry in
`scripts/edit-copy.mjs`.

The rest of this document (About lead sentence, meta description) is **not
applied** — those remain optional.

---

**How to use what's left.** Items marked ✅ are already live and need nothing
from you. For the unapplied ones you have two options:

- **Ask me** — I apply them to all five exports via `scripts/edit-copy.mjs`, the
  same self-healing path as the rest. This is the easier route.
- **Do it in Claude design** — open the export, replace the strings, re-export,
  commit. Still works; just remember to run `npm run copy:apply` afterwards.

> Keep it honest: every claim below is already true from your portfolio. This is
> **emphasis**, not invention.

---

## HERO / top

- **Eyebrow (unchanged is fine, or):**
  `SENIOR SOFTWARE ENGINEER · CAIRO, EGYPT 🇪🇬 · OPEN TO RELOCATION 🌍`

- **Headline (keep your strong one):**
  **I build the systems** / **other teams depend on.**

- **Intro — ✅ APPLIED LIVE (self-healing; no action needed):**
  > Cairo-based senior engineer specializing in real-time, multi-tenant SaaS —
  > live bidding, role-based tenants, and the mobile apps that run on top. Five
  > years shipping to production across the Gulf, the US, and the UK. Laravel,
  > Next.js, FastAPI, Flutter. Open to relocation.

  The translated versions live in each export too — all exact strings are in
  [`scripts/edit-copy.mjs`](../scripts/edit-copy.mjs).

- **Buttons — ✅ APPLIED LIVE:** `Start a project` → **Book a scoping call**
  (all three placements: nav, hero, about). `See selected work` and
  `Download CV ↓` unchanged.

- **Optional scarcity line under the buttons (high-converting):**
  > _Currently taking a small number of engagements for Q4 2026._

---

## ABOUT / about

- **Availability badge:** `Available · Q4 2026` (keep it current — passive dates
  read as "not really available"; a near quarter reads as "act now").

- **Lead sentence (SHARPEN):**
  > **I'm Ahmed Farid — a senior engineer who ships real-time, multi-tenant
  > platforms end to end.**

- **Second paragraph (keep, lightly tightened):**
  > Based in Cairo, open to relocation. Over five years I've built multi-tenant
  > SaaS, real-time auction and booking systems, AI-powered tools, and a fleet
  > of mobile apps that went to production across the Gulf, US, and UK — Laravel,
  > Next.js, FastAPI, Flutter, AWS — from the first schema decision to app-store
  > submission and post-launch readiness.

---

## META / SEO (in Claude design's page settings, or leave to the build)

- **Title tag (front-load the niche + name):**
  `Real-Time & Multi-Tenant SaaS Engineer — Ahmed Farid`

- **Meta description:**
  > Senior software engineer specializing in real-time, multi-tenant SaaS
  > platforms (Laravel · Next.js · Flutter). Shipped 23+ products across the
  > Gulf, US & UK. Available for fixed-scope builds and retainers.

> Note: your build injects canonical/OG/JSON-LD automatically. If you set a
> `<meta name="description">` in the export, the build preserves it — so this is
> the place to put the niche-focused description.

---

## WAYS TO WORK TOGETHER · 13 / services

- **Intro (add a low-commitment first step):**
  > Whether you're hiring, building, or just need a second pair of experienced
  > hands, there's a clear way in. Every engagement starts with a free
  > 30-minute scoping call — no obligation, and if I'm not the right fit I'll
  > point you to someone who is.

---

## CONNECT · 17 / connect — ✅ APPLIED LIVE

A **Free checklist** card is now the first item in the Connect grid, in all five
languages, linking to `/checklist.html`.

**One change still worth making:** it currently links straight to the checklist,
so readers get the PDF and you get nothing. Once you have an email-capture form
(see [`SETUP-EMAIL-AND-SEARCH-CONSOLE.md`](SETUP-EMAIL-AND-SEARCH-CONSOLE.md)),
send me the URL and I'll repoint the card at it.

---

## What NOT to change

- Your case-study structure (Problem → Hard Part → Architecture → Outcome). It's
  your best asset — leave it.
- The "Why me" comparison table. It's excellent.
- The multilingual setup, the trust signals, the FAQ.

The goal is a **sharper point on the same spear**, not a rebuild.
