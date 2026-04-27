# TokenSave Project State Snapshot

> **⚠️ WARNING — This document is a snapshot, not a permanent source of truth.**
> Always verify state against GitHub (main branch, open issues, open PRs) before acting.
> This file itself may be stale if last updated date is more than 48h ago.
> Do not assume this file reflects current reality.

**Last updated**: 2026-04-27T07:58:00Z
**Source**: GitHub `origin/main` at commit `6d974e2` (PR #32 hotfix)

---

## Current Repo State

| Item | Value |
|------|-------|
| Repo | choosenobody/TokenSave |
| Main branch SHA | `6d974e2` (PR #32 hotfix merge) |
| Package manager | npm |
| Build tool | Vite 5 + TypeScript 5 |
| index.html | HTML/CSS shell with module script reference to src/main.ts |
| src/main.ts | ~950 lines, `@ts-nocheck`, application logic (ingest/aggregation/report/UI/fix-card helpers; utils/constants/parser/domain helpers extracted; detectCostRate remains in main) |
| src/parser.ts | 126 lines, parseJson / parseJsonl / parseZipEntries + private ZIP helpers |
| src/constants.ts | 61 lines, COST_RATES / FIX_LIBRARY / FIX_BADGES |
| src/types.ts | 269 lines, domain types (JobStat, RunRecord, Report, etc.) |
| src/domain.ts | ~147 lines, 11 exported pure helpers (8 predicates + classifyWaste + buildFixSuggestion + normalizeJobs), imports stringify/normalizeKey/slugify from utils |
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
| #32 | I2b.6D-H: fix normalizeJobs utils imports | 2026-04-27 | `6d974e2` |
| #31 | I2b.6D-S: refresh docs/PROJECT_STATE.md after PR #30 (#31) | 2026-04-26 | `34f88f5` |
| #28 | I2b.6C: extract buildFixSuggestion to src/domain.ts | 2026-04-26 | `7655f15` |
| #27 | I2b.6B-S: refresh docs/PROJECT_STATE.md after PR #26 | 2026-04-26 | `c7e9cd0` |
| #26 | I2b.6B: extract classifyWaste to src/domain.ts | 2026-04-26 | `5b5111d` |
| #25 | I2b.6A-S: refresh docs/PROJECT_STATE.md after PR #24 | 2026-04-26 | `dd65cf3` |
| #24 | I2b.6A: extract predicate helpers to src/domain.ts | 2026-04-26 | `018b0cb` |
| #23 | I2b.5-S: refresh docs/PROJECT_STATE.md after PR #22 | 2026-04-26 | `b806005` |
| #22 | I2b.5: extract parser helpers to src/parser.ts | 2026-04-26 | `3cdad15` |
| #20 | I2b.4B: extract constants to src/constants.ts | 2026-04-26 | `df6a250` |
| #19 | I2b.4S: refresh docs/PROJECT_STATE.md after I2b.4A | 2026-04-26 | `ccf3232` |
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
| I2b.4S | Refresh docs/PROJECT_STATE.md after I2b.4A | #19 | CLOSED |
| I2b.4B | Extract COST_RATES / FIX_LIBRARY / FIX_BADGES to src/constants.ts | #20 | CLOSED |
| I2b.4B-S | Refresh docs/PROJECT_STATE.md after I2b.4B | #21 | CLOSED |
| I2b.5 | Extract parseJson / parseJsonl / parseZipEntries and ZIP parser helpers to src/parser.ts | #22 | CLOSED |
| I2b.5-S | Refresh docs/PROJECT_STATE.md after I2b.5 | #23 | CLOSED |
| I2b.6A | Extract extractTokenCount / isErrorRecord / isExecType / isSimpleCheck / isJobLike / isRunLike / isMetaLike / readBoolean to src/domain.ts | #24 | CLOSED |
| I2b.6A-S | Refresh docs/PROJECT_STATE.md after PR #24 | #25 | CLOSED |
| I2b.6B | Extract classifyWaste to src/domain.ts | #26 | CLOSED |
| I2b.6B-S | Refresh docs/PROJECT_STATE.md after PR #26 | #27 | CLOSED |
| I2b.6C | Extract buildFixSuggestion to src/domain.ts | #28 | CLOSED |
| I2b.6C-S | Refresh docs/PROJECT_STATE.md after PR #28 | #29 | CLOSED |
| I2b.6D | Extract normalizeJobs to src/domain.ts | #30 | CLOSED |
| I2b.6D-S | Refresh docs/PROJECT_STATE.md after PR #30 | #31 | CLOSED |
| I2b.6D-H | Fix normalizeJobs missing utils imports (normalizeKey/slugify) | #32 | CLOSED |

**I2b overall: IN PROGRESS** (sub-slices I2b.1, I2b.2, I2b.3, I2b.4A, I2b.4S, I2b.4B, I2b.4B-S, I2b.5, I2b.5-S, I2b.6A, I2b.6A-S, I2b.6B, I2b.6B-S, I2b.6C, I2b.6C-S, I2b.6D, I2b.6D-S, I2b.6D-H complete; I2b.6E plan-only done; I2b.6E implementation pending BG approval)

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

**Completed I2b sub-slices**: I2b.1 (script migration), I2b.2 (validation), I2b.3 (types), I2b.4A (formatting helpers), I2b.4S (docs refresh), I2b.4B (constants), I2b.4B-S (docs refresh), I2b.5 (parser extraction), I2b.5-S (docs refresh), I2b.6A (predicate/domain helpers), I2b.6A-S (docs refresh), I2b.6B (classifyWaste extraction), I2b.6B-S (docs refresh), I2b.6C (buildFixSuggestion extraction), I2b.6C-S (docs refresh), I2b.6D (normalizeJobs extraction), I2b.6D-S (docs refresh), I2b.6D-H (normalizeJobs utils import hotfix)

**Next slice**: I2b.6E plan-only analysis complete. I2b.6E implementation scope: extract `applyRunRecord`, `ensureSyntheticStat`, `resolveJob`, `createJobStat` from `src/main.ts` into `src/domain.ts`. See plan report for full analysis. **Do not start I2b.6E implementation until BG approves.**

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

**Recommended Next Step**: BG approves I2b.6E implementation scope. Slice extracts: `applyRunRecord`, `ensureSyntheticStat`, `resolveJob`, `createJobStat` from `src/main.ts` into `src/domain.ts`. Each function is pure-or-accumulator, no pricing coupling. Do not start until BG approval.

Current completed slices (I2b.1–I2b.5, I2b.6A, I2b.6A-S, I2b.6B, I2b.6B-S, I2b.6C, I2b.6C-S, I2b.6D, I2b.6D-S, I2b.6D-H) extracted: inline script, validation, types, formatting helpers, constants, parser, predicate helpers, classifyWaste, buildFixSuggestion, normalizeJobs, normalizeJobs utils import fix.

detectCostRate remains sensitive and must not be changed without explicit pricing-slice approval.

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
