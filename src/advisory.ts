// @ts-nocheck
/**
 * Advisory / Review-Signal Layer (I23)
 *
 * Field-test motivation
 * ---------------------
 * Agent-first dogfood across 23 jobs / 743 runs surfaced a recall gap in the
 * strict D1-D7 rule layer: 72 errors and 14.9M tokens produced only 1 confirmed
 * finding, while cross-job signature analysis produced 3 actionable signals
 * that did not strictly match any D-rule threshold.
 *
 * This module introduces a separate, strictly lower-priority review-signal
 * layer.  Advisory signals are intentionally NOT confirmed waste.  They exist
 * to surface sub-threshold patterns a strict rule layer would miss, so a human
 * can decide whether to inspect the shared dispatcher / profile / gateway
 * layer first.
 *
 * Ranking invariant
 * -----------------
 *   - Confirmed D1-D7 findings remain primary.
 *   - Advisory signals are review-only and must not outrank confirmed
 *     critical findings.  When confirmed findings exist, advisory signals
 *     are demoted to a secondary review section.
 *   - When no confirmed findings exist, advisory signals surface in the
 *     primary section but always as "Review signal" — never as "waste",
 *     "fix", "critical", or "burning".
 *
 * Safety boundaries
 * -----------------
 *   - First action for every advisory signal is a READ-ONLY inspect command
 *     against the shared dispatcher / profile / gateway layer.
 *   - No "disable", "edit", "restart", "switch-model", or "switch schedule"
 *     appears as a first action.
 *   - No precise savings figure is emitted — only an approximate cost
 *     exposure range.
 *   - No quota exhaustion claim.
 *   - Unknown / missing model does not silently default to cheap pricing;
 *     the conservative-estimate label is preserved.
 *   - No backend / network / telemetry / analytics / external LLM / API key
 *     collection — this module is pure, synchronous, and read-only.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Stable identifier for an advisory signal.
 *
 * `A1` — zero-token fast-failure review signal
 * `A2` — premium-model + repeated NO_REPLY / low-value output review signal
 * `A3` — cross-job shared failure signature review signal
 */
export type AdvisoryId = 'A1' | 'A2' | 'A3';

/**
 * A review-only signal.  Carries structured evidence and a first-action
 * read-only inspect command, but is NOT confirmed waste.
 */
export interface AdvisorySignal {
  /** Stable signal identifier (A1, A2, A3) */
  id: AdvisoryId;
  /** Human-readable short title */
  title: string;
  /**
   * Explanation text.  Must be conservative — must not use words like
   * "waste", "burning", "critical", or "fix" outside of quoted evidence.
   */
  explanation: string;
  /** Job identifiers this signal applies to (id, name, or title fallback) */
  affectedJobIds: string[];
  /**
   * Approximate cost exposure range (USD, inclusive).  Always approximate.
   * When unknown, the field is null — no precise figure is ever claimed.
   */
  approximateCostExposure: { lowUsd: number; highUsd: number } | null;
  /**
   * First action — read-only inspect command.  Must not contain disable,
   * edit, restart, switch-model, or schedule-change verbs.
   */
  firstAction: {
    /** Description of the inspect step (conservative) */
    description: string;
    /** Read-only command or path the human should run first */
    command: string;
  };
  /** Structured evidence for this signal firing */
  evidence: {
    /** Signal id (mirrors AdvisorySignal.id) */
    id: AdvisoryId;
    /** Explanation (mirrors AdvisorySignal.explanation) */
    explanation: string;
    /** Source fields consulted for this signal */
    sourceFields: string[];
    /** Observed values (kept abstract — no precise savings) */
    observedValue: Record<string, unknown>;
    /** Comparison thresholds (where applicable) */
    threshold?: Record<string, unknown> | null;
  };
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/**
 * Sub-threshold fast-failure duration ceiling (milliseconds).  A run shorter
 * than this AND with totalTokens === 0 is suspicious but not confirmed
 * waste — it warrants manual review of the dispatcher / profile layer.
 */
const FAST_FAILURE_DURATION_MS = 300;

/**
 * Minimum number of qualifying zero-token fast-failure runs required for
 * A1 to emit a signal for a single job.
 *
 * Rationale (from 2026-06-03 advisory proof on Dataset B): a single
 * run that meets the A1 admission guard could be a one-off dispatcher
 * jitter — humans would correctly not act on it.  Requiring ≥ 2 runs
 * per job drops the obvious single-event noise and makes every A1
 * signal a confirmed multi-event pattern, which is the inspect-worthy
 * shape the advisory layer was built to surface.
 *
 * Kept conservative (default 2) so the gate is a small tightening of
 * the prior "any qualifying run" behavior, not a major behavior change.
 */
const MIN_A1_RUN_COUNT = 2;

/**
 * Approximate upper bound on a single zero-token fast failure's "exposure"
 * when cost is unknown.  Conservative and approximate only — never a
 * precise figure.
 */
const APPROX_FAST_FAILURE_USD_LOW = 0;
const APPROX_FAST_FAILURE_USD_HIGH = 1;

/**
 * Words that must NEVER appear in advisory copy as an action verb.  These
 * are the words used by the strict D-rule layer to mark confirmed waste;
 * using them in advisory copy as a directive would falsely elevate
 * advisory signals to confirmed-waste status.
 *
 * Note: this list is intentionally narrow.  Reversed / negated forms like
 * "do not disable" or "no destructive actions" are SAFE and should be
 * allowed — they reinforce the read-only-inspect-first invariant.
 */
const FORBIDDEN_WORDS_IN_ADVISORY_COPY = [
  'waste', 'wasting', 'burning', 'burns', 'critical', 'fix', 'fixing',
  'disable this', 'edit this', 'switch model', 'switch-model', 'restart this',
  'exhausted', 'exhaustion',
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Conservative copy check — guards against the most common "this is confirmed
 * waste" wording accidents.  Returns the list of forbidden words that appear
 * in `text`, or an empty list when copy is safe.
 *
 * Implementation note: the advisory layer is REQUIRED to include the
 * disclaimer "not confirmed waste" in every explanation.  That disclaimer
 * contains the word "waste" by design — we strip it before scanning, so
 * the disclaimer does not trigger a false positive.
 */
function findForbiddenWords(text: string): string[] {
  if (typeof text !== 'string') return [];
  const DISCLAIMER = /not confirmed waste/gi;
  const lower = text.replace(DISCLAIMER, '').toLowerCase();
  const hits: string[] = [];
  for (const word of FORBIDDEN_WORDS_IN_ADVISORY_COPY) {
    if (lower.includes(word)) hits.push(word);
  }
  return hits;
}

/**
 * Pick the best-available job identifier (id → name → title fallback).
 * Returns '' when nothing usable is present.
 */
function pickJobId(job: {
  id?: unknown;
  name?: unknown;
  title?: unknown;
  jobId?: unknown;
  job_id?: unknown;
  jobName?: unknown;
  job_name?: unknown;
}): string {
  if (job && job.id != null && job.id !== '') return String(job.id);
  if (job && job.jobId != null && job.jobId !== '') return String(job.jobId);
  if (job && job.job_id != null && job.job_id !== '') return String(job.job_id);
  if (job && job.name != null && job.name !== '') return String(job.name);
  if (job && job.jobName != null && job.jobName !== '') return String(job.jobName);
  if (job && job.job_name != null && job.job_name !== '') return String(job.job_name);
  if (job && job.title != null && job.title !== '') return String(job.title);
  return '';
}

/**
 * Token field aliases recognized by the advisory layer.
 *
 * Listed in priority order — earlier aliases win when multiple are present.
 */
const TOKEN_FIELD_ALIASES: ReadonlyArray<string> = [
  'tokens',
  'total_tokens',
  'token_count',
];

/**
 * Nested token field paths recognized by the advisory layer.
 *
 * Real Hermes cron run records keep the token count under a nested
 * `usage` / `metrics` object (e.g. `record.usage.total_tokens`), not at
 * the top level.  The original detector only checked top-level fields,
 * which made A1 blind to the real Hermes output schema (proven by the
 * 2026-06-03 advisory proof on Dataset E: 0 A1 firings on 3,206 real
 * records).  These nested paths are now scanned after the top-level
 * aliases, in priority order.
 *
 * Each entry is a tuple of [outerKey, innerKey].  BOTH keys must be
 * present via own-property check, AND the inner value must be a finite
 * number for the path to be considered "present".  The numeric
 * acceptance check is delegated to `parseTokenNumber` so the same
 * strict rules (reject blank / boolean / object / array / NaN /
 * Infinity / numeric strings) apply at every path.
 */
const NESTED_TOKEN_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ['usage', 'total_tokens'],
  ['usage', 'tokens'],
  ['metrics', 'tokens'],
];

/**
 * Strict token number parser — accepts finite numbers ONLY.
 *
 * Rejects (returns null):
 *   - null / undefined
 *   - blank / whitespace strings ""
 *   - boolean true / false
 *       (`Number(true) === 1`, `Number(false) === 0` — a real false-zero
 *        trap the prior `Number(raw)` path fell into)
 *   - objects / arrays
 *       (`Number([]) === 0`, `Number({}) === NaN` — same trap class)
 *   - NaN / Infinity
 *   - non-numeric strings
 *   - numeric strings like "0"
 *       (intentional: the advisory layer is numbers-only; any
 *        string-shaped value is treated as "not present" so coercion
 *        traps cannot leak)
 *
 * Rationale (guardian_cat 2026-06-04): the prior `Number(raw)` path
 * silently converted blank strings / `false` / empty arrays to 0,
 * letting A1 fire and A3 group `zero-token-fast-failure` on records
 * that carried no real numeric token count.  This helper closes that
 * gap with a strict, easy-to-reason-about whitelist.
 *
 * @param raw - value to inspect
 * @returns finite number, or null when the value is not a real number
 */
export function parseTokenNumber(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  // Reject everything else: booleans, strings, objects, arrays, etc.
  return null;
}

/**
 * Returns the numeric token count when an alias is actually present and is
 * a finite number, OR null when the token field is missing / null /
 * undefined / non-numeric.
 *
 * Critical: this helper is the inverse of "treat missing token as 0".
 * The JS coercion trap is that an explicit null token field converts to
 * numeric zero, and undefined converts to NaN — so a naive
 * `Number(record.tokens ?? 0)` path would silently classify missing-token
 * records as zero-token fast failures.  A1 and the A3 failureSignature
 * helper both depend on this to avoid that false positive.
 *
 * All numeric acceptance is delegated to `parseTokenNumber`, which
 * rejects blank strings, booleans, objects, arrays, NaN, Infinity,
 * and numeric strings.  This means a record that only has
 * `usage.total_tokens: ""` or `tokens: false` will be treated as
 * "no token field meaningfully present" — never as zero.
 *
 * Path priority (first match wins):
 *   1. Top-level: `tokens`, `total_tokens`, `token_count`
 *   2. Nested:    `usage.total_tokens`, `usage.tokens`, `metrics.tokens`
 *
 * A nested path is considered "present" only when BOTH the outer object
 * and the inner field are own-properties AND the inner value passes
 * `parseTokenNumber`.  A missing or null outer / inner value returns
 * null (which the caller treats as "no token field meaningfully
 * present" — never as 0).
 *
 * @param record - run-like record
 * @returns finite number, or null when no token field is meaningfully present
 */
export function pickPresentTokenValue(record: any): number | null {
  if (!record || typeof record !== 'object') return null;

  // (1) Top-level aliases — preserved from the original detector.
  for (const alias of TOKEN_FIELD_ALIASES) {
    if (!Object.prototype.hasOwnProperty.call(record, alias)) continue;
    const raw = (record as Record<string, unknown>)[alias];
    const n = parseTokenNumber(raw);
    if (n !== null) return n;
  }

  // (2) Nested token paths — Hermes cron run record schema.  Each path
  //     is gated on the outer object being a real own-property object
  //     (not null / not a primitive) AND the inner field being present
  //     and finite.  Any "missing" link in the chain returns null
  //     (which the caller treats as "no token field meaningfully
  //     present" — never as 0).
  for (const [outerKey, innerKey] of NESTED_TOKEN_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(record, outerKey)) continue;
    const outer = (record as Record<string, unknown>)[outerKey];
    if (outer == null || typeof outer !== 'object') continue;
    if (!Object.prototype.hasOwnProperty.call(outer, innerKey)) continue;
    const inner = (outer as Record<string, unknown>)[innerKey];
    const n = parseTokenNumber(inner);
    if (n !== null) return n;
  }

  return null;
}

/**
 * Returns true when the record explicitly carries a token field that is
 * a finite number equal to 0.
 *
 * Use this whenever the question is "is this a real zero-token record?"
 * — never `record.tokens === 0`, which is true for missing fields after
 * a sloppy coercion (the same JS coercion trap the helper above avoids).
 */
export function hasZeroTokenValue(record: any): boolean {
  const v = pickPresentTokenValue(record);
  return v === 0;
}

/**
 * Stable cross-job failure signature.  Used to group jobs that share the
 * same failure mode into a single A3 advisory signal.
 *
 * Signatures are intentionally conservative — only well-known shapes are
 * normalized, anything else is bucketed as "other-normalized-error".
 */
export function failureSignature(record: {
  error?: unknown;
  status?: unknown;
  result?: unknown;
  tokens?: unknown;
  total_tokens?: unknown;
  [key: string]: unknown;
}): string {
  // 1) Zero-token + short-duration → "zero-token-fast-failure"
  //    Critical: only fire when an actual token field is present and is
  //    explicitly 0.  An explicit null token field would otherwise
  //    classify any record missing a token field as a zero-token fast
  //    failure (see pickPresentTokenValue for the coercion trap details).
  const tokenCount = pickPresentTokenValue(record);
  const hasZeroTokens = tokenCount === 0;
  const durationMs = typeof record.durationMs === 'number'
    ? record.durationMs
    : Number(record.durationMs);
  if (hasZeroTokens && Number.isFinite(durationMs) && durationMs < FAST_FAILURE_DURATION_MS) {
    return 'zero-token-fast-failure';
  }

  // 2) Allowlist reject — error message starts with the standard allowlist
  //    reject prefix
  const errStr = typeof record.error === 'string' ? record.error.toLowerCase() : '';
  if (errStr.startsWith('allowlist reject') || errStr.startsWith('allowlist_reject')) {
    return 'allowlist-reject';
  }

  // 3) Dispatcher reject — similar shape
  if (errStr.startsWith('dispatcher reject') || errStr.startsWith('dispatcher_reject')) {
    return 'dispatcher-reject';
  }

  // 4) Generic normalized error message — trim, lowercase, collapse whitespace
  if (errStr) {
    const normalized = errStr.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (normalized) return `normalized-error:${normalized}`;
  }

  // 5) Status-only failure
  const statusStr = typeof record.status === 'string' ? record.status.toLowerCase() : '';
  if (statusStr === 'no_reply' || statusStr === 'no-reply' || statusStr === 'noreply') {
    return 'no-reply';
  }

  return '';
}

// ---------------------------------------------------------------------------
// Signal detectors
// ---------------------------------------------------------------------------

/**
 * A1 — Zero-token fast-failure review signal.
 *
 * Fires when a record shows totalTokens === 0 AND duration below the
 * small-threshold (when available) AND at least one of:
 *   - failed status (e.g. "failed" / "error")
 *   - missing or null model
 *   - no delivered output (status / result missing or empty)
 *
 * This is REVIEW-only.  A human must inspect the shared dispatcher /
 * profile / gateway layer first before any model or schedule change.
 *
 * @param records - run-like records with totalTokens / durationMs / status / model
 * @returns array of A1 advisory signals (one per distinct affected job)
 */
export function detectA1ZeroTokenFastFailure(records: any[]): AdvisorySignal[] {
  if (!Array.isArray(records) || records.length === 0) return [];

  // Group records by job identifier
  const byJob = new Map<string, any[]>();
  for (const record of records) {
    if (!record || typeof record !== 'object') continue;

    // Critical: only fire when an actual token field is present and is
    // explicitly 0.  An explicit null token field would otherwise
    // classify any record missing a token field as a zero-token fast
    // failure (see pickPresentTokenValue for the coercion trap details).
    const tokenCount = pickPresentTokenValue(record);
    if (tokenCount !== 0) continue;

    const durationRaw = record.durationMs ?? record.duration_ms ?? record.elapsedMs ?? null;
    const durationMs = typeof durationRaw === 'number' ? durationRaw : Number(durationRaw);
    if (!Number.isFinite(durationMs)) continue;
    if (durationMs >= FAST_FAILURE_DURATION_MS) continue;

    // At least one of: failed status / missing model / no delivered output
    const statusRaw = record.status ?? record.result ?? null;
    const statusStr = statusRaw == null ? '' : String(statusRaw).trim().toLowerCase();
    const failedStatus = statusStr === 'failed' || statusStr === 'error' || statusStr === 'failure';
    const modelRaw = record.model ?? record.model_name ?? record.modelName ?? null;
    const missingModel = modelRaw == null || (typeof modelRaw === 'string' && modelRaw.trim() === '');
    const noDeliveredOutput = !statusStr; // status/result missing or empty
    if (!failedStatus && !missingModel && !noDeliveredOutput) continue;

    const jobId = pickJobId(record);
    if (!jobId) continue; // need a stable job identity to make this signal actionable

    const existing = byJob.get(jobId);
    if (existing) existing.push(record);
    else byJob.set(jobId, [record]);
  }

  const signals: AdvisorySignal[] = [];
  for (const [jobId, jobRecords] of byJob) {
    // Gate: require at least MIN_A1_RUN_COUNT qualifying runs per job
    // before emitting.  A single zero-token fast-failed run can be a
    // one-off dispatcher jitter; a multi-run pattern is the inspect-
    // worthy shape the layer was built to surface.  This is a
    // conservative tightening — jobs with runCount < 2 are not
    // misclassified, they are simply below the A1 noise floor.
    if (jobRecords.length < MIN_A1_RUN_COUNT) continue;

    const first = jobRecords[0];
    // Reuse pickPresentTokenValue so the evidence matches the admission
    // guard exactly — no second coercion path that could disagree on a
    // missing / null / undefined token field (including the new nested
    // usage.* / metrics.* paths).
    const tokenCount = pickPresentTokenValue(first);
    const durationMs = first.durationMs ?? first.duration_ms ?? first.elapsedMs;
    const model = first.model ?? first.model_name ?? null;
    const status = first.status ?? first.result ?? null;

    // Build conservative explanation
    const explanation =
      `Review signal (not confirmed waste): ${jobRecords.length} run(s) by this job ` +
      `ended with zero tokens consumed in under ${FAST_FAILURE_DURATION_MS} ms. ` +
      `This pattern is unusual and may reflect dispatcher / profile / gateway ` +
      `rejection before model invocation, but it could also be a normal fast ` +
      `no-op. Inspect the run history first.`;

    const firstAction = {
      description:
        'Inspect the run history of this job before taking any action. Do not change the model, schedule, or job state on the basis of this signal alone.',
      command: `openclaw cron runs --id ${jobId} --limit 5`,
    };

    // Sanity check: copy must not contain forbidden words
    const forbidden = findForbiddenWords(explanation + ' ' + firstAction.description);
    if (forbidden.length > 0) {
      // Defensive — should not happen with current copy.  Skip this signal
      // rather than emit a forbidden-word violation.
      continue;
    }

    const signal: AdvisorySignal = {
      id: 'A1',
      title: 'Review signal: zero-token fast failure',
      explanation,
      affectedJobIds: jobId === '__no_job_id__' ? [] : [jobId],
      approximateCostExposure: {
        lowUsd: APPROX_FAST_FAILURE_USD_LOW,
        highUsd: APPROX_FAST_FAILURE_USD_HIGH,
      },
      firstAction,
      evidence: {
        id: 'A1',
        explanation,
        sourceFields: [
          'tokens', 'total_tokens', 'token_count',
          'usage.total_tokens', 'usage.tokens', 'metrics.tokens',
          'durationMs', 'duration_ms', 'elapsedMs',
          'status', 'result', 'model', 'model_name',
        ],
        observedValue: {
          runCount: jobRecords.length,
          totalTokens: tokenCount,
          durationMs: typeof durationMs === 'number' ? durationMs : Number(durationMs),
          model: model == null ? null : String(model),
          status: status == null ? null : String(status),
        },
        threshold: {
          maxDurationMs: FAST_FAILURE_DURATION_MS,
          totalTokensEquals: 0,
        },
      },
    };
    signals.push(signal);
  }

  return signals;
}

/**
 * A2 — Premium model + repeated NO_REPLY / low-value output review signal.
 *
 * Fires when:
 *   - job uses a premium / expensive model (e.g. opus, sonnet, or known
 *     premium model field) OR pricingSource === 'known-local' with rate
 *     above a conservative threshold
 *   - AND at least 2 runs ended with NO_REPLY / no delivered output OR
 *     low-value output
 *   - AND the job is agentTurn=true OR appears to be a script-like / simple
 *     task
 *
 * This is REVIEW-only.  Wording MUST require manual verification before
 * any model or schedule change.  No precise savings figure.
 *
 * @param jobs - array of job-like objects with model / agentTurn / run stats
 * @param premiumModelPatterns - regex patterns matching premium model names
 * @param minNoReplyRuns - minimum NO_REPLY runs to fire (default 2)
 * @returns array of A2 advisory signals
 */
export function detectA2PremiumNoReply(
  jobs: any[],
  premiumModelPatterns: RegExp[] = [/opus/i, /sonnet/i],
  minNoReplyRuns: number = 2
): AdvisorySignal[] {
  if (!Array.isArray(jobs) || jobs.length === 0) return [];

  const signals: AdvisorySignal[] = [];
  for (const job of jobs) {
    if (!job || typeof job !== 'object') continue;

    const model = String(job.model ?? job.model_name ?? job.modelName ?? '');
    if (!model) continue;

    const isPremium = premiumModelPatterns.some((p) => p.test(model));
    if (!isPremium) continue;

    const noReplyRunsRaw = job.noReplyRuns ?? job.no_reply_runs ?? job.noReplyCount;
    const noReplyRuns = typeof noReplyRunsRaw === 'number' ? noReplyRunsRaw : Number(noReplyRunsRaw);
    if (!Number.isFinite(noReplyRuns) || noReplyRuns < minNoReplyRuns) continue;

    const agentTurn = !!(job.agentTurn ?? job.agent_turn ?? job.agent_turn_enabled);
    const taskRaw = String(job.task ?? job.type ?? job.description ?? job.prompt ?? '');
    const taskLower = taskRaw.toLowerCase();
    const scriptLike = /^(ping|health|status|heartbeat|check|monitor|probe|verify|smoke|lint)$/i.test(taskLower.trim());
    const isSimpleTask = /(health|status|ping|monitor|probe|verify|heartbeat|smoke|lint|check)/i.test(taskLower);
    const isScriptLike = scriptLike || isSimpleTask;
    if (!agentTurn && !isScriptLike) continue;

    const jobId = pickJobId(job);
    if (!jobId) continue;

    const explanation =
      `Review signal (not confirmed waste): job uses a premium model ("${model}") ` +
      `and recorded ${noReplyRuns} NO_REPLY run(s). Confirm manually that this ` +
      `combination is intentional before changing the model or schedule. ` +
      `Inspect the run history first.`;

    const firstAction = {
      description:
        'Inspect the run history of this job before taking any action. Confirm that the premium model is required for this task type; do not change models on the basis of this signal alone.',
      command: `openclaw cron runs --id ${jobId} --limit 5`,
    };

    const forbidden = findForbiddenWords(explanation + ' ' + firstAction.description);
    if (forbidden.length > 0) continue;

    const signal: AdvisorySignal = {
      id: 'A2',
      title: 'Review signal: premium model with repeated NO_REPLY',
      explanation,
      affectedJobIds: [jobId],
      approximateCostExposure: null,
      firstAction,
      evidence: {
        id: 'A2',
        explanation,
        sourceFields: ['model', 'model_name', 'modelName', 'noReplyRuns', 'no_reply_runs', 'noReplyCount', 'agentTurn', 'agent_turn', 'agent_turn_enabled', 'task', 'type', 'description', 'prompt'],
        observedValue: {
          model,
          noReplyRuns,
          agentTurn,
          isScriptLike,
        },
        threshold: {
          minNoReplyRuns,
        },
      },
    };
    signals.push(signal);
  }

  return signals;
}

/**
 * A3 — Cross-job shared failure signature review signal.
 *
 * Fires when >= 2 jobs share the same normalized failure signature across
 * their run records.  Common signatures:
 *   - zero-token-fast-failure
 *   - allowlist-reject
 *   - dispatcher-reject
 *   - normalized-error:<message>
 *
 * The signal's first action is to inspect the SHARED dispatcher / profile /
 * gateway layer first, since the shared pattern strongly suggests a common
 * upstream cause.  Must NOT suggest directly disabling the affected jobs.
 *
 * @param jobs - array of job-like objects with .id/.name/.title and an array of run records
 * @param minSharedJobs - minimum number of jobs that must share a signature (default 2)
 * @returns array of A3 advisory signals (one per shared signature)
 */
export function detectA3SharedFailureSignature(
  jobs: any[],
  minSharedJobs: number = 2
): AdvisorySignal[] {
  if (!Array.isArray(jobs) || jobs.length === 0) return [];

  // Map signature → list of job ids
  const sigToJobs = new Map<string, string[]>();
  // Map signature → list of sample records (for evidence)
  const sigToSamples = new Map<string, any[]>();

  for (const job of jobs) {
    if (!job || typeof job !== 'object') continue;
    const jobId = pickJobId(job);
    if (!jobId) continue;

    const records = Array.isArray(job.records) ? job.records : [];
    const seen = new Set<string>();
    for (const record of records) {
      const sig = failureSignature(record);
      if (!sig) continue;
      // Dedupe per job so the same signature on the same job only counts once
      const key = `${jobId}::${sig}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const existing = sigToJobs.get(sig);
      if (existing) existing.push(jobId);
      else sigToJobs.set(sig, [jobId]);

      const existingSamples = sigToSamples.get(sig);
      if (existingSamples) existingSamples.push(record);
      else sigToSamples.set(sig, [record]);
    }
  }

  const signals: AdvisorySignal[] = [];
  for (const [sig, jobIds] of sigToJobs) {
    if (jobIds.length < minSharedJobs) continue;

    const samples = sigToSamples.get(sig) || [];

    const explanation =
      `Review signal (not confirmed waste): ${jobIds.length} jobs share the same ` +
      `failure signature ("${sig}"). This pattern often reflects a shared ` +
      `upstream cause in the dispatcher / profile / gateway layer. Inspect the ` +
      `shared layer first; do not change the affected jobs on the basis of ` +
      `this signal alone.`;

    const firstAction = {
      description:
        'Inspect the shared dispatcher / profile / gateway configuration first. ' +
        'Read-only inspection only — no destructive actions on the basis of this signal.',
      command: `cat ~/.openclaw/cron/jobs.json | head -100`,
    };

    const forbidden = findForbiddenWords(explanation + ' ' + firstAction.description + ' ' + firstAction.command);
    if (forbidden.length > 0) continue;

    const signal: AdvisorySignal = {
      id: 'A3',
      title: 'Review signal: cross-job shared failure signature',
      explanation,
      affectedJobIds: jobIds,
      approximateCostExposure: null,
      firstAction,
      evidence: {
        id: 'A3',
        explanation,
        sourceFields: ['error', 'status', 'result', 'tokens', 'total_tokens', 'durationMs', 'duration_ms', 'elapsedMs'],
        observedValue: {
          signature: sig,
          affectedJobCount: jobIds.length,
          sampleRecordCount: samples.length,
          sampleStatuses: samples.slice(0, 3).map((r) => {
            const s = r.status ?? r.result ?? null;
            return s == null ? null : String(s);
          }),
        },
        threshold: {
          minSharedJobs,
        },
      },
    };
    signals.push(signal);
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Ranking helper
// ---------------------------------------------------------------------------

/**
 * Ranking helper for callers that want to mix advisory signals with D-rule
 * findings.  Enforces the invariant that advisory signals never outrank
 * confirmed critical findings.
 *
 *   - When the caller provides a list of confirmed finding IDs (e.g. D-rule
 *     results that fired), advisory signals are returned in a separate
 *     `reviewSignals` array.
 *   - When the caller provides an empty confirmed list, advisory signals
 *     are returned in `primarySignals` for the caller's review section.
 *
 * This function does NOT mutate the input.  It returns a structured result
 * the caller can render with whichever UI they have.
 */
export function rankAdvisorySignals(
  signals: AdvisorySignal[],
  confirmedRuleIds: string[]
): {
  primarySignals: AdvisorySignal[];
  reviewSignals: AdvisorySignal[];
  hasConfirmedCritical: boolean;
} {
  const hasConfirmedCritical = Array.isArray(confirmedRuleIds) && confirmedRuleIds.length > 0;
  if (hasConfirmedCritical) {
    // Demote all advisory to review-only when confirmed findings exist
    return { primarySignals: [], reviewSignals: signals.slice(), hasConfirmedCritical: true };
  }
  return { primarySignals: signals.slice(), reviewSignals: [], hasConfirmedCritical: false };
}
