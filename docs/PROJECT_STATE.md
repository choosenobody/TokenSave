# TokenSave Project State Snapshot

> **⚠️ WARNING — This document is a snapshot, not a permanent source of truth.**
> Always verify state against GitHub (main branch, open issues, open PRs) before acting.
> This file itself may be stale if last updated date is more than 48h ago.
> Do not assume this file reflects current reality.

**Last updated**: 2026-04-27T07:15:00Z
**Source**: GitHub `origin/main` at commit `91716cd` (PR #41 I2b.6H merge)

---

## Current Repo State

| Item | Value |
|------|-------|
| Repo | choosenobody/TokenSave |
| Main branch SHA | `91716cd` (PR #41 I2b.6H merge) |
| Package manager | npm |
| Build tool | Vite 5 + TypeScript 5 |
| index.html | HTML/CSS shell with module script reference to src/main.ts |
| src/main.ts | ~690 lines, `@ts-nocheck`, application logic (ingest/analyzeDataset/finalizeStat/detectCostRate/render UI helpers; buildFixCards moved to fixes.ts; all pure helpers extracted to domain/utils/fixes) |
| src/parser.ts | 126 lines, parseJson / parseJsonl / parseZipEntries + private ZIP helpers |
| src/constants.ts | 61 lines, COST_RATES / FIX_LIBRARY / FIX_BADGES |
| src/types.ts | 269 lines, domain types (JobStat, RunRecord, Report, etc.) |
| src/domain.ts | ~317 lines, 18 exported helpers (8 predicates + classifyWaste + buildFixSuggestion + normalizeJobs + createJobStat + ensureSyntheticStat + resolveJob + applyRunRecord + parseScheduleMinutes + formatFrequency + compareJobs), imports stringify/normalizeKey/slugify/cleanFileStem/formatShortDuration from utils |
| src/fixes.ts | 31 lines, buildFixCards — imports FIX_LIBRARY from ./constants |
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
| #41 | I2b.6H: extract compareJobs to src/domain.ts | 2026-04-27 | `91716cd` |
| #38 | I2b.6G: extract buildFixCards to src/fixes.ts | 2026-04-27 | `ae5b712` |
| #37 | I2b.6F-S: refresh docs/PROJECT_STATE.md after PR #36 | 2026-04-27 | `21c838c` |
| #36 | I2b.6F: extract schedule helpers to src/domain.ts | 2026-04-27 | `6c5cf39` |
| #34 | I2b.6E: extract data pipeline helpers to src/domain.ts | 2026-04-27 | `43930a0` |
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
| I2b.6E | Extract createJobStat / ensureSyntheticStat / resolveJob / applyRunRecord to src/domain.ts | #34 | CLOSED |
| I2b.6F | Extract parseScheduleMinutes / formatFrequency to src/domain.ts | #36 | CLOSED |
| I2b.6H | Extract compareJobs to src/domain.ts | #41 | CLOSED |
| I2b.6G | Extract buildFixCards to src/fixes.ts | #38 | CLOSED |

**I2b overall: CLOSED — Completed** — All 26 PRs across 17 implementation slices + docs/hotfixes complete. All acceptance criteria met.

---

## Next Action

**Issue #11 (I2b): CLOSED as complete.** All acceptance criteria met. All safely extractable pure helpers migrated to `src/` modules.

**Recommended follow-up** (requires separate BG approval):
- UI module extraction (create `src/ui.ts`)
- Pricing slice (`detectCostRate`/`finalizeStat` review)
- App-shell architecture cleanup
- No-network evidence/test work (Issue #6)

---

## Open Issues and Recommended Cleanup Actions

> ⚠️ Do not close or modify issues unless BG explicitly approves. Listed here for reference.

| Issue | Title | Status | Recommended Action |
|-------|-------|--------|-------------------|
| #11 | I2b: Migrate index.html logic into src modules | **CLOSED** | All acceptance criteria met. All pure helpers extracted. |
| #10 | I2a: Vite + TypeScript scaffold | **OPEN** | **Completed by PR #14.** Recommend: close. |
| #9 | I1.1: Harden .gitignore and add process docs | **OPEN** | **Completed by PR #13.** Duplicate of #12 (both superseded by #13). |
| #8 | I2: Vite + TypeScript scaffold | **OPEN** | **Parent of I2a.** Recommend: close as completed by #10 and #11 (I2a done, I2b active). |
| #7 | I8: README, MVP_SPEC, PRIVACY, SECURITY, RULES docs | OPEN | Future issue. Not yet started. |
| #6 | I7: No-network test and evidence bundle system | OPEN | Future issue. Not yet started. |
| #5 | I6: Rule engine — Pre-flight rules B1-B3 and W1-W5 | OPEN | Future issue. Requires separate BG approval. |
| #4 | I5: Rule engine — Diagnose rules D1-D7 | OPEN | Future issue. Requires separate BG approval. |
| #3 | I4: Domain layer — pricing data and cost calculation | OPEN | Future issue. Requires separate BG approval. |
| #2 | I3: Add parser modules with tests | OPEN | Future issue. Requires separate BG approval. |
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

**Recommended Next Step**: Issue #11 (I2b) is now CLOSED. All safely extractable pure helpers have been migrated to `src/` modules. BG to decide next direction: approve a follow-up issue for UI module extraction, pricing slice review, app-shell cleanup, or no-network evidence/test work (Issue #6).

Current completed slices (I2b.1–I2b.6G) extracted: inline script, validation, types, formatting helpers, constants, parser, predicate helpers, classifyWaste, buildFixSuggestion, normalizeJobs, normalizeJobs utils import fix, data pipeline helpers (createJobStat / ensureSyntheticStat / resolveJob / applyRunRecord), schedule helpers (parseScheduleMinutes / formatFrequency), buildFixCards (→ fixes.ts).

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
