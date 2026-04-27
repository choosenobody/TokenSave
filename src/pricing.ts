// @ts-nocheck
import { stringify } from './utils';
import { COST_RATES } from './constants';

export function detectCostRate(model) {
  const candidate = COST_RATES.find((rate) => rate.match.test(stringify(model)));
  if (candidate) return candidate;
  // Unknown model — assume MiniMax M2.7 as default for OpenClaw users
  return { label: "MiniMax-M2.7 (default)", rate: 0.14 };
}
