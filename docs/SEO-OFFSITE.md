# Off-site SEO: the part only you can do

The on-site work is in the build: titles and descriptions per page and locale,
hreflang, canonicals, JSON-LD, honest sitemap dates, IndexNow on every deploy,
share cards in five languages, and the `/insights/` write-ups. What is left
needs your accounts. Do it in this order; the first two sections are worth more
than everything after them.

Rule for all of it: same name (**Ahmed Farid**), same city (**Dubai**), same
URL (**https://iamahmedfarid.com**) everywhere. Consistency is the signal.

---

## 1. Right after the next deploy (~15 minutes)

Search Console (the **Domain** property for `iamahmedfarid.com`; setup steps in
[`SETUP-EMAIL-AND-SEARCH-CONSOLE.md`](SETUP-EMAIL-AND-SEARCH-CONSOLE.md)):

1. **Sitemaps** → confirm `sitemap.xml` is submitted and reads **55** URLs. If it
   shows an older count, click it and **Resubmit**.
2. **URL inspection** → paste each URL → **Request indexing**. Google allows a
   handful a day, so do the new ones first:
   - `https://iamahmedfarid.com/insights/`
   - `https://iamahmedfarid.com/insights/real-time-bidding-laravel-redis/`
   - `https://iamahmedfarid.com/insights/webhook-sync-out-of-order/`
   - `https://iamahmedfarid.com/contact/`
   - `https://iamahmedfarid.com/ar/`
3. **Indexing → Pages** → anything under "Not indexed" with a reason other than
   "Page with redirect" or "Alternate page with proper canonical tag" is worth
   a look. Send me the URL and the reason.

Bing Webmaster Tools ([bing.com/webmasters](https://www.bing.com/webmasters)):
**Import from Google Search Console** — one click, no DNS. IndexNow already
pings Bing on every deploy; this just gives you the dashboard. Bing also feeds
ChatGPT search and DuckDuckGo, so it is not optional.

**Test the project form once.** The new form on `/contact/` posts through
FormSubmit like the demo and checklist forms. Send yourself one test brief from
the live page; if FormSubmit asks you to confirm the address, confirm it. Until
then, briefs from that form are not delivered.

---

## 2. Profiles that already rank for your name (~30 minutes)

These pages rank for "Ahmed Farid" before your site does. Each one should point
at the site, so the authority they have flows to it.

| Profile | What to set |
|---|---|
| LinkedIn | **Contact info → Website**: `https://iamahmedfarid.com` (type: Portfolio). **Featured**: the site, then the bidding write-up. Headline ends with "· Dubai". |
| GitHub | Profile **Website** field: `https://iamahmedfarid.com`. The profile README already links it. |
| X, Instagram, TikTok, YouTube, Behance | Bio link → `https://iamahmedfarid.com`, not a link-in-bio service. A link-in-bio page takes the link equity instead of your site. |
| Stack Overflow (if you have one) | **Website** field. |
| Upwork / Contra (if you use them) | Portfolio item per case study, each linking to its `/work/<slug>/` page. |

Short bio, ready to paste (it matches the site's own description):

> Dubai-based senior software engineer (6+ years) building real-time,
> multi-tenant SaaS end to end: Laravel, Next.js, Flutter. Fixed-scope builds
> and consulting. https://iamahmedfarid.com

> مهندس برمجيات أول في دبي (أكثر من 6 سنوات)، أبني منصّات SaaS متعدّدة
> المستأجرين تعمل في الوقت الفعلي من البداية للنهاية: Laravel وNext.js
> وFlutter. مشاريع محدّدة النطاق واستشارات. https://iamahmedfarid.com

---

## 3. Republish the write-ups, with a canonical link (~10 minutes each)

The two `/insights/` articles are the first pages on the site that can rank for
something other than your name. Republishing them where developers already
read gets them seen and linked, **as long as every copy names your page as the
original**. Without that, the copy outranks you with your own words.

| Platform | How to set the original |
|---|---|
| dev.to | Front matter: `canonical_url: https://iamahmedfarid.com/insights/<slug>/` |
| Hashnode | Article settings → **"Are you republishing?"** → original URL |
| Medium | Use **Import a story** with the URL (it sets the canonical itself); don't paste |
| LinkedIn article | No canonical field. Post a summary of 3–4 paragraphs plus the link instead of the full text. |

Wait until Google has indexed the original (URL inspection says "URL is on
Google") before republishing anywhere.

Each new write-up is an entry in `scripts/insights.mjs`; tell me the topic and
the case it comes from, and I add it. One a month is enough. Topics that fit the
case studies you already have: Microsoft Entra SSO in a multi-tenant Laravel
app (Recovery Advisers); ERP two-way sync with Dynamics 365 (Yelo Sale); one
account, many locations: tenant design for multi-location businesses (Phonic Maps).

---

## 4. Links from your own work (ask once per client)

The strongest link you can get is from a client's live product, because it is
real and on topic. Ask each client whose case study is on the site for one of:

- a mention on their About, Team or Partners page: "Platform built with
  [Ahmed Farid](https://iamahmedfarid.com)";
- a line in their app store listing's developer notes or website credits.

Anchor text is your **name**, not "Laravel developer Dubai". A keyword anchor in
a client's sitewide footer is a known spam pattern and can count against you.
A `nofollow` link is fine; it still sends people and brand signal.

---

## 5. Google Business Profile: only if you want local searches

GBP is what shows on Maps and in the "software developer near me" box. It helps
for searches like "Laravel developer Dubai"; it does nothing for searches
outside Dubai. Two rules decide whether it is worth it:

- **No home address on the profile.** Set it up as a **service-area business**
  (Dubai / UAE) and hide the address. Google verifies a solo freelancer this
  way, usually by video of your work setup; expect it to take a few days.
- **The business name is your real name: "Ahmed Farid".** Adding "Laravel
  Developer Dubai" to the name breaks Google's guidelines and gets profiles
  suspended.

If you go ahead:

| Field | Value |
|---|---|
| Name | Ahmed Farid |
| Primary category | **Software company** (pick the closest match the dropdown offers) |
| Additional categories | Website designer; Computer consultant (only if offered) |
| Service area | Dubai; United Arab Emirates |
| Website | `https://iamahmedfarid.com` |
| Appointment link | `https://calendly.com/iamahmedfarid/30min` |
| Hours | Your real hours, GMT+4 |

Description (English, under 750 characters):

> Senior software engineer based in Dubai with 6+ years of production work.
> I build real-time, multi-tenant SaaS platforms end to end: Laravel APIs,
> Next.js web apps and Flutter mobile apps, from architecture to deployment on
> AWS. I work with companies as fixed-scope builds, ongoing engineering
> retainers or architecture reviews. Recent work includes a live vehicle
> auction platform in Saudi Arabia and a debt-recovery case-management
> platform in Dubai. Arabic and English. Book a 30-minute scoping call from the
> website.

Description (Arabic):

> مهندس برمجيات أول مقيم في دبي، بخبرة تزيد عن 6 سنوات في أنظمة تعمل فعلياً.
> أبني منصّات SaaS متعدّدة المستأجرين وفي الوقت الفعلي من البداية للنهاية:
> واجهات Laravel، وتطبيقات ويب بـ Next.js، وتطبيقات جوال بـ Flutter، من
> التصميم المعماري حتى النشر على AWS. أعمل مع الشركات بمشاريع محدّدة النطاق
> أو عقود هندسية مستمرة أو مراجعات معمارية. من أعمالي الأخيرة منصّة مزادات
> سيارات مباشرة في السعودية ومنصّة لإدارة قضايا التحصيل في دبي. بالعربية
> والإنجليزية. احجز مكالمة تحديد نطاق مدتها 30 دقيقة من الموقع.

Add the five case studies as **Products** or **Posts** with a photo from each
case and a link to its `/work/<slug>/` page. Ask clients who already gave you a
quote to leave the same words as a Google review; never write one for them.

---

## 6. What not to do

- **Directory blasts** (50 directories for $20). They are links Google ignores
  at best and discounts the site for at worst.
- **Clutch / GoodFirms.** Built for agencies, need verified client interviews,
  and rank agencies above individuals. Skip them unless you list a company.
- **Buying guest posts or links.** Same risk, and it shows.
- **Rewriting titles for keywords on your own.** The titles are tuned and held
  by length gates in the build; tell me what you want to rank for and I change
  them in `scripts/site-facts.mjs`.

---

## 7. How to tell whether it works

| When | Look at | Healthy |
|---|---|---|
| 2 weeks | Search Console → Indexing → Pages | All 55 sitemap URLs indexed or "alternate with canonical" |
| 6 weeks | Performance → Queries, filter page contains `/insights/` | Impressions for queries that are not your name |
| 3 months | Performance → Queries, filter query does not contain "ahmed" or "farid" | Clicks from non-branded queries, mostly on `/insights/` and `/services/` |
| Every month | Umami → referrers | LinkedIn, dev.to and client sites appear as sources |

Branded search ("ahmed farid") growing is the strongest sign the rest of your
marketing works; non-branded clicks growing is the sign the SEO works. They
are different numbers; don't read one as the other.
