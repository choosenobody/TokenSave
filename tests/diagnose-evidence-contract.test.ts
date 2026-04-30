import { describe, it, expect } from 'vitest';
import {
  diagnoseD1FailureLoopDetection,
  diagnoseD2BurstSpend,
  diagnoseD3PremiumModelOnSimpleJob,
  diagnoseD4AgentTurnCronBurn,
  diagnoseD5UnknownModelPricing,
  diagnoseD6ZeroTokenAbnormalRun,
  diagnoseD7ExactDuplicateActiveJob,
} from '../src/rules';

function assertEvidenceContract(
  result: ReturnType<
    | typeof diagnoseD1FailureLoopDetection
    | typeof diagnoseD3PremiumModelOnSimpleJob
    | typeof diagnoseD4AgentTurnCronBurn
    | typeof diagnoseD5UnknownModelPricing
    | typeof diagnoseD6ZeroTokenAbnormalRun
    | typeof diagnoseD7ExactDuplicateActiveJob
  > & { ruleId: string; severity: string; message: string; affectedJobIds: string[]; evidence: Record<string, unknown> },
  expectedRuleId: string,
  expectedSeverity: string
): void {
  expect(result).not.toBeNull();
  expect(result!.ruleId).toBe(expectedRuleId);
  expect(result!.severity).toBe(expectedSeverity);
  expect(typeof result!.message).toBe('string');
  expect(result!.message.length).toBeGreaterThan(0);
  expect(Array.isArray(result!.affectedJobIds)).toBe(true);
  expect(Object.prototype.hasOwnProperty.call(result, 'evidence')).toBe(true);
  const evidence = result!.evidence as Record<string, unknown>;
  expect(evidence).not.toBeNull();
  expect(typeof evidence).toBe('object');
  expect(typeof evidence).not.toBe('string');
  expect(evidence.ruleId).toBe(expectedRuleId);
  expect(typeof evidence.explanation).toBe('string');
  expect(evidence.explanation.length).toBeGreaterThan(0);
  expect(Array.isArray(evidence.sourceFields)).toBe(true);
  expect(evidence.sourceFields.length).toBeGreaterThan(0);
  expect(Object.prototype.hasOwnProperty.call(evidence, 'observedValue')).toBe(true);
  expect(Object.prototype.hasOwnProperty.call(evidence, 'threshold')).toBe(true);
  // Structured — not free-text only: requires multiple structured keys
  const structuredKeys = ['ruleId', 'explanation', 'sourceFields', 'observedValue', 'threshold'];
  const presentKeys = structuredKeys.filter(k => k in evidence);
  expect(presentKeys.length).toBeGreaterThanOrEqual(4);
}

describe('diagnoseD1FailureLoopDetection — evidence contract', () => {
  it('fires and returns structured evidence (job with id)', () => {
    const result = diagnoseD1FailureLoopDetection({
      id: 'd1-job',
      totalRuns: 5,
      errorRuns: 4,
    });
    assertEvidenceContract(result, 'D1', 'warning');
  });

  it('fires and returns structured evidence (job without id)', () => {
    const result = diagnoseD1FailureLoopDetection({
      name: 'D1-named-job',
      totalRuns: 5,
      errorRuns: 4,
    });
    assertEvidenceContract(result, 'D1', 'warning');
  });
});

describe('diagnoseD2BurstSpend — evidence contract', () => {
  it('fires and returns structured evidence', () => {
    const now = Date.now();
    // D2 requires ≥3 distinct jobs + ≥$50 total cost in 60-minute window.
    // Use GPT-4o (conservative-estimate) at ~$2/M tokens → 10M tokens ≈ $20/job → 3 jobs ≈ $60.
    const records: Record<string, unknown>[] = [
      { timestamp: now - 1000 * 60 * 59, model: 'GPT-4o', tokens: 10_000_000, jobId: 'job-1' },
      { timestamp: now - 1000 * 60 * 30, model: 'GPT-4o', tokens: 10_000_000, jobId: 'job-2' },
      { timestamp: now - 1000 * 60 * 1,  model: 'GPT-4o', tokens: 10_000_000, jobId: 'job-3' },
    ];
    const result = diagnoseD2BurstSpend(records);
    assertEvidenceContract(result, 'D2', 'info');
  });
});

describe('diagnoseD3PremiumModelOnSimpleJob — evidence contract', () => {
  it('fires and returns structured evidence', () => {
    const result = diagnoseD3PremiumModelOnSimpleJob({
      id: 'd3-job',
      model: 'Claude Opus',
      description: 'health check',
      totalTokens: 500,
      totalRuns: 1,
    });
    assertEvidenceContract(result, 'D3', 'warning');
  });
});

describe('diagnoseD4AgentTurnCronBurn — evidence contract', () => {
  it('fires and returns structured evidence', () => {
    const result = diagnoseD4AgentTurnCronBurn({
      id: 'd4-job',
      agentTurn: true,
      schedule: '*/5 * * * *',
    });
    assertEvidenceContract(result, 'D4', 'warning');
  });
});

describe('diagnoseD5UnknownModelPricing — evidence contract', () => {
  it('fires and returns structured evidence', () => {
    const result = diagnoseD5UnknownModelPricing({
      id: 'd5-job',
      model: 'completely-unknown-model-xyz',
    });
    assertEvidenceContract(result, 'D5', 'warning');
  });
});

describe('diagnoseD6ZeroTokenAbnormalRun — evidence contract', () => {
  it('fires and returns structured evidence', () => {
    const result = diagnoseD6ZeroTokenAbnormalRun({
      id: 'd6-job',
      totalTokens: 0,
      totalRuns: 5,
    });
    assertEvidenceContract(result, 'D6', 'warning');
  });
});

describe('diagnoseD7ExactDuplicateActiveJob — evidence contract', () => {
  it('fires and returns structured evidence', () => {
    const result = diagnoseD7ExactDuplicateActiveJob([
      {
        id: 'd7-job-1',
        name: 'Dup Job',
        model: 'MiniMax M2.7',
        task: 'health check',
        schedule: '*/10 * * * *',
        enabled: true,
        active: true,
        createdAt: '2026-04-29T10:00:00Z',
        updatedAt: '2026-04-29T10:00:00Z',
      },
      {
        id: 'd7-job-2',
        name: 'Dup Job',
        model: 'MiniMax M2.7',
        task: 'health check',
        schedule: '*/10 * * * *',
        enabled: true,
        active: true,
        createdAt: '2026-04-29T10:05:00Z',
        updatedAt: '2026-04-29T10:05:00Z',
      },
    ]);
    assertEvidenceContract(result, 'D7', 'warning');
  });
});