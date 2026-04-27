// @ts-nocheck
import { FIX_LIBRARY } from './constants';

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
