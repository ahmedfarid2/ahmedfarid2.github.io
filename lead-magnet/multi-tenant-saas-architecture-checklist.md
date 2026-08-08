# The Multi-Tenant SaaS Architecture Checklist

**The decisions you can't cheaply undo six months later.**

By Ahmed Farid — Senior Software Engineer · [iamahmedfarid.com](https://iamahmedfarid.com)

---

Most multi-tenant SaaS rewrites don't happen because the code was bad. They
happen because a boundary was drawn wrong on day one — and by the time it hurts,
it's load-bearing. This is the checklist I actually run before writing a single
screen, distilled from shipping multi-tenant platforms across the Gulf, US, and
UK.

Use it as a pre-build gate. If you can't answer a question, that's the next
conversation to have — not the next feature to build.

---

## 1. Tenancy model — decide before anything else

- [ ] **Isolation strategy chosen and written down:** shared schema (tenant_id
      column), schema-per-tenant, or database-per-tenant. Each has a different
      blast radius and cost curve.
- [ ] **Tenant resolution path defined:** subdomain, path, header, or token
      claim — and where in the request lifecycle it resolves (middleware, not
      controllers).
- [ ] **Every query is tenant-scoped by default**, not by developer discipline.
      A global scope / query filter that fails *closed* (no tenant = no data).
- [ ] **The "noisy neighbor" question answered:** can one tenant's load or data
      volume degrade another's experience? What's the ceiling?
- [ ] **Cross-tenant admin access is a separate, audited path** — never the same
      code path as tenant users.

## 2. Identity, roles & access

- [ ] **Roles modeled as first-class concepts**, not booleans that multiply.
- [ ] **Separate auth guards** for the distinct actor types (e.g. admin /
      company / customer) rather than one overloaded user table.
- [ ] **Permission checks centralized** (policy layer), not sprinkled in views.
- [ ] **Tenant + role together** decide access — a valid user in the wrong
      tenant sees nothing.
- [ ] **Impersonation / support access** is logged, time-boxed, and reversible.

## 3. Data & billing awareness

- [ ] **Billing is a first-class concept in the data model** from day one —
      plans, limits, usage, and the seams to meter them.
- [ ] **Usage-limiting is enforceable** (seats, API calls, storage) without a
      schema migration later.
- [ ] **Schema designed first, indexes second** — but the indexes that matter at
      scale (tenant_id composites) are identified now.
- [ ] **Soft-delete and data-retention policy** decided per entity (compliance
      and "undo" both depend on it).
- [ ] **Tenant data export & deletion** is possible (GDPR/offboarding) without a
      manual DBA operation.

## 4. Real-time & concurrency (if applicable)

- [ ] **The server is the single source of truth** for ordering — never the
      client. (Lost updates and double-winners come from client-decided order.)
- [ ] **Atomic operations** for contended state (e.g. Redis atomic increments
      for counters, bids, inventory).
- [ ] **A push layer** (WebSocket/SSE) mirrors state to watchers — with a
      defined latency target you actually measure.
- [ ] **Idempotency keys** on anything that can be retried (payments, webhooks).
- [ ] **Backpressure & reconnection** handled — what happens when 200 clients
      reconnect at once?

## 5. Integrations & money

- [ ] **Payment gateway(s) chosen per region** — and abstracted behind one
      interface so a second gateway isn't a rewrite.
- [ ] **Webhooks are verified, idempotent, and queued** — never processed
      inline on the request thread.
- [ ] **ERP/CRM sync direction defined** (one-way vs bidirectional) and
      conflict resolution decided *before* the first sync.
- [ ] **External calls have timeouts, retries, and a circuit breaker** — a slow
      third party can't take your app down.

## 6. Delivery & operations

- [ ] **Deploy topology decided:** environments (alpha/beta/prod), and a
      pipeline that survives a Friday deploy.
- [ ] **Migrations are safe to run by someone who isn't you, at 2 a.m.**
      (reversible, non-locking where it counts).
- [ ] **Observability from v1:** structured logs, error tracking, and the 3–5
      metrics that tell you the system is healthy.
- [ ] **Feature flags** so vertical slices ship early and dark.
- [ ] **A runbook exists** — the handoff is part of the work, not an afterthought.

## 7. The "can't cheaply undo" list — get these right on day one

1. Tenant isolation strategy
2. Auth/guard structure
3. Billing in the data model
4. Server-authoritative real-time ordering
5. API contract & versioning
6. Deployment topology

Everything else you can refactor. These six, you live with.

---

### Want a second pair of eyes on yours?

I do architecture reviews and fixed-scope builds for real-time, multi-tenant
SaaS. A 30-minute scoping call is free — and often saves a six-month rewrite.

→ **[Book a call at iamahmedfarid.com](https://iamahmedfarid.com)**
→ LinkedIn: [Ahmed Farid](https://www.linkedin.com/in/ahmed-farid-b46a5221b/)

_© 2026 Ahmed Farid._
