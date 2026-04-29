import { detectCostRate } from './pricing';
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
