# Community Playbook — Borrowing Other People's Audiences

LinkedIn reaches people who already follow you. Communities reach people who
don't. This is where to go, how to behave, and drafted answers you can adapt.

**The one rule:** answer as a practitioner, never as a seller. No links, no
"DM me," no pitch. A good answer earns the profile click; your profile does the
selling. Every one of these communities will punish you for the alternative.

**These drafts are starting points, not copy-paste.** They're built from your
real projects, but the thread you're answering will have specifics. Adapt them,
cut what doesn't apply, and answer the actual question asked. A generic answer
pasted into a specific thread reads exactly like what it is.

---

## Where to go

| Community | Who's there | Self-promo rules |
|---|---|---|
| **r/SaaS** | Founders building SaaS — your buyers | Strict. Answer only; links get removed |
| **r/laravel** | Laravel devs, some CTOs | Relaxed, but pitching is frowned on |
| **r/flutterdev** | Mobile devs and founders | Relaxed; showcase threads allowed |
| **r/ExperiencedDevs** | Senior engineers, tech leads | Very strict. High-quality answers only |
| **r/webdev** | Broad; huge reach | Strict on self-promo |
| **Indie Hackers** | Solo founders, small teams | Friendly; a profile link is fine |
| **Dev.to / Hashnode** | Devs reading tutorials | Republishing your own content is expected |
| **Hacker News** | Technical founders, CTOs | Brutal on marketing, generous to depth |
| **Arabic dev Discord/Telegram** | Gulf/Egypt devs | Little senior presence — your opening |

**Start with two.** r/SaaS (buyers) and r/laravel (peers who refer work). Adding
more before you have a rhythm just spreads you thin.

## Cadence

15 minutes a day. Sort by **New**, answer 2–3 threads where you have real
experience. Skip anything you'd have to research — that's the tell.

Fill your profile out first: bio line naming what you build, and your site link.
That's the only "promotion" you need.

---

## Drafted answers to recurring questions

These questions come up constantly. Each draft is grounded in something you
actually built.

### Q: "Should I use one database per tenant, or a shared schema?"

```
Depends on one question: what's your blast radius tolerance, and who's paying
for it?

Shared schema with a tenant_id column is the cheapest to run and the easiest to
migrate — one migration, one connection pool. The risk is that a single missing
WHERE clause leaks data across tenants. You mitigate that by making tenant
scoping automatic (a global scope / query filter) rather than something each
developer remembers. It should fail closed: no tenant context = no rows.

Database-per-tenant gives you hard isolation and easy per-tenant restores, and
it's often what enterprise customers' security reviews want to hear. The cost is
operational: migrations run N times, connection pools multiply, and your
deployment story gets meaningfully harder.

Schema-per-tenant sits in the middle and in my experience is the least pleasant
of the three — you inherit most of the operational cost without the full
isolation benefit.

For most startups I'd start with shared schema and automatic scoping, and only
move a specific customer to their own database when a contract requires it.
Design the tenant resolution layer so that switch is possible later — that's the
part that's expensive to retrofit.
```

### Q: "How do I stop race conditions in real-time bidding / booking / inventory?"

```
The core rule is that the server has to be authoritative for ordering. If the
client decides sequence, you will get lost updates under load — it's not a
question of if.

On a vehicle auction platform I worked on, dozens of bidders would hit the same
lot in the final seconds. What made it correct:

- Contended state (the current bid) lived in Redis with atomic increments, so
  two simultaneous bids could never both read the same "current" value
- The server assigned ordering and rejected anything stale; clients only ever
  rendered what the server confirmed
- A push layer mirrored the confirmed state to every watcher, so nobody was
  acting on a stale view
- Anything retryable (payments, webhooks) carried an idempotency key

For booking specifically, the equivalent is locking the resource before you
re-check for conflicts, rather than checking then writing. Check-then-act is
where the bug lives.

Whatever you build, load-test it with concurrent writers before you trust it.
Race conditions don't show up with one user clicking around.
```

### Q: "Laravel or Node for a multi-tenant SaaS?"

```
Either works. The tenancy model matters far more than the language.

I've shipped multi-tenant platforms on Laravel and used Node specifically for
the real-time layer, which is a reasonable split: Laravel for the domain,
migrations, queues and admin surface; a small Node/Socket.IO service for the
websocket fan-out. That's not indecision, it's using each for what it's good at.

What actually decides the outcome:

- Is tenant scoping automatic or left to developer discipline?
- Are roles first-class concepts, or booleans that multiply?
- Is billing in the data model from day one?
- Can migrations be run safely by someone who isn't you?

I've seen well-designed Laravel SaaS scale fine, and I've seen Node SaaS
collapse under bad tenancy design. Pick the one your team can operate at 2am.
```

### Q: "How do I structure roles/permissions for a B2B app?"

```
Two things that saved me repeatedly:

1. Separate auth guards per actor type rather than one overloaded users table.
   Admin, company/operator, and end customer have genuinely different lifecycles
   and claims. Cramming them together produces permission checks full of special
   cases.

2. Tenant and role together decide access, never role alone. A valid user
   presenting a valid role for the wrong tenant should see nothing at all — not
   an empty list, but a hard denial at the query layer.

Centralise checks in a policy layer. The moment permission logic appears inside
views or controllers, it drifts, and you can't answer "who can see this?"
without reading the whole codebase.

Also: make support impersonation a separate, logged, time-boxed path. You will
need it, and you don't want it going through the same code as normal auth.
```

### Q: "How do you handle payments across multiple countries?"

```
Assume from day one that you'll need more than one gateway, and put them behind
a single interface.

I've shipped with PayFort in the Gulf, Fawry and Fawaterak in Egypt,
MyFatoorah in Qatar, plus Stripe and PayPal. There's no universal option — local
payment habits differ (cash on delivery is still significant in some markets,
and completely absent in others).

The expensive mistake is wiring one gateway's SDK directly through your
checkout. Then the second market means touching your entire order flow. Define
your own payment interface — authorize, capture, refund, webhook-verify — and
implement it per provider.

And treat webhooks as untrusted, idempotent, and queued. Never process them
inline on the request thread.
```

### Q: "Is it worth building white-label / multi-tenant instead of separate apps?"

```
The test I use: are you about to build the same thing for the third time?

We had a case with a dozen-plus independent pharmacies in the US and UK, each
wanting their own branded patient app and storefront. Building twelve products
was never viable — no one client could justify a dedicated engineering line.

So it became one white-label platform: a new tenant launches with its own
client_id, branding, hours and storefront, and every patient request routes back
to that specific pharmacy automatically.

The trade is real though. Multi-tenancy makes the first customer slower to ship
and every customer after that dramatically faster. If you're not confident
there's a third customer, build the single-tenant version and keep the seams
clean.

Multi-tenancy is a business model decision that happens to be implemented in
code — not a technical preference.
```

---

## Turning answers into conversations

Someone replies "this is exactly our problem" — that's your opening. Don't pitch
in the thread. Reply helpfully once more, then:

> Happy to go deeper if useful — feel free to DM.

Let them come to you. On Reddit especially, the person who helps and doesn't
sell is the one people remember and message later.

## Where this content also goes

Every answer you write here is 80% of a LinkedIn post. Answer on Reddit in the
morning, reshape it for LinkedIn (English and Arabic) in the evening. One piece
of thinking, three audiences.

---

## Further reading on the topic itself

Useful for seeing how others frame multi-tenancy publicly — and where the gaps
are that you could write into:

- [Shared Resources, Isolated Data: The Power of Multi-Tenant SaaS](https://dev.to/ioweb_961ddefd53bd65fce97/shared-resources-isolated-data-the-power-of-multi-tenant-saas-388) — DEV Community
- [Building Multi-Tenant SaaS as a Solo Developer](https://dev.to/pipipi-dev/building-multi-tenant-saas-as-a-solo-developer-1pi9) — DEV Community
- [Multi-Tenant Architecture: A Complete Guide](https://dev.to/tak089/multi-tenant-architecture-a-complete-guide-basic-to-advanced-119o) — DEV Community

Note how general these are. None of them are written by someone who has shipped
nine of these to production across three regions. That's the gap you write into.
