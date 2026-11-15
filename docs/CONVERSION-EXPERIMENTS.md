# Conversion: what needs real data or owner input

_November 2026. Companion to [`MEASUREMENT.md`](MEASUREMENT.md) (events and
attribution) and [`STUDIO-SPEC.md`](STUDIO-SPEC.md) (honesty rules R1–R6).
Nothing here is shipped. Each item waits on data the site can't produce by
itself or on a fact only the owner can confirm._

## 1. Verify FormSubmit (do this first, 5 minutes)

FormSubmit delivers nothing until the address is activated. The first
submission sends an activation email to `ahmed@iamahmedfarid.com`, and until
someone clicks it, enquiries are not forwarded. Nothing on the site can tell
whether that click has happened.

1. On the live site, in a private window, exclude yourself from Umami:
   `localStorage.setItem('umami.disabled', 1)` in the console.
2. Open `https://iamahmedfarid.com/contact/?utm_source=test&utm_medium=check`
   and send a short enquiry that says "test".
3. Expected: you land on the thank-you, and within a few minutes an email
   arrives titled "Project enquiry (en) — iamahmedfarid.com" with a
   **Source** row (`source: test · medium: check · …`). Check spam too.
4. If FormSubmit shows an activation notice instead, click the link in the
   activation email and repeat. Do the same once for `/demo.html` and
   `/get-checklist.html` (same address, so one activation covers all three).
5. Optional hardening: FormSubmit's activation email offers a random alias
   (`formsubmit.co/<alias>`). Using it in place of the address in the three
   form `action`s (`formAction` in `scripts/build.mjs`, `demo.html`,
   `get-checklist.html`) keeps the address out of the form markup. The
   address is published elsewhere on the site anyway, so this is a spam
   reduction, not a fix.

## 2. Experiments that need conversion data

Traffic is low (see `BUSINESS-NUMBERS.md`), so a split test will not reach
significance in any useful time. Run these as **before / after periods**:
change one thing, leave it for at least four weeks or until the funnel step
has 20+ events, and judge by lead quality in `tracking/leads.csv` as much as
by counts. Note the change date in the scorecard.

| # | Question | Change to try | Read it from | Decide when |
|---|---|---|---|---|
| E1 | Does the required phone number cost demo requests? | Make **Phone or WhatsApp** optional on `demo.html` | `demo` + `hero-demo` clicks → `demo-submit` → `demo-sent`; share of sent requests you could actually reach | A falling `demo-submit` → `demo-sent` ratio or many abandons after the phone field. Keep it required if optional numbers are mostly left blank by good leads. |
| E2 | Do Arabic visitors need the demo page in Arabic? | Translate `demo.html` into an `/ar/` page (a new page: `PAGE_SPECS`-style routing, hreflang, sitemap and inventory counts) | `hero-demo` / `demo` clicks on `/ar/` pages vs `demo-sent` with `lang: en` but an Arabic brief | Only if `/ar/` demo clicks are a real share (say 20%+) and convert clearly worse than English ones. Until then the English page says it accepts Arabic briefs. |
| E3 | Should the hero lead with the free demo or the call? (owner decision f540023 put the demo first) | Swap the primary and ghost hero buttons | `hero-demo` vs `book-call` (`where: hero`), then `demo-sent` vs `call-booked`, then which became proposals in `leads.csv` | If demo requests are many but rarely become paid work while calls do, lead with the call. |
| E4 | Does the budget band qualify demo requests? | Nothing yet; it is optional | Share of `demo-sent` with a budget filled, against which ones became proposals | If budgets "Under $9,000" never convert, say up front that the demo is for builds from $9,000. |
| E5 | Do case-study readers move to an offer? | Nothing yet | `project` clicks → `services` clicks from `/work/<slug>/` → `plan` / `book-call` (`where: case`) | If case pages get traffic but almost no `where: case` bookings, test a stronger case-page call to action. |

## 3. Case studies: business outcomes to collect

Today the case studies show what each product does and qualitative results
(clients follow their case in a portal; every location's reviews in one
screen). None shows a business number, and the one technical number is not
backed by an evidence line yet. Do not add a number to the site without the
evidence (R6) and, for an employer, without permission (R1: roles stay
"In-house role", never studio work).

| Case | Provenance | Verified now | Ask for (and from whom) |
|---|---|---|---|
| Recovery Advisers | In-house role | Approved quote: clients check their own case status instead of emailing; rebuilt while in daily use | Drop in status emails or calls after the portal launched; number of active client portals. Ask the CTO (Remon Adel) for a figure he is happy to see published. |
| Yelo Sale | In-house role | Live on web, iOS and Android; approved quote that it held under real traffic | Evidence for "<200ms" and "zero lost-bid race conditions" (load-test report, monitoring screenshot), or soften them; auctions or lots run per month, if the company allows it. |
| Phonic Maps | Client project | Approved quote: reviews for many locations in one screen, problems flagged early | Locations or businesses on the platform; time to reply to reviews before and after. Ask the project manager (Amr Khalil). |
| KhebraOS | Client project | Live product; six-step course flow | Academies launched; time to publish a first course. |
| Qoralia | Client project | Live product (Proven Management) | Cities or teams using it; a pilot result the client will name. |

Where an approved testimonial already states the outcome, the quickest win is
to show that quote on its own case study page (home already links each quote
to its case). That is a new block on the case pages, so it needs the owner's
go-ahead and the quoted person's consent to the second placement.

`docs/TESTIMONIAL-REQUESTS.md` has the message templates. Ask for one number
per client, in their words.

## 4. Studio credibility without inventing anything

What the site claims now, all owner-confirmed: Ahmed Farid Studio, Dubai,
since 2022; "a senior-led team of 7+", unnamed; contracts and invoices
signed by the founder (no legal entity yet); five named testimonials (three
from people at companies where Ahmed held a role) and one LinkedIn
recommendation; twelve case studies linked to
live products. The structured data claims the same and nothing more.

Gaps a careful buyer will notice, and what closes each:

1. **The team is a number without names.** Name the people who agreed, with
   written consent, role and one line each (`STUDIO-SPEC.md` 2.2). Until
   then the site must not add team photos, headcounts by role or "our
   engineers" lines.
2. **Most proof comes from in-house roles.** The strongest stories (Yelo
   Sale, Recovery Advisers) are employment. Phonic Maps already has a client
   quote with a result; one more from KhebraOS or Qoralia, with a number,
   would shift the balance toward studio work.
3. **The About FAQ says Ahmed is full-time at Recovery Advisers.** That is
   true and stays, but a buyer may ask who runs their project day to day.
   The answer the site gives is "Ahmed leads every project; you deal with
   him throughout". Confirm that still holds at four client projects a
   quarter.
4. **No legal entity.** Procurement-heavy buyers will ask. `STUDIO-SPEC.md`
   Phase 3 covers what changes once the company exists.
5. **Client logos.** Only with each client's written yes; employer logos
   never go in a client strip.
