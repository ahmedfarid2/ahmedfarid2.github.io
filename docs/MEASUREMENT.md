# Measurement: what the site counts and what it can't

_November 2026. Analytics is Umami Cloud (cookieless, `ANALYTICS.umamiWebsiteId`
in `scripts/site-facts.mjs`). No other tracking service. The ChatGPT Ads pixel is
off (`adPixelId` empty) and the build refuses to ship it._

## The rule

**A click is interest. A submission only counts once FormSubmit has accepted
it.** FormSubmit sends the visitor back to `?sent=1` only after it has taken
the message, so the `*-sent` events fire on that return, never on the button.
Analytics receives event names and a few labels. It never receives a name,
an email address, a phone number or anything typed into a form.

## Events

Click events are attributes Umami reads on click (`data-umami-event`). Most are
added by `tagClicks` in `scripts/build.mjs` from the link's target. The offer
buttons and booking placements are added in the page pass because their
targets (`#contact`, one Calendly URL) don't say which offer or which spot
they belong to. Umami records the page URL with every event, so "which page"
is always available.

| Event | Properties | Fires when | Means | Kind |
|---|---|---|---|---|
| `book-call` | `where`: `nav` · `hero` · `case` · `pricing` · `contact` · `connect` · `other` | Click on any Calendly link | Opened the booking widget | Interest |
| `plan` | `plan`: `review` · `build` · `monthly` | Click on "Talk about this" (home offers) or "Book a review" / "Scope a build" / "Discuss retainer" (/services/) | Interested in that offer (Architecture Clinic, Launchpad, Partner) | Interest |
| `services` | | Click on any link to `/services/` (nav, chooser, case-study service line) | Went to look at offers | Interest |
| `hero-demo` | | Home hero "Request a free demo" | Free demo interest from the hero | Interest |
| `demo` | | Any other link to the demo page | Free demo interest | Interest |
| `demo-submit` | | Demo form's submit button | Tried to send (may still fail validation) | Attempt |
| `demo-sent` | `source`, `lang` | Demo page loads with `?sent=1` | **Demo request delivered** | Success |
| `project-form` | | /contact/ form's submit button | Tried to send (may still fail validation) | Attempt |
| `project-form-sent` | `source`, `lang` | /contact/ loads with `?sent=1` (any locale) | **Project enquiry delivered** | Success |
| `checklist` | | Any link to the checklist pages or PDF | Lead magnet interest | Interest |
| `checklist-submit` | | Checklist form's submit button | Tried to send | Attempt |
| `checklist-sent` | `source`, `lang` | Checklist gate page loads with `?sent=1` | **Checklist request delivered** (the page then offers the PDF) | Success |
| `whatsapp` / `email` | | WhatsApp or `mailto:` link | Opened a direct channel. What happens next is not visible | Interest |
| `cv` / `linkedin` | | CV PDF or LinkedIn profile | Hiring-side or trust check | Interest |
| `project` | `project`: flagship slug | Click on a case-study card | Read a case study | Engagement |
| `hero-proof` | | Home hero "Read what they say" | Checked testimonials | Engagement |

`source` on the `-sent` events is the visit's source label (below). `project-form`
keeps its old name so its history stays comparable; read it as "attempts".

A `-sent` event counts only when this tab sent that form in the last two
hours: the form's submit event (it fires only after the browser's validation
passes) leaves a note in `sessionStorage` (`af_pending`), and the return to
`?sent=1` uses it up. So reloading the thank-you, opening a bookmarked or
shared `?sent=1` URL, or a form that failed validation counts nothing. The
inbox is still the real count.

## Verify it yourself

1. Open Umami → the site → **Realtime** (or Events with today's range).
2. Visit `https://iamahmedfarid.com/?utm_source=test&utm_medium=check` in a
   private window. Click the hero's demo button, then the nav "Book a call".
   Within a minute Realtime shows `hero-demo` and `book-call` (`where: nav`).
3. Hover a booking link and check its URL in the status bar: it now ends in
   `utm_source=test&utm_medium=check&utm_content=…&utm_term=/`.
4. On /services/ click "Scope a build": `plan` with `plan: build`.
5. Send a real test through /contact/ with "test" in the message. You land on
   the thank-you, Realtime shows `project-form-sent` with `source: test`, and
   the email has a **Source** row:
   `source: test · medium: check · landed on: / · sent from: /contact/`.
6. In a browser with JS off the forms still post, and FormSubmit shows its own
   confirmation. Nothing is counted then; the email still arrives.

Test submissions show up in Umami as real conversions: filter them out by
their `source` (`test`), or exclude your browser first with
`localStorage.setItem('umami.disabled', 1)` in the console on the live site.

Local builds can't complete a submission, because `_next` points at the live
site. To check the thank-you states, open `dist/contact/index.html?sent=1`,
`dist/demo.html?sent=1` and `dist/get-checklist.html?sent=1` (they show the
thank-you but count nothing, since no form was sent from that tab).

## Source attribution

### What the site captures

On the page a visitor arrives on, `ATTRIBUTION_JS` (`scripts/build.mjs`)
keeps the `utm_source`, `utm_medium`, `utm_campaign` and `utm_content` tags,
the referring site and the landing page in `sessionStorage` (`af_src`). A
later arrival from outside in the same tab (a tagged link, another site)
replaces it; clicking between the site's own pages doesn't. The browser
clears it when the tab closes. No cookie. Three things use it:

- **Umami** reads the same UTM tags from the landing URL on its own (its UTM
  report) and records the referrer.
- **Calendly**: every booking link gets `utm_source`, `utm_medium`,
  `utm_campaign`, `utm_content` (= where the link sat: `hero`, `case`, …) and
  `utm_term` (= landing page). Calendly stores these on the booking, so each
  booked call shows where it came from (Scheduled events → the event → UTM
  details, and in the CSV export).
- **Forms**: a hidden **Source** field on the contact, demo and checklist
  forms carries one readable line into the enquiry email.

The source label is the `utm_source` if there is one, else the referring
site (`linkedin.com`, `google.com`), else `direct`. A page the site opens in
a new tab starts with empty session storage, so it reads as `direct`; the
site only does that for outside links, so it rarely matters.

### Tag every link you post

Untagged LinkedIn traffic often arrives as `direct` (app in-browser) or
`linkedin.com`, with no clue which post sent it. Use one convention:

| Channel | `utm_source` | `utm_medium` | `utm_campaign` | `utm_content` |
|---|---|---|---|---|
| LinkedIn post | `linkedin` | `social` | `post-2026-11-17` (post date) | topic, e.g. `rbac` |
| LinkedIn DM / connection note | `linkedin` | `dm` | `outreach-2026-11` | prospect's segment, e.g. `saas-cto` (never a name) |
| LinkedIn profile Featured / website link | `linkedin` | `profile` | `featured` | |
| Cold email | `email` | `outbound` | `seq-hiring-signal` | step, e.g. `e2` |
| Referral intro | `referral` | `intro` | referrer's first name or company | |
| Upwork / Contra profile | `upwork` | `profile` | | |
| Talk, podcast, community post | `community` | `talk` | event or community name | |

Examples:

```
https://iamahmedfarid.com/work/phonic-maps/?utm_source=linkedin&utm_medium=social&utm_campaign=post-2026-11-17&utm_content=multi-location
https://iamahmedfarid.com/demo.html?utm_source=linkedin&utm_medium=dm&utm_campaign=outreach-2026-11
https://iamahmedfarid.com/services/?utm_source=referral&utm_medium=intro&utm_campaign=khebra
```

Values keep letters, digits and `. _ / -` only; anything else becomes `-`.
Keep them lowercase and short. Link to the page that matches the message
(the relevant case study, `/services/#plan-review`, the demo page), not home.

## What only the CRM can tell you

The site sees intent and delivered messages. Everything after that lives in
`docs/tracking/leads.csv` (import into Google Sheets, never commit real
names). Copy the email's **Source** line, or Calendly's UTM details, into
the `channel` and `notes` columns when you add the lead.

| Outcome | Where it's recorded |
|---|---|
| Call actually held (vs booked, then no-show) | leads.csv `stage = call_held` |
| Qualified (budget, authority, timing fit) | leads.csv `notes`; the demo form's optional budget and timeline help |
| Proposal sent, value | `stage = proposal`, `deal_value_usd` |
| Won / lost, and why | `stage`, `lost_reason` |
| WhatsApp and email conversations | Only the click is counted; log the lead by hand |
| Revenue per channel | leads.csv grouped by `channel` |

## Monthly review (15 minutes)

1. Umami, last 30 days: `book-call` by `where`, `plan` by `plan`, and the three
   `-sent` events. Compare `project-form` (attempts) with `project-form-sent`:
   a big gap means the form is losing people.
2. Calendly: bookings by `utm_source`, against `book-call` clicks.
3. leads.csv: calls held, proposals, won, by channel. This is the number that
   matters; the rest explains it.
4. Change one thing at a time, and note the date so next month's numbers can
   be read against it.
