import { detectCostRate } from './pricing';
import type { DiagnoseRuleResult, DiagnoseRuleId } from './types';

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
export function diagnoseD5UnknownModelPricing(job: { model?: unknown }): DiagnoseRuleResult | null {
  const model = typeof job.model === 'string' ? job.model : String(job.model ?? '');

  const costInfo = detectCostRate(model);

  if (costInfo.pricingSource !== 'conservative-estimate') {
    return null; // rule did not fire
  }

  const ruleId: DiagnoseRuleId = 'D5';

  return {
    ruleId,
    fired: true,
    severity: 'warning',
    explanation: `Model "${model}" is not in the pricing database. A conservative estimate (highest known rate) is used. Actual cost may differ significantly.`,
    sourceFields: ['model', 'pricingSource'],
    observedValue: {
      model,
      pricingSource: costInfo.pricingSource,
      estimatedRate: costInfo.rate,
    },
    threshold: null, // no numeric threshold for this rule
    affectedJobIds: [],
  };
}