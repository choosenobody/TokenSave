# TokenSave

TokenSave is a local-first token waste audit tool for recurring AI agent jobs.

## What TokenSave Does

- Imports job data from a local file and runs diagnostic checks to surface waste signals
- Detects failure loops, duplicate active jobs, premium model misuse, and abnormal zero-token runs
- Produces evidence bundles with problem text and fix hints (CLI text only)
- Runs entirely offline — no network calls, no telemetry, no external API usage
- Provides a 3-path export guide so you can decide what to include in your audit export

## What TokenSave Does NOT Do

- Does **not** host, deploy, or provide a SaaS interface
- Does **not** provide a dashboard, agent observability, or archive viewer
- Does **not** offer a kill switch, precise cost-saving calculator, or exact pricing tool
- Does **not** auto-apply fixes, execute runtime file writes, or call external LLMs/APIs
- Does **not** collect API keys or send any data off the device
- Does **not** include a browser extension

## Local Setup

```bash
git clone <repo-url>
npm install
npm run dev
```

## Validation

```bash
npm run build && npm test
```

## Privacy

All files stay on your device. TokenSave is designed to run without any network calls. The test suite statically scans built assets for forbidden network APIs (fetch, XMLHttpRequest, sendBeacon, WebSocket, EventSource) to catch regressions. No telemetry, no external API usage, and `node_modules/` is gitignored.
