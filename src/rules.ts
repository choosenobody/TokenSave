import { detectCostRate } from './pricing';
import { parseScheduleMinutes, readBoolean, isSimpleCheck } from './domain';
import { stringify } from './utils';
import type { DiagnoseRuleResult, DiagnoseRuleId, DiagnoseSeverity, DiagnoseEvidence } from './types';

// Re-export for consumers
export type { DiagnoseRuleId, DiagnoseSeverity, DiagnoseEvidence, DiagnoseRuleResult };

/**
 * D5: Unknown model pricing diagnostic.
 *
 * Fires when the job's model is not found in the pricing database,
 * meaning detectCostRate() returned pricingSource === 'conservative-estimate'.
 *
 * This rule does NOT recommend a price — it warns that the price is uncertain.
 *
 * @param job - a job-like object with at least .model field
 * @returns DiagnoseRuleResult if fired, null if the rule does not apply
 */
export function diagnoseD5UnknownModelPricing(job: {
  model?: unknown;
  id?: unknown;
  name?: unknown;
  title?: unknown;
}): DiagnoseRuleResult | null {
  const model = typeof job.model === 'string' ? job.model : String(job.model ?? '');

  const costInfo = detectCostRate(model);

  if (costInfo.pricingSource !== 'conservative-estimate') {
    return null; // rule did not fire
  }

  // Determine best available stable identifier for affectedJobIds
  const affectedJobIds: string[] = [];
  if (job.id != null) affectedJobIds.push(String(job.id));
  else if (job.name != null) affectedJobIds.push(String(job.name));
  else if (job.title != null) affectedJobIds.push(String(job.title));

  const ruleId: DiagnoseRuleId = 'D5';

  return {
    ruleId,
    severity: 'warning',
    message: `Model "${model}" is not in the pricing database. A conservative estimate (highest known rate) is used. Actual cost may differ significantly.`,
    affectedJobIds,
    evidence: {
      ruleId,
      explanation: `Model "${model}" is not in the pricing database. A conservative estimate (highest known rate) is used. Actual cost may differ significantly.`,
      sourceFields: ['model', 'pricingSource'],
      observedValue: {
        model,
        pricingSource: costInfo.pricingSource,
        estimatedRate: costInfo.rate,
      },
      threshold: null,
    },
  };
}

/**
 * D6: Zero-token abnormal run diagnostic.
 *
 * Fires when a job has been executed (totalRuns > 0) but consumed zero tokens (totalTokens === 0).
 * This is anomalous — either token counting failed, the job was cached/hit limits with no charge,
 * or the run records were not captured properly.
 *
 * @param job - a job-like object with totalRuns and totalTokens fields
 * @returns DiagnoseRuleResult if fired, null if the rule does not apply
 */
export function diagnoseD6ZeroTokenAbnormalRun(job: {
  totalRuns?: unknown;
  totalTokens?: unknown;
  id?: unknown;
  name?: unknown;
  title?: unknown;
}): DiagnoseRuleResult | null {
  // Parse totalRuns — must be a finite number > 0
  const rawTotalRuns = job.totalRuns;
  const totalRuns =
    typeof rawTotalRuns === 'number' && Number.isFinite(rawTotalRuns)
      ? rawTotalRuns
      : NaN;

  // Parse totalTokens — must be a finite number
  const rawTotalTokens = job.totalTokens;
  const totalTokens =
    typeof rawTotalTokens === 'number' && Number.isFinite(rawTotalTokens)
      ? rawTotalTokens
      : NaN;

  // Rule fires only when totalRuns > 0 AND totalTokens === 0
  if (!(totalRuns > 0) || totalTokens !== 0) {
    return null;
  }

  // Determine best available stable identifier for affectedJobIds
  const affectedJobIds: string[] = [];
  if (job.id != null) affectedJobIds.push(String(job.id));
  else if (job.name != null) affectedJobIds.push(String(job.name));
  else if (job.title != null) affectedJobIds.push(String(job.title));

  const ruleId: DiagnoseRuleId = 'D6';

  return {
    ruleId,
    severity: 'warning',
    message: `Job ran ${totalRuns} time(s) but consumed zero tokens. This is abnormal — token data may be missing or counting may have failed.`,
    affectedJobIds,
    evidence: {
      ruleId,
      explanation: `Job ran ${totalRuns} time(s) but totalTokens is ${totalTokens}. This suggests token counting failed, runs were cached with no charge, or run records were not captured.`,
      sourceFields: ['totalRuns', 'totalTokens'],
      observedValue: {
        totalRuns,
        totalTokens,
      },
      threshold: {
        totalRunsGreaterThan: 0,
        totalTokensEquals: 0,
      },
    },
  };
}

/**
 * D3: Premium model on simple job diagnostic.
 *
 * Fires when ALL true:
 *   1. isSimpleCheck(job, promptText) === true
 *   2. costInfo.pricingSource === 'known-local'
 *   3. referenceCostInfo.pricingSource === 'known-local'
 *   4. referenceRate is finite and > 0
 *   5. rateMultiplier >= 5 (where rateMultiplier = costInfo.rate / referenceRate)
 *
 * referenceRate is derived from detectCostRate('MiniMax M2.7').rate
 *
 * Using an expensive model (e.g., Claude Opus at 15) for a simple check job is wasteful.
 *
 * @param job - a job-like object with model/model_name/modelName, task, type, description, prompt, name, title, id fields
 * @returns DiagnoseRuleResult if fired, null if the rule does not apply
 */
export function diagnoseD3PremiumModelOnSimpleJob(job: {
  model?: unknown;
  model_name?: unknown;
  modelName?: unknown;
  task?: unknown;
  type?: unknown;
  description?: unknown;
  prompt?: unknown;
  name?: unknown;
  title?: unknown;
  id?: unknown;
}): DiagnoseRuleResult | null {
  // Extract model from any alias
  const model = String(job.model ?? job.model_name ?? job.modelName ?? '');

  // Model must not be empty
  if (!model) {
    return null;
  }

  // Build promptText for isSimpleCheck detection
  const promptText = [
    job.task, job.type, job.description, job.prompt, job.name, job.title
  ].filter(Boolean).join(' ');

  // isSimpleCheck must return true
  const simpleCheck = isSimpleCheck(job, promptText);
  if (!simpleCheck) {
    return null;
  }

  // Reference model for rate comparison
  const REFERENCE_MODEL = 'MiniMax M2.7';
  const referenceCostInfo = detectCostRate(REFERENCE_MODEL);
  const referenceRate = referenceCostInfo.rate;

  // Guardrails for reference
  if (referenceCostInfo.pricingSource !== 'known-local') {
    return null;
  }
  if (!Number.isFinite(referenceRate) || referenceRate <= 0) {
    return null;
  }

  // Cost info for the job's model
  const costInfo = detectCostRate(model);

  // Model must be known-local (D5 handles unknown models)
  if (costInfo.pricingSource !== 'known-local') {
    return null;
  }

  // Compute rate multiplier
  const rateMultiplier = costInfo.rate / referenceRate;
  const MIN_RATE_MULTIPLIER = 5;

  // Rate multiplier must meet or exceed threshold
  if (rateMultiplier < MIN_RATE_MULTIPLIER) {
    return null;
  }

  // Determine best available stable identifier for affectedJobIds
  const affectedJobIds: string[] = [];
  if (job.id != null) affectedJobIds.push(String(job.id));
  else if (job.name != null) affectedJobIds.push(String(job.name));
  else if (job.title != null) affectedJobIds.push(String(job.title));

  const ruleId: DiagnoseRuleId = 'D3';

  return {
    ruleId,
    severity: 'warning',
    message: `Model "${model}" (rate ${costInfo.rate}) is being used for a simple check job but costs more than ${MIN_RATE_MULTIPLIER}x the reference model. Consider a lighter, cheaper model for simple checks.`,
    affectedJobIds,
    evidence: {
      ruleId,
      explanation: `Model "${model}" with rate ${costInfo.rate} is used on a simple check job, but the rate is ${rateMultiplier.toFixed(2)}x the reference model rate (based on TokenSave's bundled pricing table). Using premium models on simple jobs is wasteful.`,
      sourceFields: ['model', 'pricingSource', 'rate', 'referenceModel', 'referenceRate', 'rateMultiplier', 'simpleCheck'],
      observedValue: {
        model,
        pricingSource: costInfo.pricingSource,
        rate: costInfo.rate,
        referenceModel: REFERENCE_MODEL,
        referenceRate,
        rateMultiplier,
        simpleCheck: true,
      },
      threshold: {
        pricingSourceEquals: 'known-local',
        minRateMultiplier: MIN_RATE_MULTIPLIER,
        simpleCheckEquals: true,
      },
    },
  };
}

/**
 * D4: Agent-turn cron burn diagnostic.
 *
 * Fires when agentTurn is enabled with a schedule that runs more than once per hour.
 * Agent-turn mode is expensive for frequent cron-like jobs that don't need an LLM agent.
 *
 * @param job - a job-like object with agentTurn and schedule fields
 * @returns DiagnoseRuleResult if fired, null if the rule does not apply
 */
export function diagnoseD4AgentTurnCronBurn(job: {
  agentTurn?: unknown;
  agent_turn?: unknown;
  agent_turn_enabled?: unknown;
  schedule?: unknown;
  interval?: unknown;
  frequency?: unknown;
  cron?: unknown;
  id?: unknown;
  name?: unknown;
  title?: unknown;
}): DiagnoseRuleResult | null {
  // Read agentTurn from any alias
  const rawAgentTurn = job.agentTurn ?? job.agent_turn ?? job.agent_turn_enabled;
  const agentTurn = readBoolean(rawAgentTurn);

  // Read schedule from any alias
  const schedule = job.schedule ?? job.interval ?? job.frequency ?? job.cron;

  // Must have agentTurn = true
  if (!agentTurn) {
    return null;
  }

  // Schedule must exist
  if (schedule == null) {
    return null;
  }

  // Parse schedule minutes
  const scheduleMinutes = parseScheduleMinutes(schedule);

  // Must be finite
  if (scheduleMinutes == null || !Number.isFinite(scheduleMinutes)) {
    return null;
  }

  // Must be > 0 and < 60
  if (scheduleMinutes <= 0 || scheduleMinutes >= 60) {
    return null;
  }

  // Determine best available stable identifier for affectedJobIds
  const affectedJobIds: string[] = [];
  if (job.id != null) affectedJobIds.push(String(job.id));
  else if (job.name != null) affectedJobIds.push(String(job.name));
  else if (job.title != null) affectedJobIds.push(String(job.title));

  const ruleId: DiagnoseRuleId = 'D4';

  return {
    ruleId,
    severity: 'warning',
    message: `Agent-turn mode is enabled with a schedule of ${scheduleMinutes} minutes. This is wasteful — agent-turn is expensive and cron-like jobs do not need an LLM agent.`,
    affectedJobIds,
    evidence: {
      ruleId,
      explanation: `Agent-turn mode is enabled with a schedule of ${scheduleMinutes} minutes (less than 60 min). Frequent agent-turn jobs waste tokens on cron-like work that does not need an LLM agent.`,
      sourceFields: ['agentTurn', 'schedule', 'scheduleMinutes'],
      observedValue: {
        agentTurn: true,
        schedule,
        scheduleMinutes,
      },
      threshold: {
        agentTurnEquals: true,
        scheduleMinutesLessThan: 60,
      },
    },
  };
}

/**
 * D1: Aggregate failure loop detection.
 *
 * Detects jobs with a high failure rate across multiple runs,
 * suggesting a persistent failure loop pattern.
 *
 * This is aggregate failure-ratio detection only.
 * It does NOT prove the same error repeats consecutively or within a time window.
 *
 * @param job - a job-like object with totalRuns and errorRuns fields
 * @returns DiagnoseRuleResult if fired, null if the rule does not apply
 */
export function diagnoseD1FailureLoopDetection(job: {
  totalRuns?: unknown;
  errorRuns?: unknown;
  id?: unknown;
  name?: unknown;
  title?: unknown;
}): DiagnoseRuleResult | null {
  // Parse totalRuns — must be a finite number >= 3
  const totalRuns = typeof job.totalRuns === 'number' && Number.isFinite(job.totalRuns)
    ? job.totalRuns
    : NaN;

  // Parse errorRuns — must be a finite number >= 0
  const errorRuns = typeof job.errorRuns === 'number' && Number.isFinite(job.errorRuns)
    ? job.errorRuns
    : NaN;

  // Guard: insufficient runs or invalid aggregates
  if (!Number.isFinite(totalRuns) || totalRuns < 3) { return null; }
  if (!Number.isFinite(errorRuns) || errorRuns < 0 || errorRuns > totalRuns) { return null; }

  const errorRate = errorRuns / totalRuns;

  // Fire if >= 80% of runs are errors
  if (errorRate < 0.8) { return null; }

  // Build affectedJobIds (id → name → title)
  const affectedJobIds: string[] = [];
  if (job.id != null) { affectedJobIds.push(String(job.id)); }
  else if (job.name != null) { affectedJobIds.push(String(job.name)); }
  else if (job.title != null) { affectedJobIds.push(String(job.title)); }

  const result: DiagnoseRuleResult = {
    ruleId: 'D1',
    severity: 'warning',
    affectedJobIds,
    message: `Job failed ${errorRuns}/${totalRuns} runs (${(errorRate * 100).toFixed(1)}% error rate). This pattern suggests a persistent failure loop.`,
    evidence: {
      ruleId: 'D1',
      explanation: `Aggregate failure ratio is ${(errorRate * 100).toFixed(1)}% (${errorRuns} errors / ${totalRuns} total runs). Threshold: >= 80% error rate with at least 3 runs.`,
      sourceFields: ['totalRuns', 'errorRuns', 'errorRate'],
      observedValue: { totalRuns, errorRuns, errorRate },
      threshold: { minTotalRuns: 3, minErrorRate: 0.8 },
    },
  };

  return result;
}

/**
 * D7: Exact duplicate active job diagnostic.
 *
 * Fires when two or more active jobs share the same effective configuration
 * (model + schedule + task/prompt/type/description).
 *
 * Active jobs are those that are NOT explicitly disabled:
 * - active !== false
 * - enabled !== false
 * - disabled !== true
 * (missing fields default to active)
 *
 * Jobs without sufficient config (no model or no schedule) are skipped.
 *
 * @param jobs - array of job-like objects
 * @returns DiagnoseRuleResult if fired, null if no duplicates found
 */
export function diagnoseD7ExactDuplicateActiveJob(jobs: {
  id?: unknown;
  name?: unknown;
  title?: unknown;
  model?: unknown;
  model_name?: unknown;
  modelName?: unknown;
  schedule?: unknown;
  interval?: unknown;
  frequency?: unknown;
  cron?: unknown;
  task?: unknown;
  type?: unknown;
  description?: unknown;
  prompt?: unknown;
  active?: unknown;
  enabled?: unknown;
  disabled?: unknown;
  [key: string]: unknown;
}[]): DiagnoseRuleResult | null {
  // --- Step 1: Filter active jobs and build duplicate key ---
  type JobEntry = {
    job: Record<string, unknown>;
    duplicateKey: string;
  };

  const activeJobs: JobEntry[] = [];

  for (const job of jobs) {
    // Determine active status — only explicit values determine inactivity:
    // active === false, enabled === false, disabled === true
    // Missing fields → active (included)
    if (
      (job as Record<string, unknown>).active === false ||
      (job as Record<string, unknown>).enabled === false ||
      (job as Record<string, unknown>).disabled === true
    ) {
      continue;
    }

    // Build normalized model key
    const modelRaw = job.model ?? job.model_name ?? job.modelName;
    const model = typeof modelRaw === 'string' ? modelRaw.trim().toLowerCase() : '';

    // Build normalized schedule key
    const scheduleRaw = job.schedule ?? job.interval ?? job.frequency ?? job.cron;
    const schedule = typeof scheduleRaw === 'string' ? scheduleRaw.trim().toLowerCase() : '';

    // Skip jobs with insufficient config (both model AND schedule must be present)
    if (!model || !schedule) {
      continue;
    }

    // Build task content key
    const taskContent = [job.task, job.type, job.description, job.prompt]
      .map(v => (typeof v === 'string' ? v.trim() : ''))
      .filter(v => v.length > 0)
      .join('|')
      .toLowerCase();

    const duplicateKey = `${model}::${schedule}::${taskContent}`;

    activeJobs.push({ job, duplicateKey });
  }

  // --- Step 2: Group by duplicate key ---
  const groupMap = new Map<string, JobEntry[]>();
  for (const entry of activeJobs) {
    const existing = groupMap.get(entry.duplicateKey);
    if (existing) {
      existing.push(entry);
    } else {
      groupMap.set(entry.duplicateKey, [entry]);
    }
  }

  // --- Step 3: Find first group with count >= 2 ---
  let duplicateGroup: JobEntry[] | null = null;
  let duplicateKey = '';

  for (const [key, group] of groupMap) {
    if (group.length >= 2) {
      duplicateGroup = group;
      duplicateKey = key;
      break; // Use first duplicate group
    }
  }

  if (!duplicateGroup) {
    return null;
  }

  // --- Step 4: Build affectedJobIds (id → name → title fallback) ---
  const affectedJobIds: string[] = [];
  const affectedJobs: { id?: unknown; name?: unknown; title?: unknown; model?: unknown; schedule?: unknown }[] = [];

  for (const entry of duplicateGroup) {
    const j = entry.job;
    if (j.id != null) {
      affectedJobIds.push(String(j.id));
    } else if (j.name != null) {
      affectedJobIds.push(String(j.name));
    } else if (j.title != null) {
      affectedJobIds.push(String(j.title));
    }

    // Build observed affected job entry
    affectedJobs.push({
      id: j.id,
      name: j.name,
      title: j.title,
      model: j.model ?? j.model_name ?? j.modelName,
      schedule: j.schedule ?? j.interval ?? j.frequency ?? j.cron,
    });
  }

  const ruleId: DiagnoseRuleId = 'D7';
  const duplicateCount = duplicateGroup.length;

  // --- Step 5: Build explanation ---
  const sampleJob = duplicateGroup[0].job;
  const sampleModel = String(sampleJob.model ?? sampleJob.model_name ?? sampleJob.modelName ?? '');
  const sampleSchedule = String(sampleJob.schedule ?? sampleJob.interval ?? sampleJob.frequency ?? sampleJob.cron ?? '');
  const explanation = `Found ${duplicateCount} active jobs with identical model ("${sampleModel}") and schedule ("${sampleSchedule}"). These jobs are duplicates and may cause redundant work or billing duplication.`;

  return {
    ruleId,
    severity: 'warning',
    message: `Duplicate active jobs detected: ${duplicateCount} jobs share the same model and schedule configuration. Review for redundancy.`,
    affectedJobIds,
    evidence: {
      ruleId,
      explanation,
      sourceFields: ['model', 'schedule', 'task', 'type', 'description', 'prompt', 'active', 'enabled', 'disabled'],
      observedValue: {
        duplicateKey,
        duplicateCount,
        affectedJobs,
      },
      threshold: {
        minDuplicateCount: 2,
      },
    },
  };
}

// -----------------------------------------------------------------------------
// D2: Burst Spend Detection
// -----------------------------------------------------------------------------


/**
 * D2: Burst spend concentration diagnostic.
 *
 * Scans all run-like records for the strongest rolling 60-minute window
 * where spend is concentrated across >= 3 distinct jobs.
 *
 * This is a REVIEW signal, not a waste proof. Burst spend may reflect normal
 * batch work, launch activity, team peak usage, or intentional scheduling.
 *
 * Key design decisions:
 * - Reads raw RunRecord[] (not FinalizedJob[]) so it can access timestamp/model
 *   fields that get aggregated away in finalizeStat().
 * - Uses detectCostRate() for per-record cost estimation.
 * - Skips records missing parseable timestamp, model, positive tokens, or job id.
 * - Labels conservative-estimate models explicitly in evidence.
 * - Does NOT claim potential savings; D2 is purely informational.
 * - Severity is 'info', not 'warning' or 'critical'.
 *
 * @param records - array of run-like records with timestamp, model, token, job-identity fields
 * @returns DiagnoseRuleResult if a burst window is found, null otherwise
 */
export function diagnoseD2BurstSpend(
  records: Record<string, unknown>[]
): DiagnoseRuleResult | null {
  if (!Array.isArray(records) || records.length === 0) {
    return null;
  }

  // --- Step 1: Parse and validate each record ---
  type ParsedRecord = {
    timestamp: number;      // ms since epoch
    model: string;          // normalised model name or ''
    totalTokens: number;    // positive finite token count
    jobKey: string;         // stable job identity string
    pricingSource: 'known-local' | 'conservative-estimate';
  };

  const parsed: ParsedRecord[] = [];
  for (const rec of records) {
    // --- Timestamp ---
    const tsRaw =
      rec.timestamp ??
      rec.createdAt ??
      rec.created_at ??
      rec.startedAt ??
      rec.started_at ??
      rec.time;
    if (tsRaw == null) continue;
    const ts = Number(new Date(tsRaw).getTime());
    if (!Number.isFinite(ts) || ts <= 0) continue;

    // --- Token count ---
    const tokensRaw =
      rec.tokens ??
      rec.total_tokens ??
      rec.token_count ??
      (rec.usage as Record<string, unknown>)?.total_tokens ??
      (rec.usage as Record<string, unknown>)?.tokens ??
      (rec.metrics as Record<string, unknown>)?.tokens;
    if (tokensRaw == null) continue;
    const tokens = Number(tokensRaw);
    if (!Number.isFinite(tokens) || tokens <= 0) continue;

    // --- Model ---
    const modelRaw = String(
      rec.model ?? rec.model_name ?? rec.modelName ?? ''
    );
    if (!modelRaw) continue;
    const costInfo = detectCostRate(modelRaw);
    const pricingSource: 'known-local' | 'conservative-estimate' =
      costInfo.pricingSource === 'known-local'
        ? 'known-local'
        : 'conservative-estimate';

    // --- Job identity ---
    // Handle rec.job as an object { id, name } separately from top-level string fields.
    // Using stringify() to safely convert any value to string before trimming.
    const jobObj = rec.job as Record<string, unknown> | null | undefined;
    const jobKey = (
      stringify(rec.jobId) ||
      stringify(rec.job_id) ||
      stringify(jobObj?.id) ||
      stringify(jobObj?.name) ||
      stringify(rec.jobName) ||
      stringify(rec.job_name) ||
      stringify(rec.name) ||
      stringify(rec.title) ||
      stringify(rec.job) ||         // rec.job as a plain string (not an object)
      ''
    ).trim();
    if (!jobKey || jobKey === '[object Object]') continue;

    parsed.push({ timestamp: ts, model: modelRaw, totalTokens: tokens, jobKey, pricingSource });
  }

  if (parsed.length === 0) {
    return null;
  }

  // --- Step 2: Sort by timestamp ---
  parsed.sort((a, b) => a.timestamp - b.timestamp);

  // --- Step 3: Rolling 60-minute window scan ---
  // For each record as window start, find the strongest (highest cost) window.
  // We track the best window seen across all starting points.
  const WINDOW_MS = 60 * 60 * 1000; // 60 minutes in ms
  const MIN_DISTINCT_JOBS = 3;
  const ABSOLUTE_FLOOR_USD = 50;

  type WindowAccum = {
    startIdx: number;
    endIdx: number;     // inclusive
    totalCost: number;
    distinctJobs: Set<string>;
    knownLocalCost: number;
    conservativeCost: number;
  };

  let best: WindowAccum | null = null;

  for (let i = 0; i < parsed.length; i++) {
    const windowStartTs = parsed[i].timestamp;
    const windowEndTs = windowStartTs + WINDOW_MS;

    let totalCost = 0;
    let knownLocalCost = 0;
    let conservativeCost = 0;
    const distinctJobs = new Set<string>();

    for (let j = i; j < parsed.length; j++) {
      if (parsed[j].timestamp > windowEndTs) break;

      const rateInfo = detectCostRate(parsed[j].model);
      const recordCost = (parsed[j].totalTokens / 1_000_000) * rateInfo.rate;
      totalCost += recordCost;
      if (parsed[j].pricingSource === 'known-local') {
        knownLocalCost += recordCost;
      } else {
        conservativeCost += recordCost;
      }
      distinctJobs.add(parsed[j].jobKey);

      // Track best window (highest total cost)
      if (
        distinctJobs.size >= MIN_DISTINCT_JOBS &&
        totalCost >= ABSOLUTE_FLOOR_USD &&
        (best === null || totalCost > best.totalCost)
      ) {
        best = { startIdx: i, endIdx: j, totalCost, distinctJobs: new Set(distinctJobs), knownLocalCost, conservativeCost };
      }
    }
  }

  if (best === null) {
    return null;
  }

  // --- Step 4: Build affectedJobs list from window records ---
  const windowRecords = parsed.slice(best.startIdx, best.endIdx + 1);
  const jobKeys = Array.from(best.distinctJobs);
  const affectedJobs = jobKeys.map((key) => {
    const recs = windowRecords.filter((r) => r.jobKey === key);
    const jobCost = recs.reduce((sum, r) => {
      const ri = detectCostRate(r.model);
      return sum + (r.totalTokens / 1_000_000) * ri.rate;
    }, 0);
    const { pricingSource } = recs[0];
    return { jobKey: key, totalCost: jobCost, pricingSource };
  });

  // --- Step 5: Build explanation ---
  const windowStart = new Date(parsed[best.startIdx].timestamp).toISOString();
  const windowEnd = new Date(parsed[best.endIdx].timestamp).toISOString();
  const ruleId: DiagnoseRuleId = 'D2';

  const explanation =
    `${best.distinctJobs.size} distinct jobs spent $${best.totalCost.toFixed(2)} ` +
    `in a 60-minute window (${windowStart} – ${windowEnd}). ` +
    `This represents a concentrated spend spike that warrants review ` +
    `to confirm it was intended.`;

  return {
    ruleId,
    severity: 'info',
    message: `Spend concentration detected: ${best.distinctJobs.size} jobs spent $${best.totalCost.toFixed(2)} in 60 minutes. Review this burst to confirm it was intended.`,
    affectedJobIds: jobKeys,
    evidence: {
      ruleId,
      explanation,
      sourceFields: ['timestamp', 'createdAt', 'created_at', 'startedAt', 'started_at', 'time',
        'tokens', 'total_tokens', 'token_count', 'usage.total_tokens', 'usage.tokens', 'metrics.tokens',
        'model', 'model_name', 'modelName',
        'jobId', 'job_id', 'job.id', 'job.name', 'jobName', 'job_name', 'name', 'title'],
      observedValue: {
        windowStart,
        windowEnd,
        windowDurationMinutes: 60,
        totalWindowCost: Math.round(best.totalCost * 100) / 100,
        distinctJobCount: best.distinctJobs.size,
        affectedJobs,
        pricingSourceBreakdown: {
          knownLocal: Math.round(best.knownLocalCost * 100) / 100,
          conservativeEstimate: Math.round(best.conservativeCost * 100) / 100,
        },
      },
      threshold: {
        windowMinutes: 60,
        minDistinctJobs: MIN_DISTINCT_JOBS,
        absoluteFloorUsd: ABSOLUTE_FLOOR_USD,
      },
    },
  };
}
