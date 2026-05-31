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

**Why it matters:** Duplicate scheduling at scale compounds quickly. With each run consuming ~1600 tokens, the pair wastes ~3200 tokens/day. Over 30 days that is roughly 96,000 tokens attributed solely to duplication — not counting the original runs. Actual dollar impact depends on your provider's pricing table.

**Severity:** High
**Confidence:** High
**Impact type:** recurring_token_waste
**Action risk:** Low
**Verification steps:**
- Confirm which job is the canonical one (check run count, error history, last_output_at)
- Check the last 3 run logs for both jobs
- Deactivate only the retry wrapper after confirming the primary job handles failures correctly

---

## D2 — Retry Loop (High)

**Finding:** `job_fkd291` has an error/runs ratio of 12:5 — 240% failure rate, strongly indicating a retry loop.

**Evidence:**
- 12 recorded errors across 5 total runs — the job rarely completes successfully
- 3-minute offset from `job_fkd290` positions it as a scheduled retry, not a standalone job
- The error count keeps growing with each run — the underlying condition has not been resolved

**Why it matters:** Retry loops that never resolve the root cause silently burn tokens indefinitely. Each failed run consumes tokens with no output. If the root cause is a connectivity issue, the job will continue failing every day without human intervention.

**Severity:** High
**Confidence:** High
**Impact type:** retry_loop_waste
**Action risk:** Medium
**Verification steps:**
- Inspect raw logs for `job_fkd291` — look for recurring error messages
- Check whether the upstream fetch endpoint for `job_fkd290` is stable
- Convert to a conditional trigger (only fire if the primary job fails) rather than a fixed schedule
- Do not delete — the retry wrapper may serve a legitimate purpose once the root cause is fixed

---

## D4 — Model / Routing Waste (Medium)

**Finding:** `job_pql882` uses `gpt-4o` for a portfolio digest email.

**Evidence:**
- Prompt: gather performance data + generate email — no multi-step reasoning, vision, or complex function-calling
- Average `totalTokens` per run: 10,300 — well within gpt-4o-mini's capability
- A lower-cost model may be a candidate, but the actual cost impact depends on the provider pricing table supplied by the user.

**Why it matters:** Potential cost reduction depends on the provider pricing table supplied by the user. TokenSave can flag this as a candidate optimization, but should not calculate exact savings unless pricing input is provided. Run 2–3 quality checks before changing the model.

**Severity:** Medium
**Confidence:** Medium
**Impact type:** routing_waste_candidate
**Action risk:** Medium
**Verification steps:**
- Candidate optimization: test a lower-cost model on 2–3 representative historical inputs
- Compare output quality for the digest email — if content quality remains acceptable, the change may be suitable for this task
- Only change the default model if output quality remains acceptable
- Revert and investigate further if quality degrades

**What NOT to automate automatically:** Do not auto-switch models based only on token count or model name — quality regressions can be subtle and may only surface under specific conditions.

---

## D6 — Stale Automation (Medium)

**Finding:** `job_hpq771` has produced zero output tokens across 61 runs.

**Evidence:**
- `output_tokens: 0` across all recorded runs — the job has never returned content
- `error_count: 34` shows recurring failures — likely the zero-output condition is failure-related
- `tool_calls: file-read, send-alert` suggests it is supposed to send an alert on a condition, but never generates alert text
- Last run: `2026-05-29T06:00:00Z` — still actively scheduled despite chronic failure

**Why it matters:** Zero-output jobs are consuming tokens with no observable benefit. They may indicate a broken automation that is silently failing its intended purpose. If this job has been running for months without anyone noticing, the underlying issue has had months to compound.

**Severity:** Medium
**Confidence:** High
**Impact type:** stale_automation
**Action risk:** Low
**Verification steps:**
- Inspect raw logs for `job_hpq771` — the file read path or alert pipeline is broken
- Fix the alert path so that failures are surfaced rather than silently consumed
- If the job's purpose no longer applies, deactivate it
- Do not delete — it may be a component of a larger workflow whose failure mode would be worse if removed without understanding

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
