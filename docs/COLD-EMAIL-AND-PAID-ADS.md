# Cold Email + Paid Ads — the small-budget playbook

Companion to [`30-DAY-CLIENT-SPRINT.md`](30-DAY-CLIENT-SPRINT.md). That one covers
the free channels. This one covers the two you asked about: cold email, and
spending a small amount on ads.

**Read this first, because it reframes what the ad money is for:**

> At a small budget, no ad channel will produce measurable *conversions* for a
> $9,000 B2B engineering service. That is not pessimism, it's arithmetic —
> $200 buys roughly 15–20 clicks on LinkedIn or a few dozen on Google, and you
> need hundreds of clicks before a conversion rate means anything.
>
> What a small budget **can** do is keep your name in front of the same few
> thousand right-fit people, repeatedly, so that your cold emails and DMs land
> on someone who has already seen your face.
>
> **Ads at this budget are support for outreach, not a source of leads.**
> Judge them by whether your outreach reply rate goes up — not by "leads from
> ads," which will be zero for months.

---

# Part 1 — Cold email

This is your highest-ROI paid channel. Done properly it beats ads at your stage
by a wide margin, because you're choosing exactly who sees it.

## Step 0 — Check what your mail service actually is

**This matters more than anything else here.** Cold outreach on the wrong
service gets your account terminated, not just your emails filtered.

| Your service | Can you cold email? |
|---|---|
| **Google Workspace / Microsoft 365 / Zoho Mail** | ✅ Yes — a normal inbox. Send from a **separate domain** (below). |
| **Instantly / Smartlead / Lemlist / Woodpecker** | ✅ Yes — built exactly for this. |
| **Mailchimp / SendGrid / Brevo / Resend / Mailgun** | ❌ **No.** These are opt-in bulk senders. Their terms forbid cold outreach and they will suspend the account. Use them only for people who signed up (your Tally list, the checklist downloads). |

If yours is in the bottom row, you need a normal inbox on a second domain — not
a bulk service.

## Step 1 — Never cold email from `iamahmedfarid.com`

One spam-flagged campaign and your main domain's reputation is damaged. Then
your *real* client emails start going to junk, and that is very hard to undo.

**Buy a second domain** — something obviously you but separate:

- `ahmedfarid.dev`
- `iamahmedfarid.co`
- `farid.engineering`

Point it at your main site with a redirect, set up email on it, and send
everything cold from there. If it burns, you throw it away and buy another.
Your real domain never touches cold traffic.

## Step 2 — Deliverability setup (do all of it)

- [ ] **SPF, DKIM and DMARC** records on the new domain. Non-negotiable — Google
      and Microsoft reject unauthenticated bulk senders outright now.
- [ ] **Warm up for 2–3 weeks before sending anything real.** Start at 5 emails
      a day, add 5 every few days. A brand-new domain sending 50 emails on day
      one is the single clearest spam signal there is.
- [ ] **Max 30 emails per day, per inbox.** Ever. Want more volume? More inboxes,
      not more per inbox.
- [ ] **Plain text. No HTML, no images, no logo, no signature graphics.** It
      should look like an email a person typed.
- [ ] **Turn off open and click tracking.** Tracking pixels and rewritten links
      are a deliverability tax, and at 30 emails a day the data is worthless
      anyway. You'll know it worked because someone replies.
- [ ] **Zero links in email 1.** One link maximum in later emails.
- [ ] **Verify every address** before sending. A bounce rate over 3% wrecks
      domain reputation fast.

## Step 3 — The list (this is 80% of the result)

**Do not buy a list. Do not scrape 5,000 addresses.** 25 well-chosen companies
a week beats 500 random ones, and it's the only version that works from a
single warmed inbox.

### The strongest signal for you specifically

**Companies actively hiring a senior Laravel / Next.js / full-stack engineer.**

Think about what a job post actually tells you:

- They have **approved budget** for senior engineering
- They have a **hole they can't fill** — and average time-to-hire is 2–3 months
- They're feeling the pain **right now**

You can start in a week and ship a slice in three. That's a genuinely better
offer than waiting a quarter for a hire, and it costs less than the recruiter
fee. This is the sharpest angle you have — build the whole sequence on it.

**Where to find them:** LinkedIn Jobs, Wuzzuf (Egypt), Bayt (Gulf), Wellfound,
company career pages, and recently-funded MENA startups on Crunchbase or
MENAbytes.

### Filters

- 11–200 employees — big enough for budget, small enough that one person decides
- Gulf, Egypt, or Europe — your timezone and your references
- Building something you've already built: marketplaces, booking, multi-tenant
  B2B, payments, anything real-time

### Who to email

**One person per company.** CTO, VP Engineering, Head of Engineering — or the
founder if there's no technical lead. Never email three people at one company.

## Step 4 — The sequence

Four emails over three weeks. Each one stands alone and each adds something new.

**Subject lines:** lowercase, 2–4 words, boring, internal-looking. The subject's
only job is to get opened.

---

### Email 1 — the hiring signal (day 0)

**Subject:** `your laravel role`

> Hi [Name],
>
> Saw you're hiring a senior Laravel engineer at [Company].
>
> That search usually runs two to three months, and the work doesn't pause while
> it does. I do the in-between version — one production-ready slice, shipped end
> to end in three weeks, so the roadmap keeps moving while you find the right
> permanent person.
>
> Last one was a multi-tenant auction platform: real-time bidding, web and
> mobile, ERP-synced invoicing. Live on the App Store and Google Play.
>
> Worth a conversation, or is the hire covered?
>
> Ahmed Farid
> Senior Software Engineer · Cairo

**Why this works:** it opens inside their world, names a real cost they're
already feeling, and the ask is a yes/no question rather than a calendar link.
"Or is the hire covered?" makes "no" easy — which paradoxically raises replies.

---

### Email 2 — proof, different angle (day 4)

**Subject:** `three weeks`

> Hi [Name] — following up once with something more concrete.
>
> The three-week thing sounds like a sales number, so here's what it actually
> looks like: one clearly-scoped slice, not "the product." Backend, web and infra
> owned end to end, Dockerised deploy with CI/CD, docs and a clean handover so
> your team owns it after. Fixed price, no hourly meter.
>
> I've done eleven of these — debt recovery case management, a decarbonisation
> platform for municipalities, an Arabic-first LMS delivered with full handover
> documentation.
>
> Case studies here if useful: iamahmedfarid.com
>
> Ahmed

---

### Email 3 — give something away (day 11)

**Subject:** `quick read`

> Hi [Name],
>
> Last useful thing and then I'll stop.
>
> I wrote a short checklist on multi-tenant SaaS architecture — the tenant
> isolation, migration and scaling decisions that are cheap to get right early
> and expensive to fix later. No email required, it's just on the site:
> iamahmedfarid.com/checklist.html
>
> If any of it is relevant to what [Company] is building, happy to talk it
> through — no charge and no pitch.
>
> Ahmed

**This one converts best.** It asks for nothing, and it demonstrates competence
rather than claiming it.

---

### Email 4 — the breakup (day 21)

**Subject:** `closing the loop`

> Hi [Name] — I'll assume the timing isn't right and stop here.
>
> If the hire falls through, or a build starts slipping later in the year, my
> inbox is open. No hard feelings either way — good luck with [Company].
>
> Ahmed

**Then genuinely stop.** The breakup email gets a surprising number of replies
precisely because people can tell you mean it. If you send a fifth, you didn't.

---

## Step 5 — Legal, briefly

- **Sign every email with your real name and city.** No fake identity, no
  fake company.
- **Honour every opt-out immediately.** If someone says stop, they come off the
  list permanently.
- **Business addresses only.** Never personal Gmail accounts.
- **EU (Germany, Spain, France):** GDPR permits B2B outreach under legitimate
  interest, but you must be able to say where you got the address and make
  opting out easy. Keep a note of the source for each contact.
- **Gulf and Egypt** are looser, but the same discipline protects your domain.

## What to actually expect

Honest numbers, so you don't quit at the wrong moment:

| | Realistic |
|---|---|
| Reply rate, well-targeted | 3–8% |
| Positive replies | ~1–3% |
| 100 emails/week × 4 weeks = 400 sent | 12–30 replies |
| Of those | **3–8 conversations** |
| Of those | **1–2 paid projects** |

That is a good outcome. If you're seeing under 1% replies, the problem is the
**list**, not the copy — go back to Step 3.

---

# Part 2 — Paid ads, $200/month

You want to spend, so here's how to spend it well rather than not at all.

## Where the money goes

**All $200 into LinkedIn — boosting your own posts to a job-title audience.**

Not split across channels. At this budget, splitting means learning nothing
twice.

### Why LinkedIn and not the others

It is the only platform on earth where you can say *"show this to CTOs at
companies with 11–200 employees in the UAE."* That targeting is the entire
product. Everywhere else you're guessing at an audience; here you're naming it.

And you're boosting **content, not an ad** — a case study or a lesson-learned
post. For a high-trust purchase, a post someone reads and remembers does far
more than a banner saying "hire me."

### Exact settings

| Setting | Value |
|---|---|
| **Campaign objective** | Engagement or Website visits — **not** Lead Gen |
| **Job titles** | CTO · VP Engineering · Head of Engineering · Engineering Manager · Technical Co-Founder · Founder |
| **Company size** | 11–200 employees |
| **Locations** | UAE · Saudi Arabia · Egypt · UK · Germany · Spain |
| **Budget** | $7/day |
| **What to boost** | Your best-performing organic post that week — never a "hire me" ad |

### What to measure

Not leads. These:

- **Profile views** (LinkedIn shows you this weekly)
- **Connection requests accepted** from target titles
- **Reply rate on your cold email and DMs** — this is the real one

The mechanism: someone sees your post twice, then your email arrives and you're
not a stranger any more. That lift shows up in your outreach numbers, not in the
ad dashboard.

### Kill rule

**60 days.** If your outreach reply rate hasn't moved and no conversation traces
back to LinkedIn, stop and put the $200 into Sales Navigator instead.

---

## TikTok — the honest answer

**Ads: no.** Two reasons, and neither is snobbery:

1. **The targeting can't find your buyer.** TikTok optimises for watch time,
   not job title. You cannot say "CTO with budget." You'd be paying for cheap
   attention from people who will never buy a $9,000 engineering engagement.
2. **Wrong mindset.** Nobody scrolling TikTok is procuring senior engineering.
   Intent is the whole game for a considered purchase, and there is none there.

**Organic: maybe, if you enjoy it.** Short Arabic technical videos are a genuinely
underserved niche and could build a real audience over a year. But it builds
*audience*, and you already have 25,000 people on the platform where your buyers
actually work. Fix that first.

## Meta (Facebook / Instagram) — optional $50 experiment

Clicks in Egypt and the Gulf are very cheap, so if you want to test something
beyond LinkedIn, this is the one worth $50 — but point it at the **$1,200
architecture review**, not the $9,000 build. Small ticket, regional founders,
cheap traffic. Cap it at $50 and treat it as a test, not a channel.

## Google Ads — still not yet

Unchanged from the sprint doc. Those keywords are agency keywords and $200 buys
you a rounding error of clicks. Revisit after you have testimonials and a known
close rate, and start with retargeting rather than cold search.

---

# Part 3 — Upwork

You've started with your HR consultant. One thing to tell her, because it changes
how the profile should be built:

> **For the first 60 days the goal is reviews, not rate.**

- Bid on **small, fast, boring** jobs you can finish perfectly in a weekend
- Take a lower rate than you're worth — deliberately, and temporarily
- Ask for the review the day you deliver
- **After 3 five-star reviews, raise the rate hard** and stop bidding low

You are buying public proof with labour instead of cash. The rate is the price
of the proof. Just don't let it become your anchor — set the exit date now.

---

# What to do this week

| Day | Do |
|---|---|
| Mon | Buy the second domain. Set up SPF/DKIM/DMARC. Start warmup at 5/day. |
| Tue | Build the first list of 25 companies hiring Laravel/Next.js engineers. |
| Wed | Set up the LinkedIn campaign, $7/day, boosting your best post. |
| Thu | Brief the HR consultant: reviews first, rate second. |
| Fri | Warmup continues. Nothing to do but wait. |

**Cold email sending starts in week 3**, after warmup. Do not shortcut this —
it's the one step where impatience costs you the domain.

Meanwhile, the free channels from the sprint doc run in parallel starting
tomorrow. They'll produce your first conversation before any of this does.
