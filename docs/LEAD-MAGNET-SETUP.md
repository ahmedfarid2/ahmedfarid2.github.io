# Lead Magnet Setup — Wiring the Checklist to a Client Pipeline

You now have the asset (`/lead-magnet/`). A lead magnet only works when it
**captures an email** so you can nurture the 98% who aren't ready to book a call
today. Here's the fastest way to wire it, no backend required.

---

## The asset

- `lead-magnet/multi-tenant-saas-architecture-checklist.md` — source content.
- `lead-magnet/multi-tenant-saas-architecture-checklist.html` — branded,
  print-ready page (matches your site's dark/gold theme).

**Make the PDF:** open the `.html` in a browser → Print → "Save as PDF." It has
a print stylesheet that switches to a clean light theme for the PDF. Name it
`multi-tenant-saas-checklist.pdf`.

---

## Option A — Fastest (email tool, recommended)

Best for building a list you can email later.

1. **Pick a free tool:** [ConvertKit/Kit](https://kit.com) (free tier),
   [MailerLite](https://mailerlite.com), or [Beehiiv](https://beehiiv.com).
2. Create a **landing page or form** titled: _"The Multi-Tenant SaaS
   Architecture Checklist — free."_
3. Set the **incentive/delivery** = your PDF (upload it). The tool emails it
   automatically on signup.
4. Add a **2-email follow-up sequence** (templates below).
5. Copy the form/landing-page URL. That's the link you put everywhere:
   - LinkedIn Featured section
   - LinkedIn post CTAs ("link in comments")
   - Your site's Connect section (see `COPY-POSITIONING.md`)

## Option B — No email tool yet (form → notify)

Use [Tally](https://tally.so) or [Formspree](https://formspree.io) (both free):
- One email field → on submit, redirect to the hosted checklist page and/or
  auto-reply with the PDF link. You get an email for each signup to follow up
  manually. Upgrade to Option A once signups are steady.

## Option C — Host the page on your own site (pairs with A or B)

Because your build copies root files into `dist/`, you can serve the checklist
from your own domain:

1. Copy the HTML to the repo root as `checklist.html` (root files get deployed;
   files inside `/lead-magnet/` and `/docs/` do **not**):
   ```
   cp lead-magnet/multi-tenant-saas-architecture-checklist.html checklist.html
   ```
2. Commit & push. It goes live at **`https://iamahmedfarid.com/checklist.html`**.
3. Gate it: link the form (Option A/B) to deliver this URL after signup, or
   embed the form at the top of the page.

> Keep the canonical lead flow behind an email capture — a public URL is fine
> for sharing, but the signup is what turns a reader into a lead.

---

## The 2-email follow-up (paste into your email tool)

**Email 1 — sent immediately (delivery):**
```
Subject: Your Multi-Tenant SaaS checklist 👇

Hi [first name],

Here's the checklist — the architecture decisions you can't cheaply undo:
[link to PDF / page]

The six items in section 7 are the ones I'd fight for on day one. If any of
them are still open questions on your current build, that's usually where a
rewrite is quietly brewing.

I do free 30-minute architecture reviews if a second pair of eyes would help —
just reply and we'll find a time.

— Ahmed
iamahmedfarid.com
```

**Email 2 — sent 3 days later (soft offer + proof):**
```
Subject: The race condition that almost shipped two winners

Hi [first name],

Quick story from a real build. On a live-auction platform I built (Yelo Sale),
dozens of bidders would hit the same lot in the final seconds. Get bid ordering
wrong for even one, and you get two "winners" — and a legal problem.

The fix was making the server the single source of truth for ordering, with
atomic Redis increments and a push layer mirroring every bid in <200ms. Zero
lost bids under load.

That's the kind of problem I'm built for. If you're wrestling with concurrency,
multi-tenancy, or "we need backend + web + mobile from one person," I have a
build slot open this quarter.

Want to talk it through? → [booking link]

— Ahmed
```

---

## Where the link goes (checklist)

- [ ] LinkedIn **Featured** section (pinned, first item)
- [ ] LinkedIn **About** section (one line + link)
- [ ] The **first comment** of every relevant post ("checklist in the comments")
- [ ] Your site's **Connect** section (copy in `COPY-POSITIONING.md`)
- [ ] Your **email signature**
- [ ] Any **talk, podcast, or guest post** you do

One asset, promoted repeatedly, quietly builds a list of exactly the people who
hire you. That list is worth more than any search ranking.
