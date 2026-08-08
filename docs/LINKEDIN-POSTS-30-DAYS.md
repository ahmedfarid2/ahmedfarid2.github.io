# 30 Days of LinkedIn Posts — Ready to Paste

Twelve posts (3/week × 4 weeks), written from **your real case studies**. Every
technical claim here is already true from your portfolio — nothing invented.

**How to use:** copy a post, replace anything in `[brackets]`, post it.
Put the lead-magnet link in the **first comment**, not the post body (LinkedIn
suppresses reach on posts with external links).

**Posting rhythm:** Tue / Thu / Sat, ~9:00 Cairo. Reply to every comment in the
first 2 hours — early engagement drives reach more than anything else.

---

## WEEK 1 — Establish the niche

### Post 1 (Tue) — War story: the race condition
```
Live auctions don't forgive.

On Yelo Sale — a vehicle auction platform in the Gulf — dozens of bidders would
hammer the same lot in the final seconds. Get bid ordering wrong for even one
of them and you get two "winners." That's not a bug report. That's a legal
problem.

Here's how we made it impossible:

→ Live bid state in Redis with atomic increments
→ The SERVER decides bid order. Never the client.
→ A WebSocket layer mirrors every bid to every watcher in <200ms
→ Proxy auto-bidding resolved server-side, up to each bidder's max

Result: real-time bidding live on web, iOS and Android. Zero lost bids to race
conditions. ERP-synced invoicing behind it.

The lesson I keep relearning: in real-time systems, the server is the single
source of truth — or you don't have a source of truth at all.

Ever lost data to a race condition you didn't know you had? 👇
```

### Post 2 (Thu) — Architecture take: boundaries
```
I don't write screens first. I draw seams first.

Before a single UI component exists on a multi-tenant build, I decide three
things:

1. How tenants are isolated (shared schema? schema-per-tenant? separate DBs?)
2. Where tenant resolution happens (middleware — never controllers)
3. Whether billing exists in the data model on day one

Why so early? Because these are the decisions you can't cheaply undo. Six
months in, they're load-bearing. Everything else — the components, the
endpoints, even the framework — you can refactor on a Tuesday.

Most "we need a rewrite" conversations I've been pulled into weren't caused by
bad code. They were caused by a boundary drawn wrong on day one.

Boundaries before features. Every time.

What's the boundary you wish you'd drawn earlier? 👇
```

### Post 3 (Sat) — Soft offer: lead magnet
```
I wrote down the checklist I actually run before building any multi-tenant
SaaS.

Not a listicle. The real pre-build gate — tenant isolation, role boundaries,
billing-aware data, the concurrency questions, and the six decisions you live
with forever because you can't cheaply undo them.

It's the thing I wish someone had handed me before my first multi-tenant
platform instead of after.

Free, no strings. Link in the comments.

If it saves you one rewrite, it did its job.
```

---

## WEEK 2 — Show range within the niche

### Post 4 (Tue) — War story: webhooks over polling
```
"Just poll every 30 seconds."

That was the easy answer for keeping a client portal in sync with our internal
debt-collection system at Recovery Advisers. It was also the wrong one.

Polling meant: stale data for up to 30s, load that scales with client count
(not with actual changes), and a portal that felt dead.

What we built instead — a stateless webhook push architecture:

→ The internal app pushes state changes outward as they happen
→ Each tenant gets secure, read-only visibility into only their own cases
→ Clients see updates near-real-time, without a single polling request
→ Load scales with events, not with how many people are watching

Six-stage lifecycle behind it: leads → cases → mandates → litigation →
recoveries → invoices. Multi-tenant isolation via tenant-resolution middleware.

Push beats poll almost every time. The exception is when you can't control the
sender — and that's a smaller set of cases than most teams assume.
```

### Post 5 (Thu) — Build in the open
```
Shipped this week: [what you shipped].

The part that took longest wasn't the feature. It was [the unglamorous
thing — the migration, the edge case, the auth boundary].

That ratio never changes. The feature is 20% of the work. The other 80% is
making sure it doesn't break the three things next to it.

[One concrete lesson.]

Anyone else find the "small" tasks eat the week? 👇
```

### Post 6 (Sat) — Client outcome: leverage
```
12+ pharmacy apps. 12+ storefronts. One codebase.

Over a dozen independent US and UK pharmacies each needed branded patient apps
and websites. None of them could justify a dedicated engineering team.

So we didn't build twelve products. We built one white-label platform:

→ A new pharmacy launches with a client_id — own branding, hours, storefront
→ Patients get prescription refills, transfers, appointment booking,
  medication reminders, two-way messaging
→ Every request auto-routes to that pharmacy by fax + email via Celery
→ Patient apps in Flutter, storefronts in React, one shared backend

The engineering insight isn't the tech. It's this: when you're about to build
the same thing for the third time, stop and build the thing that builds it.

Multi-tenancy isn't a feature. It's a business model decision that happens to
be implemented in code.
```

---

## WEEK 3 — Depth + the AI angle

### Post 7 (Tue) — War story: the AI pipeline
```
A course creator shouldn't need a video team.

That was the whole thesis behind KhebraOS — an Arabic-first academy platform
where trainers launch their own branded school.

The hard part wasn't the LMS. It was the 6-stage AI pipeline that takes a
creator from "I have an idea" to a published course:

script → narration → cover art → promo video → landing page → funnel

Under the hood: GPT-4o-mini for scripts, ElevenLabs for narration (10 Arabic
voices), DALL·E 3 for covers, and SSE over Postgres NOTIFY so the creator
watches it happen in real time instead of staring at a spinner.

Arabic-first and RTL from the ground up — not an afterthought bolted onto an
English-first tool. That decision shaped the entire component layer.

Most "AI features" are a text box wired to an API. The useful ones are
pipelines that remove an entire job from the critical path.
```

### Post 8 (Thu) — Architecture take: caching
```
Premature caching is just a bug with a delay.

I've watched teams add Redis to "make it fast," then spend the next quarter
hunting ghosts — stale reads, inconsistent state, bugs that only reproduce on
Thursdays.

The order that actually works:

1. Profile. Find the read path that genuinely hurts.
2. Cache exactly that one.
3. Decide how it gets invalidated BEFORE you ship it.
4. Measure again.

If you can't answer "what invalidates this?" in one sentence, you're not adding
a cache. You're adding a second source of truth that will eventually disagree
with the first one.

Cache where it pays. Nowhere else.
```

### Post 9 (Sat) — Direct offer
```
I'm opening 1 fixed-scope build slot for [Q4].

What that means in practice: a defined slice of your product, shipped to
production in 4–8 weeks. Architecture, build, deploy, handoff. Flat quote per
phase — no hourly drift, no surprise invoice.

Best fit if you're building:

→ A multi-tenant SaaS platform (tenants, roles, billing)
→ A real-time system (live bidding, tracking, chat, live data)
→ Something that needs backend + web + mobile from one pair of hands

Five years, 23 products shipped across the Gulf, US and UK. Laravel, Next.js,
FastAPI, Flutter.

If that's you — or someone you know — DM me "BUILD" and I'll send over scoping
questions. First call is 30 minutes and free. If I'm not the right fit, I'll
tell you who is.
```

---

## WEEK 4 — Authority + proof

### Post 10 (Tue) — War story: multi-tenant reseller model
```
One dashboard. Hundreds of locations. Three social platforms.

Franchise operators managing storefronts across Google, Meta and X had reviews,
posts and metrics scattered across separate vendor dashboards. Nobody had a
single view — and nobody had time to reply to every review.

What Phonic Maps does:

→ Resellers onboard business clients as tenants (reseller → client → locations)
→ Storefronts sync via Google My Business OAuth
→ AI-suggested replies to reviews, with bulk auto-response rules
→ One promo post publishes across many locations at once
→ Per-location metrics, from one SMB up to hundreds of branches

The architectural bit people miss: "reseller → client → location" is three
levels of tenancy, not one. Get that hierarchy wrong at the schema level and
every permission check downstream becomes a special case.

Model the hierarchy that actually exists in the business. Not the simplified
one that's easier to code.
```

### Post 11 (Thu) — Numbers + lessons
```
23 products. 16 countries. 5 years. Here's what shipping across regions
actually taught me:

1/ RTL is not a CSS flag.
Arabic-first means layout, iconography, date handling and content flow. Bolt it
on at the end and you'll rebuild the component layer.

2/ Payment gateways are regional, permanently.
PayFort in the Gulf. Fawry and Fawaterak in Egypt. MyFatoorah in Qatar. Stripe
and PayPal for the rest. Abstract behind one interface on day one, or the
second market costs you a rewrite.

3/ Compliance shapes architecture.
Healthcare taught me audit trails. Banking taught me reconciliation.
Marketplaces taught me eventual consistency. Each domain leaves a fingerprint
on how you design the next one.

4/ "Works on my timezone" is a real bug class.
Store UTC. Render local. Always.

None of these are exotic. All of them cost someone a sprint to learn.

What's the regional gotcha that got you? 👇
```

### Post 12 (Sat) — Recap + social proof
```
The checklist I posted a few weeks back is still the thing people DM me about
most.

It's the pre-build gate for multi-tenant SaaS — tenant isolation, role
boundaries, billing-aware data, and the six decisions you genuinely can't
cheaply undo later.

Someone I used to work with put it better than I can:

"Ahmed is a very committed developer, dedicated to the strategy of the projects
he's part of. A reliable, strategic teammate who stays focused on what the
business actually needs."
— [Saeed Al-Badry, who managed me directly]

That's the job, really. Not shipping features. Building the thing the business
actually needs, in a way that survives its second year.

Checklist is free — link in the comments. And if you're building something in
this space, my DMs are open.
```

---

## After 30 days

Rotate the same five pillars with fresh material: Fixawy (two-sided marketplace,
live map tracking), Ezhal (3 role-based apps, concurrency-safe slot booking),
Compass Med (Odoo ERP sync, dual payment gateways), Qoralia (RAG + climate
knowledge graph).

Each one has a "hard part" worth a post. You have at least six more months of
content sitting in your portfolio already.
