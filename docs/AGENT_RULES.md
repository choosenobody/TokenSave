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
