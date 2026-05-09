# TokenSave Project State Snapshot

> **⚠️ WARNING — This document is a snapshot, not a permanent source of truth.**
> Always verify state against GitHub (main branch, open issues, open PRs) before acting.
> This file itself may be stale if last updated date is more than 48h ago.
> Do not assume this file reflects current reality.

**Last updated**: 2026-05-09T01:36:00Z
**Source**: GitHub `origin/main` at commit `658a8309c44439291e4411e5063056be8cab0dbe` (PR #121 feat(I16): UX-only .rar import guidance; merge commit `658a830`)

---

## Current Repo State

| Item | Value |
|------|-------|
| Repo | choosenobody/TokenSave |
| Main branch SHA | `658a8309c44439291e4411e5063056be8cab0dbe` (PR #121 feat(I16): UX-only .rar import guidance; merge commit `658a830`) |
| Package manager | npm |
| package.json | vitest (devDependency), npm test script added |
| Build tool | Vite 5 + TypeScript 5 |
| index.html | HTML/CSS shell with module script reference to src/main.ts; I10-B1 adds 3-path OpenClaw diagnostic file guidance panel (Full ZIP export / jobs.json only / JSONL run history only); I15-A replaces openclaw export BEST option with ~/.openclaw/cron/jobs.json + ~/.openclaw/cron/runs/*.jsonl |
| src/types.ts | ~335 lines, domain types (JobStat, RunRecord, Report, CostRate, SummaryStats, FinalizedJob, WasteEvidence, DiagnoseRuleId, DiagnoseSeverity, DiagnoseEvidence, DiagnoseRuleResult, etc.) + PricingSource union type + hasConservativeEstimates; SummaryStats includes knownLocalCost and conservativeEstimateCost; FinalizedJob includes pricingSource and evidence |
| src/rules.ts | ~761 lines, pure D-rule functions (diagnoseD1FailureLoopDetection, diagnoseD2BurstSpend, diagnoseD3PremiumModelOnSimpleJob, diagnoseD4AgentTurnCronBurn, diagnoseD5UnknownModelPricing, diagnoseD6ZeroTokenAbnormalRun, diagnoseD7ExactDuplicateActiveJob); DiagnoseRuleResult with nested evidence bundle; no side effects, no network |
| src/domain.ts | ~443 lines, 21 exported helpers (8 predicates + classifyWaste + buildFixSuggestion + normalizeJobs + createJobStat + ensureSyntheticStat + resolveJob + applyRunRecord + parseScheduleMinutes + formatFrequency + compareJobs + buildWasteEvidence + estimateOccurrencesPerDay + estimateJobWasteTokens + estimateWastePerRun + estimateDailyWasteTokens + isEnabled + isActiveJob) + private computeWasteSignals helper shared by classifyWaste/buildWasteEvidence; I15-B: added isEnabled() and isActiveJob() for lifecycleStatus classification; imports stringify/normalizeKey/slugify/cleanFileStem/formatShortDuration from utils |
| src/main.ts | ~820 lines, `@ts-nocheck`, application logic (ingest/analyzeDataset/finalizeStat/render UI helpers; detectCostRate moved to src/pricing.ts; buildFixCards moved to fixes.ts; finalizeStat attaches evidence to FinalizedJob; all pure helpers extracted to domain/utils/fixes); I4-C1: token/waste-first UI, default sort by tokens, Approx. Cost Exposure wording, cost demoted to secondary signal; I9-A: renderImportSummary panel above summary grid; handleFiles sets dataset.fileCount = files.length for real import path; I9-B: renderImportSummary extended with readiness gap sections (present/missing evidence tags, affected diagnostics, manual next steps); renderFixes restraint logic: fix cards suppressed only when hasJobs===false && hasRuns===false; I10-B1 maps low-level parse failures to clearer import guidance messages; I13-A: renderImportSummary audit-strength framing note (full/partial/limited evidence → actionable implications), renderFixes restrained-state copy clarifies CLI-only/manual guidance; I15-A: buildFixSteps rewritten — one command per job ID to avoid multi-ID command risk; ERROR_WASTE uses `cron show` + `cron runs --id` per job; buildFixSteps now splits both comma-separated and whitespace-separated ID lists (split(/[,\s]+/)); importTip updated to reference ~/.openclaw/cron/jobs.json re-import; I15-B: lifecycleStatus assignment per job, activeJobs/historicalJobs split, report.historicalJobs, renderTopWaste secondary 'Historical / disabled review signals' section (muted cards), renderFixes historical fix cards with 'Review signal' badge + grey tags + inspect-only commands |
| I10-B1 changed files | `index.html`, `src/main.ts`; export guidance and error UX only; no backend/network/telemetry/runtime file-write intended |
| src/types.ts | ~385 lines, domain types (JobStat, RunRecord, Report, CostRate, SummaryStats, FinalizedJob, WasteEvidence, DiagnoseRuleId, DiagnoseSeverity, DiagnoseEvidence, DiagnoseRuleResult, etc.) + PricingSource union type + hasConservativeEstimates; SummaryStats includes knownLocalCost and conservativeEstimateCost; FinalizedJob includes pricingSource and evidence; I9-A: DetectedSource, AuditConfidence, SupportedRuleHint, EvidenceHint, ImportSummary types; I9-B: ReadinessGap interface (missingEvidence/label/affectedDiagnostics/manualNextStep) + Report.readinessGaps: ReadinessGap[] |
| src/parser.ts | ~340 lines, parseJson / parseJsonl / parseZipEntries + private ZIP helpers + exported detectImportSource(dataset) pure function (source type detection, audit confidence, supportedRuleHint, evidence hints) + private hasFiniteTokenField helper (zero-token alias detection); I9-B: exported buildReadinessGaps(summary) pure function — maps ImportSummary EvidenceHint to ReadinessGap[] (one entry per missing evidence signal with affected diagnostics and manual next steps) |
| src/constants.ts | COST_RATES / FIX_LIBRARY / FIX_BADGES; COST_RATES entries now carry 5 metadata fields: source, sourceType, checkedDate, status, approximationNote (all source=null, sourceType='unverified', checkedDate=null, status='unknown' for I4-A placeholder) |
| src/utils.ts | 72 lines, 10 pure formatting/string helpers |
| src/fixes.ts | 143 lines, buildFixCards + buildEvidenceBackedProblem + formatEvidenceBlurb; I14-B: buildEvidenceBackedProblem() returns evidence-backed problem text for CRITICAL ('Runs every N min, below the N min threshold.') and ERROR_WASTE ('N% error rate, above the N% threshold.') — strict typeof==='number' guard rejects null/''/whitespace before Number.isFinite(); all other categories fall back to FIX_LIBRARY exactly |
| src/pricing.ts | detectCostRate — returns pricingSource ('known-local' or 'conservative-estimate'); unknown model uses highest known positive rate (15) as conservative estimate |
| tests/pricing.test.ts | 17 tests, COST_RATES metadata field tests + detectCostRate characterization/regression + I4-B1 premium-saving regression tests (3 new); all COST_RATES entries marked unverified/unknown for I4-A |
| tests/parser.test.ts | ~711 lines, parseJson / parseJsonl / parseZipEntries characterization tests (12 inline + 4 fixture-based) + detectImportSource tests (19 new) + buildReadinessGaps tests (12 new, including 3 jobs/runs regression cases) + I11-A import readiness regression coverage (14 new); total 50 parser tests |
| tests/no-network.test.ts | I7A no-network regression test now handles Vite modulepreload polyfill false positives in built output; forbidden app runtime API scan includes fetch, XMLHttpRequest, sendBeacon, WebSocket, and EventSource; passes under current Windows/Vite build output |
| tests/evidence.test.ts | 108 lines, 7 tests for WasteEvidence type and buildWasteEvidence (waste classification evidence bundle) |
| tests/rules.test.ts | 119 tests including D1-D7 rule coverage, contract/alias coverage, and D5 unknown-model regression; total suite 187 tests across 6 files |
| tests/fixes.test.ts | 30 tests, buildEvidenceBackedProblem (15 tests) + buildFixCards with evidence-backed problem (15 tests); coverage: CRITICAL/ERROR_WASTE with valid evidence, no evidence fallback, malformed-value fallback (null/""/whitespace), other categories no override, sort/slice preserved, action/impactLabel unchanged; total suite 261 tests |
| tests/i15a-openclaw-cli-guidance.test.ts | 145 tests, covers CLI syntax correctness (openclaw cron/* vs openclaw jobs/*), forbidden patterns (--resume/--no-agent-turn/--dry-run/cron expression strings), multi-ID command risk (whitespace-separated and comma-separated ID lists), local path references, ERROR_WASTE --id flag syntax, --enable flag, cron disable vs edit --disable; whitespace-separated multi-ID asserts each command targets exactly one job ID; total test suite 444 tests |
| tests/i15b-active-historical.test.ts | 38 tests, covers isEnabled() aliases (enabled=true/false/string/number/missing, active alias), synthetic=true → lifecycleStatus='historical' regardless of enabled, enabled=false → 'disabled', missing/null → conservative 'active', synthetic-with-runs edge case (lifecycleStatus='historical' but included in historicalJobs, excluded from activeJobs), disabled job outrank prevention in same-tier sort; total test suite 354 tests |
| tests/diagnose-evidence-contract.test.ts | 156 lines, 8 tests — D1-D7 DiagnoseRuleResult evidence contract regression coverage (I7C); asserts result/severity/evidence structure, non-empty message, non-string evidence, structured evidence keys (ruleId/explanation/sourceFields/observedValue/threshold) |
| docs/AGENT_RULES.md | Development workflow rules + Merge Authorization Protocol + Stop Point Protocol + Negative Instruction Priority + Low-Risk Codex Review Lane (I12-A): narrow tests-only/docs-only PRs may skip guardian_cat review when all 12 conditions met and Codex review returns PASS |
| docs/INCIDENTS.md | Incident log — PR #73 unauthorized merge recorded; both incidents CLOSED |
| docs/PROJECT_STATE.md | This file |
| dist/ | Not committed (gitignored) |
| node_modules/ | Not committed (gitignored) |
| README.md | Product overview — local-first token waste audit tool, local setup (git clone / npm install / npm run dev), validation commands (npm run build && npm test), privacy statement, what TokenSave does and does NOT do |
| MVP_SPEC.md | MVP scope document — objective, workflow (Import → Diagnose → Evidence → Manual Fix), D1-D7 summary (D2 marked as review signal only), evidence boundaries, MVP does NOT include list, deferred items (Issue #5 RULES.md, PRIVACY/SECURITY later slices), privacy/local-first constraints |
| PRIVACY.md | Privacy policy — local-first, no telemetry, no external API calls, no API key collection, no-network design (static build-asset scan), cost estimates (approximate, secondary), user responsibility for imported data |
| SECURITY.md | Security policy — security model, threat model, data storage/retention (no local history store, session-only analysis), non-goals (not sandbox/endpoint protection/SaaS/kill switch), controls (local-first, no telemetry, no-network static scan, CLI text-only fix hints), vulnerability reporting (GitHub issues, no SLA) |

---

## Latest Merged PRs

| PR | Title | Merged | Merge Commit |
|----|-------|--------|-------------|
| #121 | feat(I16): UX-only .rar import guidance | 2026-05-09 | `658a830` |
| #120 | docs(PROJECT_STATE): refresh after PR #119 — I15-A browser smoke fixed | 2026-05-08 | `cb80aee` |
| #119 | fix(I15-A): split multi-job fix commands into one command per ID | 2026-05-08 | `62aa4fe` |
| #117 | feat(I15-B): active vs historical/disabled waste distinction | 2026-05-08 | `d9ed115d4a64c9797af1c20aba8293c064d4f10e` |
| #113 | docs(PROJECT_STATE): refresh after PR #112 — I7B Slice B CLOSED | 2026-05-07 | `8e0cb16` |
| #112 | docs(I7B): add PRIVACY.md and SECURITY.md | 2026-05-06 | `6c4315c` |
| #110 | docs(I7A): README.md + MVP_SPEC.md | 2026-05-06 | `a808198` |
| #108 | feat(I14-B): evidence-backed fix card problem text for CRITICAL and ERROR_WASTE | 2026-05-05 | `7228ce0` |
| #107 | docs(PROJECT_STATE): refresh after PR #106 — I14-A Slice 1 CLOSED, D2 decision, main SHA 1e6401c | 2026-05-05 | `5f46ac1` |
| #106 | feat(I14-A Slice 1): schedule-normalized waste priority | 2026-05-05 | `1e6401c` |
| #105 | feat(I13-C): evidence-backed fix card explanation | 2026-05-04 | `bf1fff0` |
| #104 | feat(I13-B): rename UI to Agent Job Waste Audit | 2026-05-04 | `11bf1a1` |
| #102 | feat(I13-A): improve evidence-to-fix card clarity | 2026-05-04 | `7be7126` |
| #101 | docs(PROJECT_STATE): fix PR #99 full merge SHA | 2026-05-04 | `109b633` |
| #100 | docs(PROJECT_STATE): refresh after PR #98 and PR #99 — I11-A CLOSED, I12-A CLOSED | 2026-05-04 | `6be0040` |
| #99 | docs(I12-A): define low-risk Codex review lane | 2026-05-04 | `d00059a` |
| #98 | test(I11-A): add import readiness regression coverage | 2026-05-04 | `a383bbc` |
| #97 | docs(PROJECT_STATE): refresh after PR #96 (#97) | 2026-05-03 | `787e653` |
| #96 | test(I7A): handle Vite modulepreload polyfill in no-network test | 2026-05-03 | `77b01df` |
| #95 | docs(PROJECT_STATE): refresh after PR #94 | 2026-05-03 | `50a2b19` |
| #94 | feat(I10-B1): export guidance 3-path + improved import error UX | 2026-05-02 | `582534e` |
| #92 | docs(PROJECT_STATE): refresh after PR #91 — I9-B CLOSED | 2026-05-02 | `7c6593f` |
| #91 | feat(I9-B): add import-to-action funnel — readiness gaps, affected diagnostics, manual next steps, fix-card restraint | 2026-05-02 | `7228f0c` |
| #89 | feat(I9-A): add local log import audit-readiness summary | 2026-05-02 | `25d116b` |
| #87 | fix(I4-C1): reorient UI from cost-dashboard to token-waste-action tool | 2026-05-02 | `f0c7891` |
| #85 | docs(PROJECT_STATE): refresh after PR #84 — I4-B1 CLOSED | 2026-05-01 | `488c9b9` |
| #84 | fix(I4-B1): decouple premium saving reference rate | 2026-05-01 | `d4373e0` |
| #83 | docs(I4-A): refresh PROJECT_STATE after PR #82 | 2026-04-30 | `51bd0e2` |
| #82 | feat(I4-A): add pricing baseline metadata fields | 2026-04-30 | `5d925de` |
| #81 | docs(PROJECT_STATE): refresh after Issue #6 closure — I7 CLOSED | 2026-04-30 | `7101e9c` |
| #80 | docs(PROJECT_STATE): refresh after PR #79 — I7C complete | 2026-04-30 | `57e84fd` |
| #79 | tests: D1-D7 evidence contract regression coverage (I7C) | 2026-04-30 | `ac30496` |
| #77 | docs(PROJECT_STATE): refresh after PR #76 — main SHA, PR table, process-safety | 2026-04-30 | `b649c8e` |
| #76 | docs: process-safety — merge authorization + stop point + incidents | 2026-04-30 | `50be1a8` |
| #74 | docs(I5-D2-S): refresh PROJECT_STATE.md after PR #73 | 2026-04-30 | `a9a72ca` |
| #73 | feat(I5-D2): add diagnoseD2BurstSpend for spend concentration detection | 2026-04-29 | `2f2d2e0` |
| #71 | feat(I5-D1): add diagnoseD1FailureLoopDetection | 2026-04-29 | `59a2ecc` |
| #69 | feat(I5-D7): add diagnoseD7ExactDuplicateActiveJob | 2026-04-29 | `f040f1b` |
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
| #17 | I2b.3: add src/types.ts — type inventory slice | 2026-04-26 | `b806005` |
| #16 | I2b.1: Migrate inline script to src/main.ts | 2026-04-25 | `0898562` |
| #15 | I1.2: Add project state snapshot document | 2026-04-25 | `d19c4b5` |
| #14 | I2a: Vite + TypeScript scaffold | 2026-04-25 | `69ab3e7` |
| #13 | I1.1 corrective: replace docs with guardian_cat-reviewed versions | 2026-04-24 | `b09754c` |

---

## Completed Increments

| Increment | Issue | PR | Status |
|-----------|-------|-----|--------|
| I7A (Slice A — README + MVP_SPEC) | Issue #7 (I8) docs — Slice A | #110 | **SLICE COMPLETE** |
| I7B (Slice B — PRIVACY + SECURITY) | Issue #7 (I8) docs — Slice B | #112 | **SLICE COMPLETE** — Issue #7 remains OPEN; RULES.md pending |
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
| I7A | No-network regression test — vitest setup + npm test script (Issue #6 sub-slice); PR #96 test hygiene follow-up closed the Vite modulepreload polyfill false positive and added EventSource to the forbidden network API scan | #44, #96 | CLOSED |
| I7B (Evidence-Bundle) | Add WasteEvidence type + buildWasteEvidence for waste classification (Issue #6 sub-slice) | #59 | CLOSED |
| I7C (Evidence-Contract-Tests) | Add tests/diagnose-evidence-contract.test.ts — 156 lines, 8 tests; D1-D7 DiagnoseRuleResult evidence contract regression coverage; assertEvidenceContract helper validates result/severity/evidence structure, non-empty message, non-string evidence, structured keys (ruleId/explanation/sourceFields/observedValue/threshold); Issue #6 sub-slice | #79 | CLOSED |
| I5-D5 (Diagnose-D5) | D5 unknown-model pricing diagnostic — diagnoseD5UnknownModelPricing pure function + DiagnoseRuleResult contract with nested evidence bundle (Issue #4 sub-slice) | #61 | CLOSED |
| I5-D6 (Diagnose-D6) | D6 zero-token abnormal run diagnostic — diagnoseD6ZeroTokenAbnormalRun pure function; fires when totalRuns > 0 AND totalTokens === 0; 13 new tests (Issue #4 sub-slice) | #63 | CLOSED |
| I5-D4 (Diagnose-D4) | D4 agent-turn cron burn diagnostic — diagnoseD4AgentTurnCronBurn pure function; fires when agentTurn=true AND scheduleMinutes ∈ (0, 60); reads agentTurn (agentTurn/agent_turn/agent_turn_enabled) and schedule (schedule/interval/frequency/cron) aliases; 16 tests (Issue #4 sub-slice) | #65 | CLOSED |
| I5-D3 (Diagnose-D3) | D3 premium-model-on-simple-job diagnostic — diagnoseD3PremiumModelOnSimpleJob pure function; fires when isSimpleCheck(job,promptText) AND pricingSource='known-local' AND rateMultiplier >= 5; uses MiniMax M2.7 as v1 bundled-pricing reference model; 19 tests (Issue #4 sub-slice) | #67 | CLOSED |
| I5-D1 (Diagnose-D1) | D1 aggregate failure-loop diagnostic — diagnoseD1FailureLoopDetection pure function; fires when totalRuns >= 3 AND errorRuns/totalRuns >= 0.8; severity warning; evidence includes ruleId/sourceFields/observedValue/threshold; 18 new tests (Issue #4 sub-slice) | #71 | CLOSED |
| I5-D2 (Diagnose-D2) | D2 burst-spend concentration diagnostic — diagnoseD2BurstSpend pure function; input: Record<string, unknown>[] (run-record level); 60-minute rolling window; fires when >= 3 distinct jobs AND >= USD 50 estimated total window cost; severity info; review signal only, not waste proof; no potentialSaving calculation; unknown models labeled conservative-estimate; 19 new tests; total suite 152 tests (Issue #4 sub-slice) | #73 | CLOSED |
| I5-D7 (Diagnose-D7) | D7 exact-duplicate-active-job diagnostic — diagnoseD7ExactDuplicateActiveJob pure function; fires when >= 2 active jobs share same model+schedule+task config; active filter (active/disabled/enabled aliases); duplicate key from normalized model+schedule+task/type/description/prompt; 21 tests (Issue #4 sub-slice) | #69 | CLOSED |
| I3.1 (Pricing-Extract) | Extract detectCostRate to src/pricing.ts + add characterization tests | #46 | CLOSED |
| I3.2B (Pricing-Confidence) | Pricing-Confidence: conservative-estimate fallback + pricingSource tracking | #48 | CLOSED |
| I3.2C-A (Pricing-Exposure-UI) | Split pricing exposure in Summary UI — Known Local Cost / Conservative Unknown Exposure / Estimated Total Cost cards | #50 | CLOSED |
| I3A (Parser-Char-Tests) | Add parser characterization tests for parseJson / parseJsonl / parseZipEntries — 12 inline tests covering valid, malformed, edge cases | #53 | CLOSED |
| I3B (Parser-Fixture-Tests) | Add fixture-based parser tests for parseJson / parseJsonl — 4 fixture tests using tests/fixtures/parser/ jobs.valid.json, runs.valid.jsonl, malformed.json, malformed.jsonl | #55 | CLOSED |
| I4-B1 (Decouple-Premium-Ref) | Replace hardcoded `const cheapRate = 0.14` with dynamic `detectCostRate('MiniMax M2.7')` in premium-model saving calculation. Guard: only use rate when `pricingSource === 'known-local'` and rate is finite positive. Safe fallback: skip saving calculation if reference is not safe — avoids conservative overestimate (rate 15) as cheap baseline. Behavior unchanged with current COST_RATES. Future MiniMax rate updates will auto-reflect in Summary saving. No numeric rate changes. No metadata changes. | #84 | CLOSED |
| I4-C1 (Token-first Waste Action UI Correction) | src/main.ts only. Strategic UI reorientation: cost-first dashboard → token/waste-action tool. Default sort changed from `cost` to `tokens`. Summary cards reordered: Avoidable Token Burn first, Approx. Cost Exposure last/secondary. Labels renamed: Waste from Failures → Avoidable Token Burn, Potential Saving → Approx. Avoidable Cost Exposure, Estimated Cost → Approx. Cost Exposure. Top waste metadata: tokens first, approximate cost second. hasConservativeEstimates branch restored Approx. Avoidable Cost Exposure (known-local only, excludes conservative unknown exposure). No pricing/rule/parser/domain/constants changes. | #87 | CLOSED |
| I9-A (Local Log Import + Audit-Ready Evidence Layer) | Local import summary panel after ingest: detected source type label, record/file counts, audit confidence, supportedRuleHint, evidence tags (hasJobs/hasRuns/hasTokens/hasErrors/hasSchedules/hasModels), static local-only privacy note. detectImportSource(dataset) pure function in src/parser.ts — zero network, zero side effects. hasFiniteTokenField local helper correctly recognizes tokens:0 and all token aliases as valid evidence (NaN/Infinity/-1 excluded). dataset.fileCount = files.length wired in handleFiles() real import path. supportedRuleHint='full' requires jobs+runs+tokens+schedules+models ALL present. UI labels: "Strong audit readiness" / "Partial audit evidence" / "Limited audit evidence" / "No audit evidence detected". No backend/network/telemetry/export/runtime-write. | #89 | CLOSED |
| I9-B (Import-to-Action Funnel) | Present/missing evidence tags in import summary (hasJobs/hasRuns/hasTokens/hasErrors/hasSchedules/hasModels); readiness gaps via buildReadinessGaps() pure function in src/parser.ts — maps ImportSummary to ReadinessGap[] (one entry per missing evidence signal); affected diagnostics mapping (hasTokens→D1/D2/D6, hasRuns→D1/D2/D6, hasSchedules→D4/D7, hasModels→D3/D5, hasJobs→D7+fix-card-detail, hasErrors→D1/ERROR_WASTE); manual next-step guidance per gap; fix-card restraint: fix cards suppressed only when hasJobs===false && hasRuns===false (both signals missing), partial evidence sufficient to show evidence-backed cards; no parser behavior change, no D-rule/pricing/COST_RATES/domain behavior change, no backend/network/telemetry/export/auto-apply. | #91 | CLOSED |
| I10-B1 (Export Guidance + Import Error UX) | Added 3-path OpenClaw diagnostic file guidance panel: Full ZIP export (best), jobs.json only (OK), and run-history JSONL only (partial). Improved import parse error UX by mapping malformed JSON, malformed JSONL, incomplete ZIP, and unsupported file type errors to clearer user-facing guidance. Changed files: index.html and src/main.ts. No backend/network/telemetry/runtime file-write intended. | #94 | CLOSED |
| I11-A (Import Readiness Regression Coverage) | Added 14 regression tests to tests/parser.test.ts for import readiness path — fileCount wiring, zero-token detection, readiness gaps buildReadinessGaps edge cases, partial evidence. Total parser tests now 50. Total test suite: 203 tests. | #98 | CLOSED |
| I12-A (Low-Risk Codex Review Lane) | Added Low-Risk Codex Review Lane to docs/AGENT_RULES.md: narrow tests-only/docs-only PRs may skip guardian_cat review when all 12 conditions are met (tests-only/docs-only, no runtime/src/index.html/pkg/parser/domain/pricing/privacy/export changes, validation passes, Codex review returns PASS). BG merge authorization still mandatory. Auto-merge still forbidden. guardian_cat remains required for all high-risk work. | #99 | CLOSED |
| I13-C (Evidence-Backed Fix Card) | Added formatEvidenceBlurb() to src/fixes.ts — formats short human-readable evidence blurb from job.evidence[].observedValue and threshold; called from renderFixes in src/main.ts to append a "Why: ..." line below each fix card problem description. Per-category formatting: CRITICAL→"Schedule: every N min · threshold: 30 min", ERROR_WASTE→"Error rate: N% · threshold: 10%", PREMIUM_MODEL_WASTE→"Model: [name]", WARNING→"Schedule: every N min · threshold: 60 min". No rule logic changes. | #105 | CLOSED |
| I14-A Slice 1 (Schedule-Normalized Waste Priority) | src/domain.ts added four new exported helpers: estimateOccurrencesPerDay (1440/scheduleMinutes), estimateJobWasteTokens (mirrors analyzeDataset waste formula), estimateWastePerRun (waste/totalRuns), estimateDailyWasteTokens (perRun×perDay). src/main.ts topWaste ranking now uses three-tier priority: Tier 1 estimatedDailyWasteTokens > 0 desc (known schedule with positive daily waste); Tier 2 estimatedWastePerRun > 0 desc (unknown schedule with run evidence); Tier 3 totalTokens × errorRate desc (fallback). src/main.ts imports only estimateWastePerRun and estimateDailyWasteTokens directly. tests/waste-estimate.test.ts added 28 tests covering all four helpers and tier ranking. Total test suite now 231 tests. | #106 | CLOSED |
| I14-B (Evidence-Backed Fix Card Problem Text) | src/fixes.ts added buildEvidenceBackedProblem() pure helper. buildFixCards() now generates evidence-backed problem text for CRITICAL ('Runs every N min, below the N min threshold.') and ERROR_WASTE ('N% error rate, above the N% threshold.') categories. Strict typeof==='number' guard on observedValue/threshold rejects null/''/whitespace before Number.isFinite(), preventing misleading '0 min' text. Falls back to FIX_LIBRARY[category].problem exactly when evidence is absent or malformed. FIX_LIBRARY not mutated. formatEvidenceBlurb unchanged. buildFixSteps unchanged. action/impactLabel unchanged. tests/fixes.test.ts: 30 tests covering valid evidence, no-evidence fallback, malformed-value fallback (null/""/whitespace/non-finite), other categories no override, sort/slice preserved. Total test suite: 261 tests. | #108 | CLOSED |
| I15-A (OpenClaw CLI Guidance — Cron Command Family + Multi-ID Fix) | src/constants.ts: 5 FIX_LIBRARY actions migrated from `openclaw jobs/*` to `openclaw cron/*` (CRITICAL/LLM_AGENT_CRON/ERROR_WASTE/PREMIUM_MODEL_WASTE/WARNING). ERROR_WASTE now uses `openclaw cron runs --id [JOB_ID] --limit 5` (flag syntax, not positional) and `openclaw cron edit --enable` (not --resume). CRITICAL/LLM_AGENT_CRON use `openclaw cron disable` (not edit --disable/--no-agent-turn). WARNING uses `--every 6h` (not cron expression string). src/main.ts buildFixSteps: one command per job ID to avoid multi-ID command risk; ERROR_WASTE renders separate `cron show` + `cron runs --id` per job; ID parsing changed from `split(',')` to `split(/[,\s]+/)` to handle both comma-separated and whitespace-separated ID lists; active fix cards render one command per job ID. index.html BEST option: replaced `openclaw export` with `~/.openclaw/cron/jobs.json` + `~/.openclaw/cron/runs/*.jsonl`. importTip updated accordingly. tests/i15a-openclaw-cli-guidance.test.ts: 145 tests covering CLI syntax, forbidden patterns, multi-ID risk (whitespace/comma), local path references. Total test suite: 444 tests. CLI syntax verified against `openclaw cron --help` output. PR #119 (follow-up): fixed real-data browser regression where ERROR_WASTE fix cards rendered multi-ID commands (e.g. `cron show ID1 ID2`) instead of one per ID. Browser sanity check PASS after PR #119 merge. | #115, #119 | **CLOSED** |
| I15-B (Active vs Historical/Disabled Waste Distinction) | src/domain.ts: added `isEnabled(job)` pure helper — reads `enabled`/`active` field from `job.raw`, returns `boolean|null`. Added `isActiveJob(job)` — classifies `lifecycleStatus` as `'active'|'disabled'|'historical'`. Rules: synthetic=true → 'historical'; enabled===false → 'disabled'; otherwise → 'active' (conservative, missing enabled→'active'). src/main.ts: per-job `lifecycleStatus` assignment; `activeJobs` filtered to exclude disabled and all synthetic jobs (no job definition = no fix possible); `historicalJobs` includes disabled jobs and all synthetic jobs; `renderTopWaste` adds secondary muted 'Historical / disabled review signals' section after active top waste; disabled jobs show 'Disabled' label, grey opacity, no urgent color; synthetic jobs show 'Unmapped historical run' label, no name heading; `renderFixes` adds muted historical fix cards with 'Review signal' badge (never CRITICAL/ERROR_WASTE) and grey job tags; historical/disabled fix cards show only inspect commands (`cron show`/`cron runs`) — no edit/disable/enable. tests/i15b-active-historical.test.ts: 38 tests covering isEnabled aliases, synthetic classification, active/conservative fallback, synthetic-with-runs edge case (historical but included in historicalJobs, excluded from activeJobs), disabled job outrank prevention. Total test suite: 354 tests / 10 files. | #117 | CLOSED |
| I16 (UX-only .rar Import Guidance) | src/main.ts: fail-fast RAR rejection in `ingestLooseFile()` — checks /\.rar\$/i before `await file.text()` to avoid loading a potentially large binary archive into memory; `mapErrorMessage()` maps RAR-specific error to user-facing local-extraction guidance with supported format list (.zip, .json, .jsonl). No RAR parser added. No WASM, no backend, no telemetry, no dependency changes. tests/i16-rar-import-guidance.test.ts: 4 tests covering RAR guidance exact-string, generic unsupported regression, unrelated-error pass-through, case-sensitivity. Total test suite: 448 tests / 11 files. | #121 | CLOSED |
| I13-B (Audit-Language UI Rename) | index.html copy-only: <title> renamed to "TokenSave — Agent Job Waste Audit", <h1> renamed to "Agent Job Waste Audit", subhead changed from passive "inspect job waste" to active "surface recurring token burn, failure loops, and fix priorities". No logic, no rules, no domain changes. | #104 | CLOSED |
| I13-A (Evidence-to-Fix Card Clarity) | src/main.ts copy/UX only. renderImportSummary: added audit-strength framing note that explains what the audit can prove based on evidence quality (full → core diagnostics have strongest evidence; partial → most diagnostics available, some weakened; limited → only basic diagnostics; minimal → audit strength limited). renderFixes restrained-state: improved message to explain fix cards need at least job definitions OR run history, specific import paths, and explicitly states fixes are CLI text only — no auto-apply. No parser/rules/domain/pricing/constants/fixes behavior changes. | #102 | CLOSED |
| I4-A (Pricing-Baseline-Metadata) | Add metadata fields to every COST_RATES entry: source, sourceType, checkedDate, status, approximationNote. All entries source=null, sourceType='unverified', checkedDate=null, status='unknown' — intentional placeholder. No numeric rates changed. No regex changed. detectCostRate behavior unchanged. D5 fires for unknown models as before. I4-B will collect official provider sources and correct rates with BG approval. | #82 | CLOSED |
| I2b.6H | Extract compareJobs to src/domain.ts | #41 | CLOSED |

**I2b overall: CLOSED — Completed** — All 26 PRs across 17 implementation slices + docs/hotfixes complete. All acceptance criteria met.

---

## Next Action

**Issue #11 (I2b): CLOSED as complete.** All acceptance criteria met. All safely extractable pure helpers migrated to `src/` modules.

**I10-B1 (Export Guidance + Import Error UX) — CLOSED.** Added 3-path OpenClaw diagnostic file guidance in `index.html` and clearer import parse error messages in `src/main.ts`. This was guidance/UX only: no backend, no telemetry, no network calls in app code, and no runtime file-write path intended.

**I7A test hygiene follow-up — CLOSED.** PR #96 updated `tests/no-network.test.ts` to handle the Vite modulepreload polyfill false positive in generated `dist/assets` output, expanded forbidden network API coverage to include EventSource, and restored the expected passing no-network regression under current Windows/Vite output. `npm test` should now pass 261 tests (current suite).

**I9-B (Import-to-Action Funnel) — CLOSED.** Added buildReadinessGaps() pure function, ReadinessGap type, present/missing evidence tags, affected diagnostics mapping, manual next-step guidance, and precise fix-card restraint (&& not ||). 12 new tests in parser.test.ts including 3 regression cases. No parser/D-rule/pricing/COST_RATES/domain behavior change. No backend/network/telemetry/export/auto-apply. Total test suite: 203 tests.

**I9-A (Local Log Import + Audit-Ready Evidence Layer) — CLOSED.** Added import summary panel (renderImportSummary), detectImportSource(dataset) pure function, dataset.fileCount wiring, hasFiniteTokenField zero-token detection, tightened supportedRuleHint='full' requiring jobs+runs+tokens+schedules+models. No backend/network/telemetry/export/runtime-write. No pricing/rule/domain behavior changes.

**I4-C1 (Token-first Waste Action UI Correction) — CLOSED.** src/main.ts only. Reoriented UI from cost-dashboard to token-waste-action tool. Default sort: `cost` → `tokens`. Summary cards: Avoidable Token Burn first, Approx. Cost Exposure last/secondary. Labels updated: Approx. Cost Exposure, Approx. Avoidable Cost Exposure, Avoidable Token Burn. hasConservativeEstimates branch restored known-local avoidable cost signal. No pricing/rule/parser/domain/constants changes.

**I3A (Parser-Char-Tests) — CLOSED.** Added 12 characterization tests for parseJson / parseJsonl / parseZipEntries in tests/parser.test.ts. I9-A later expanded parser.test.ts to 34 tests (detectImportSource coverage). No parser behavior changes.

**I3B (Parser-Fixture-Tests) — CLOSED.** Added 4 fixture-based tests using realistic text fixtures under tests/fixtures/parser/. I3A + I3B together provide comprehensive inline + fixture coverage for parseJson and parseJsonl. No src changes.

**I3.2B (Pricing-Confidence) — CLOSED.** Unknown model fallback now uses highest known positive rate (15) as conservative estimate. PricingSource tracking implemented. Conservative-estimate jobs included in totalCost, excluded from precise totalCostSaving.

**I3.2C-A (Pricing-Exposure-UI) — CLOSED.** Summary UI now shows split exposure: Known Local Cost card (precise), Conservative Unknown Exposure card (estimated), and Estimated Total Cost card. Simple single Estimated Cost card preserved when all costs are known.

**I7B (Evidence-Bundle) — CLOSED.** Added WasteEvidence type + buildWasteEvidence for waste classification. 7 new tests in tests/evidence.test.ts. Total test suite now 34 tests. I7A + I7B + I7C together complete all Issue #6 acceptance criteria. Issue #6 is CLOSED (BG 2026-04-30).

**I5-D3 (Diagnose-D3) — CLOSED.** Added diagnoseD3PremiumModelOnSimpleJob pure function in src/rules.ts. Fires when isSimpleCheck(job,promptText) AND pricingSource='known-local' AND rateMultiplier >= 5. Uses MiniMax M2.7 as v1 bundled-pricing reference model (rate derived at runtime via detectCostRate('MiniMax M2.7').rate). MiniMax M2.7 is not a permanent industry standard; future Issue #3 pricing policy should move reference logic out of D3. 19 tests in tests/rules.test.ts. D1-D7 sub-slice 4 of N. Issue #4 is CLOSED (BG approved 2026-04-30). Issue #6 is CLOSED (BG 2026-04-30).

**Project pricing architecture decision (BG/GPT-5.5):** TokenSave uses two pricing layers: (1) TokenSave maintained pricing baseline with version/lastUpdated metadata; (2) User preference/override layer (simple controls: provider/pricing mode, enterprise discount, model price override, reference preference). Users should not be required to manually import pricing files. Any future online pricing update must be explicit/transparent and must not send user export/config/model usage data out of the browser.

**I5-D4 (Diagnose-D4) — CLOSED.** Added diagnoseD4AgentTurnCronBurn pure function in src/rules.ts. Fires when agentTurn=true AND scheduleMinutes ∈ (0, 60). Reads agentTurn aliases (agentTurn/agent_turn/agent_turn_enabled) and schedule aliases (schedule/interval/frequency/cron). 16 tests in tests/rules.test.ts. D1-D7 sub-slice 3 of N. Issue #4 is CLOSED (BG approved 2026-04-30). Issue #6 is CLOSED (BG 2026-04-30).

**I5-D6 (Diagnose-D6) — CLOSED.** Added diagnoseD6ZeroTokenAbnormalRun pure function in src/rules.ts. Fires when totalRuns > 0 AND totalTokens === 0; returns null otherwise. Handles missing/non-finite values gracefully without throwing. 13 tests in tests/rules.test.ts. D1-D7 sub-slice 2 of N. Issue #4 is CLOSED (BG approved 2026-04-30). Issue #6 is CLOSED (BG 2026-04-30).

**I5-D5 (Diagnose-D5) — CLOSED.** Added diagnoseD5UnknownModelPricing pure function in src/rules.ts. DiagnoseRuleResult contract uses nested evidence bundle { ruleId, explanation, sourceFields, observedValue, threshold }. 8 tests in tests/rules.test.ts. D1-D7 sub-slice 1 of N. Issue #4 is CLOSED (BG approved 2026-04-30). Issue #6 is CLOSED (BG 2026-04-30).

**Recommended Next Steps**:
**I15-A (OpenClaw CLI Guidance) — CLOSED (PR #115 + PR #119).** PR #115 migrated to cron command family; PR #119 fixed real-data browser regression where multi-ID ERROR_WASTE fix cards rendered one command with multiple IDs instead of one per job ID. Browser sanity check PASS. All I15-A acceptance criteria met.

**I16 (UX-only .rar Import Guidance) — CLOSED (PR #121).** Fail-fast RAR rejection before `file.text()` load in `ingestLooseFile()`, `mapErrorMessage()` RAR branch mapped to local-extraction guidance. No RAR parser, no WASM, no backend, no telemetry. Focus remains on real-data audit usefulness / core waste loop.

**Recommended Next Steps**:
- Focus on real-data audit usefulness / core waste loop
- No new implementation slices until BG approves next planning PR.

## Current Local Validation Reality

- `npm run build` passes.
- `npm test` passes 448 tests (PR #121: 4 tests in tests/i16-rar-import-guidance.test.ts; PR #119: 145 tests in tests/i15a-openclaw-cli-guidance.test.ts; PR #117: 38 tests in tests/i15b-active-historical.test.ts; total suite 11 files, 448 tests).
- `tests/no-network.test.ts` now handles the Vite modulepreload polyfill false positive from generated `dist/assets` output.
- Source/runtime scan remains intended to catch forbidden app network APIs, including fetch, XMLHttpRequest, sendBeacon, WebSocket, and EventSource.

---

## Open Issues and Recommended Cleanup Actions

> ⚠️ Do not close or modify issues unless BG explicitly approves. Listed here for reference.

| Issue | Title | Status | Recommended Action |
|-------|-------|--------|-------------------|
| #11 | I2b: Migrate index.html logic into src modules | **CLOSED** | All acceptance criteria met. All pure helpers extracted. |
| #10 | I2a: Vite + TypeScript scaffold with minimal behavior changes | **CLOSED** | Completed by PR #14. Closed 2026-04-28. |
| #9 | I1.1: Harden .gitignore and add process docs | **CLOSED** | Completed by PR #13. Closed 2026-04-28. |
| #8 | I2: Vite + TypeScript scaffold | **CLOSED** | Parent of I2a. Completed by PR #14 and Issue #11 / I2b. Closed 2026-04-28. |
| #7 | I8: README, MVP_SPEC, PRIVACY, SECURITY, RULES docs | **PARTIALLY COMPLETE — Slices A+B DONE** | README.md (PR #110), MVP_SPEC.md (PR #110), PRIVACY.md (PR #112), SECURITY.md (PR #112) merged. RULES.md pending — Issue #5 (B1-B3/W1-W5) must close or BG must approve D1-D7-only partial rules doc first. Issue #7 remains OPEN. |
| #6 | I7: No-network test and evidence bundle system | **CLOSED (COMPLETED)** | I7A (PR #44): no-network regression test. I7B (PR #59): WasteEvidence type + buildWasteEvidence. I7C (PR #79): D1-D7 evidence contract regression coverage. All acceptance criteria met. Issue closed by BG 2026-04-30. |
| #5 | I6: Rule engine — Pre-flight rules B1-B3 and W1-W5 | OPEN | Future issue. Requires separate BG approval. RULES.md depends on this. |
| #4 | I5: Rule engine — Diagnose rules D1-D7 | **CLOSED (COMPLETED)** | D1-D7 sub-slices all CLOSED. Issue closed by BG 2026-04-30. |
| #3 | I4: Domain layer — pricing data and cost calculation | OPEN | Partially advanced by I3.2B conservative-estimate fallback and I3.2C-A split pricing UI. Full issue scope requires separate BG decision. |
| #2 | I3: Add parser modules with tests | **CLOSED** | I3A (PR #53): 12 inline characterization tests. I3B (PR #55): 4 fixture-based tests. Combined 16 tests in tests/parser.test.ts. src/parser.ts unchanged. Closed 2026-04-28. |
| #1 | I1: Remove tracked node_modules and add .gitignore | CLOSED | Done. |

---

## Protected Product Constraints

These constraints are **never negotiable** regardless of issue scope:

- **Local-first**: files never leave the device
- **No backend**: zero server-side components
- **No telemetry, analytics, tracking**: zero external data egress
- **No app runtime fetch/XMLHttpRequest/sendBeacon/WebSocket/EventSource**: zero network calls from the app
- **No external LLM/API calls**: app never calls any LLM or external API
- **No auto-apply**: fix hints are CLI text only, never executed
- **No runtime write-path**: app does not write any files
- **No API key collection**: zero credential handling
- **No export/report/share/download unless explicitly approved**: do not add data egress or file-generation surfaces without BG approval
- **node_modules/ in .gitignore**: never commit node_modules
- **No secrets in repo**: zero credentials or tokens in source
- **Unknown model pricing defaults to highest reasonable rate**: never cheap

---

**I5-D2 (Diagnose-D2) — CLOSED.** Added diagnoseD2BurstSpend pure function in src/rules.ts. Input: Record<string, unknown>[] (run-record level, not FinalizedJob level). 60-minute rolling window scans all records to find highest-cost window. Fires when >= 3 distinct jobs AND >= USD 50 estimated total cost in that window. Severity: info — review signal only, not waste proof. Does not calculate potential savings. Unknown models participate and are labeled conservative-estimate in evidence. 19 new tests in tests/rules.test.ts. Total suite: 187 tests. D1-D7 sub-slice 6 of N. Issue #4 is CLOSED (BG approved 2026-04-30). Issue #6 is CLOSED (all slices complete as of 2026-04-30).

**D2 Decision (BG 2026-05-05):** D2 (burst spend concentration review signal) stays disconnected. Do not wire into main UI waste ranking or waste proof logic. Decision only — no code change. Revisit when/if multi-export or temporal recurrence analysis is implemented in future work.

**Recommended Next Step**: PR #108 (I14-B) merged on main at `7228ce0`. PR #107 (docs refresh after PR #106) also merged. Next: review Issue #103 remaining items and choose next smallest slice. Recommended: Issue #103 post-I14 reassessment — product review first, no-code. Do not start new implementation immediately.

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
- [ ] BG_MERGE_AUTHORIZATION block present in latest message: `PR: #<number>`, `HEAD_SHA: <sha>`, `ACTION: MERGE_NOW`

---

*This document was created to eliminate stale-memory dependency for future agents. Verify, don't trust.*
