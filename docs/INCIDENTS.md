# Incidents Log

## 2026-04-24 — I1 Direct Main Commit
- Date: 2026-04-24
- Issue: coding_cat committed directly to main, bypassing PR + guardian_cat review workflow
- Root cause: subagent had write access and process guard was insufficient
- Resolution: guardian_cat performed post-commit review; result PASS
- Prevention: future changes must go through feature branch + PR; Path B patch-only mode introduced
- Status: CLOSED
