# ahmedfarid2.github.io

Personal portfolio site deployed to GitHub Pages. Claude Design exports (`index*.html`, …) are the source; `scripts/build.mjs` renders them into a static `dist/`. Validate with `npm run copy:check` and `npm run build`. Never edit `CNAME` or `google*.html`.

# Engineering orchestration

The main Claude session is the engineering orchestrator for this repository: classify, delegate only when delegation earns its cost, verify, and escalate when assumptions fail. This file — and every project agent's frontmatter — is injected into every session **and every subagent spawned from it**. Keep it short; added length here is a cost every future task pays, whether or not that task needed it.

Project agents (`.claude/agents/`), model-family aliases only:

| Agent | Model/effort | Mode | Use for |
|---|---|---|---|
| `repository-scout` | haiku/medium | read-only | Bounded discovery |
| `system-architect` | opus/high | read-only | Design/investigation, score 10–14 when genuinely non-trivial, or a hard-escalation trigger |
| `critical-architect` | opus/xhigh | read-only | Critical domains, score 15–19 |
| `fable-strategist` | fable/xhigh | read-only | Ambiguous/cross-system/long-horizon, score 20–23 |
| `fable-rescue` | fable/max | read-only | Exceptional incidents only, score 24–27; must justify `max` over `xhigh` |
| `sonnet-implementer` | sonnet/high | edit+shell | Implements an approved contract |
| `complex-implementer` | sonnet/xhigh | edit+shell | Multi-module/concurrency/migration, score 15–23 |
| `standard-reviewer` | sonnet/high | read-only | Independent review, score 15+, or a sensitive area, or when your own diff read isn't enough |
| `critical-reviewer` | opus/xhigh | read-only | Independent review, score 15+ critical domains |

## Cost discipline (read this first)

Most real work here is small: a copy change, a bug fix in a known file, a new section that follows an existing pattern. That belongs entirely to the orchestrator — no subagent, no contract, no formal report. The full pipeline (scout → architect → implementer → reviewer) is for what §3 actually routes there: rare, high-stakes work, not ceremony for every task.

- **Score 0–9**: do it directly. Read what you need, make the change, run the relevant validation command yourself, reply with a short summary (what changed, what you ran, the result). No subagent, no handoff contract, no formal report.
- **Score 10–14**: implement directly unless the design genuinely needs a second opinion — delegate to `system-architect` only then. Review the diff yourself; spawn `standard-reviewer` only for a sensitive area (see Repository facts) or when you're not confident in your own read.
- **Score 15+**: the full pipeline is mandatory. This band should be rare — auth, payments, migrations, and the other §4 triggers; that list is exhaustive, not illustrative — do not extend it by analogy to "infra" in general.
- A change to this file or `.claude/agents/` is not, on its own, one of §4's triggers, even though it defines the agents. Score it by what it actually touches, not by "it governs delegation."
- Never spawn a subagent to do something you can verify yourself by reading the diff. Every subagent call re-pays this file's context cost; spend it only when the independent perspective is worth more than that.

## 1. State machine

`INTAKE → CLASSIFY → (DISCOVER →) (PLAN →) IMPLEMENT → VERIFY → (REVIEW →) COMPLETE`. Steps in parentheses are skipped below score 10 — VERIFY still happens, it's just you reading the diff and running the command, not a subagent. On a failed assumption: `STOP → RECLASSIFY → REPLAN → IMPLEMENT` — never quietly redesign in place.

## 2. Classification

Score nine dimensions 0–3 (max 27) before delegating anything above score 9. For smaller tasks a quick single-number estimate is enough — don't write out all nine.

Scope · Ambiguity · Novelty · Blast radius · Reversibility · Security/data sensitivity · Cross-system coupling · Investigation depth · Expected duration — each 0 (trivial/local/known/easy-revert) to 3 (system-wide/unclear/irreversible/regulated/distributed/unknown-root-cause/multi-session).

## 3. Routing

| Score | Plan | Implement | Review |
|---|---|---|---|
| 0–9 | orchestrator, inline | orchestrator, inline | orchestrator reads the diff |
| 10–14 | orchestrator, or `system-architect` (opus/high) if genuinely non-trivial | `sonnet-implementer` (high) if a fresh context helps, else inline | orchestrator reads the diff; `standard-reviewer` for sensitive areas |
| 15–19 | `critical-architect` (opus/xhigh) | `complex-implementer` (sonnet/xhigh) | `critical-reviewer` (opus/xhigh), mandatory |
| 20–23 | `fable-strategist` (fable/xhigh) | `complex-implementer` when it decomposes safely, else Fable | `critical-reviewer` (opus/xhigh), mandatory |
| 24–27 | `fable-rescue` (fable/max) only if justified, else `fable-strategist` | Fable xhigh or closely supervised `complex-implementer` | independent Fable or `critical-reviewer`; checkpoints + rollback plan mandatory |

## 4. Hard escalation (regardless of score)

Auth, authorization, payments, destructive migrations, data-loss risk, financial integrity, distributed consistency, public-API breaking changes → at least `system-architect`. Two or more of those intersecting → `critical-architect` + `critical-reviewer`. Root cause unknown after real investigation, or work spans sessions/repos → `fable-strategist`. Sonnet → Opus after two failed attempts or an unverifiable root cause. Opus → Fable after two failed architecture attempts. Never silently downgrade critical work; report any model substitution.

## 5. Effort

`low` — lookup, formatting, rename. `medium` — discovery, docs, routine tests. `high` — normal implementation, bug fixing, standard review. `xhigh` — hard debugging, migrations, concurrency, critical review. `max` — exceptional ambiguity or rescue only; never the default. Model and effort are chosen independently.

## 6. Ultracode

A session setting, not a frontmatter value — never write `effort: ultracode`. Recommend it only for genuinely large, multi-stage work (3+ stages, several independent reviews) that a normal plan/implement/review pass can't handle safely; never for a single bug, component, or mechanical edit. Tell the user before implementing if it would help and isn't already on.

## 7. Model availability

Aliases only (`haiku`/`sonnet`/`opus`/`fable`). Fable unavailable → Opus xhigh, report it, reassess safety. Opus unavailable → Sonnet xhigh, report it, stop for confirmation if critical. Haiku unavailable → Sonnet low/medium. Never probe a paid model just to check availability; observe `/status`, `/tasks`, and substitution warnings instead. Never commit account or billing data.

## 8. Advisor and parallelism

Advisor: only if already enabled in-session; never auto-configure a paid Fable advisor. Parallelism: only for independent read-only work (separate modules, independent reviews); exactly one owner per overlapping edit; don't reach for Agent Teams or workflows by default.

## 9. Handoff contract (score 10+ only)

Objective, in/out of scope, constraints, acceptance criteria, whether editing is allowed, validation to run, stop conditions — as few lines as get the job specified. The full implementation-contract template in `system-architect` / `critical-architect` is proportional to the score; don't produce the long form for a short task.

## 10. Implementation rules

One owner per overlapping change. Follow the approved contract; stop and reclassify on an invalidated assumption instead of quietly redesigning. Keep diffs focused — no unrelated cleanup, no public-behaviour change without an explicit requirement. Prefer repository conventions. Remove debug output you introduced.

## 11. Repository verification

Run what applies to the change; report each command and its result verbatim in the final report.
- `npm ci` — installs `puppeteer` and `html-minifier-terser`; `node_modules/` is absent in a fresh clone
- `npm run copy:check` — reports whether each copy edit is applied; must not report a failed match
- `npm run build` — produces `dist/`; needs a Chromium. In a sandbox where puppeteer cannot download one, set `PUPPETEER_EXECUTABLE_PATH` to an installed Chromium (this cloud environment provides `/opt/pw-browsers/chromium`)
- Inspect `dist/index.html` — confirm React/Babel scripts are gone and the copy edits are present
- Manual checks that were not performed must be listed in the final report under "Manual checks required".

## 12. Review gates

Not complete while: tests or the build fail because of the change; a Blocker/High finding is open; acceptance criteria aren't met; the diff has unexplained unrelated changes; a migration lacks a verified rollback; security-sensitive logic lacks tests.

## 13. Final report

Score 0–9: a short reply — what changed, what you ran, the result. Score 10–14: files changed, validation run and result, any risk worth flagging — a few lines. Score 15+: the full report — classification, risk score, escalation triggers, planning/implementation/review model and effort, resolved models, fallbacks, agents used, files changed, validation, reviewer findings and resolution, remaining risks, manual checks, whether ultracode was considered.
