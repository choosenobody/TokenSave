import { detectCostRate } from './pricing';
import { parseScheduleMinutes, readBoolean, isSimpleCheck } from './domain';
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
 * Fires when isSimpleCheck === true AND the model is known-local (in pricing database)
 * AND the model's rate exceeds the premium threshold: referenceRate * premiumMultiplier.
 *
 * referenceRate = detectCostRate('MiniMax M2.7').rate = 0.14
 * premiumMultiplier = 10 (constant)
 * threshold = 1.40
 *
 * Using an expensive model (e.g., Claude Opus at 15) for a simple check job is wasteful.
 *
 * @param job - a job-like object with model, isSimpleCheck, id, name, title fields
 * @returns DiagnoseRuleResult if fired, null if the rule does not apply
 */
export function diagnoseD3PremiumModelOnSimpleJob(job: {
  model?: unknown;
  isSimpleCheck?: unknown;
  id?: unknown;
  name?: unknown;
  title?: unknown;
}): DiagnoseRuleResult | null {
  // isSimpleCheck must be exactly true
  if (job.isSimpleCheck !== true) {
    return null;
  }

  // Model must be a finite string
  const model =
    typeof job.model === 'string' && job.model.length > 0 ? job.model : null;

  if (model === null) {
    return null;
  }

  const costInfo = detectCostRate(model);

  // Model must be known-local (D5 handles unknown models)
  if (costInfo.pricingSource !== 'known-local') {
    return null;
  }

  // Constants
  const REFERENCE_RATE = 0.14; // MiniMax M2.7 rate
  const PREMIUM_MULTIPLIER = 10;
  const THRESHOLD = 1.40; // referenceRate * premiumMultiplier = 0.14 * 10

  // Model rate must exceed threshold
  if (!(costInfo.rate > THRESHOLD)) {
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
    message: `Model "${model}" (rate ${costInfo.rate}) is being used for a simple check job but exceeds the premium threshold (${THRESHOLD}). Consider a lighter, cheaper model for simple checks.`,
    affectedJobIds,
    evidence: {
      ruleId,
      explanation: `Model "${model}" with rate ${costInfo.rate} is used on a simple check job, but the premium threshold is ${THRESHOLD} (reference rate ${REFERENCE_RATE} × multiplier ${PREMIUM_MULTIPLIER}). Using premium models on simple jobs is wasteful.`,
      sourceFields: ['model', 'isSimpleCheck', 'modelRate', 'referenceRate', 'premiumMultiplier'],
      observedValue: {
        model,
        isSimpleCheck: true,
        modelRate: costInfo.rate,
        referenceRate: REFERENCE_RATE,
        premiumMultiplier: PREMIUM_MULTIPLIER,
      },
      threshold: {
        premiumMultiplier: PREMIUM_MULTIPLIER,
        minFiringRate: THRESHOLD,
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
