# TokenSave

TokenSave helps users find recurring AI agent job waste before it silently turns into long-term token burn.

## What It Audits

- **D1 Duplicate Jobs** — two or more active jobs doing the same work
- **D2 Retry Loops** — jobs that keep failing and rescheduling themselves
- **D3 Context Bloat** — excessive context accumulation in long-running agents
- **D4 Model / Routing Waste** — premium models assigned to tasks that don't need them
- **D5 Low-Value / Unused Tool Calls** — jobs calling expensive tools they never use
- **D6 Stale Automations** — active jobs that have been producing no output for weeks
- **D7 Risky Silent Patterns** — jobs that run without visible output or error signals

## Quick Start

```bash
git clone https://github.com/choosenobody/TokenSave.git
cd TokenSave
npm install
npm run dev
```

## Validation

```bash
npm run build && npm test
```

## Input Example

```json
[
  {
    "job_id": "job_abc001",
    "title": "Daily Crypto Summary",
    "status": "active",
    "schedule": "0 9 * * *",
    "model": "claude-sonnet-4",
    "prompt_summary": "Fetch today's crypto prices, summarize as markdown",
    "runs": 84,
    "input_tokens": 1200,
    "output_tokens": 800,
    "totalTokens": 2000,
    "tool_calls": ["fetch", "markdown-render"],
    "error_count": 0,
    "last_run_at": "2026-05-28T09:00:00Z"
  },
  {
    "job_id": "job_abc002",
    "title": "Daily Crypto Summary — retry",
    "status": "active",
    "schedule": "5 9 * * *",
    "model": "claude-sonnet-4",
    "prompt_summary": "Fetch today's crypto prices, summarize as markdown",
    "runs": 12,
    "input_tokens": 1150,
    "output_tokens": 780,
    "totalTokens": 1930,
    "tool_calls": ["fetch", "markdown-render"],
    "error_count": 8,
    "last_run_at": "2026-05-28T09:05:02Z"
  },
  {
    "job_id": "job_xyz789",
    "title": "Weekly Portfolio Report",
    "status": "active",
    "schedule": "0 8 * * 1",
    "model": "gpt-4o",
    "prompt_summary": "Pull wallet balances, compute P&L, draft email",
    "runs": 22,
    "input_tokens": 4800,
    "output_tokens": 3200,
    "totalTokens": 8000,
    "tool_calls": ["wallet-balance", "send-email"],
    "error_count": 0,
    "last_run_at": "2026-05-26T08:00:00Z"
  }
]
```

## Output Example

### D1 — Duplicate Jobs (High)

**Finding:** `job_abc001` and `job_abc002` run the same task 5 minutes apart.

**Evidence:**
- Both call `fetch` + `markdown-render` with identical prompts
- `job_abc002` has recorded 8 errors and only 12 runs vs. 84 runs for `job_abc001`
- Schedule offset is 5 minutes — likely a retry loop configuration

**Why it matters:** Double-running wastes tokens on every execution. At ~2000 tokens/run, that's ~4000 tokens/day or ~1.2M tokens/month for this pair alone.

**Manual fix:** Deactivate `job_abc002`. If it exists to handle failures, move it to a conditional-only trigger instead of a fixed schedule.

**What NOT to automate automatically:** Do not delete, stop, or rewrite jobs without human review — confirm which job is canonical first.

---

### D4 — Model / Routing Waste (Medium)

**Finding:** `job_xyz789` uses `gpt-4o` for a task that fits within `gpt-4o-mini` capabilities.

**Evidence:**
- Prompt is fetch wallet balances + email draft
- No multi-step reasoning, no vision, no function-calling complexity
- Average `totalTokens` per run: 8000 — well within mini's context window

**Why it matters:** At current gpt-4o rates, this job costs ~$0.024/run. The same job on `gpt-4o-mini` would cost ~$0.006/run — 4× savings with equivalent output quality.

**Manual fix:** Change model from `gpt-4o` to `gpt-4o-mini`. Verify output quality for 2–3 runs before setting as permanent.

**What NOT to automate automatically:** Model changes can affect output quality. Do not auto-switch without human sign-off on sample outputs.

## Privacy

TokenSave is built around a strict local-only design:

- **No network calls** — all processing happens on-device
- **No telemetry** — no analytics, no crash reporting, no external services
- **No API key collection** — credentials never leave your machine
- **No auto-remediation** — nothing is written, deleted, or modified automatically
- Test suite statically scans built assets for forbidden APIs (`fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`) to catch regressions

## What TokenSave Will NOT Do

- It will **not** upload logs, secrets, or job data to any external service
- It will **not** auto-edit, delete, stop, or rewrite jobs
- It will **not** call external LLMs or APIs to generate fixes
- It will **not** claim exact dollar savings without verifiable input pricing data
- It will **not** replace human review — findings are evidence-backed suggestions
- It will **not** provide legal, financial, or security guarantees
