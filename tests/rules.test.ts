import { describe, it, expect } from 'vitest';
import { diagnoseD5UnknownModelPricing } from '../src/rules';

describe('diagnoseD5UnknownModelPricing', () => {
  it('fires when model is unknown (pricingSource === conservative-estimate)', () => {
    const result = diagnoseD5UnknownModelPricing({ model: 'completely-unknown-model-xyz' });
    expect(result).not.toBeNull();
    expect(result!.fired).toBe(true);
    expect(result!.ruleId).toBe('D5');
    expect(result!.severity).toBe('warning');
    expect(result!.sourceFields).toContain('model');
    expect(result!.sourceFields).toContain('pricingSource');
  });

  it('does NOT fire when model is known (pricingSource === known-local)', () => {
    const result = diagnoseD5UnknownModelPricing({ model: 'mini-max' });
    expect(result).toBeNull();
  });

  it('evidence.observedValue includes model and pricingSource', () => {
    const result = diagnoseD5UnknownModelPricing({ model: 'unknown-gpt-99' });
    expect(result).not.toBeNull();
    const ov = result!.observedValue as Record<string, unknown>;
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
    expect(result!.fired).toBe(true);
    expect(result!.ruleId).toBe('D5');
  });

  it('ruleId is always D5 when fired', () => {
    const models = ['unknown-1', 'mystery-model', 'foobar-v999'];
    for (const m of models) {
      const result = diagnoseD5UnknownModelPricing({ model: m });
      expect(result?.ruleId).toBe('D5');
    }
  });

  it('severity is warning when fired', () => {
    const result = diagnoseD5UnknownModelPricing({ model: 'unknown-x' });
    expect(result?.severity).toBe('warning');
  });

  it('known models return null (not fired)', () => {
    const knownModels = ['mini-max', 'claude-3-5-sonnet', 'gpt-4o'];
    for (const m of knownModels) {
      const result = diagnoseD5UnknownModelPricing({ model: m });
      expect(result).toBeNull();
    }
  });
});