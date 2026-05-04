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
  if (category === 'ERROR_WASTE') {
    const pct = typeof observedValue === 'number'
      ? (observedValue * 100).toFixed(0)
      : observedValue;
    return `Error rate: ${pct}% · threshold: ${threshold != null ? (Number(threshold) * 100).toFixed(0) : '?'}%`;
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

export function buildFixCards(jobs) {
  const categoryMap = new Map();

  jobs.forEach((job) => {
    const categories = job.issues[0] === "OK" ? ["OK"] : job.issues;
    categories.forEach((category) => {
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category).push(job);
    });
  });

  const order = ["CRITICAL", "ERROR_WASTE", "PREMIUM_MODEL_WASTE", "WARNING", "OK"];
  return order
    .filter((category) => categoryMap.has(category))
    .map((category) => ({
      category,
      config: FIX_LIBRARY[category],
      jobs: categoryMap.get(category)
        .sort((left, right) => {
          const lw = left.totalTokens * left.errorRate;
          const rw = right.totalTokens * right.errorRate;
          return rw - lw;
        })
        .slice(0, 4)
    }));
}
