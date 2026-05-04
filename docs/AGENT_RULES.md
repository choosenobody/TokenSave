# Agent Rules for TokenSave.cloud

## Development Workflow
1. Hermes Agent defines issue and assigns to coding_cat
2. BG approves before implementation
3. coding_cat creates feature branch (NOT direct to main)
4. coding_cat opens PR targeting main
5. guardian_cat reviews PR
6. coding_cat fixes any review comments
7. guardian_cat returns PASS
8. BG approves merge
9. Only then is the PR merged

## Low-Risk Codex Review Lane
This lane is allowed only when ALL conditions are true:
1. PR is tests-only or docs-only.
2. No src runtime behavior changes.
3. No index.html changes.
4. No package.json / package-lock.json / dependency changes.
5. No pricing/cost wording or pricing logic changes.
6. No parser/domain rule behavior changes.
7. No privacy/storage/network/runtime file-write changes.
8. No export/report/share/download changes.
9. No backend/gateway/SaaS/team/admin/Kill Switch work.
10. Validation passes.
11. Codex review returns PASS.
12. BG still gives explicit merge authorization before merge.

When this lane applies, guardian_cat review may be skipped for that PR, but auto-merge is still forbidden and the Merge Authorization Protocol still applies in full.

guardian_cat remains required for:
- source/runtime changes
- parser/domain behavior changes
- pricing/cost changes
- product positioning/copy changes
- UI changes
- privacy/storage/network/file-write/dependency changes
- export/report/share/download changes
- backend/gateway/SaaS/team/admin/Kill Switch work
- any Codex uncertainty
- any failed or incomplete validation

## Non-Negotiable Rules
- Local-first: files never leave the device
- No backend
- No telemetry, analytics, tracking
- No fetch/XMLHttpRequest/sendBeacon
- No external LLM calls
- No auto-apply or runtime write-path
- No API key collection
- node_modules/ in .gitignore — never commit node_modules
- No secrets in repo
- Every rule has named ID and evidence
- Unknown model pricing must not default to cheap
- Fix hints are CLI text only, never executed

## Issue Naming
- Use format: I1, I2, I1.1, I2a, I2b, etc.
- Prefix feature branches: feature/I2a-vite-scaffold

## Merge Authorization Protocol
- Merge is a high-risk action and never happens as an implied next step.
- Hermes/coding_cat/guardian_cat may not merge any PR unless BG's latest message contains this exact block:
  ```
  BG_MERGE_AUTHORIZATION:
  PR: #[number]
  HEAD_SHA: [exact current PR head SHA]
  ACTION: MERGE_NOW
  ```
- The PR number must match.
- The current PR head SHA must match.
- ACTION must be exactly `MERGE_NOW`.
- Older approval does not count.
- Conditional approval does not count.
- "After X, merge" does not count.
- "Approved once checks pass" does not count.
- If the block is absent, `merge_action = forbidden`.

## Stop Point Protocol
- Mandatory stop points:
  - after PR body edits
  - after validation/checks
  - after guardian_cat PASS
  - after Codex review PASS for a Low-Risk Codex Review Lane PR
  - before implementation PR merge
  - after implementation PR merge
  - before docs PR merge
  - before issue close/reopen
  - before revert/force-push/delete-main-related actions
- At a stop point, Hermes must report status and wait for BG.
- Hermes must not infer BG approval from completed preconditions.

## Negative Instruction Priority
- Any phrase like "do not merge," "not yet," "wait," "stop," or "report first" overrides later procedural text.
- If a prompt contains both a prohibition and a conditional future action, the prohibition wins until BG sends a fresh authorization block.
