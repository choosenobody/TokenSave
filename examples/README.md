# TokenSave Examples

These files contain fully synthetic data for demonstration and testing purposes. No real usernames, emails, tokens, API keys, wallet addresses, or production data is included.

## Files

### `sample-openclaw-export.json`
A realistic synthetic export of recurring agent jobs in OpenClaw/Hermes format. Use this to test the import pipeline without exposing real job data.

### `sample-audit-report.md`
A rendered audit report showing D1, D2, and D4 diagnostic findings on the sample data. Each finding includes evidence, severity, and manual fix guidance.

### `sample-schema-notes.md` *(optional)*
Informal notes on the input schema structure. Not a formal JSON Schema — see the parser source for the authoritative contract.

## Synthetic Data Notice

All data in these examples is fabricated:
- Job IDs are randomly generated (`job_xxx`, `job_yyy` patterns)
- Model names, token counts, schedules, and tool calls are realistic but fictional
- No real production logs, secrets, or user data are included
- Any similarity to real jobs is coincidental
