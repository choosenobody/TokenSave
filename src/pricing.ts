// @ts-nocheck
import { stringify } from './utils';
import { COST_RATES } from './constants';

export function detectCostRate(model) {
  const candidate = COST_RATES.find((rate) => rate.match.test(stringify(model)));
  if (candidate) {
    return { ...candidate, pricingSource: 'known-local' };
  }
  // Unknown model — use highest known positive rate as conservative estimate
  const highestRate = 15; // Claude Opus / GPT-5-codex — highest positive rate in COST_RATES
  return {
    label: 'Unknown model (conservative estimate)',
    rate: highestRate,
    pricingSource: 'conservative-estimate'
  };
}
