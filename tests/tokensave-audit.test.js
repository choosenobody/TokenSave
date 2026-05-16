import { describe, it, expect } from 'vitest';

// Inline minimal helpers — same as the probe uses
function readBoolean(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return ['true', '1', 'yes', 'on'].includes(v.trim().toLowerCase());
  return Boolean(v);
}

function isSimpleCheck(rawJob, promptText) {
  const tokens = [rawJob.type, rawJob.taskType, rawJob.name, rawJob.description, rawJob.prompt, promptText]
    .filter(Boolean).join(' ').toLowerCase();
  return /\b(check|health|status|ping|monitor|probe|verify|heartbeat|smoke|lint)\b/.test(tokens);
}

function parseScheduleMinutes(schedule) {
  if (schedule == null) return null;
  if (typeof schedule === 'number' && Number.isFinite(schedule)) {
    return schedule >= 60_000 ? schedule / 60_000 : schedule;
  }
  if (typeof schedule === 'object') {
    var everyVal = schedule.every ?? schedule.everyInterval ?? schedule.interval ?? schedule.everyMs ?? null;
    if (everyVal != null && everyVal !== schedule) return parseScheduleMinutes(everyVal);
    var nested = schedule.interval_minutes ?? schedule.intervalMinutes ?? schedule.minutes ?? schedule.cron ?? schedule.value ?? null;
    if (nested != null && nested !== schedule) return parseScheduleMinutes(nested);
    if (typeof schedule.expr === 'string') return parseScheduleMinutes(schedule.expr);
  }
  var text = String(schedule ?? '').trim().toLowerCase();
  if (!text) return null;
  if (/hourly/.test(text)) return 60;
  if (/daily/.test(text)) return 1440;
  let m = text.match(/every\s+(\d+)\s*(minute|min|minutes|mins|m)\b/);
  if (m) return Number(m[1]);
  m = text.match(/every\s+(\d+)\s*(hour|hours|hr|hrs|h)\b/);
  if (m) return Number(m[1]) * 60;
  m = text.match(/^(\d+)\s*(minute|min|minutes|mins|m)\b/);
  if (m) return Number(m[1]);
  m = text.match(/^(\d+)\s*(hour|hours|hr|hrs|h)\b/);
  if (m) return Number(m[1]) * 60;
  m = text.match(/^(\d+)\s*(day|days|d)\b/);
  if (m) return Number(m[1]) * 1440;
  const cron = text.trim().split(/\s+/);
  if (cron.length >= 5) {
    if (cron[0].startsWith('*/')) return Number(cron[0].slice(2));
    if (cron[0] === '0' && cron[1].startsWith('*/')) return Number(cron[1].slice(2)) * 60;
    if (cron[0] === '0' && cron[1] === '*') return 60;
    if (cron[0] === '0' && cron[1] === '0') return 1440;
  }
  return null;
}

const COST_RATES = [
  { label: 'MiniMax M2.7',  match: /\bminimax.*m2\.?7\b|\bm2\.?7\b/i, rate: 0.14 },
  { label: 'MiniMax M2.5',  match: /\bminimax.*m2\.?5\b|\bm2\.?5\b/i, rate: 0.12 },
  { label: 'GPT-4o',        match: /\bgpt-?4o\b/i,                    rate: 2.5  },
  { label: 'Claude Sonnet', match: /\bsonnet\b/i,                      rate: 3    },
  { label: 'Claude Opus',   match: /\bopus\b/i,                        rate: 15   },
  { label: 'GPT-5-codex',   match: /\bgpt-?5[\d.]*.*codex\b|\bcodex\b/i, rate: 15 },
  { label: 'DeepSeek Chat', match: /\bdeepseek\b/i,                    rate: 0.28 },
];

function detectCostRate(model) {
  const s = String(model ?? '');
  const c = COST_RATES.find(function(r) { return r.match.test(s); });
  if (c) return { label: c.label, rate: c.rate, pricingSource: 'known-local' };
  return { label: 'Unknown (conservative)', rate: 15, pricingSource: 'conservative-estimate' };
}

function diagnoseD1(job) {
  const totalRuns  = typeof job.totalRuns  === 'number' && Number.isFinite(job.totalRuns)  ? job.totalRuns  : NaN;
  const errorRuns = typeof job.errorRuns === 'number' && Number.isFinite(job.errorRuns) ? job.errorRuns : NaN;
  if (!Number.isFinite(totalRuns) || totalRuns < 3) return null;
  if (!Number.isFinite(errorRuns) || errorRuns < 0 || errorRuns > totalRuns) return null;
  const errorRate = errorRuns / totalRuns;
  if (errorRate < 0.8) return null;
  return { ruleId: 'D1', severity: 'warning', errorRate: errorRate, totalRuns: totalRuns, errorRuns: errorRuns, estimatedWaste: Math.round(job.totalTokens * Math.max(0, errorRate - 0.05)) };
}

function diagnoseD3(job) {
  const model = String(job.model ?? job.model_name ?? job.modelName ?? '');
  if (!model) return null;
  const promptText = [job.task, job.type, job.description, job.prompt, job.name, job.title].filter(Boolean).join(' ');
  if (!isSimpleCheck(job, promptText)) return null;
  const ref = detectCostRate('MiniMax M2.7');
  const costInfo = detectCostRate(model);
  if (costInfo.pricingSource !== 'known-local') return null;
  if (!Number.isFinite(ref.rate) || ref.rate <= 0) return null;
  const multiplier = costInfo.rate / ref.rate;
  if (multiplier < 5) return null;
  return { ruleId: 'D3', severity: 'warning', multiplier: multiplier, estimatedWaste: Math.round(job.totalTokens * Math.max(0, (costInfo.rate - ref.rate) / costInfo.rate)) };
}

function diagnoseD4(job) {
  const agentTurn = readBoolean(job.agentTurn ?? job.agent_turn ?? job.agent_turn_enabled);
  if (!agentTurn) return null;
  const schedule = job.schedule ?? job.interval ?? job.frequency ?? job.cron;
  if (schedule == null) return null;
  const mins = parseScheduleMinutes(schedule);
  if (mins == null || !Number.isFinite(mins) || mins <= 0 || mins >= 60) return null;
  return { ruleId: 'D4', severity: 'warning', scheduleMinutes: mins };
}

function diagnoseD5(job) {
  const model = String(job.model ?? job.model_name ?? job.modelName ?? '');
  if (!model) return null;
  const costInfo = detectCostRate(model);
  if (costInfo.pricingSource === 'known-local') return null;
  return { ruleId: 'D5', severity: 'warning', estimatedRate: costInfo.rate };
}

function diagnoseD6(job) {
  const totalRuns   = typeof job.totalRuns   === 'number' && Number.isFinite(job.totalRuns)   ? job.totalRuns   : NaN;
  const totalTokens = typeof job.totalTokens === 'number' && Number.isFinite(job.totalTokens) ? job.totalTokens : NaN;
  if (!(totalRuns > 0) || totalTokens !== 0) return null;
  return { ruleId: 'D6', severity: 'warning' };
}

function rankFindings(findings) {
  return findings.sort(function(a, b) {
    if (a.ruleId === 'D1' && b.ruleId !== 'D1') return -1;
    if (b.ruleId === 'D1' && a.ruleId !== 'D1') return 1;
    if (a.ruleId === 'D4' && b.ruleId !== 'D4') return -1;
    if (b.ruleId === 'D4' && a.ruleId !== 'D4') return 1;
    var wa = a.estimatedWaste ?? -1;
    var wb = b.estimatedWaste ?? -1;
    if (wa !== wb) return wb - wa;
    var order = { D5: 1, D6: 2, D3: 3, D7: 4, D2: 5 };
    return (order[a.ruleId] || 99) - (order[b.ruleId] || 99);
  });
}

// Tests

describe('diagnoseD1 -- Failure Loop Detection', function() {
  it('fires at exactly 80% error rate', function() {
    var r = diagnoseD1({ totalRuns: 10, errorRuns: 8, totalTokens: 100000 });
    expect(r).not.toBeNull();
    expect(r.ruleId).toBe('D1');
    expect(r.errorRate).toBe(0.8);
  });

  it('does NOT fire below 80%', function() {
    expect(diagnoseD1({ totalRuns: 10, errorRuns: 7, totalTokens: 100000 })).toBeNull();
  });

  it('does NOT fire with fewer than 3 runs', function() {
    expect(diagnoseD1({ totalRuns: 2, errorRuns: 2, totalTokens: 10000 })).toBeNull();
  });

  it('does NOT fire at 5% error rate (below threshold)', function() {
    expect(diagnoseD1({ totalRuns: 20, errorRuns: 1, totalTokens: 100000 })).toBeNull();
  });
});

describe('diagnoseD3 -- Premium Model on Simple Job', function() {
  it('fires for Opus on simple-check job', function() {
    var r = diagnoseD3({ model: 'Claude Opus', type: 'check', totalTokens: 50000 });
    expect(r).not.toBeNull();
    expect(r.ruleId).toBe('D3');
    expect(r.multiplier).toBeGreaterThanOrEqual(5);
  });

  it('does NOT fire for MiniMax M2.7 on simple check', function() {
    expect(diagnoseD3({ model: 'MiniMax M2.7', type: 'check', totalTokens: 50000 })).toBeNull();
  });

  it('does NOT fire for Opus on non-simple job', function() {
    expect(diagnoseD3({ model: 'Claude Opus', type: 'exec', totalTokens: 50000 })).toBeNull();
  });

  it('does NOT fire for unknown model', function() {
    expect(diagnoseD3({ model: 'totally-unknown-xyz', type: 'check', totalTokens: 50000 })).toBeNull();
  });
});

describe('diagnoseD4 -- Agent-Turn Cron Burn', function() {
  it('fires for agentTurn every 15 minutes', function() {
    var r = diagnoseD4({ agentTurn: true, schedule: 'every 15 minutes', totalTokens: 10000 });
    expect(r).not.toBeNull();
    expect(r.ruleId).toBe('D4');
    expect(r.scheduleMinutes).toBe(15);
  });

  it('does NOT fire for agentTurn every 60 minutes', function() {
    expect(diagnoseD4({ agentTurn: true, schedule: 'every 60 minutes', totalTokens: 10000 })).toBeNull();
  });

  it('does NOT fire when agentTurn is false', function() {
    expect(diagnoseD4({ agentTurn: false, schedule: 'every 5 minutes', totalTokens: 10000 })).toBeNull();
  });

  it('does NOT fire for cron at 60 minutes', function() {
    expect(diagnoseD4({ agentTurn: true, schedule: { expr: '0 * * * *' }, totalTokens: 10000 })).toBeNull();
  });

  it('fires for cron every 20 minutes', function() {
    var r = diagnoseD4({ agentTurn: true, schedule: { expr: '*/20 * * * *' }, totalTokens: 10000 });
    expect(r).not.toBeNull();
    expect(r.ruleId).toBe('D4');
  });
});

describe('detectCostRate -- pricing source detection', function() {
  it('returns conservative-estimate for unknown model', function() {
    var r = detectCostRate('completely-unknown-xyz-123');
    expect(r.pricingSource).toBe('conservative-estimate');
    expect(r.rate).toBe(15);
  });

  it('returns known-local for MiniMax M2.7', function() {
    var r = detectCostRate('MiniMax M2.7');
    expect(r.pricingSource).toBe('known-local');
  });

  it('returns known-local for GPT-4o', function() {
    var r = detectCostRate('GPT-4o');
    expect(r.pricingSource).toBe('known-local');
  });

  it('is case-insensitive for model matching', function() {
    expect(detectCostRate('MINIMAX M2.7').pricingSource).toBe('known-local');
    expect(detectCostRate('gpt-4o').pricingSource).toBe('known-local');
    expect(detectCostRate('CLAUDE SONNET').pricingSource).toBe('known-local');
  });
});

describe('diagnoseD6 -- Zero-Token Abnormal Run', function() {
  it('fires when totalRuns>0 and totalTokens===0', function() {
    var r = diagnoseD6({ totalRuns: 5, totalTokens: 0 });
    expect(r).not.toBeNull();
    expect(r.ruleId).toBe('D6');
  });

  it('does NOT fire when totalTokens > 0', function() {
    expect(diagnoseD6({ totalRuns: 5, totalTokens: 1000 })).toBeNull();
  });

  it('does NOT fire when totalRuns === 0', function() {
    expect(diagnoseD6({ totalRuns: 0, totalTokens: 0 })).toBeNull();
  });
});

describe('Ranking', function() {
  it('D1 always ranks above D4', function() {
    var findings = [
      { ruleId: 'D4', severity: 'warning' },
      { ruleId: 'D1', severity: 'warning' },
    ];
    var ranked = rankFindings(findings);
    expect(ranked[0].ruleId).toBe('D1');
  });

  it('D4 ranks above D5 when no waste values', function() {
    var findings = [
      { ruleId: 'D5', severity: 'warning' },
      { ruleId: 'D4', severity: 'warning' },
    ];
    var ranked = rankFindings(findings);
    expect(ranked[0].ruleId).toBe('D4');
  });

  it('higher estimatedWaste sorts first', function() {
    var findings = [
      { ruleId: 'D3', severity: 'warning', estimatedWaste: 100 },
      { ruleId: 'D5', severity: 'warning', estimatedWaste: 5000 },
    ];
    var ranked = rankFindings(findings);
    expect(ranked[0].ruleId).toBe('D5');
  });

  it('null estimatedWaste sorts after numeric values', function() {
    var findings = [
      { ruleId: 'D5', severity: 'warning', estimatedWaste: null },
      { ruleId: 'D3', severity: 'warning', estimatedWaste: 100 },
    ];
    var ranked = rankFindings(findings);
    expect(ranked[0].ruleId).toBe('D3');
  });

  it('D5 before D6 before D3 when waste is equal', function() {
    var findings = [
      { ruleId: 'D3', severity: 'warning', estimatedWaste: null },
      { ruleId: 'D6', severity: 'warning', estimatedWaste: null },
      { ruleId: 'D5', severity: 'warning', estimatedWaste: null },
    ];
    var ranked = rankFindings(findings);
    expect(ranked[0].ruleId).toBe('D5');
    expect(ranked[1].ruleId).toBe('D6');
    expect(ranked[2].ruleId).toBe('D3');
  });
});

describe('Output structure -- three required sections', function() {
  it('script contains Problem Summary section', function() {
    var fs = require('fs');
    var src = fs.readFileSync('scripts/tokensave-audit.mjs', 'utf8');
    expect(src).toContain('## Problem Summary');
  });

  it('script contains What To Do First section', function() {
    var fs = require('fs');
    var src = fs.readFileSync('scripts/tokensave-audit.mjs', 'utf8');
    expect(src).toContain('## What To Do First');
  });

  it('script contains Agent Diagnosis Prompt section', function() {
    var fs = require('fs');
    var src = fs.readFileSync('scripts/tokensave-audit.mjs', 'utf8');
    expect(src).toContain('## Agent Diagnosis Prompt');
  });

  it('script produces compact structured output per finding', function() {
    var fs = require('fs');
    var src = fs.readFileSync('scripts/tokensave-audit.mjs', 'utf8');
    expect(src).toContain('Category:');
    expect(src).toContain('Est. recurring waste:');
  });
});