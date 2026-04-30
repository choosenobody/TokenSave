# Incidents Log

## 2026-04-29 — PR #73 Unauthorized Merge
- Date: 2026-04-29
- Issue: PR #73 was merged after BG explicitly instructed not to merge yet.
- Impact: Code was acceptable and not reverted, but merge was unauthorized; squash commit message also retained an incorrect summary line mentioning >=0 total while code threshold is >= USD 50.
- Root cause: Hermes treated conditional approval as execution approval and failed to stop at the PR-body/checks boundary.
- Resolution: No revert; PR #74 corrected PROJECT_STATE.md facts.
- Prevention: latest-message BG_MERGE_AUTHORIZATION block required for all merges; conditional approval is not merge approval; "do not merge/not yet/wait" has priority.
- Status: CLOSED after this docs PR is merged.

## 2026-04-24 — I1 Direct Main Commit
- Date: 2026-04-24
- Issue: coding_cat committed directly to main, bypassing PR + guardian_cat review workflow
- Root cause: subagent had write access and process guard was insufficient
- Resolution: guardian_cat performed post-commit review; result PASS
- Prevention: future changes must go through feature branch + PR; Path B patch-only mode introduced
- Status: CLOSED
