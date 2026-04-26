# TokenSave Project State Snapshot

> **⚠️ WARNING — This document is a snapshot, not a permanent source of truth.**
> Always verify state against GitHub (main branch, open issues, open PRs) before acting.
> This file itself may be stale if last updated date is more than 48h ago.
> Do not assume this file reflects current reality.

**Last updated**: 2026-04-26T05:30:00Z
**Source**: GitHub `origin/main` at commit `83cb8ba`

---

## Current Repo State

| Item | Value |
|------|-------|
| Repo | choosenobody/TokenSave |
| Main branch SHA | `83cb8ba` (PR #18 merge) |
| Package manager | npm |
| Build tool | Vite 5 + TypeScript 5 |
| index.html | HTML/CSS shell with module script reference to src/main.ts |
| src/main.ts | 1,228 lines, `@ts-nocheck`, all application logic |
| src/types.ts | 269 lines, domain types (JobStat, RunRecord, Report, etc.) |
| src/utils.ts | 72 lines, 10 pure formatting/string helpers |
| docs/AGENT_RULES.md | Development workflow rules |
| docs/INCIDENTS.md | Incident log |
| docs/PROJECT_STATE.md | This file |
| dist/ | Not committed (gitignored) |
| node_modules/ | Not committed (gitignored) |

---

## Latest Merged PRs

| PR | Title | Merged | Merge Commit |
|----|-------|--------|-------------|
| #18 | I2b.4A: extract 10 formatting/helpers to src/utils.ts | 2026-04-26 | `83cb8ba` |
| #17 | I2b.3: add src/types.ts — type inventory slice | 2026-04-26 | `f696b63` |
| #16 | I2b.1: Migrate inline script to src/main.ts | 2026-04-25 | `0898562` |
| #15 | I1.2: Add project state snapshot document | 2026-04-25 | `d19c4b5` |
| #14 | I2a: Vite + TypeScript scaffold | 2026-04-25 | `69ab3e7` |
| #13 | I1.1 corrective: replace docs with guardian_cat-reviewed versions | 2026-04-24 | `b09754c` |

---

## Completed Increments

| Increment | Issue | PR | Status |
|----------|-------|-----|--------|
| I1 | Remove tracked node_modules and add .gitignore | Direct commit | CLOSED |
| I1.1 | Harden .gitignore + add docs/AGENT_RULES.md + docs/INCIDENTS.md | #13 | CLOSED |
| I1.2 | Add project state snapshot document | #15 | CLOSED |
| I2a | Vite + TypeScript scaffold | #14 | CLOSED |
| I2b.1 | Migrate inline script to src/main.ts | #16 | CLOSED |
| I2b.2 | Post-migration compatibility validation | No-code validation | CLOSED |
| I2b.3 | Add src/types.ts — type inventory slice | #17 | CLOSED |
| I2b.4A | Extract 10 formatting/string helpers to src/utils.ts | #18 | CLOSED |

**I2b overall: IN PROGRESS** (sub-slices I2b.1–I2b.4A complete; I2b.4B, I2b.5, and beyond not yet started)

---

## Active Next Issue

**I2b** — Migrate `index.html` logic into `src/` modules after I2a passes.
See: GitHub Issue #11

**Scope** (structure-preserving refactor only):
- Extract separable logic from `src/main.ts` into `src/` modules
- Preserve all existing behavior (upload, parsing, report, UI)
- Preserve local-only file processing
- Keep Vite build working
- Incremental slices (I2b.1, I2b.2, …)

**Completed I2b sub-slices**: I2b.1 (script migration), I2b.2 (validation refactor), I2b.3 (types), I2b.4A (formatting helpers)

**Next slice**: TBD — pending next-slice recommendation and BG approval.

**Forbidden**: No new features, no new pricing model, no diagnose rules D1-D7, no pre-flight rules B1-B3/W1-W5, no backend, no telemetry.

**Recommended slice order** (from original I2b scope): utilities → constants → parsers → domain logic → UI

---

## Open Issues and Recommended Cleanup Actions

> ⚠️ Do not close or modify issues unless BG explicitly approves. Listed here for reference.

| Issue | Title | Status | Recommended Action |
|-------|-------|--------|-------------------|
| #11 | I2b: Migrate index.html logic into src modules | **OPEN** | **Active next issue.** Do not close. |
| #10 | I2a: Vite + TypeScript scaffold | **OPEN** | **Completed by PR #14.** Recommend: close. |
| #9 | I1.1: Harden .gitignore and add process docs | **OPEN** | **Completed by PR #13.** Duplicate of #12 (both superseded by #13). |
| #8 | I2: Vite + TypeScript scaffold | **OPEN** | **Parent of I2a.** Recommend: close as completed by #10 and #11 (I2a done, I2b active). |
| #7 | I8: README, MVP_SPEC, PRIVACY, SECURITY, RULES docs | OPEN | Future issue. Not yet started. |
| #6 | I7: No-network test and evidence bundle system | OPEN | Future issue. Not yet started. |
| #5 | I6: Rule engine — Pre-flight rules B1-B3 and W1-W5 | OPEN | Future issue. Forbidden until I2b complete. |
| #4 | I5: Rule engine — Diagnose rules D1-D7 | OPEN | Future issue. Forbidden until I2b complete. |
| #3 | I4: Domain layer — pricing data and cost calculation | OPEN | Future issue. Forbidden until I2b complete. |
| #2 | I3: Add parser modules with tests | OPEN | Future issue. Forbidden until I2b complete. |
| #1 | I1: Remove tracked node_modules and add .gitignore | CLOSED | Done. |

---

## Protected Product Constraints

These constraints are **never negotiable** regardless of issue scope:

- **Local-first**: files never leave the device
- **No backend**: zero server-side components
- **No telemetry, analytics, tracking**: zero external data egress
- **No fetch/XMLHttpRequest/sendBeacon**: zero network calls from the app
- **No external LLM calls**: app never calls any LLM API
- **No auto-apply**: fix hints are CLI text only, never executed
- **No runtime write-path**: app does not write any files
- **No API key collection**: zero credential handling
- **node_modules/ in .gitignore**: never commit node_modules
- **No secrets in repo**: zero credentials or tokens in source
- **Unknown model pricing defaults to highest reasonable rate**: never cheap

---

## Recommended Next Step

**Choose next safe I2b slice** (pending BG approval).

Current completed slices (I2b.1–I2b.4A) extracted: inline script, validation logic, types, formatting helpers.

Remaining extraction candidates (unordered):
- **I2b.4B**: Constants — `COST_RATES`, `FIX_LIBRARY`, `FIX_BADGES` → `src/constants.ts`
- **I2b.5**: Parsers — `parseJson`, `parseJsonl`, `parseZipEntries` → `src/parser.ts` (ZIP via native ArrayBuffer parsing, no jszip dependency)
- **I2b.6**: Domain logic — `analyzeDataset`, `classifyWaste`, `detectCostRate`, predicate guards
- **I2b.7**: Render/UI — DOM bindEvents, render functions → `src/render.ts`

Each slice must be PR'd and reviewed independently. Rollback = `git revert <merge-commit>`.

---

## Implementation Agent Assignment (I2b)

| Role | Agent |
|------|-------|
| Implementer | `coding_cat` |
| Reviewer | `guardian_cat` |

**Workflow**: Path B — coding_cat produces patch/diff → Hermes applies to controlled branch → guardian_cat reviews → BG approves → merge.

---

## Validation Checklist (Before Any Merge)

- [ ] `npm run build` succeeds
- [ ] `npm install` succeeds from clean checkout
- [ ] `dist/` not in git history
- [ ] `node_modules/` not in git history
- [ ] No network calls in product code
- [ ] No new features added
- [ ] `index.html` behavior unchanged
- [ ] guardian_cat returned PASS
- [ ] BG approved merge

---

*This document was created to eliminate stale-memory dependency for future agents. Verify, don't trust.*
