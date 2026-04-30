// @ts-nocheck
// Extracted from src/main.ts — top-level constants only.
// No logic changed. Mechanically copied: const → export const.

export const COST_RATES = [
  { label: "MiniMax M2.7", match: /\bminimax.*m2\.?7\b|\bm2\.?7\b/i, rate: 0.14, source: null, sourceType: 'unverified' as const, checkedDate: null, status: 'unknown' as const, approximationNote: 'TokenSave currently uses bundled per-1M-token rates against total token counts; source verification and input/output split handling are deferred to later Issue #3 slices.' },
  { label: "MiniMax M2.5", match: /\bminimax.*m2\.?5\b|\bm2\.?5\b/i, rate: 0.12, source: null, sourceType: 'unverified' as const, checkedDate: null, status: 'unknown' as const, approximationNote: 'TokenSave currently uses bundled per-1M-token rates against total token counts; source verification and input/output split handling are deferred to later Issue #3 slices.' },
  { label: "GPT-4o", match: /\bgpt-?4o\b/i, rate: 2.5, source: null, sourceType: 'unverified' as const, checkedDate: null, status: 'unknown' as const, approximationNote: 'TokenSave currently uses bundled per-1M-token rates against total token counts; source verification and input/output split handling are deferred to later Issue #3 slices.' },
  { label: "Claude Sonnet", match: /\bsonnet\b/i, rate: 3, source: null, sourceType: 'unverified' as const, checkedDate: null, status: 'unknown' as const, approximationNote: 'TokenSave currently uses bundled per-1M-token rates against total token counts; source verification and input/output split handling are deferred to later Issue #3 slices.' },
  { label: "Claude Opus", match: /\bopus\b/i, rate: 15, source: null, sourceType: 'unverified' as const, checkedDate: null, status: 'unknown' as const, approximationNote: 'TokenSave currently uses bundled per-1M-token rates against total token counts; source verification and input/output split handling are deferred to later Issue #3 slices.' },
  { label: "GPT-5-codex", match: /\bgpt-?5[\d.]*.*codex\b|\bcodex\b/i, rate: 15, source: null, sourceType: 'unverified' as const, checkedDate: null, status: 'unknown' as const, approximationNote: 'TokenSave currently uses bundled per-1M-token rates against total token counts; source verification and input/output split handling are deferred to later Issue #3 slices.' },
  { label: "DeepSeek Chat", match: /\bdeepseek\b/i, rate: 0.28, source: null, sourceType: 'unverified' as const, checkedDate: null, status: 'unknown' as const, approximationNote: 'TokenSave currently uses bundled per-1M-token rates against total token counts; source verification and input/output split handling are deferred to later Issue #3 slices.' }
];

export const FIX_LIBRARY = {
  CRITICAL: {
    title: "Burning too many tokens",
    problem: "This job runs on a very short schedule with agent-turn mode, burning tokens on every single run.",
    action: "1) Run: openclaw jobs list — find this job\n2) Run: openclaw jobs edit [JOB_ID] --schedule \"*/30 * * * *\" (or any interval >= 30min)\n3) Or if it's a simple check: openclaw jobs edit [JOB_ID] --no-agent-turn\n4) Then run: openclaw export to verify the change",
    impactLabel: "cost per run"
  },
  LLM_AGENT_CRON: {
    title: "LLM-powered cron job",
    problem: "This scheduled job uses agent-turn mode — the LLM is invoked on every trigger to decide what to do, even for routine tasks. This is the single biggest source of token waste in OpenClaw.",
    action: "1) Run: openclaw jobs list — find this job\n2) Run: openclaw jobs edit [JOB_ID] --no-agent-turn\n3) Run: openclaw export to verify the change",
    impactLabel: "agent-turn overhead"
  },
  ERROR_WASTE: {
    title: "Failing repeatedly",
    problem: "This job is failing repeatedly, and each failed run burns tokens with nothing to show.",
    action: "1) Run: openclaw jobs logs [JOB_ID] --last 1 — get the first error message\n2) Fix the cause (bad credentials, missing file, wrong API key, etc.)\n3) Run: openclaw jobs edit [JOB_ID] --resume\n4) Watch: openclaw jobs logs [JOB_ID] --watch",
    impactLabel: "wasted tokens"
  },
  PREMIUM_MODEL_WASTE: {
    title: "Overpaying for simple work",
    problem: "This job uses an expensive model (Claude Opus / GPT-4o) for a simple check or monitor task.",
    action: "1) Run: openclaw jobs list — find this job\n2) Run: openclaw jobs edit [JOB_ID] --model mini-max/m2.7\n3) Run: openclaw jobs run [JOB_ID] --dry-run to verify it still works\n4) Monitor the next 3 runs to confirm output quality",
    impactLabel: "potential saving"
  },
  WARNING: {
    title: "Running too often",
    problem: "This job runs very frequently. It works, but the frequency may be unnecessary.",
    action: "1) Run: openclaw jobs list — find this job\n2) Ask: does this need to run every [SCHEDULE]? Could it run every 1h / 6h / daily?\n3) Run: openclaw jobs edit [JOB_ID] --schedule \"0 */6 * * *\" (e.g. 6h)\n4) Compare results after 3 runs before committing the new schedule",
    impactLabel: "schedule"
  },
  OK: {
    title: "Healthy — no action needed",
    problem: "No waste detected. This job is running within acceptable parameters.",
    action: "Keep monitoring. Recheck if the task changes or token usage grows.",
    impactLabel: "status"
  }
};

export const FIX_BADGES = {
  CRITICAL: { label: "CRITICAL", color: "#ff5d73" },
  LLM_AGENT_CRON: { label: "LLM AGENT", color: "#ff9f43" },
  ERROR_WASTE: { label: "FIX FIRST", color: "#ff7849" },
  PREMIUM_MODEL_WASTE: { label: "SWITCH MODEL", color: "#f59e0b" },
  WARNING: { label: "REVIEW", color: "#f59e0b" },
  OK: { label: "OK", color: "#35d07f" }
};