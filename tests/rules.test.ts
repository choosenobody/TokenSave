import { describe, it, expect } from 'vitest';
import { diagnoseD5UnknownModelPricing, diagnoseD6ZeroTokenAbnormalRun } from '../src/rules';

describe('diagnoseD5UnknownModelPricing', () => {
  it('fires when model is unknown (pricingSource === conservative-estimate)', () => {
    const result = diagnoseD5UnknownModelPricing({ model: 'completely-unknown-model-xyz' });
    expect(result).not.toBeNull();
    expect(result!.evidence.ruleId).toBe('D5');
    expect(result!.severity).toBe('warning');
    expect(result!.evidence.sourceFields).toContain('model');
    expect(result!.evidence.sourceFields).toContain('pricingSource');
  });

  it('does NOT fire when model is known (pricingSource === known-local)', () => {
    const result = diagnoseD5UnknownModelPricing({ model: 'MiniMax M2.7' });
    expect(result).toBeNull();
  });

  it('evidence.observedValue includes model and pricingSource', () => {
    const result = diagnoseD5UnknownModelPricing({ model: 'unknown-gpt-99' });
    expect(result).not.toBeNull();
    const ov = result!.evidence.observedValue as Record<string, unknown>;
    expect(ov.model).toBe('unknown-gpt-99');
    expect(ov.pricingSource).toBe('conservative-estimate');
    expect(ov.estimatedRate).toBeDefined();
  });

  it('does not mutate the input job', () => {
    const job = { model: 'some-unknown-model' } as const;
    const before = JSON.stringify(job);
    diagnoseD5UnknownModelPricing(job);
    expect(JSON.stringify(job)).toBe(before);
  });

  it('handles missing model field gracefully', () => {
    const result = diagnoseD5UnknownModelPricing({});
    expect(result).not.toBeNull();
    expect(result!.evidence.ruleId).toBe('D5');
  });

  it('affectedJobIds uses job.id when present', () => {
    const result = diagnoseD5UnknownModelPricing({ model: 'unknown-x', id: 'job-123' });
    expect(result).not.toBeNull();
    expect(result!.affectedJobIds).toContain('job-123');
  });

  it('affectedJobIds uses job.name when id not present', () => {
    const result = diagnoseD5UnknownModelPricing({ model: 'unknown-y', name: 'My Job' });
    expect(result).not.toBeNull();
    expect(result!.affectedJobIds).toContain('My Job');
  });

  it('known models return null (not fired)', () => {
    const knownModels = ['MiniMax M2.7', 'GPT-4o', 'Claude Sonnet'];
    for (const m of knownModels) {
      const result = diagnoseD5UnknownModelPricing({ model: m });
      expect(result).toBeNull();
    }
  });
});

describe('diagnoseD6ZeroTokenAbnormalRun', () => {
  it('fires for totalRuns > 0 and totalTokens === 0', () => {
    const result = diagnoseD6ZeroTokenAbnormalRun({ totalRuns: 5, totalTokens: 0 });
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('D6');
    expect(result!.severity).toBe('warning');
    expect(result!.evidence.ruleId).toBe('D6');
  });

  it('does NOT fire for totalRuns === 0 and totalTokens === 0', () => {
    const result = diagnoseD6ZeroTokenAbnormalRun({ totalRuns: 0, totalTokens: 0 });
    expect(result).toBeNull();
  });

  it('does NOT fire for totalTokens > 0', () => {
    const result = diagnoseD6ZeroTokenAbnormalRun({ totalRuns: 5, totalTokens: 1234 });
    expect(result).toBeNull();
  });

  it('handles missing totals gracefully (no throw)', () => {
    expect(() => diagnoseD6ZeroTokenAbnormalRun({})).not.toThrow();
    expect(diagnoseD6ZeroTokenAbnormalRun({})).toBeNull();
  });

  it('handles undefined values gracefully', () => {
    expect(() => diagnoseD6ZeroTokenAbnormalRun({ totalRuns: undefined, totalTokens: undefined })).not.toThrow();
    expect(diagnoseD6ZeroTokenAbnormalRun({ totalRuns: undefined, totalTokens: undefined })).toBeNull();
  });

  it('handles non-finite values gracefully', () => {
    expect(() => diagnoseD6ZeroTokenAbnormalRun({ totalRuns: NaN, totalTokens: NaN })).not.toThrow();
    expect(diagnoseD6ZeroTokenAbnormalRun({ totalRuns: NaN, totalTokens: NaN })).toBeNull();
    expect(() => diagnoseD6ZeroTokenAbnormalRun({ totalRuns: Infinity, totalTokens: Infinity })).not.toThrow();
    expect(diagnoseD6ZeroTokenAbnormalRun({ totalRuns: Infinity, totalTokens: Infinity })).toBeNull();
  });

  it('evidence includes ruleId, sourceFields, observedValue, and threshold', () => {
    const result = diagnoseD6ZeroTokenAbnormalRun({ totalRuns: 3, totalTokens: 0 });
    expect(result).not.toBeNull();
    expect(result!.evidence.ruleId).toBe('D6');
    expect(result!.evidence.sourceFields).toContain('totalRuns');
    expect(result!.evidence.sourceFields).toContain('totalTokens');
    expect(result!.evidence.observedValue).toEqual({ totalRuns: 3, totalTokens: 0 });
    expect(result!.evidence.threshold).toEqual({ totalRunsGreaterThan: 0, totalTokensEquals: 0 });
  });

  it('affectedJobIds uses job.id when present', () => {
    const result = diagnoseD6ZeroTokenAbnormalRun({ totalRuns: 1, totalTokens: 0, id: 'job-abc' });
    expect(result).not.toBeNull();
    expect(result!.affectedJobIds).toContain('job-abc');
  });

  it('affectedJobIds uses job.name when id not present', () => {
    const result = diagnoseD6ZeroTokenAbnormalRun({ totalRuns: 1, totalTokens: 0, name: 'Test Job' });
    expect(result).not.toBeNull();
    expect(result!.affectedJobIds).toContain('Test Job');
  });

  it('affectedJobIds uses job.title when id and name not present', () => {
    const result = diagnoseD6ZeroTokenAbnormalRun({ totalRuns: 1, totalTokens: 0, title: 'Test Title' });
    expect(result).not.toBeNull();
    expect(result!.affectedJobIds).toContain('Test Title');
  });

  it('affectedJobIds is empty when no identifier fields present', () => {
    const result = diagnoseD6ZeroTokenAbnormalRun({ totalRuns: 1, totalTokens: 0 });
    expect(result).not.toBeNull();
    expect(result!.affectedJobIds).toEqual([]);
  });

  it('does not mutate the input job', () => {
    const job = { totalRuns: 10, totalTokens: 0, id: 'test-job' } as const;
    const before = JSON.stringify(job);
    diagnoseD6ZeroTokenAbnormalRun(job);
    expect(JSON.stringify(job)).toBe(before);
  });

  it('handles string numeric values for totals', () => {
    // The function accepts unknown types but only fires when they parse to the right numeric values
    const result = diagnoseD6ZeroTokenAbnormalRun({ totalRuns: '5', totalTokens: 0 });
    expect(result).toBeNull(); // string '5' is not a finite number, so it won't match
  });
});
