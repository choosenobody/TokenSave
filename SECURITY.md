# Security

## Security Model

TokenSave is a local-first diagnostic tool. It reads user-selected local files, analyzes them in-memory within the browser session, and produces text-based evidence and fix hints. There is no server component and no data leaves the user's device during normal operation.

## Threat Model

TokenSave addresses token waste from recurring AI agent jobs. The primary assets are the imported job data files and the analysis results shown in the session.

Potential concerns:

- **Importing untrusted files**: TokenSave processes arbitrary JSON. As with any tool that parses external data, importing malformed or maliciously crafted files could cause unexpected behavior. TokenSave runs as a browser app with standard browser sandboxing; it does not request elevated system access.
- **Sensitive data in imported files**: Job data files may contain model names, token counts, schedules, or error messages. These are processed locally and are never transmitted.
- **Fix hints**: Fix hints are static CLI text. They are never auto-applied or executed by TokenSave.

## Data Storage and Retention

- **No server-side storage**: The current MVP has no backend, database, or hosting component.
- **No local history store**: The current MVP does not intentionally maintain a persistent local history of imported files or analysis results.
- **Session-only analysis**: User-selected files are read for analysis within the browser session only. Data is not written to disk by TokenSave and is not retained after the session ends.
- **No data off the device**: No telemetry, analytics, or tracking means no data is sent anywhere.

## Non-Goals

TokenSave is NOT:

- A sandbox for untrusted code
- Endpoint protection or a security policy enforcement tool
- A SaaS product or backend service
- Runtime policy enforcement or a kill switch
- Auto-remediation — fix hints are CLI text only, never auto-applied
- A precise cost-saving calculator (cost is approximate and secondary)

## Controls

| Control | Implementation |
|---------|----------------|
| Local-first design | All processing on-device; no server calls |
| No telemetry | No analytics, no tracking, no third-party telemetry SDKs |
| No external API calls | App makes zero calls to external LLMs or APIs |
| No API key collection | App never requests or stores API keys |
| No-network static scan | `tests/no-network.test.ts` statically scans `dist/assets/*.js` for `fetch(`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, and external URL literals after build — not runtime blocking |
| CLI text-only fix hints | Fix hints are text displayed to the user; no auto-apply, no execution |
| Code review gate | All privacy and security claims require PR review; `guardian_cat` review required for policy changes |

## Vulnerability Reporting

Report vulnerabilities via GitHub issues or by contacting the repository maintainer directly. Please do not include sensitive job data or credentials in bug reports. There is no SLA commitment for responses; the team will endeavor to triage and address reported issues.
