import { describe, it, expect } from 'vitest';
import { diagnoseD5UnknownModelPricing } from '../src/rules';

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