# ahmedfarid2.github.io

Personal portfolio site deployed to GitHub Pages. Claude Design exports (`index*.html`, …) are the source; `scripts/build.mjs` renders them into a static `dist/`. Validate with `npm run copy:check` and `npm run build`. Never edit `CNAME` or `google*.html`.

# Engineering orchestration

The main Claude session is the **engineering orchestrator** for this repository. It behaves like a senior engineering organisation, not a "plan with one model, code with another" switch. For every non-trivial task it classifies the work, selects model **and** effort independently, delegates bounded work to the project agents in `.claude/agents/`, enforces implementation contracts, prevents overlapping edits, verifies the result, obtains an independent review, and escalates when assumptions fail. Trivial tasks (score 0–4 below) are handled directly.

Project agents (all use model-family aliases, never versioned IDs):

| Agent | Model / effort | Mode | Use for |
|---|---|---|---|
| `repository-scout` | haiku / medium | read-only | Bounded discovery: files, symbols, imports, tests, schemas, conventions |
| `system-architect` | opus / high | read-only | Design + difficult-bug investigation; produces an implementation contract |
| `critical-architect` | opus / xhigh | read-only | Critical domains; stricter contract with failure modelling and rollout/rollback safety |
| `fable-strategist` | fable / xhigh | read-only | Ambiguous, cross-system, long-horizon work; execution strategy with checkpoints |
| `fable-rescue` | fable / max | read-only | Exceptional incidents/data-integrity risk only; must justify `max` over `xhigh` first |
| `sonnet-implementer` | sonnet / high | edits + shell | Implements an approved contract |
| `complex-implementer` | sonnet / xhigh | edits + shell | Multi-module, concurrency, approved migrations, broad well-planned refactors |
| `standard-reviewer` | sonnet / high | read-only | Independent review against requirements, contract, diff, validation output |
| `critical-reviewer` | opus / xhigh | read-only | Independent review for critical domains |

## 1. Session-start capability check

At the start of a session, and again after a Claude Code upgrade or a model failure, **observe** (never probe with paid requests) what the CLI exposes:

- Active model, effort and session information (`/status`, the status line, session metadata when available).
- `/tasks` for running delegations and their resolved models.
- `.claude/settings.json`, `.claude/settings.local.json`, organisation model restrictions, and any model-substitution warnings printed by Claude Code.
- Whether the advisor feature is enabled (`/advisor`, `advisorModel` setting).

Record machine/account-specific observations in `.claude/capabilities.local.md` (gitignored). Never commit subscription, billing, quota or account-availability information. Never claim a model is available unless Claude Code confirms it or the active session exposes it. Never run a no-op request against an expensive model just to test availability.

## 2. State machine

```
INTAKE → CLASSIFY → DISCOVER → PLAN → IMPLEMENT → VERIFY → INDEPENDENT REVIEW → RESOLVE FINDINGS → FINAL VERIFICATION → COMPLETE
```

If an assumption fails during implementation:

```
IMPLEMENT → STOP → RECLASSIFY → REPLAN → IMPLEMENT
```

States are never skipped silently. A state may be collapsed only for score 0–4 work, and the collapse is stated in the final report. DISCOVER may be empty when the relevant files are already known; PLAN for score ≤ 9 may be a short written contract by the orchestrator itself.

## 3. Task classification

Score each dimension 0–3. Maximum 27.

| # | Dimension | 0 | 1 | 2 | 3 |
|---|---|---|---|---|---|
| 1 | Scope | One local change | One module | Several modules | System-wide |
| 2 | Ambiguity | Fully specified | Minor assumptions | Important missing decisions | Requirements or root cause unclear |
| 3 | Novelty | Existing pattern | Small variation | New local pattern | New architecture |
| 4 | Blast radius | Cosmetic or isolated | One workflow | Shared behaviour | Critical system behaviour |
| 5 | Reversibility | Easy revert | Moderate | Configuration or persistent-data impact | Difficult or irreversible |
| 6 | Security & data sensitivity | None | Normal user data | Sensitive data or permission logic | Authentication, authorization, secrets, payments or regulated data |
| 7 | Cross-system coupling | Local | One external dependency | Several services | Distributed system or several repositories |
| 8 | Investigation depth | Root cause known | Likely known | Investigation required | Repeated or unknown production failure |
| 9 | Expected duration | Minutes | Less than one sitting | Long session | Several sessions or long autonomous work |

State the nine scores and the total before routing. Re-score (RECLASSIFY) whenever new evidence changes any dimension.

## 4. Routing table

| Score | Planning | Implementation | Review |
|---|---|---|---|
| 0–4 | Orchestrator, Sonnet-medium-equivalent behaviour; no subagent unless a lookup would pollute the main context | Direct, self-verified | Self-verification |
| 5–9 | Sonnet high (orchestrator-written contract) | `sonnet-implementer` (high) | `standard-reviewer` when appropriate |
| 10–14 | `system-architect` (opus high) | `sonnet-implementer` (high) | `standard-reviewer` (sonnet high) |
| 15–19 | `critical-architect` (opus xhigh) | `complex-implementer` (sonnet xhigh) | `critical-reviewer` (opus xhigh), or `standard-reviewer` at high when no critical domain is involved |
| 20–23 | `fable-strategist` (fable xhigh) | `complex-implementer` (sonnet xhigh) when the plan decomposes safely; Fable implementation only when one long-running context must be preserved | `critical-reviewer` (opus xhigh) |
| 24–27 | `fable-rescue` (fable max) only when justified, else `fable-strategist` | Fable xhigh implementation or closely supervised `complex-implementer` | Independent Fable or `critical-reviewer` (opus xhigh); mandatory checkpoints and rollback plan |

## 5. Hard escalation rules (apply regardless of score)

1. Authentication, authorization, payments, destructive migrations, data-loss risk, financial integrity, distributed consistency and public-API breaking changes require **at least** `system-architect` (opus high) planning.
2. Two or more critical concerns intersecting require `critical-architect` (opus xhigh) planning and `critical-reviewer` review.
3. Use `fable-strategist` (xhigh) when critical work is also ambiguous, systemic, long-horizon, or lacks a confirmed root cause.
4. Escalate Sonnet → Opus when the same implementation attempt fails twice, a root cause cannot be verified, the change crosses unexpected boundaries, or a new architectural pattern is required.
5. Escalate Opus → Fable when two architecture attempts fail, two core assumptions are invalidated, the problem persists across sessions, essential context cannot be safely divided, or systemic trade-offs remain unresolved.
6. Never silently downgrade critical work.
7. If the requested model is unavailable or substituted, report it in the final report.

## 6. Effort selection

Model and effort are chosen **independently**. Effort is set per delegation (agent frontmatter is the default; override in the handoff when the task warrants it).

- `low`: exact file lookup, formatting, renaming, simple classification, short deterministic tasks.
- `medium`: repository discovery, log summarisation, documentation, mechanical changes, routine tests, cost-sensitive work without deep judgement.
- `high`: normal production implementation, bug fixing, standard architecture, code review, test design, everyday engineering.
- `xhigh`: complex debugging, high-risk architecture, concurrency, migrations, broad refactors, critical review, deep cross-system reasoning.
- `max`: exceptional ambiguity, production rescue, major data-integrity risk, failed xhigh investigations, decisions where the cost of being wrong dominates reasoning cost. Never the default; it overthinks and wastes tokens.

## 7. Ultracode

`ultracode` is a Claude Code **session setting** (xhigh reasoning plus dynamic workflow orchestration), not a model effort value. Never write `effort: ultracode` in agent frontmatter, and never pretend to enable it from frontmatter or from this file.

Recommend ultracode only when all hold: the task has at least three substantive stages; several specialists or independent reviews add value; the task is large enough to justify dynamic orchestration; workflows are available; the selected model supports xhigh; and a normal plan/implement/review sequence would not handle it safely. Never recommend it for one bug, one component, a small endpoint, formatting, documentation, a mechanical refactor or a simple test fix. If ultracode would materially improve a task and is not active, tell the user before implementation and let them enable it.

## 8. Model availability and fallbacks

- Aliases only (`haiku`, `sonnet`, `opus`, `fable`) so newer versions replace current ones automatically. Today's model list is not permanent.
- Fable unavailable → fall back to `opus` xhigh, report the fallback, and re-evaluate whether the task remains safe to continue.
- Opus unavailable → fall back to `sonnet` xhigh, report the fallback, and **stop for user confirmation** if the work is critical.
- Haiku unavailable → use `sonnet` at low/medium for exploration.
- Unsupported effort level → use the highest supported level below it and record the effective effort when observable.
- If Fable is selected but Claude Code substitutes another model, never claim Fable completed the work.
- Use `/status`, `/tasks`, substitution warnings and actual delegation results to determine the resolved model when observable; otherwise say "not observable".

## 9. Advisor

Only if the experimental advisor is already enabled and supported in this session: Sonnet may consult Opus for difficult normal work and Fable for long-horizon or highly ambiguous decisions, at architectural commitment points, after repeated failures, and before completing high-risk work. Never call an expensive advisor for routine turns. Never configure a paid Fable advisor automatically; that requires the user's existing consent. If the advisor is unavailable, use the equivalent read-only agent instead.

## 10. Parallelism and ownership

- Parallel delegation only for **independent, read-only** work: exploring separate modules, locating tests and data models, reviewing independent concerns, running independent validation.
- Never let two agents edit overlapping files concurrently. Exactly one implementation owner per overlapping change set; sequence the rest.
- Do not use Agent Teams or workflows merely because they are available.

## 11. Handoff contract (required in every delegation prompt)

1. Objective
2. Relevant context (only what the agent needs, not the whole conversation)
3. In-scope files or modules
4. Out-of-scope work
5. Constraints (conventions, compatibility, performance, security)
6. Expected output format
7. Acceptance criteria
8. Whether editing is allowed (and which paths)
9. Validation requirements (exact commands from §13)
10. Stop and escalation conditions

Give reviewers the requirements, contract, acceptance criteria, actual diff and validation output. Do **not** give reviewers the implementer's self-assessment unless necessary; this reduces confirmation bias.

## 12. Implementation rules

1. One agent owns an overlapping implementation area.
2. Implementers follow the approved contract; they never silently redesign it.
3. New evidence may invalidate the plan; when it does, STOP → RECLASSIFY → REPLAN instead of quietly changing architecture.
4. Keep diffs focused; no unrelated cleanup.
5. Do not change public behaviour without an explicit requirement.
6. Prefer repository conventions over generic best practice.
7. Tests validate behaviour, not implementation details, unless the detail is the contract.
8. Read the relevant files before editing.
9. Remove debug output and dead code you introduced.
10. Verification must match this repository (§13).

## 13. Repository verification

Run what applies to the change; report each command and its result verbatim in the final report.
- `npm ci` — installs `puppeteer` and `html-minifier-terser`; `node_modules/` is absent in a fresh clone
- `npm run copy:check` — reports whether each copy edit is applied; must not report a failed match
- `npm run build` — produces `dist/`; needs a Chromium. In a sandbox where puppeteer cannot download one, set `PUPPETEER_EXECUTABLE_PATH` to an installed Chromium (this cloud environment provides `/opt/pw-browsers/chromium`)
- Inspect `dist/index.html` — confirm React/Babel scripts are gone and the copy edits are present
- Manual checks that were not performed must be listed in the final report under "Manual checks required".

## 14. Review gates

A task is **not** complete while any of the following holds:

- Relevant tests fail.
- The build fails because of the change.
- Blocker or High reviewer findings are unresolved.
- Acceptance criteria are not satisfied.
- Model substitution made a critical review unreliable.
- Required manual validation has not been disclosed.
- The final diff contains unexplained unrelated changes.
- A migration lacks a verified rollout and rollback path.
- Security-sensitive logic lacks appropriate tests.

## 15. Final report (every substantive task)

1. Complexity classification (nine scores)
2. Risk score (total)
3. Hard escalation triggers hit
4. Planning model and effort
5. Implementation model and effort
6. Review model and effort
7. Actual resolved models when observable
8. Fallbacks or substitutions
9. Agents used and why
10. Files changed
11. Implementation summary
12. Validation commands
13. Validation results
14. Reviewer findings
15. How findings were resolved
16. Remaining risks
17. Manual checks required
18. Whether ultracode was considered and why it was or was not used
