import { describe, it, expect } from 'vitest';
import { diagnoseD3PremiumModelOnSimpleJob, diagnoseD4AgentTurnCronBurn, diagnoseD5UnknownModelPricing, diagnoseD6ZeroTokenAbnormalRun } from '../src/rules';

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

describe('diagnoseD4AgentTurnCronBurn', () => {
  it('fires when agentTurn=true and scheduleMinutes=30 (< 60)', () => {
    const result = diagnoseD4AgentTurnCronBurn({ agentTurn: true, schedule: '30 min' });
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('D4');
    expect(result!.severity).toBe('warning');
    expect(result!.evidence.ruleId).toBe('D4');
    const ov = result!.evidence.observedValue as Record<string, unknown>;
    expect(ov.scheduleMinutes).toBe(30);
    expect(ov.agentTurn).toBe(true);
    expect(result!.evidence.threshold).toEqual({ agentTurnEquals: true, scheduleMinutesLessThan: 60 });
  });

  it('fires when agent_turn=true and scheduleMinutes=30', () => {
    const result = diagnoseD4AgentTurnCronBurn({ agent_turn: true, schedule: 'every 30 min' });
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('D4');
    const ov = result!.evidence.observedValue as Record<string, unknown>;
    expect(ov.agentTurn).toBe(true);
  });

  it('fires when agent_turn_enabled=true and scheduleMinutes=30', () => {
    const result = diagnoseD4AgentTurnCronBurn({ agent_turn_enabled: true, schedule: '30m' });
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('D4');
    const ov = result!.evidence.observedValue as Record<string, unknown>;
    expect(ov.agentTurn).toBe(true);
  });

  it('fires when agentTurn=true and cron alias is frequent (15 min < 60)', () => {
    const result = diagnoseD4AgentTurnCronBurn({ agentTurn: true, cron: '*/15 * * * *' });
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('D4');
    const ov = result!.evidence.observedValue as Record<string, unknown>;
    expect(ov.scheduleMinutes).toBe(15);
    expect(ov.agentTurn).toBe(true);
  });

  it('fires when agentTurn=true and interval alias is frequent (30 min < 60)', () => {
    const result = diagnoseD4AgentTurnCronBurn({ agentTurn: true, interval: 'every 30 minutes' });
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('D4');
    const ov = result!.evidence.observedValue as Record<string, unknown>;
    expect(ov.scheduleMinutes).toBe(30);
    expect(ov.agentTurn).toBe(true);
  });

  it('fires when agentTurn=true and frequency alias is frequent (45 min < 60)', () => {
    const result = diagnoseD4AgentTurnCronBurn({ agentTurn: true, frequency: 'every 45 mins' });
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('D4');
    const ov = result!.evidence.observedValue as Record<string, unknown>;
    expect(ov.scheduleMinutes).toBe(45);
    expect(ov.agentTurn).toBe(true);
  });

  it('does NOT fire when agentTurn=false', () => {
    const result = diagnoseD4AgentTurnCronBurn({ agentTurn: false, schedule: '30 min' });
    expect(result).toBeNull();
  });

  it('does NOT fire when scheduleMinutes >= 60 (e.g., 60, 120, 1440)', () => {
    expect(diagnoseD4AgentTurnCronBurn({ agentTurn: true, schedule: '60 min' })).toBeNull();
    expect(diagnoseD4AgentTurnCronBurn({ agentTurn: true, schedule: '120 min' })).toBeNull();
    expect(diagnoseD4AgentTurnCronBurn({ agentTurn: true, schedule: 'daily' })).toBeNull();
  });

  it('does NOT fire when scheduleMinutes <= 0', () => {
    expect(diagnoseD4AgentTurnCronBurn({ agentTurn: true, schedule: '0 min' })).toBeNull();
    expect(diagnoseD4AgentTurnCronBurn({ agentTurn: true, schedule: '-30 min' })).toBeNull();
  });

  it('does NOT fire when schedule is missing', () => {
    expect(diagnoseD4AgentTurnCronBurn({ agentTurn: true })).toBeNull();
  });

  it('does NOT fire when schedule is unparseable', () => {
    expect(diagnoseD4AgentTurnCronBurn({ agentTurn: true, schedule: 'not-a-valid-schedule' })).toBeNull();
  });

  it('handles non-finite scheduleMinutes (NaN, Infinity) gracefully', () => {
    // parseScheduleMinutes returns null for unparseable strings, which leads to null return
    expect(diagnoseD4AgentTurnCronBurn({ agentTurn: true, schedule: NaN })).toBeNull();
    expect(diagnoseD4AgentTurnCronBurn({ agentTurn: true, schedule: Infinity })).toBeNull();
  });

  it('affectedJobIds uses id for affectedJobIds', () => {
    const result = diagnoseD4AgentTurnCronBurn({ agentTurn: true, schedule: 'every 30 minutes', id: 'job-123' });
    expect(result).not.toBeNull();
    expect(result!.affectedJobIds).toContain('job-123');
  });

  it('affectedJobIds uses name fallback when no id', () => {
    const result = diagnoseD4AgentTurnCronBurn({ agentTurn: true, schedule: 'every 30 minutes', name: 'My Job' });
    expect(result).not.toBeNull();
    expect(result!.affectedJobIds).toContain('My Job');
  });

  it('affectedJobIds uses title fallback when no id/name', () => {
    const result = diagnoseD4AgentTurnCronBurn({ agentTurn: true, schedule: 'every 30 minutes', title: 'My Title' });
    expect(result).not.toBeNull();
    expect(result!.affectedJobIds).toContain('My Title');
  });

  it('does not mutate the input job', () => {
    const job = { agentTurn: true, schedule: '30 min', id: 'test-job' } as const;
    const before = JSON.stringify(job);
    diagnoseD4AgentTurnCronBurn(job);
    expect(JSON.stringify(job)).toBe(before);
  });
});

describe('diagnoseD3PremiumModelOnSimpleJob', () => {
  // --- Firing cases ---

  it('fires when GPT-4o on simple health check (rate 2.5 / 0.14 ≈ 17.86 >= 5)', () => {
    const result = diagnoseD3PremiumModelOnSimpleJob({ model: 'GPT-4o', task: 'health check' });
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('D3');
    expect(result!.severity).toBe('warning');
    expect(result!.evidence.ruleId).toBe('D3');
  });

  it('fires when Claude Sonnet on simple status check (rate 3 / 0.14 ≈ 21.43 >= 5)', () => {
    const result = diagnoseD3PremiumModelOnSimpleJob({ model: 'Claude Sonnet', type: 'status check' });
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('D3');
    expect(result!.severity).toBe('warning');
  });

  it('fires when Claude Opus on simple monitor/probe job (rate 15 / 0.14 ≈ 107.14 >= 5)', () => {
    const result = diagnoseD3PremiumModelOnSimpleJob({ model: 'Claude Opus', description: 'monitor probe' });
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('D3');
    expect(result!.severity).toBe('warning');
  });

  it('fires when GPT-5-codex on simple check job (rate 15 / 0.14 ≈ 107.14 >= 5)', () => {
    const result = diagnoseD3PremiumModelOnSimpleJob({ model: 'GPT-5-codex', name: 'health check job' });
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('D3');
    expect(result!.severity).toBe('warning');
  });

  // --- Non-firing cases: rate below threshold (rateMultiplier < 5) ---

  it('does NOT fire for MiniMax M2.7 (rate 0.14 / 0.14 = 1.0 < 5)', () => {
    const result = diagnoseD3PremiumModelOnSimpleJob({ model: 'MiniMax M2.7', task: 'health check' });
    expect(result).toBeNull();
  });

  it('does NOT fire for MiniMax M2.5 (rate 0.12 / 0.14 ≈ 0.86 < 5)', () => {
    const result = diagnoseD3PremiumModelOnSimpleJob({ model: 'MiniMax M2.5', task: 'health check' });
    expect(result).toBeNull();
  });

  it('does NOT fire for DeepSeek Chat (rate 0.28 / 0.14 = 2.0 < 5)', () => {
    const result = diagnoseD3PremiumModelOnSimpleJob({ model: 'DeepSeek Chat', task: 'health check' });
    expect(result).toBeNull();
  });

  // --- Non-firing cases: not a simple check ---

  it('does NOT fire for premium model on non-simple complex reasoning task', () => {
    const result = diagnoseD3PremiumModelOnSimpleJob({ model: 'Claude Opus', description: 'complex reasoning and analysis' });
    expect(result).toBeNull();
  });

  it('does NOT fire for premium model with no text fields that trigger isSimpleCheck', () => {
    const result = diagnoseD3PremiumModelOnSimpleJob({ model: 'Claude Opus', task: 'run some analysis' });
    expect(result).toBeNull();
  });

  // --- Non-firing cases: unknown model (D5 territory) ---

  it('does NOT fire for unknown model on simple check job (D5 territory)', () => {
    const result = diagnoseD3PremiumModelOnSimpleJob({ model: 'completely-unknown-model-xyz', task: 'health check' });
    expect(result).toBeNull();
  });

  // --- Non-firing cases: model missing ---

  it('does NOT fire when model is missing', () => {
    const result = diagnoseD3PremiumModelOnSimpleJob({ task: 'health check' });
    expect(result).toBeNull();
  });

  // --- Structural tests ---

  it('evidence.observedValue includes model, pricingSource, rate, referenceModel (MiniMax M2.7), referenceRate (0.14), rateMultiplier', () => {
    const result = diagnoseD3PremiumModelOnSimpleJob({ model: 'Claude Opus', task: 'health check' });
    expect(result).not.toBeNull();
    const ov = result!.evidence.observedValue as Record<string, unknown>;
    expect(ov.model).toBe('Claude Opus');
    expect(ov.pricingSource).toBe('known-local');
    expect(ov.rate).toBe(15);
    expect(ov.referenceModel).toBe('MiniMax M2.7');
    expect(ov.referenceRate).toBe(0.14);
    expect(ov.rateMultiplier).toBe(15 / 0.14); // ≈ 107.14
    expect(ov.simpleCheck).toBe(true);
  });

  it('evidence.threshold includes pricingSourceEquals, minRateMultiplier, simpleCheckEquals', () => {
    const result = diagnoseD3PremiumModelOnSimpleJob({ model: 'Claude Opus', task: 'health check' });
    expect(result).not.toBeNull();
    const th = result!.evidence.threshold as Record<string, unknown>;
    expect(th.pricingSourceEquals).toBe('known-local');
    expect(th.minRateMultiplier).toBe(5);
    expect(th.simpleCheckEquals).toBe(true);
  });

  it('affectedJobIds uses id when present', () => {
    const result = diagnoseD3PremiumModelOnSimpleJob({ model: 'Claude Opus', task: 'health check', id: 'job-abc' });
    expect(result).not.toBeNull();
    expect(result!.affectedJobIds).toContain('job-abc');
  });

  it('affectedJobIds uses name when id not present', () => {
    const result = diagnoseD3PremiumModelOnSimpleJob({ model: 'Claude Opus', task: 'health check', name: 'My Job' });
    expect(result).not.toBeNull();
    expect(result!.affectedJobIds).toContain('My Job');
  });

  it('affectedJobIds uses title when id and name not present', () => {
    const result = diagnoseD3PremiumModelOnSimpleJob({ model: 'Claude Opus', task: 'health check', title: 'My Title' });
    expect(result).not.toBeNull();
    expect(result!.affectedJobIds).toContain('My Title');
  });

  it('affectedJobIds is empty when no identifier fields present', () => {
    const result = diagnoseD3PremiumModelOnSimpleJob({ model: 'Claude Opus', task: 'health check' });
    expect(result).not.toBeNull();
    expect(result!.affectedJobIds).toEqual([]);
  });

  it('does not mutate the input job', () => {
    const job = { model: 'Claude Opus', task: 'health check', id: 'test-job' } as const;
    const before = JSON.stringify(job);
    diagnoseD3PremiumModelOnSimpleJob(job);
    expect(JSON.stringify(job)).toBe(before);
  });

  it('model_name alias works', () => {
    const result = diagnoseD3PremiumModelOnSimpleJob({ model_name: 'Claude Opus', task: 'health check' });
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('D3');
  });

  it('modelName alias works', () => {
    const result = diagnoseD3PremiumModelOnSimpleJob({ modelName: 'Claude Opus', task: 'health check' });
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('D3');
  });

  it('simple check detection uses task, type, description, prompt, name, title fields', () => {
    // Only description contains "monitor" → should fire
    const result1 = diagnoseD3PremiumModelOnSimpleJob({ model: 'Claude Sonnet', description: 'run monitor' });
    expect(result1).not.toBeNull();

    // Only prompt contains "probe" → should fire
    const result2 = diagnoseD3PremiumModelOnSimpleJob({ model: 'Claude Sonnet', prompt: 'do a probe check' });
    expect(result2).not.toBeNull();

    // Only title contains "heartbeat" → should fire
    const result3 = diagnoseD3PremiumModelOnSimpleJob({ model: 'Claude Sonnet', title: 'heartbeat monitor' });
    expect(result3).not.toBeNull();
  });
});