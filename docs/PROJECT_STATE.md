# TokenSave Project State Snapshot

> **⚠️ WARNING — This document is a snapshot, not a permanent source of truth.**
> Always verify state against GitHub (main branch, open issues, open PRs) before acting.
> This file itself may be stale if last updated date is more than 48h ago.
> Do not assume this file reflects current reality.

**Last updated**: 2026-04-29T08:25:00Z
**Source**: GitHub `origin/main` at commit `dda118c` (PR #67 I5-D3 premium-model-on-simple-job diagnostic; squash merge)

---

## Current Repo State

| Item | Value |
|------|-------|
| Repo | choosenobody/TokenSave |
| Main branch SHA | `dda118c` (PR #67 I5-D3 premium-model-on-simple-job diagnostic; squash merge) |
| Package manager | npm |
| package.json | vitest (devDependency), npm test script added |
| Build tool | Vite 5 + TypeScript 5 |
| index.html | HTML/CSS shell with module script reference to src/main.ts |
| src/types.ts | ~335 lines, domain types (JobStat, RunRecord, Report, CostRate, SummaryStats, FinalizedJob, WasteEvidence, DiagnoseRuleId, DiagnoseSeverity, DiagnoseEvidence, DiagnoseRuleResult, etc.) + PricingSource union type + hasConservativeEstimates; SummaryStats includes knownLocalCost and conservativeEstimateCost; FinalizedJob includes pricingSource and evidence |
| src/rules.ts | ~370 lines, pure D-rule functions (diagnoseD3PremiumModelOnSimpleJob, diagnoseD4AgentTurnCronBurn, diagnoseD5UnknownModelPricing, diagnoseD6ZeroTokenAbnormalRun); DiagnoseRuleResult with nested evidence bundle; no side effects, no network |
| src/domain.ts | ~404 lines, 19 exported helpers (8 predicates + classifyWaste + buildFixSuggestion + normalizeJobs + createJobStat + ensureSyntheticStat + resolveJob + applyRunRecord + parseScheduleMinutes + formatFrequency + compareJobs + buildWasteEvidence) + private computeWasteSignals helper shared by classifyWaste/buildWasteEvidence, imports stringify/normalizeKey/slugify/cleanFileStem/formatShortDuration from utils |
| src/main.ts | ~682 lines, `@ts-nocheck`, application logic (ingest/analyzeDataset/finalizeStat/render UI helpers; detectCostRate moved to src/pricing.ts; buildFixCards moved to fixes.ts; finalizeStat attaches evidence to FinalizedJob; all pure helpers extracted to domain/utils/fixes) |
| src/parser.ts | 126 lines, parseJson / parseJsonl / parseZipEntries + private ZIP helpers |
| src/constants.ts | 61 lines, COST_RATES / FIX_LIBRARY / FIX_BADGES |
| src/utils.ts | 72 lines, 10 pure formatting/string helpers |
| src/fixes.ts | 31 lines, buildFixCards — imports FIX_LIBRARY from ./constants |
| src/pricing.ts | detectCostRate — returns pricingSource ('known-local' or 'conservative-estimate'); unknown model uses highest known positive rate (15) as conservative estimate |
| tests/pricing.test.ts | Characterization tests for detectCostRate; covers all 7 known models + unknown fallback; asserts pricingSource |
| tests/parser.test.ts | 259 lines, 16 characterization tests for parseJson / parseJsonl / parseZipEntries (12 inline + 4 fixture-based). Fixtures under tests/fixtures/parser/: jobs.valid.json, runs.valid.jsonl, malformed.json, malformed.jsonl |
| tests/evidence.test.ts | 108 lines, 7 tests for WasteEvidence type and buildWasteEvidence (waste classification evidence bundle) |
| tests/rules.test.ts | ~460 lines, 58 D-rule tests (19 D3 tests + 16 D4 tests + 10 D5 tests + 13 D6 tests) for DiagnoseRuleResult contract and rule firing conditions |
| docs/AGENT_RULES.md | Development workflow rules |
| docs/INCIDENTS.md | Incident log |
| docs/PROJECT_STATE.md | This file |
| dist/ | Not committed (gitignored) |
| node_modules/ | Not committed (gitignored) |

---

## Latest Merged PRs

| PR | Title | Merged | Merge Commit |
|----|-------|--------|-------------|
| #67 | feat(I5-D3): add diagnoseD3PremiumModelOnSimpleJob | 2026-04-29 | `dda118c` |
| #65 | feat(I5-D4): add diagnoseD4AgentTurnCronBurn agent-turn cron burn diagnostic | 2026-04-29 | `46796dc` |
| #63 | feat(I5-D6): add diagnoseD6ZeroTokenAbnormalRun | 2026-04-29 | `921debe` |
| #61 | feat(I5-D5): D5 unknown-model pricing diagnostic | 2026-04-29 | `49db5d7` |
| #59 | feat(I7B): add WasteEvidence type + buildWasteEvidence for waste classification | 2026-04-29 | `9564e11` |
| #55 | test(I3B): add fixture-based parser tests for Issue #2 | 2026-04-28 | `ab322e3` |
| #53 | test(I3A): add parser characterization tests for parseJson / parseJsonl / parseZipEntries | 2026-04-28 | `47893ee` |
| #52 | docs(PROJECT_STATE): refresh after issue cleanup #8 #9 #10 | 2026-04-28 | `fd77591` |
| #51 | docs(I3.2C-A-S): refresh PROJECT_STATE.md after PR #50 | 2026-04-28 | `aa6ff12` |
| #50 | feat(I3.2C-A): split pricing exposure in Summary UI | 2026-04-28 | `a8a765c` |
| #48 | feat(I3.2B): Pricing-Confidence — conservative-estimate fallback + pricingSource tracking | 2026-04-28 | `c668b74` |
| #47 | docs: refresh PROJECT_STATE.md after PR #46 (Pricing-Char) | 2026-04-28 | `58471cf` |
| #46 | feat(Pricing-Extract): extract detectCostRate to src/pricing.ts + add characterization tests | 2026-04-27 | `ad69001` |
| #44 | I7A: no-network regression test — vitest + npm test script | 2026-04-27 | `f1d9685` |
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
| I2b.6G | Extract buildFixCards to src/fixes.ts | #38 | CLOSED |
| I7A | No-network regression test — vitest setup + npm test script (Issue #6 sub-slice) | #44 | CLOSED |
| I7B (Evidence-Bundle) | Add WasteEvidence type + buildWasteEvidence for waste classification (Issue #6 sub-slice) | #59 | CLOSED |
| I5-D5 (Diagnose-D5) | D5 unknown-model pricing diagnostic — diagnoseD5UnknownModelPricing pure function + DiagnoseRuleResult contract with nested evidence bundle (Issue #4 sub-slice) | #61 | CLOSED |
| I5-D6 (Diagnose-D6) | D6 zero-token abnormal run diagnostic — diagnoseD6ZeroTokenAbnormalRun pure function; fires when totalRuns > 0 AND totalTokens === 0; 13 new tests (Issue #4 sub-slice) | #63 | CLOSED |
| I5-D4 (Diagnose-D4) | D4 agent-turn cron burn diagnostic — diagnoseD4AgentTurnCronBurn pure function; fires when agentTurn=true AND scheduleMinutes ∈ (0, 60); reads agentTurn (agentTurn/agent_turn/agent_turn_enabled) and schedule (schedule/interval/frequency/cron) aliases; 16 tests (Issue #4 sub-slice) | #65 | CLOSED |
| I5-D3 (Diagnose-D3) | D3 premium-model-on-simple-job diagnostic — diagnoseD3PremiumModelOnSimpleJob pure function; fires when isSimpleCheck(job,promptText) AND pricingSource='known-local' AND rateMultiplier >= 5; uses MiniMax M2.7 as v1 bundled-pricing reference model; 19 tests (Issue #4 sub-slice) | #67 | CLOSED |
| I3.1 (Pricing-Extract) | Extract detectCostRate to src/pricing.ts + add characterization tests | #46 | CLOSED |
| I3.2B (Pricing-Confidence) | Pricing-Confidence: conservative-estimate fallback + pricingSource tracking | #48 | CLOSED |
| I3.2C-A (Pricing-Exposure-UI) | Split pricing exposure in Summary UI — Known Local Cost / Conservative Unknown Exposure / Estimated Total Cost cards | #50 | CLOSED |
| I3A (Parser-Char-Tests) | Add parser characterization tests for parseJson / parseJsonl / parseZipEntries — 12 inline tests covering valid, malformed, edge cases | #53 | CLOSED |
| I3B (Parser-Fixture-Tests) | Add fixture-based parser tests for parseJson / parseJsonl — 4 fixture tests using tests/fixtures/parser/ jobs.valid.json, runs.valid.jsonl, malformed.json, malformed.jsonl | #55 | CLOSED |
| I2b.6H | Extract compareJobs to src/domain.ts | #41 | CLOSED |

**I2b overall: CLOSED — Completed** — All 26 PRs across 17 implementation slices + docs/hotfixes complete. All acceptance criteria met.

---

## Next Action

**Issue #11 (I2b): CLOSED as complete.** All acceptance criteria met. All safely extractable pure helpers migrated to `src/` modules.

**I3A (Parser-Char-Tests) — CLOSED.** Added 12 characterization tests for parseJson / parseJsonl / parseZipEntries in tests/parser.test.ts. No src changes.

**I3B (Parser-Fixture-Tests) — CLOSED.** Added 4 fixture-based tests using realistic text fixtures under tests/fixtures/parser/. I3A + I3B together provide comprehensive inline + fixture coverage for parseJson and parseJsonl. No src changes.

**I3.2B (Pricing-Confidence) — CLOSED.** Unknown model fallback now uses highest known positive rate (15) as conservative estimate. PricingSource tracking implemented. Conservative-estimate jobs included in totalCost, excluded from precise totalCostSaving.

**I3.2C-A (Pricing-Exposure-UI) — CLOSED.** Summary UI now shows split exposure: Known Local Cost card (precise), Conservative Unknown Exposure card (estimated), and Estimated Total Cost card. Simple single Estimated Cost card preserved when all costs are known.

**I7B (Evidence-Bundle) — CLOSED.** Added WasteEvidence type + buildWasteEvidence for waste classification. 7 new tests in tests/evidence.test.ts. Total test suite now 34 tests. Evidence bundle minimal slice complete; additional slices remain pending.

**I5-D3 (Diagnose-D3) — CLOSED.** Added diagnoseD3PremiumModelOnSimpleJob pure function in src/rules.ts. Fires when isSimpleCheck(job,promptText) AND pricingSource='known-local' AND rateMultiplier >= 5. Uses MiniMax M2.7 as v1 bundled-pricing reference model (rate derived at runtime via detectCostRate('MiniMax M2.7').rate). MiniMax M2.7 is not a permanent industry standard; future Issue #3 pricing policy should move reference logic out of D3. 19 tests in tests/rules.test.ts. D1-D7 sub-slice 4 of N. Issue #4 remains OPEN (D1, D2, D7 pending). Issue #6 remains OPEN (D-rule evidence bundles incomplete).

**Project pricing architecture decision (BG/GPT-5.5):** TokenSave uses two pricing layers: (1) TokenSave maintained pricing baseline with version/lastUpdated metadata; (2) User preference/override layer (simple controls: provider/pricing mode, enterprise discount, model price override, reference preference). Users should not be required to manually import pricing files. Any future online pricing update must be explicit/transparent and must not send user export/config/model usage data out of the browser.

**I5-D4 (Diagnose-D4) — CLOSED.** Added diagnoseD4AgentTurnCronBurn pure function in src/rules.ts. Fires when agentTurn=true AND scheduleMinutes ∈ (0, 60). Reads agentTurn aliases (agentTurn/agent_turn/agent_turn_enabled) and schedule aliases (schedule/interval/frequency/cron). 16 tests in tests/rules.test.ts. D1-D7 sub-slice 3 of N. Issue #4 remains OPEN (D1, D2, D7 pending). Issue #6 remains OPEN (D-rule evidence bundles incomplete).

**I5-D6 (Diagnose-D6) — CLOSED.** Added diagnoseD6ZeroTokenAbnormalRun pure function in src/rules.ts. Fires when totalRuns > 0 AND totalTokens === 0; returns null otherwise. Handles missing/non-finite values gracefully without throwing. 13 tests in tests/rules.test.ts. D1-D7 sub-slice 2 of N. Issue #4 remains OPEN (D1, D2, D7 pending). Issue #6 remains OPEN (D-rule evidence bundles incomplete).

**I5-D5 (Diagnose-D5) — CLOSED.** Added diagnoseD5UnknownModelPricing pure function in src/rules.ts. DiagnoseRuleResult contract uses nested evidence bundle { ruleId, explanation, sourceFields, observedValue, threshold }. 8 tests in tests/rules.test.ts. D1-D7 sub-slice 1 of N. Issue #4 remains OPEN (D1, D2, D7 pending). Issue #6 remains OPEN (D-rule evidence bundles incomplete).

**Recommended follow-up** (requires separate BG approval):
- UI module extraction (create `src/ui.ts`)
- Pricing slice — config-cost / plan-covered zero / job→agent mapping remain **deferred pending future BG approval**
- App-shell architecture cleanup
- No-network evidence/test work (Issue #6) — **I7A completed (PR #44); I7B completed (PR #59); I5-D5 adds D-rule evidence contract (PR #61); remaining slices pending**
- Observed-fallback and inferred-config pricing sources remain unimplemented (future work)

---

## Open Issues and Recommended Cleanup Actions

> ⚠️ Do not close or modify issues unless BG explicitly approves. Listed here for reference.

| Issue | Title | Status | Recommended Action |
|-------|-------|--------|-------------------|
| #11 | I2b: Migrate index.html logic into src modules | **CLOSED** | All acceptance criteria met. All pure helpers extracted. |
| #10 | I2a: Vite + TypeScript scaffold with minimal behavior changes | **CLOSED** | Completed by PR #14. Closed 2026-04-28. |
| #9 | I1.1: Harden .gitignore and add process docs | **CLOSED** | Completed by PR #13. Closed 2026-04-28. |
| #8 | I2: Vite + TypeScript scaffold | **CLOSED** | Parent of I2a. Completed by PR #14 and Issue #11 / I2b. Closed 2026-04-28. |
| #7 | I8: README, MVP_SPEC, PRIVACY, SECURITY, RULES docs | OPEN | Future issue. Not yet started. |
| #6 | I7: No-network test and evidence bundle system | OPEN | I7A no-network regression test completed by PR #44. I7B evidence bundle minimal slice completed by PR #59. Remaining slices pending. Issue remains OPEN unless BG explicitly approves closure. |
| #5 | I6: Rule engine — Pre-flight rules B1-B3 and W1-W5 | OPEN | Future issue. Requires separate BG approval. |
| #4 | I5: Rule engine — Diagnose rules D1-D7 | OPEN | Future issue. Requires separate BG approval. |
| #3 | I4: Domain layer — pricing data and cost calculation | OPEN | Partially advanced by I3.2B conservative-estimate fallback and I3.2C-A split pricing UI. Full issue scope requires separate BG decision. |
| #2 | I3: Add parser modules with tests | **CLOSED** | I3A (PR #53): 12 inline characterization tests. I3B (PR #55): 4 fixture-based tests. Combined 16 tests in tests/parser.test.ts. src/parser.ts unchanged. Closed 2026-04-28. |
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

**Recommended Next Step**: I5-D3 (Diagnose-D3) is now CLOSED. D3 uses 5× relative multiplier in v1; MiniMax M2.7 is v1 bundled-pricing reference model only. Next priority: D1, D7 (remaining Issue #4 slices), UI module extraction, or no-network evidence/test work (Issue #6). BG to decide.

Pricing notes: Unknown model fallback changed from MiniMax M2.7 / 0.14 to highest known positive rate (15). `detectCostRate` now returns `pricingSource`. Conservative-estimate jobs contribute to `totalCost` and `totalWasteTokens` but not `totalCostSaving`.

Current completed slices (I2b.1–I2b.6H) extracted: inline script, validation, types, formatting helpers, constants, parser, predicate helpers, classifyWaste, buildFixSuggestion, normalizeJobs, normalizeJobs utils import fix, data pipeline helpers (createJobStat / ensureSyntheticStat / resolveJob / applyRunRecord), schedule helpers (parseScheduleMinutes / formatFrequency), buildFixCards (→ fixes.ts), compareJobs (→ domain.ts).

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
