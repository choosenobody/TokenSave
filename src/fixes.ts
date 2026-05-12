// @ts-nocheck
import { FIX_LIBRARY } from './constants';

/**
 * Format a short human-readable evidence blurb from job.evidence.
 * Returns null when no relevant evidence is available for the given category.
 */
export function formatEvidenceBlurb(jobs, category) {
  if (!jobs || !jobs.length) return null;
  const job = jobs[0];
  if (!job.evidence || !Array.isArray(job.evidence)) return null;
  const entry = job.evidence.find((e) => e.ruleId === category);
  if (!entry) return null;

  const { observedValue, threshold } = entry;

  // CRITICAL / LLM_AGENT_CRON: schedule in minutes
  if (category === 'CRITICAL' || category === 'LLM_AGENT_CRON') {
    const mins = Number(observedValue);
    if (!isNaN(mins)) {
      if (category === 'CRITICAL') {
        return `Schedule: every ${mins} min · threshold: ${threshold} min`;
      }
      return `Schedule: every ${mins} min`;
    }
  }

  // ERROR_WASTE: error rate as percentage
  // Show one decimal place when observed is close to threshold to avoid "10% above 10%" ambiguity
  if (category === 'ERROR_WASTE') {
    const obsPct = typeof observedValue === 'number'
      ? (observedValue * 100).toFixed(observedValue * 100 % 1 === 0 ? 0 : 1)
      : observedValue;
    const threshPct = threshold != null
      ? (Number(threshold) * 100).toFixed(Number(threshold) * 100 % 1 === 0 ? 0 : 1)
      : '?';
    return `Error rate: ${obsPct}% · threshold: ${threshPct}%`;
  }

  // PREMIUM_MODEL_WASTE: model name
  if (category === 'PREMIUM_MODEL_WASTE') {
    return `Model: ${observedValue}`;
  }

  // WARNING: schedule in minutes
  if (category === 'WARNING') {
    const mins = Number(observedValue);
    if (!isNaN(mins)) {
      return `Schedule: every ${mins} min · threshold: ${threshold} min`;
    }
  }

  return null;
}

/**
 * Returns evidence-backed problem text for CRITICAL and ERROR_WASTE categories,
 * or null when evidence is absent/unusable.
 *
 * CRITICAL: evidence.ruleId === "CRITICAL" + finite observedValue + finite threshold
 *   → "Runs every {mins} min, below the {threshold} min threshold."
 *
 * ERROR_WASTE: evidence.ruleId === "ERROR_WASTE" + finite observedValue + finite threshold
 *   → "{pct}% error rate, above the {thresholdPct}% threshold."
 *   (observedValue and threshold are rates, e.g. 0.67 => 67%)
 *
 * All other categories: return null (no override in I14-B).
 * Missing/malformed evidence: return null (caller falls back to FIX_LIBRARY).
 */
export function buildEvidenceBackedProblem(category, jobs) {
  if (!jobs || !jobs.length) return null;

  if (category !== 'CRITICAL' && category !== 'ERROR_WASTE') {
    return null;
  }

  // Find first job that has a matching evidence entry for this category
  const job = jobs.find((j) =>
    j.evidence && Array.isArray(j.evidence) &&
    j.evidence.some((e) => e.ruleId === category)
  );
  if (!job) return null;

  const entry = job.evidence.find((e) => e.ruleId === category);
  if (!entry) return null;

  const { observedValue, threshold } = entry;

  // Reject null, undefined, empty/whitespace strings, and non-finite numbers.
  // typeof === "number" guards against null,"",whitespace,object,etc.
  if (
    typeof observedValue !== 'number' || !Number.isFinite(observedValue) ||
    typeof threshold !== 'number' || !Number.isFinite(threshold)
  ) {
    return null;
  }

  if (category === 'CRITICAL') {
    return `Runs every ${observedValue} min, below the ${threshold} min threshold.`;
  }

  if (category === 'ERROR_WASTE') {
    // Show one decimal place when needed to avoid "10% above 10%" ambiguity
    const rawObs = observedValue * 100;
    const rawThresh = threshold * 100;
    const obsPct = rawObs % 1 === 0 ? rawObs.toFixed(0) : rawObs.toFixed(1);
    const threshPct = rawThresh % 1 === 0 ? rawThresh.toFixed(0) : rawThresh.toFixed(1);
    return `${obsPct}% error rate, above the ${threshPct}% threshold.`;
  }

  return null;
}

export function buildFixCards(jobs) {
  const order = ["CRITICAL", "LLM_AGENT_CRON", "ERROR_WASTE", "PREMIUM_MODEL_WASTE", "WARNING"];
  const categoryRank = new Map(order.map((category, index) => [category, index]));

  return (jobs || [])
    .filter((job) => {
      if (!job || job.lifecycleStatus === 'disabled' || job.lifecycleStatus === 'historical') return false;
      return (job.issues || []).some((issue) => issue !== 'OK' && categoryRank.has(issue));
    })
    .map((job) => {
      const category = (job.issues || []).find((issue) => issue !== 'OK' && categoryRank.has(issue));
      const evidenceBackedProblem = buildEvidenceBackedProblem(category, [job]);

      return {
        category,
        config: {
          ...FIX_LIBRARY[category],
          problem: evidenceBackedProblem ?? FIX_LIBRARY[category].problem,
        },
        job,
        jobs: [job],
      };
    })
    .sort((left, right) => {
      const categoryDelta = categoryRank.get(left.category) - categoryRank.get(right.category);
      if (categoryDelta !== 0) return categoryDelta;
      const lw = left.job.totalTokens * left.job.errorRate;
      const rw = right.job.totalTokens * right.job.errorRate;
      return rw - lw;
    });
}
