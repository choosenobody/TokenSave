import { describe, it, expect } from 'vitest';
import { buildWasteEvidence, classifyWaste } from '../src/domain';

// Helper to create a minimal job-like object for testing
function makeJob(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    raw: {
      agentTurn: overrides.agentTurn ?? false,
      agent_turn: overrides.agent_turn,
      agent_turn_enabled: overrides.agent_turn_enabled,
      task: overrides.task ?? '',
      type: overrides.type ?? '',
      taskType: overrides.taskType,
      mode: overrides.mode,
      command: overrides.command,
      name: overrides.name ?? 'Test Job',
      prompt: overrides.prompt ?? '',
      description: overrides.description ?? '',
    },
    model: overrides.model ?? 'mini-max',
    promptText: overrides.promptText ?? overrides.task ?? '',
    schedule: overrides.schedule ?? null,
    ...overrides,
  };
}

describe('buildWasteEvidence', () => {
  it('CRITICAL: agentTurn=true, exec/command task, scheduleMinutes=15 → CRITICAL evidence, no LLM_AGENT_CRON or WARNING', () => {
    const job = makeJob({ agentTurn: true, task: 'run shell command', schedule: 'every 15 minutes' });
    const evidence = buildWasteEvidence(job, 0, 15);
    const ruleIds = evidence.map(e => e.ruleId);
    expect(ruleIds).toContain('CRITICAL');
    expect(ruleIds).not.toContain('LLM_AGENT_CRON');
    expect(ruleIds).not.toContain('WARNING');
    const crit = evidence.find(e => e.ruleId === 'CRITICAL')!;
    expect(crit.sourceFields).toContain('agentTurn');
    expect(crit.observedValue).toBe(15);
    expect(crit.threshold).toBe(30);
    expect(crit.explanation).toContain('CRITICAL');
  });

  it('LLM_AGENT_CRON: agentTurn=true, scheduleMinutes=60, non-exec job → LLM_AGENT_CRON evidence', () => {
    const job = makeJob({ agentTurn: true, task: 'some analysis task', schedule: 'every 60 minutes' });
    const evidence = buildWasteEvidence(job, 0, 60);
    const ruleIds = evidence.map(e => e.ruleId);
    expect(ruleIds).toContain('LLM_AGENT_CRON');
    expect(ruleIds).not.toContain('CRITICAL');
    expect(ruleIds).not.toContain('WARNING');
  });

  it('ERROR_WASTE: errorRate=0.25 → ERROR_WASTE evidence with observedValue=0.25, threshold=0.1', () => {
    const job = makeJob({});
    const evidence = buildWasteEvidence(job, 0.25, null);
    const err = evidence.find(e => e.ruleId === 'ERROR_WASTE')!;
    expect(err.observedValue).toBe(0.25);
    expect(err.threshold).toBe(0.1);
    expect(err.sourceFields).toContain('errorRate');
  });

  it('PREMIUM_MODEL_WASTE: model=Claude Opus + simple check task → PREMIUM_MODEL_WASTE evidence', () => {
    const job = makeJob({ model: 'Claude Opus', task: 'system health check' });
    const evidence = buildWasteEvidence(job, 0, null);
    expect(evidence.map(e => e.ruleId)).toContain('PREMIUM_MODEL_WASTE');
    const prem = evidence.find(e => e.ruleId === 'PREMIUM_MODEL_WASTE')!;
    expect(prem.observedValue).toBe('Claude Opus');
    expect(prem.sourceFields).toContain('model');
  });

  it('WARNING: exec/command task, scheduleMinutes=45, agentTurn=false → WARNING evidence, threshold=60', () => {
    const job = makeJob({ agentTurn: false, task: 'execute deployment script', schedule: 'every 45 minutes' });
    const evidence = buildWasteEvidence(job, 0, 45);
    expect(evidence.map(e => e.ruleId)).toContain('WARNING');
    expect(evidence.map(e => e.ruleId)).not.toContain('CRITICAL');
    const warn = evidence.find(e => e.ruleId === 'WARNING')!;
    expect(warn.observedValue).toBe(45);
    expect(warn.threshold).toBe(60);
  });

  it('OK: cheap model, non-exec task, daily schedule, errorRate=0 → empty evidence array', () => {
    const job = makeJob({ model: 'mini-max', task: 'daily data aggregation', schedule: 'daily' });
    const evidence = buildWasteEvidence(job, 0, 1440);
    expect(evidence).toEqual([]);
  });

  it('alignment: evidence ruleIds match classifyWaste categories (excluding OK)', () => {
    const cases = [
      { agentTurn: true, task: 'run command', schedule: 'every 10 minutes', errorRate: 0 },
      { agentTurn: true, task: 'analysis', schedule: 'every 2 hours', errorRate: 0 },
      { agentTurn: false, task: 'deployment script', schedule: 'every 30 minutes', errorRate: 0.2 },
      { model: 'Claude Sonnet', task: 'status check', schedule: 'hourly', errorRate: 0 },
      { model: 'gpt-4o', task: 'complex reasoning', schedule: 'daily', errorRate: 0 },
      { model: 'mini-max', task: 'daily report', schedule: 'daily', errorRate: 0 },
    ];
    for (const c of cases) {
      const job = makeJob(c);
      // parse schedule to minutes for input
      let smMins = null;
      if (c.schedule === 'every 10 minutes') smMins = 10;
      if (c.schedule === 'every 2 hours') smMins = 120;
      if (c.schedule === 'every 30 minutes') smMins = 30;
      if (c.schedule === 'hourly') smMins = 60;
      if (c.schedule === 'daily') smMins = 1440;
      const evidenceRuleIds = buildWasteEvidence(job, c.errorRate ?? 0, smMins).map(e => e.ruleId);
      const classified = classifyWaste(job, c.errorRate ?? 0, smMins).filter(r => r !== 'OK');
      expect(evidenceRuleIds.sort()).toEqual(classified.sort());
    }
  });
});
