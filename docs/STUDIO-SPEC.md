# Founder-led studio: repositioning spec

**Decision (owner, Nov 2026):** option B. The site moves from "a senior engineer you can hire" to "a senior-led studio": Ahmed stays the face and the single point of contact, with a named delivery team, a defined process and productized offers behind him. It is not an agency rebrand.

**Goal:** larger scopes and procurement-ready clients, without losing the "you talk to the senior engineer directly" edge, and without claiming anything that isn't true.

**Out of scope:** the CV (`cv/cv.html`) stays a personal document. LinkedIn stays personal. No visual redesign; existing sections and classes only, unless a step says otherwise.

---

## Inputs the owner must supply (blocking)

Each phase lists which inputs it needs. A phase never ships with a placeholder in place of a real value.

| ID | Input | Format | Blocks |
|---|---|---|---|
| **I1** | Studio name | e.g. `Ahmed Farid Studio` (recommended: keeps the name-search SEO and the founder link) | Phase 2 |
| **I2** | Team members who agreed to be named | per person: name, role, one line on what they shipped with Ahmed, LinkedIn URL, photo (optional), **written consent** | Phase 2 |
| **I3** | Legal entity for invoicing | legal name, jurisdiction (Dubai freelance permit / LLC / other), licence number if it will be shown | Phase 3 |
| **I4** | Sellable capacity | studio projects per quarter (an integer) and Ahmed's personal hours per month | Phase 1 (slots copy) |
| **I5** | Target client | one primary segment: Gulf SMEs / funded startups / enterprise | Phase 1 (emphasis, order of offers) |

Until **I2** exists, the site must not say "team", "we" or "our engineers" about delivery (see Honesty rules).

---

## Honesty rules (enforced, every phase)

These are build-enforced where possible (see Enforcement). They exist because the strongest proof on the site is from employment, and a studio framing makes misattribution easy.

- **R1, employment vs studio work.** Yelo Sale, Recovery Advisers, RevealSite, Arab Bank and Compass Med were roles Ahmed held. They are labelled *"Built as [role] at [company]"*, never "client", "our client" or "studio project". Studio or freelance engagements (Qoralia, Phonic Maps, KhebraOS, Fixawy, Proven Group, Ibdaa Course, Applyni, Ezhal, Alnaimi Studios …) are labelled *"Client project"*. Every case study carries exactly one of the two labels.
- **R2, "we".** "We" is allowed only in delivery contexts *and* only after Phase 2 ships with ≥1 named team member. Founder statements stay "I" (hero, About, testimonials, "you talk to me directly").
- **R3, no inflated scale.** No headcount, office, "agency", "offices in", "24/7" or "dedicated team of N" unless N named people are on the page. "Vetted engineers" without names is not allowed after Phase 2 (names or nothing).
- **R4, availability.** Nothing implies Ahmed is available full time. Capacity is stated as studio slots per quarter (I4), never as personal hours "around the clock".
- **R5, entity.** "Invoice with [company]" and Organization schema appear only with a real legal name (I3). Until then: "Contract & invoice directly with me" stays.
- **R6, numbers.** Every metric keeps its `evidence` line in `scripts/site-facts.mjs` (`METRICS`). Team or studio numbers get the same treatment.

---

## Phase 1: studio-ready without new claims (inputs: I4, I5)

> **Status (Nov 2026): shipped** except 1.3's "who" and "next start" fields. Owner inputs: Fixawy = client project; I4 = 4 client projects per quarter; I5 = all segments (tier order unchanged); delivery steps confirmed: written scope + price in 2 business days, weekly staging demo, code in the client's repo and owned once paid, handover + 30 days of fixes. Labels shipped as the short forms "Client project" / "In-house role" (the role itself is already on each case's role line).

Ships first. It needs no team and no entity, and makes the site read like a studio's because of how the work is explained.

### 1.1 Case-study provenance labels
- **Data:** add `provenance: 'client' | 'employment'` and `heldAs` (role at company, employment only) per case in `CASE_DEEP_DIVES` or a new `CASE_PROVENANCE` map in `scripts/site-facts.mjs`, keyed by the export's case `name`.
- **Render:** a small label above each case title on `/work/` and each `/work/<slug>/` page, e.g. "Client project", or "Built as Senior Software Engineer at Recovery Advisers". Reuse `.chip`. Translated in all 5 locales (`NAV`-style table).
- **Accept:** every case on `/work/` in every locale has exactly one label; a build gate fails if a case has none (see Enforcement).

### 1.2 Delivery model (the "how we work" proof, written in "I" for now)
- **Where:** the existing `process` section on home, and a new block in `/services/` after `pricing`.
- **Content (fixed list, translated):**
  1. Scoping call → written scope and fixed price within 2 business days
  2. Weekly demo on a staging URL you can open
  3. One channel (WhatsApp or Slack) with the engineer who writes the code
  4. Code in your repository from day one; you own it once paid
  5. Handover: docs, runbook, deploy access, and 30 days of fixes
- Each step must be true today. Drop any step Ahmed doesn't do; don't add a step he would have to start doing.
- **Accept:** copy only via `scripts/edit-copy.mjs` or `HOME_COPY`/build text tables; `npm run copy:check` reports 0 failed.

### 1.3 Productized offers (tighten what exists)
The existing tiers stay: Architecture Clinic $1,200 · Launchpad $9,000 · Partner $3,500/mo · add-ons. For each tier, the card must state:
- **Deliverables** (nouns, not verbs: "written report", "deployed slice", "40 reserved hours")
- **Timeline** (already present)
- **Who does the work:** "Ahmed" (Phase 1), later "Ahmed + [named role]" (Phase 2)
- **Start date signal:** "Next start: [month]" from I4. One value in `site-facts.mjs` (`CAPACITY.nextStart`), rendered on all tiers. Update it by hand monthly.
- **Order** of tiers and the default highlighted tier follow I5 (SMEs: Launchpad; startups: Launchpad; enterprise: Architecture Clinic).
- **Accept:** no tier card is missing any of the four fields in any locale.

### 1.4 Capacity line
- Replace the generic capacity line on `/services/` with "**[I4] studio projects per quarter.** Next start: [month]."
- **Accept:** the value comes from `site-facts.mjs`, never hard-coded in copy.

---

## Phase 2: the named studio (inputs: I1, I2, plus I4 and I5)

> **Status (Nov 2026):** 2.1 shipped as **Ahmed Farid Studio** (owner delegated the name: the person's name leads for search and trust; "Studio" signals a practice). Nav and footer lockup, home titles. I2 = not yet, so 2.2–2.4 (team, "we", Studio Build) stay off. Availability: the owner can start any time, so the capacity line opens with "Available to start now" (`CAPACITY.availableNow`).

### 2.1 Brand lockup
- Nav brand: "Ahmed Farid" plus a small secondary line "[I1]" (desktop only; phones keep "Ahmed Farid"). Footer brand same.
- Page `<title>` patterns keep "Ahmed Farid" first (name-search SEO). Home title becomes `Ahmed Farid — [I1] · Senior Software Engineer · SaaS, Mobile & AI` if ≤ 80 chars (`HEAD_LIMITS.title`); otherwise keep the current title and put I1 in the description.
- **Accept:** `head limits + JSON-LD` gate passes; title ≤ 80 chars in all 5 locales.

### 2.2 Team section
- **Where:** `/services/`, a new section `team` after the delivery model; a 3-face strip on home after `testimonials` linking to it. Not on `/about/`, which stays the founder and hiring page.
- **Per person:** photo or letter tile, name, role, one-line "shipped with Ahmed on …", LinkedIn link. Data in `site-facts.mjs` (`TEAM`), with a `consent: 'YYYY-MM-DD'` field that is required (the build refuses a member without it).
- **Wiring:** add `team` to `PAGE_SPECS.services.sections`; update `verify` floors and the page-inventory expectations; add the section id to `LINK_OWNER` so `/#team` forwards.
- **Accept:** page inventory still reports 50 pages / 55 sitemap URLs (no new page); the section renders in all 5 locales; it has 0 members → section not rendered (never an empty "team").

### 2.3 Voice switch
- After 2.2 ships, delivery copy switches to "we" (process steps, tier "who does the work", contact terms). Founder copy stays "I".
- Remove "Larger scopes: a vetted team, quoted per scope" and replace with "Larger scopes: [I1] team ([names/roles]), quoted per scope."
- **Accept:** `grep -i "vetted team"` on `dist/` returns 0 (DRIFT_GUARD).

### 2.4 Studio-scale offer
- Add one tier: **Studio Build**, "Product built by the team, led by Ahmed". From price: owner decides (suggest ≥ $18,000), with timeline (6–10 weeks), team composition from `TEAM`, and the same four fields as 1.3.
- **Accept:** the tier appears only when `TEAM.length ≥ 1`.

---

## Phase 3: procurement-ready (input: I3)

- **Contact terms:** "Contract & invoice directly with me" → "Contract & invoice with [legal name], [jurisdiction]". Translated.
- **Schema:** add an `Organization` (or `ProfessionalService`) JSON-LD node: `name` = I1, `legalName` = I3, `founder` → existing `#person`, `areaServed`, `address` (city/country only), `sameAs` LinkedIn company page if one exists. Person gets `worksFor` unchanged (Recovery Advisers) plus `founder` relation from the Organization side only.
- **Footer:** legal name and jurisdiction in the copyright line.
- **Optional page:** `/terms/`, short engagement terms (payment schedule, IP transfer, NDA, warranty window). Only if the owner supplies the terms; adding it means a `PAGE_SPECS` entry, `SEO`, `NAV`, and new inventory counts (5 more pages, 5 more sitemap URLs).
- **Accept:** JSON-LD types gate updated to expect `Organization`; `legalName` equals I3 verbatim.

---

## Phase 4: proof and distribution (no site code, owner-run)

- **Testimonials with outcomes:** use `docs/TESTIMONIAL-REQUESTS.md`; target 2 new client (not employer) testimonials naming a result. They go in `CLIENT_QUOTES` with the existing approval rule.
- **Client logos:** only clients who said yes in writing; employer logos never appear in a "clients" strip (R1).
- **LinkedIn:** one post a week from a case study or delivery-model step, linking to `/work/<slug>/` or `/services/`; see `docs/LINKEDIN-PLAYBOOK.md`. The 28k-follower audience is the main channel; the site converts, it doesn't generate.
- **Measure:** with `ANALYTICS.umamiWebsiteId` set, track `Book a call` clicks per page; review monthly against enquiries.

---

## Enforcement (build gates)

> **Status (Nov 2026):** shipped. Provenance gate in `assertPageRoles`; studio-claim guards in `DRIFT_GUARDS`, narrowed so the Phonic Maps "Agency-ready" feature and a client's own "our clients" in a testimonial pass. `vetted team` is not guarded yet: it stays until the team section ships (2.3).

Add to `DRIFT_GUARDS` in `scripts/site-facts.mjs` (`max: 0` across `dist/`):
- `{ re: /\bagency\b/gi }`, `{ re: /offices in/gi }`, `{ re: /24\/7/g }`
- `{ re: /our clients?[^.]{0,80}(Yelo|Recovery Advisers|RevealSite|Arab Bank|Compass Med)/gi }` (employment shown as clientele)
- After 2.3: `{ s: 'vetted team' }`; before Phase 2 ships: `{ re: /\bour (team|engineers)\b/gi }`

New gate in `scripts/build.mjs` (fails closed, like the others):
- Every case on `/work/` has exactly one provenance label (1.1).
- Every `TEAM` member has `consent` (2.2).
- Organization JSON-LD present ⇔ `ENTITY.legalName` set (Phase 3).

Never relax a gate to get green (repo rule).

---

## Order of work and validation

1. Phase 1: 1.1 → 1.2 → 1.3 → 1.4, one PR each (or one PR if small). Needs I4, I5.
2. Phase 2: 2.1 → 2.2 → 2.3 → 2.4. Needs I1, I2.
3. Phase 3. Needs I3.
4. Phase 4 runs in parallel and is owner-driven.

Each PR: `npm run copy:check` (0 failed), `npm run build` (exit 0, 50 pages / 55 sitemap URLs unless the PR adds a page and updates the counts), screenshots of changed sections at 1440 / 1024 / 320 px in EN and AR, and no horizontal scroll.

**Done means:** every case is labelled honestly; offers state deliverables, timeline, who and next start; the team is named or not mentioned; invoicing names a real entity or the person; and every gate in Enforcement passes.
