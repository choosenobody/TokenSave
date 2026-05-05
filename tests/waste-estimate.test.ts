import { describe, it, expect } from 'vitest';
import {
  estimateOccurrencesPerDay,
  estimateJobWasteTokens,
  estimateWastePerRun,
  estimateDailyWasteTokens,
} from '../src/domain';

// ---------------------------------------------------------------------------
// Helper: minimal job fixture matching the union type in domain.ts
// Only fields actually read by the four estimators are included.
// ---------------------------------------------------------------------------
function makeJob(overrides: {
  totalTokens?: number;
  errorRate?: number;
  scheduleMinutes?: number | null;
  badge?: string;
  pricingSource?: string;
  totalRuns?: number;
  raw?: Record<string, unknown>;
  promptText?: string;
  rate?: { rate: number };
} = {}): {
  totalTokens: number;
  errorRate: number;
  scheduleMinutes: number | null;
  badge: string;
  pricingSource: string;
  rate: { rate: number };
  raw: Record<string, unknown>;
  promptText: string;
  totalRuns: number;
} {
  return {
    totalTokens: 10_000,
    errorRate: 0,
    scheduleMinutes: null,
    badge: 'OK',
    pricingSource: 'known-local',
    rate: { rate: 0.14 },
    raw: {},
    promptText: '',
    totalRuns: 10,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// estimateOccurrencesPerDay
// ---------------------------------------------------------------------------
describe('estimateOccurrencesPerDay', () => {
  it('5 minutes → 288 occurrences per day', () => {
    expect(estimateOccurrencesPerDay(5)).toBe(288);
  });

  it('60 minutes → 24 occurrences per day', () => {
    expect(estimateOccurrencesPerDay(60)).toBe(24);
  });

  it('1440 minutes (daily) → 1 occurrence per day', () => {
    expect(estimateOccurrencesPerDay(1440)).toBe(1);
  });

  it('null scheduleMinutes → null', () => {
    expect(estimateOccurrencesPerDay(null)).toBeNull();
  });

  it('0 scheduleMinutes → null (guards against divide-by-zero)', () => {
    expect(estimateOccurrencesPerDay(0)).toBeNull();
  });

  it('negative scheduleMinutes → null', () => {
    expect(estimateOccurrencesPerDay(-30)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// estimateJobWasteTokens
// ---------------------------------------------------------------------------
describe('estimateJobWasteTokens', () => {
  const cheapRate = 0.14; // MiniMax M2.7 local rate

  it('errorRate above 5% contributes waste proportional to (rate - 0.05)', () => {
    // errorRate=0.25 → (0.25 - 0.05) = 0.20 → 10_000 × 0.20 = 2000
    const job = makeJob({ totalTokens: 10_000, errorRate: 0.25 });
    expect(estimateJobWasteTokens(job, cheapRate)).toBe(2000);
  });

  it('errorRate at or below 5% contributes zero error waste', () => {
    const job = makeJob({ totalTokens: 10_000, errorRate: 0.05 });
    expect(estimateJobWasteTokens(job, cheapRate)).toBe(0);
    const job2 = makeJob({ totalTokens: 10_000, errorRate: 0.01 });
    expect(estimateJobWasteTokens(job2, cheapRate)).toBe(0);
  });

  it('conservative-estimate PREMIUM_MODEL_WASTE does NOT add modelSavingTokens', () => {
    // Even with badge=PREMIUM_MODEL_WASTE, pricingSource='conservative-estimate'
    // must keep modelSavingTokens at 0 (mirrors analyzeDataset behavior)
    const job = makeJob({
      badge: 'PREMIUM_MODEL_WASTE',
      pricingSource: 'conservative-estimate',
      rate: { rate: 15 },
      // No cheapRate effect — conservative-estimate gates it out regardless
    });
    // errorRate=0, no schedule waste → only modelSavingTokens possible (but gated)
    expect(estimateJobWasteTokens(job, cheapRate)).toBe(0);
  });

  it('non-conservative PREMIUM_MODEL_WASTE adds modelSavingTokens', () => {
    // With premiumRate=15, cheapRate=0.14:
    // modelSavingTokens = 10000 × max(0, (15 - 0.14) / 15) ≈ 9907
    const job = makeJob({
      badge: 'PREMIUM_MODEL_WASTE',
      pricingSource: 'known-local',
      rate: { rate: 15 },
    });
    expect(estimateJobWasteTokens(job, cheapRate)).toBeGreaterThan(0);
  });

  it('job without PREMIUM_MODEL_WASTE badge adds zero modelSavingTokens', () => {
    const job = makeJob({
      badge: 'ERROR_WASTE',
      pricingSource: 'known-local',
      rate: { rate: 15 },
    });
    // Only error waste; no model savings
    expect(estimateJobWasteTokens(job, cheapRate)).toBe(0);
  });

  it('schedule waste applies when scheduleMinutes < 60 and job is simple check', () => {
    // simple check (health/status/ping pattern) at 30 min: (60-30)/60 = 0.50 → 5000 waste
    const job = makeJob({
      scheduleMinutes: 30,
      raw: { type: 'check', taskType: 'health', name: 'system health check', description: '' },
      promptText: 'system health check',
    });
    // isSimpleCheck matches → scheduleWastedTokens = 10000 × (60-30)/60 = 5000
    expect(estimateJobWasteTokens(job, cheapRate)).toBe(5000);
  });

  it('schedule waste does NOT apply when scheduleMinutes >= 60', () => {
    const job = makeJob({
      scheduleMinutes: 120,
      raw: { type: 'check', taskType: 'health', name: 'system health check', description: '' },
      promptText: 'system health check',
    });
    expect(estimateJobWasteTokens(job, cheapRate)).toBe(0);
  });

  it('schedule waste does NOT apply to non-simple-check jobs', () => {
    const job = makeJob({
      scheduleMinutes: 30,
      raw: { type: 'exec', taskType: 'command', name: 'run deploy', description: '' },
      promptText: 'run deploy script',
    });
    // isSimpleCheck returns false for non-check tasks
    expect(estimateJobWasteTokens(job, cheapRate)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// estimateWastePerRun
// ---------------------------------------------------------------------------
describe('estimateWastePerRun', () => {
  const cheapRate = 0.14;

  it('totalRuns=0 → null (avoids divide-by-zero)', () => {
    const job = makeJob({ totalRuns: 0, errorRate: 0.25 });
    expect(estimateWastePerRun(job, cheapRate)).toBeNull();
  });

  it('totalRuns=1 with waste → positive number', () => {
    const job = makeJob({ totalRuns: 1, errorRate: 0.25 });
    expect(estimateWastePerRun(job, cheapRate)).toBe(2000); // 2000 waste / 1 run
  });

  it('totalRuns=10 with waste → waste / 10', () => {
    const job = makeJob({ totalRuns: 10, errorRate: 0.25 });
    expect(estimateWastePerRun(job, cheapRate)).toBe(200); // 2000 waste / 10 runs
  });

  it('zero waste → 0 (not null)', () => {
    const job = makeJob({ totalRuns: 10, errorRate: 0 });
    expect(estimateWastePerRun(job, cheapRate)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// estimateDailyWasteTokens
// ---------------------------------------------------------------------------
describe('estimateDailyWasteTokens', () => {
  const cheapRate = 0.14;

  it('scheduleMinutes=null → null even with positive perRun', () => {
    const job = makeJob({ scheduleMinutes: null, totalRuns: 10, errorRate: 0.25 });
    expect(estimateDailyWasteTokens(job, cheapRate)).toBeNull();
  });

  it('totalRuns=0 → null (perRun is null)', () => {
    const job = makeJob({ scheduleMinutes: 30, totalRuns: 0, errorRate: 0.25 });
    expect(estimateDailyWasteTokens(job, cheapRate)).toBeNull();
  });

  it('valid scheduled job → positive number', () => {
    // 30-min simple check, 10 runs:
    // schedule waste = 10000 × (60-30)/60 = 5000
    // error waste   = 10000 × max(0, 0.25-0.05) = 2000
    // total waste   = 7000; perRun = 700; perDay = 48 (1440/30)
    // daily = 700 × 48 = 33600
    const job = makeJob({
      scheduleMinutes: 30,
      totalRuns: 10,
      errorRate: 0.25,
      raw: { type: 'check', taskType: 'health', name: 'health', description: '' },
      promptText: 'health check',
    });
    expect(estimateDailyWasteTokens(job, cheapRate)).toBe(33_600);
  });

  it('daily schedule (1440 min), 10 runs, errorRate=0.25 → 2000/day', () => {
    // perRun = 2000/10 = 200
    // perDay = 1440/1440 = 1
    // daily = 200 × 1 = 200
    const job = makeJob({ scheduleMinutes: 1440, totalRuns: 10, errorRate: 0.25 });
    expect(estimateDailyWasteTokens(job, cheapRate)).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Three-tier ranking behavior
// ---------------------------------------------------------------------------
describe('three-tier ranking', () => {
  // cheapRate for modelSavingTokens computation
  const cheapRate = 0.14;

  // Helper: build a comparator with the same logic as main.ts rankedWaste sort
  function tierCompare(left: Parameters<typeof estimateDailyWasteTokens>[0], right: Parameters<typeof estimateDailyWasteTokens>[0]): number {
    const leftDaily = estimateDailyWasteTokens(left, cheapRate);
    const rightDaily = estimateDailyWasteTokens(right, cheapRate);
    // Tier 1: positive estimatedDailyWasteTokens (> 0, not merely non-null)
    if (leftDaily !== null && leftDaily > 0 && rightDaily !== null && rightDaily > 0) return rightDaily - leftDaily;
    if (leftDaily !== null && leftDaily > 0) return -1;
    if (rightDaily !== null && rightDaily > 0) return 1;
    // Tier 2: positive estimatedWastePerRun
    const leftPerRun = estimateWastePerRun(left, cheapRate);
    const rightPerRun = estimateWastePerRun(right, cheapRate);
    if (leftPerRun !== null && rightPerRun !== null) return rightPerRun - leftPerRun;
    if (leftPerRun !== null) return -1;
    if (rightPerRun !== null) return 1;
    // Tier 3: totalTokens × errorRate
    const lw = left.totalTokens * left.errorRate;
    const rw = right.totalTokens * right.errorRate;
    return rw - lw;
  }

  it('unknown schedule (null scheduleMinutes) is never Tier 1', () => {
    const unknownSchedule = makeJob({
      scheduleMinutes: null,
      totalRuns: 10,
      errorRate: 0.25,
      badge: 'ERROR_WASTE',
    });
    const knownSchedule = makeJob({
      scheduleMinutes: 30,
      totalRuns: 10,
      errorRate: 0.25,
      badge: 'ERROR_WASTE',
      raw: { type: 'check', taskType: 'health', name: 'health', description: '' },
      promptText: 'health check',
    });
    // Unknown-schedule job must not sort before known-schedule job in Tier 1
    const result = tierCompare(unknownSchedule, knownSchedule);
    expect(result).toBeGreaterThanOrEqual(0); // unknown not ranked above known in Tier 1
  });

  it('estimatedDailyWasteTokens = 0 is NOT Tier 1 (must be > 0)', () => {
    // Job with zero totalRuns → perRun = null → daily = null → Tier 2 or 3
    const zeroDaily = makeJob({ scheduleMinutes: 30, totalRuns: 0, errorRate: 0 });
    const positiveDaily = makeJob({
      scheduleMinutes: 30,
      totalRuns: 10,
      errorRate: 0.25,
      raw: { type: 'check', taskType: 'health', name: 'health', description: '' },
      promptText: 'health check',
    });
    const result = tierCompare(zeroDaily, positiveDaily);
    // zeroDaily has estimatedDailyWasteTokens=0 (null via perRun=null) → not Tier 1
    // positiveDaily has estimatedDailyWasteTokens=144000 (>0) → Tier 1
    expect(result).toBeGreaterThanOrEqual(0); // Tier 3/2 job must not outrank Tier 1
  });

  it('Tier 2 (per-run) used when daily unavailable but per-run is positive', () => {
    // Unknown schedule but has runs → Tier 2
    const unknownWithRuns = makeJob({
      scheduleMinutes: null,
      totalRuns: 10,
      errorRate: 0.25,
      badge: 'ERROR_WASTE',
    });
    const lowWaste = makeJob({
      scheduleMinutes: null,
      totalRuns: 1,
      errorRate: 0.01,
      badge: 'OK',
    });
    const result = tierCompare(unknownWithRuns, lowWaste);
    expect(result).toBeLessThan(0); // higher waste job ranked first
  });

  it('Tier 3 fallback (totalTokens × errorRate) when no Tier 1 or Tier 2', () => {
    const highTokens = makeJob({
      scheduleMinutes: null,
      totalRuns: 0,
      totalTokens: 100_000,
      errorRate: 0.1,
      badge: 'ERROR_WASTE',
    });
    const lowTokens = makeJob({
      scheduleMinutes: null,
      totalRuns: 0,
      totalTokens: 1_000,
      errorRate: 0.1,
      badge: 'ERROR_WASTE',
    });
    const result = tierCompare(highTokens, lowTokens);
    expect(result).toBeLessThan(0); // 100000×0.1=10000 > 1000×0.1=100
  });

  it('Tier 1 (daily waste desc) correctly orders two known-schedule jobs', () => {
    const frequent = makeJob({
      scheduleMinutes: 5,  // 288/day
      totalRuns: 10,
      errorRate: 0.25,
      badge: 'ERROR_WASTE',
      raw: { type: 'check', taskType: 'health', name: 'health', description: '' },
      promptText: 'health check',
    });
    const infrequent = makeJob({
      scheduleMinutes: 60,  // 24/day
      totalRuns: 10,
      errorRate: 0.25,
      badge: 'ERROR_WASTE',
    });
    // frequent: perRun=200, perDay=288, daily=57600
    // infrequent: perRun=200, perDay=24, daily=4800
    const result = tierCompare(frequent, infrequent);
    expect(result).toBeLessThan(0); // frequent should rank first (higher daily)
  });
});
