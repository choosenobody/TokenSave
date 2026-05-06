# Privacy

TokenSave is a local-first tool. All file processing happens on your device.

## Data Scope

TokenSave imports and analyzes job data from a user-selected local file. Imported files may contain recurring agent job data such as:

- Job names, schedules, and cron expressions
- Model names and pricing tiers
- Token counts and cost estimates
- Run records, error counts, and timestamps
- Job configuration metadata

**TokenSave does not request, receive, or transmit any of this data to external services.**

## What TokenSave Does NOT Do

- No backend, server-side components, or runtime server calls
- No telemetry, analytics, or tracking of any kind
- No external LLM or API calls
- No API key collection
- No export, report, download, or share functionality in the current MVP
- Fix hints are CLI text only — they are never auto-applied or executed

## No-Network Design

The app is built without network calls. The test suite statically scans built `dist/assets/*.js` files after each build for forbidden network API patterns (`fetch(`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, and external URL literals) to catch regressions. This is a static build-asset scan — it is not runtime API blocking or monkey-patching.

## Cost Estimates

Cost figures produced by TokenSave are approximate and secondary. The primary signal is token waste and avoidable token burn. TokenSave cannot produce precise dollar amounts saved or spent.

## User Responsibility

Do not import files that contain secrets beyond what is needed for the audit. If a future export or report feature includes sensitive data, redact that data before use.

## Node Modules

`node_modules/` is gitignored. No third-party packages with network behavior are introduced by TokenSave.
