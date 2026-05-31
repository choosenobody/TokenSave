# TokenSave Input Schema — Informal Notes

These notes describe the expected structure of an OpenClaw/Hermes job export that TokenSave can process. They are **not** a formal JSON Schema specification.

---

## Top-Level Structure

TokenSave accepts a JSON array of job objects:

```json
[
  { /* job */ },
  { /* job */ }
]
```

## Required Fields Per Job

| Field | Type | Description |
|---|---|---|
| `job_id` | string | Unique identifier for the job |
| `status` | string | `"active"` or `"paused"` |
| `model` | string | Model name used for this job |

## Optional Fields (currently used by diagnostics)

| Field | Type | Description |
|---|---|---|
| `title` | string | Human-readable job name |
| `schedule` | string | Cron expression (5-field format) |
| `prompt_summary` | string | Short description of the job's task |
| `runs` | number | Total number of executions recorded |
| `input_tokens` | number | Cumulative input tokens across all runs |
| `output_tokens` | number | Cumulative output tokens across all runs |
| `totalTokens` | number | Combined token count (may be used if input/output are absent) |
| `tool_calls` | string[] | List of tool names this job calls |
| `error_count` | number | Number of runs that ended in error |
| `last_run_at` | string | ISO 8601 timestamp of most recent run |

## Import Format Support

TokenSave currently handles:
- **JSON array** — direct import
- **JSONL** — one JSON object per line
- **ZIP** — compressed export from OpenClaw/Hermes with JSON array inside

Import format is auto-detected by file extension:
- `.json` → JSON array
- `.jsonl` → JSONL
- `.zip` → ZIP

## Diagnostic Coverage

| Diagnostic | Key Fields Used |
|---|---|
| D1 Duplicate Jobs | `prompt_summary`, `schedule`, `tool_calls`, `status` |
| D2 Retry Loop | `error_count`, `runs`, `schedule`, `prompt_summary` |
| D3 Context Bloat | `totalTokens`, `runs` |
| D4 Model / Routing Waste | `model`, `totalTokens` |
| D5 Low-Value Tool Calls | `tool_calls`, `runs` |
| D6 Stale Automation | `error_count`, `output_tokens`, `last_run_at`, `runs` |
| D7 Risky Silent Patterns | `error_count`, `output_tokens` |
