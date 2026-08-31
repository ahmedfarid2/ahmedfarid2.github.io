# Setup: Email Capture & Search Console

Two things that need your accounts. Both are short. Follow them in order —
email capture matters more.

---

## 1. Email capture for the checklist (~15 minutes)

**Why this matters more than anything else on the site:** right now the
checklist is given away and you get nothing back. Every person who downloads it
is someone interested in multi-tenant SaaS architecture — exactly your buyer —
and they leave without a trace. A capture form turns those into a list you own
and can email whenever you have capacity.

### Done — the form is on your own site

This no longer needs a third party. Both capture forms live on
`iamahmedfarid.com` and match the rest of the site:

| Page | Captures | On submit |
|---|---|---|
| [`/get-checklist.html`](../get-checklist.html) | Email (required), name | Hands over the PDF immediately |
| [`/demo.html`](../demo.html) | Name, **email**, **phone**, company URL, timeline, what to build | Confirmation on the page |

Both post to **FormSubmit**, which forwards straight to
`ahmed@iamahmedfarid.com` and stores nothing. No account, no dashboard, no
monthly fee, and the lead lands in your inbox rather than someone else's
database.

**One thing you must do once:** submit either form yourself. FormSubmit sends a
one-time confirmation email the first time an address is used — click that link
or nothing gets delivered. Do it before you send anyone to either page.

The endpoint sits in a single `action` attribute on each page with a comment
above it, so moving to Formspree, Kit, or a real backend later is a one-line
change per page.

**The old Tally form is no longer referenced anywhere** — you can delete it from
your Tally account whenever you like.

### Alternative: Kit / ConvertKit (better long-term)

Choose this if you want to send email sequences later, not just collect
addresses.

1. **[kit.com](https://kit.com)** → free plan.
2. **Grow → Landing pages & Forms → Create form → Modal or Page**.
3. Set the **incentive email** to deliver your PDF (upload
   `multi-tenant-saas-checklist.pdf` or link to the URL above).
4. Add the two-email follow-up sequence from
   [`LEAD-MAGNET-SETUP.md`](LEAD-MAGNET-SETUP.md).
5. Publish → copy the URL → send it to me.

### Where the URL goes once you have it

- The **Free checklist** card on your site (I'll wire this)
- Your **LinkedIn Featured** section, pinned first
- The **first comment** of relevant LinkedIn posts
- Your **email signature**

---

## 2. Google Search Console — Domain property (~10 min + DNS wait)

**Why:** the property you've been reading is `ahmedfarid2.github.io`, which
GitHub 301-redirects to `iamahmedfarid.com`. All ranking signals consolidate on
the custom domain, so that old property shows you almost nothing real. A
**Domain property** covers the whole domain — every subdomain and both
http/https — in one place.

### Steps

1. Go to **[search.google.com/search-console](https://search.google.com/search-console)**
   (sign in with the Google account you already used).
2. Click the property dropdown (top-left) → **Add property**.
3. Choose the **Domain** option (the left-hand box), **not** URL prefix.
4. Enter exactly:
   ```
   iamahmedfarid.com
   ```
   (no `https://`, no `www.`)
5. Google shows a **TXT record** to add, like:
   ```
   google-site-verification=AbCdEf1234...
   ```
   Copy it.
6. Add that TXT record at **whoever manages your DNS** — that's where you
   pointed the domain at GitHub Pages, so it's the registrar or DNS host you
   used when setting up the custom domain (Namecheap, GoDaddy, Cloudflare,
   Hostinger, Squarespace/Google Domains, etc.).

   In that provider's DNS settings, add a record:

   | Field | Value |
   |---|---|
   | Type | `TXT` |
   | Name / Host | `@` (means the root domain; some panels want it blank) |
   | Value / Content | the `google-site-verification=…` string |
   | TTL | default / automatic |

   > Not sure who manages your DNS? Look up `iamahmedfarid.com` on
   > [who.is](https://who.is) — the **Name Servers** line tells you (e.g.
   > `ns1.cloudflare.com` → Cloudflare manages it).

7. Save the record, go back to Search Console, click **Verify**.
   If it fails, wait — DNS can take 10 minutes to a few hours — then retry.

### After it verifies

- **Submit your sitemap:** in the new property → **Sitemaps** → enter
  `sitemap.xml` → Submit. (Your build generates it automatically and it already
  lists all five locales.)
- **Read your data here from now on.** The old `ahmedfarid2.github.io` property
  can be ignored; leave it or remove it, it doesn't matter.
- Give it a few weeks before drawing conclusions — a new property starts empty.

### What to actually look at

Ignore impressions and average position. The useful views are:

- **Performance → Queries:** are people searching your *name*? That means your
  LinkedIn work is driving branded search — the strongest signal a personal
  site can show.
- **Pages:** is `/checklist.html` getting any traffic?
- **Indexing → Pages:** are all five locales indexed, with no errors?

---

## A note on priorities

Search Console is diagnostics, not lead generation. It tells you what already
happened; it doesn't bring anyone in. Do the email form first — that's the one
that compounds.
