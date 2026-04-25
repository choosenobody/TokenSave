# TokenSave Project State Snapshot

> **⚠️ WARNING — This document is a snapshot, not a permanent source of truth.**
> Always verify state against GitHub (main branch, open issues, open PRs) before acting.
> This file itself may be stale if last updated date is more than 48h ago.
> Do not assume this file reflects current reality.

**Last updated**: 2026-04-25T08:50:00Z
**Source**: GitHub API + local `origin/main` checkout at commit `69ab3e7`

---

## Current Repo State

| Item | Value |
|------|-------|
| Repo | choosenobody/TokenSave |
| Main branch SHA | `69ab3e7` (PR #14 merge) |
| Package manager | npm |
| Build tool | Vite 5 + TypeScript 5 |
| Root config | `index.html` (2108 lines, monolithic script) |
| src/ | Empty directory (`.gitkeep` only) |
| dist/ | Not committed (gitignored) |
| node_modules/ | Not committed (gitignored) |

---

## Latest Merged PRs

| PR | Title | Merged | Merge Commit |
|----|-------|--------|-------------|
| #14 | I2a: Vite + TypeScript scaffold | 2026-04-25 | `69ab3e7` |
| #13 | I1.1 corrective: replace docs with guardian_cat-reviewed versions | 2026-04-24 | `b09754c` |

---

## Completed Increments

| Increment | Issue | PR | Status |
|----------|-------|-----|--------|
| I1 | Remove tracked node_modules and add .gitignore | Direct commit | CLOSED |
| I1.1 | Harden .gitignore + add docs/AGENT_RULES.md + docs/INCIDENTS.md | #13 (corrective merge) | CLOSED |
| I2a | Vite + TypeScript scaffold | #14 | CLOSED |

---

## Active Next Issue

**I2b** — Migrate `index.html` logic into `src/` modules after I2a passes.
See: GitHub Issue #11

**Scope** (structure-preserving refactor only):
- Extract separable logic from `index.html` into `src/` modules
- Preserve all existing behavior (upload, parsing, report, UI)
- Preserve local-only file processing
- Keep Vite build working
- Incremental slices (I2b.1, I2b.2, …)

**Forbidden**: No new features, no new pricing model, no diagnose rules D1-D7, no pre-flight rules B1-B3/W1-W5, no backend, no telemetry.

**Recommended slice order**: utilities → constants → parsers → domain logic → UI

---

## Open Issues and Recommended Cleanup Actions

> ⚠️ Do not close or modify issues unless BG explicitly approves. Listed here for reference.

| Issue | Title | Status | Recommended Action |
|-------|-------|--------|-------------------|
| #12 | I1.1: Harden .gitignore and add process docs | **OPEN** | **Superseded by PR #13**. Issue #9 also appears to cover the same work. Recommend: close as duplicate of #9 or mark superseded. |
| #11 | I2b: Migrate index.html logic into src modules | **OPEN** | **Active next issue.** Do not close. |
| #10 | I2a: Vite + TypeScript scaffold | **OPEN** | **Completed by PR #14.** Recommend: close. |
| #9 | I1.1: Harden .gitignore and add process docs | **OPEN** | **Completed by PR #13.** Issue #12 appears to be a duplicate. Recommend: close #12, keep #9 open (or close both if #13 fully addressed the intent). |
| #8 | I2: Vite + TypeScript scaffold | **OPEN** | **Parent of I2a.** I2a was split from this. Recommend: close as completed by #10 and #11 (I2a done, I2b active). |
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

**Start I2b** (Issue #11).

Implementation order suggestion:
1. **I2b.1**: Extract utility functions + establish TypeScript type skeleton
   - `src/types/index.ts` — domain types (JobStat, RunRecord, Report, etc.)
   - `src/utils/format.ts` — pure formatting functions (escapeHtml, formatCurrency, etc.)
   - `src/utils/model.ts` — model rate detection and token counting

2. **I2b.2**: Extract constants (COST_RATES, FIX_LIBRARY, FIX_BADGES)

3. **I2b.3**: Extract file parsers (JSON, JSONL, ZIP)

4. **I2b.4**: Extract domain logic (analyzeDataset, classifyWaste)

5. **I2b.5**: Extract UI/render layer

Each slice should be PR'd and reviewed independently. Rollback = `git revert <merge-commit>`.

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
