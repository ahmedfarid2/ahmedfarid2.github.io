# Business Numbers — what one client a month actually takes

_October 2026. Companion sheets: [`tracking/weekly-scorecard.csv`](tracking/weekly-scorecard.csv)
and [`tracking/leads.csv`](tracking/leads.csv)._

## The verdict

The site is not the bottleneck. **You haven't been sending enough outreach, and
nothing is measured.**

- 91 commits went into the site between August and October, almost all polish.
  `GROWTH-PLAN.md` said in August: "do not spend another hour here."
- The homepage reads as a job hunt ("Open to senior roles and consulting"),
  while the paid offer lives on `/services`. A founder arriving from LinkedIn
  lands on the job-hunt page. Choosing between a job and a client business is
  your call, but running both on one homepage has a cost.
- There are no funnel numbers: calls booked, outreach sent, reply rates. You
  can't tell whether something works without them.

## The funnel, worked backward from 1 client a month

Tiers run about $4.5k–9k, so one engagement a month is the bar.

| Stage | Benchmark | Volume needed |
|---|---|---|
| Call → client | Professional services win about 28% of pipeline; proposal win rates 25–35% | **4 calls / month** |
| LinkedIn cold (CTOs and founders at 11–200-person companies) | 28.5% acceptance, 10.4% message reply (Expandi, 13.2M attempts) | 400 requests → ~114 connections → ~12 replies → **~3 calls** |
| Warm network (past clients, colleagues, managers) | Warm-first outreach got 42% replies vs 9% cold (single-person test) | 40 notes → ~12–16 replies → **~1–2 calls or intros** |
| Cold email (month 2+, needs a separate sending domain) | Typical reply rate 3–6%; above 8% is exceptional | 1,000 sends → 30–60 replies → **~3–5 calls** |
| Upwork | 3–10% of proposals win overall; 2–8% for a new profile | 40 proposals → **1–3 small jobs** |
| Website | Professional services landing pages convert 6.1% at the median, for visitors who came to buy | Your traffic is accidental search, so expect ~0 leads |
| LinkedIn posts | Personal posts get a median 1.5–2.5% engagement | Posts make you visible; they book calls only when they end with a specific offer |

**Estimate.** Benchmarks cover acceptance and reply rates. The step from a reply
to a booked call (roughly a quarter to a third of replies) is my estimate.
Your own numbers replace it after four weeks.

## The weekly quota

About 1–1.5 hours a day. The `TARGET / week` row in the scorecard holds these numbers.

| Activity | Per week | Note |
|---|---|---|
| Warm messages | 10 | A warm list runs out (most people have 100–150 real contacts). 10 a week covers the list in about three months, follow-ups included. |
| LinkedIn connection requests to target buyers | 100 | Stay under LinkedIn's weekly invite cap. A short note, no pitch in the request. |
| Posts | 2 | Every post ends with one offer line: "1 build slot open for Q4 — DM me BUILD." |
| Upwork proposals | 10 | Only for jobs that fit your niche. The goal is reviews, not revenue. |
| Site commits | **0** | Freeze the site for 30 days unless a lead asks for something. |

## Proof without testimonials

You're not asking for testimonials now. That leaves a gap, because a stranger
with a $9k budget has no third-party proof that you deliver. These close part of
it without asking anyone for anything:

1. **Upwork reviews.** Clients review you when the job closes, without being
   asked. Two or three small jobs ($300–800) produce public, dated proof.
2. **Verifiable outcomes.** Live App Store and Google Play links and production
   URLs already sit in the case studies. In DMs and proposals, link the specific
   case that matches the buyer's problem rather than the homepage.
3. **Visible expertise.** Hinge's survey of 523 firms found that 81.5% have been
   referred by someone who was never their client, about half of those on the
   strength of the firm's expertise. Specific technical posts and a talk or two
   (Arabic-language tech talks are an open lane) are proof nobody has to sign off on.

Ads stay off. The ad gate in `30-DAY-CLIENT-SPRINT.md` requires 2+ testimonials,
3+ calls from free channels, and a known close rate. With testimonials off the
table, use **3+ calls from free channels and a known close rate** as the gate.

## How to use the sheets

**Keep real names out of this repo.** Treat it as public; only empty templates
belong here. Import both CSVs into Google Sheets (File → Import →
Upload) and fill them in there.

- **`weekly-scorecard.csv`** has one row per week starting Monday 19 October 2026,
  12 weeks. Fill in counts every Friday. The rate columns calculate themselves.
  Compare each rate with the target row.
- **`leads.csv`** has one row per person you talk to. `channel` is one of
  `warm`, `linkedin`, `email`, `upwork`, `inbound` or `referral`. `stage` is one
  of `contacted`, `replied`, `call_booked`, `call_held`, `proposal`, `won` or
  `lost`. Every row needs a `next_step_date`; a row without one is a dead lead
  you haven't admitted is dead. Fill `lost_reason` honestly (price, timing,
  no budget, went silent), because that column tells you what to fix.

## The 4-week review (Friday 13 November 2026)

| Result | What it means | What to do |
|---|---|---|
| Quota hit, 4+ calls | The funnel works | Keep going; push the best channel up. |
| Quota hit, under 4 calls, LinkedIn reply rate under 5% | The message or targeting is wrong | Rewrite the first message; narrow the job titles. |
| Quota hit, calls held, 0 won | The offer, price or call is wrong | Read `lost_reason`; record or re-script the call. |
| Quota missed | You need to send more | Nothing else changes until the quota is hit for 2 straight weeks. |

All benchmarks here are directional. Most come from outreach-tool vendors with
their own definitions. After 4 weeks of your own data, trust your numbers over these.

## Sources

- [Expandi — LinkedIn Outreach Benchmarks 2026](https://expandi.io/blog/linkedin-outreach-benchmarks)
- [Apollo — cold outreach reply-rate benchmarks](https://www.apollo.io/insights/what-is-a-good-benchmark-for-reply-rates-in-cold-outreach)
- [Mailshake — Cold Email Report 2025](https://assets.mailshake.com/wp-content/uploads/2025/04/16091740/Cold-Email-Report-2025-Mailshake.pdf)
- [Instantly — cold email reply-rate benchmarks](https://instantly.ai/blog/cold-email-reply-rate-benchmarks)
- [getfuzzy — warm-first LinkedIn test](https://getfuzzy.ai/blog/linkedin-outreach-strategies-tested)
- [Unbounce — professional services conversion rate](https://unbounce.com/conversion-benchmark-report/professional-services-conversion-rate/)
- [GigRadar — Upwork win rates](https://gigradar.io/blog/upwork-proposal-analytics-track-win-rate-response-rate-roi)
- [AiProposer — Upwork proposal win rate](https://aiproposer.com/guides/upwork-proposals/upwork-proposal-win-rate)
- [Hinge — Rethinking Referral Marketing](https://hingemarketing.com/blog/story/rethinking-referral-marketing-a-new-research-based-approach-to-referrals)
- [Klipfolio — professional services win rate](https://www.klipfolio.com/kpis/sales/successful-unsuccessful-tenders)
- [Prospeo — closing ratio benchmarks](https://prospeo.io/s/closing-ratio)
- [AuthoredUp — LinkedIn creator data](https://authoredup.com/blog/linkedin-content-creator)
