# TokenSave Audit Report — Synthetic Sample

**Generated at:** 2026-05-30T15:00:00Z
**Input file:** `sample-openclaw-export.json`
**Jobs imported:** 6
**Diagnostic version:** v0.1.0

---

## D1 — Duplicate Jobs (High)

**Finding:** `job_fkd290` and `job_fkd291` are running the same task 3 minutes apart.

**Evidence:**
- Both call `fetch` + `file-write` with identical `prompt_summary` values
- `job_fkd291` has 12 errors against 5 runs — strongly suggests it's a retry wrapper
- Schedule difference is exactly 3 minutes — a typical retry offset pattern
- Combined, these jobs double every morning's token spend on this workflow

**Why it matters:** Duplicate scheduling at scale compounds quickly. With each run consuming ~1600 tokens, the pair wastes ~3200 tokens/day. Over 30 days that is roughly 96,000 tokens attributed solely to duplication — not counting the original runs.

**Manual fix:** Deactivate `job_fkd291`. If it was created as a fallback, investigate whether `job_fkd290`'s upstream fetch failures are the root cause and address those instead.

**What NOT to automate automatically:** Never delete a job without confirming which instance is the canonical one. A retry wrapper that occasionally covers failures may serve a legitimate purpose — verify before removing.

---

## D2 — Retry Loop (High)

**Finding:** `job_fkd291` has an error/runs ratio of 12:5 — 240% failure rate, strongly indicating a retry loop.

**Evidence:**
- 12 recorded errors across 5 total runs — the job rarely completes successfully
- 3-minute offset from `job_fkd290` positions it as a scheduled retry, not a standalone job
- The error count keeps growing with each run — the underlying condition has not been resolved

**Why it matters:** Retry loops thatnever resolve the root cause silently burn tokens indefinitely. Each failed run consumes tokens with no output. If the root cause is a connectivity issue, the job will continue failing every day without human intervention.

**Manual fix:** Check the error logs for `job_fkd291`. The root cause is likely a fetch endpoint timeout or auth issue. Fix the upstream condition before the retry loop continues. Consider converting to a conditional trigger (only fire if `job_fkd290` fails) rather than a fixed schedule.

**What NOT to automate automatically:** Do not auto-disable or auto-delete this job. Its existence may indicate a gap in error handling that needs an architectural fix, not a cleanup.

---

## D4 — Model / Routing Waste (Medium)

**Finding:** `job_pql882` uses `gpt-4o` for a portfolio digest email.

**Evidence:**
- Prompt: gather performance data + generate email — no multi-step reasoning, vision, or complex function-calling
- Average `totalTokens` per run: 10,300 — well within gpt-4o-mini's capability
- `gpt-4o-mini` is rated for this workload at roughly 1/4 the cost

**Why it matters:** `gpt-4o` at $15/1M input + $60/1M output tokens, this job costs approximately $0.058/run. On `gpt-4o-mini` the same job costs approximately $0.015/run — roughly 4× reduction with equivalent output quality for this task type.

**Manual fix:** Change `model` from `gpt-4o` to `gpt-4o-mini`. Run 2–3 sample executions and compare output quality. If the digest email reads equivalently, make the change permanent. If quality degrades, revert and investigate why.

**What NOT to automate automatically:** Model swaps can introduce subtle output quality regressions in tasks that depend on instruction-following precision. Do not auto-switch based on token count alone.

---

## D6 — Stale Automation (Medium)

**Finding:** `job_hpq771` has produced zero output tokens across 61 runs.

**Evidence:**
- `output_tokens: 0` across all recorded runs — the job has never returned content
- `error_count: 34` shows recurring failures — likely the zero-output condition is failure-related
- `tool_calls: file-read, send-alert` suggests it is supposed to send an alert on a condition, but never generates alert text
- Last run: `2026-05-29T06:00:00Z` — still actively scheduled despite chronic failure

**Why it matters:** Zero-output jobs are consuming tokens with no observable benefit. They may indicate a broken automation that is silently failing its intended purpose. If this job has been running for months without anyone noticing, the underlying issue has had months to compound.

**Manual fix:** Inspect the raw logs for `job_hpq771`. The file read path or alert pipeline is broken. Fix the alert path so that failures are surfaced rather than silently consumed. If the job's purpose no longer applies, deactivate it.

**What NOT to automate automatically:** Do not delete this job — it may be a component of a larger workflow whose failure mode would be worse if removed without understanding.

---

## Summary

| Diagnostic | Severity | Jobs Affected |
|---|---|---|
| D1 Duplicate Jobs | High | 2 |
| D2 Retry Loop | High | 1 |
| D4 Model Waste | Medium | 1 |
| D6 Stale Automation | Medium | 1 |

**Recommended first action:** Deactivate the retry wrapper (`job_fkd291`) and investigate its error log — this is the highest-leverage fix with lowest risk.

---

*This report was generated from synthetic sample data. All job data, token counts, and findings are fabricated for demonstration purposes.*
