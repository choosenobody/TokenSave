# TokenSave MVP Specification

## MVP Objective

TokenSave MVP is a local-first recurring AI agent job waste audit tool. It imports job data from a local file, analyzes it through an evidence-backed waste signal pipeline to surface token waste signals, produces evidence bundles, and guides the user through manual fix steps — all without any network access or server-side components.

## MVP Workflow

1. **Import** — Load job data from a local JSON file
2. **Diagnose** — Analyze imported data through the evidence-backed waste signal pipeline
3. **Evidence** — Generate evidence bundles (WasteEvidence type) with problem text and fix hints
4. **Manual Fix** — Review fix cards and apply corrections outside the app

## MVP Includes

- **D1** — Aggregate failure-loop detection (totalRuns ≥ 3, errorRuns/totalRuns ≥ 80%)
- **D2** — Burst-spend concentration (≥ 3 jobs with ≥ $50 in a 60-min window) — review signal only, does not contribute to waste proof or ranking
- **D3** — Premium model on simple job (isSimpleCheck + known-local + rateMultiplier ≥ 5)
- **D4** — Agent-turn cron burn (agentTurn=true + scheduleMinutes ∈ (0, 60))
- **D5** — Unknown model pricing diagnostic with conservative estimate fallback
- **D6** — Zero-token abnormal run (totalRuns > 0, totalTokens === 0)
- **D7** — Exact duplicate active job (≥ 2 active jobs, same model + schedule + task)
- *These rules are implemented as pure diagnostic functions with test coverage. The active import analysis pipeline surfaces waste signals through the existing classification and evidence system.*
- Evidence bundle system (WasteEvidence type + buildWasteEvidence)
- Import audit readiness summary (detectImportSource + buildReadinessGaps)
- Fix cards with evidence-backed problem text for CRITICAL and ERROR_WASTE severity
- No-network design: the app is built without network calls; the test suite statically scans built assets for forbidden APIs to catch regressions
- Local-first privacy: files never leave the device, no telemetry, no analytics

## MVP Does NOT Include

- B1–B3 / W1–W5 pre-flight rules (deferred to Issue #5 RULES.md)
- Backend, server-side components, or any hosting/deployment
- Telemetry, analytics, or tracking of any kind
- Auto-apply fixes — fix hints are CLI text only, never executed
- Export, report, or download functionality (3-path export guidance is UI-only)
- Runtime pricing updates or live cost lookups
- Multi-export temporal analysis
- Browser extension implementation

## D1–D7 Summary

| ID | Diagnostic | Notes |
|----|------------|-------|
| D1 | Aggregate failure-loop | totalRuns ≥ 3, errorRuns/totalRuns ≥ 80% |
| D2 | Burst-spend concentration | Review signal only — does not contribute to waste proof or ranking |
| D3 | Premium model on simple job | isSimpleCheck + known-local + rateMultiplier ≥ 5 |
| D4 | Agent-turn cron burn | agentTurn=true + scheduleMinutes ∈ (0, 60) |
| D5 | Unknown model pricing | Conservative estimate fallback used |
| D6 | Zero-token abnormal run | totalRuns > 0, totalTokens === 0 |
| D7 | Exact duplicate active job | ≥ 2 active, same model + schedule + task |

## Evidence Boundaries

TokenSave can produce evidence of:
- Recurring failure loops and error rate patterns
- Duplicate active jobs running concurrently
- Misuse of premium models on simple, local tasks
- Excessive agent-turn cron frequency
- Zero-token runs that appear abnormal
- Burst-spend concentration across multiple jobs

TokenSave cannot prove:
- Precise dollar amounts saved or spent (cost is approximate and secondary)
- Root cause of failures (only pattern detection)
- Whether a job is genuinely necessary (signal only)

## Privacy / Local-First Constraints

- All files stay on the user's device — no data leaves during import, audit, or export
- No backend, server-side components, or runtime server calls
- No telemetry, analytics, or tracking
- No external LLM or API calls
- No API key collection
- `node_modules/` is gitignored

## Deferred / Future Items

- **Issue #5 RULES.md** — B1–B3 and W1–W5 pre-flight rules
- **PRIVACY.md / SECURITY.md** — Detailed policy docs (later slices)
- **Browser extension** — Future planning only, not in MVP scope
