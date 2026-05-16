#!/usr/bin/env node
// @ts-check
/**
 * TokenSave OpenClaw Audit Probe
 * ==================================
 * Standalone diagnostic probe: reads local openclaw cron data,
 * runs D1–D7 diagnostic rules, ranks findings by estimated waste.
 *
 * NO external dependencies beyond Node.js built-ins.
 * NO build step required.
 * Output: structured, copyable into Hermes/guardian_cat/coding_cat.
 *
 * Usage: node scripts/tokensave-audit.mjs
 */

import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// INLINED DOMAIN HELPERS (minimal — from src/domain.ts / src/utils.ts)
// ─────────────────────────────────────────────────────────────────────────────

function stringify(v) {
  return v == null ? '' : String(v);
}

function normalizeKey(v) {
  return stringify(v).trim().toLowerCase();
}

function slugify(v) {
  return stringify(v).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function cleanFileStem(fileName) {
  return stringify(fileName).split(/[/\\]/).pop().replace(/\.(jsonl|json|zip)$/i, '');
}

function readBoolean(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return ['true', '1', 'yes', 'on'].includes(v.trim().toLowerCase());
  return Boolean(v);
}

function extractTokenCount(record) {
  const candidates = [
    record.tokens,
    record.total_tokens,
    record.token_count,
    record.usage?.total_tokens,
    record.usage?.tokens,
    record.metrics?.tokens,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

function isErrorRecord(record) {
  if (typeof record.error === 'boolean') return record.error;
  if (typeof record.error === 'string') return record.error.trim().length > 0 && record.error.toLowerCase() !== 'false';
  if (record.error && typeof record.error === 'object') return true;
  const s = stringify(record.status || record.result || '').toLowerCase();
  return s === 'error' || s === 'failed' || s === 'failure';
}

function isSimpleCheck(rawJob, promptText) {
  const tokens = [rawJob.type, rawJob.taskType, rawJob.name, rawJob.description, rawJob.prompt, promptText]
    .filter(Boolean).join(' ').toLowerCase();
  return /\b(check|health|status|ping|monitor|probe|verify|heartbeat|smoke|lint)\b/.test(tokens);
}

function isActiveJob(job) {
  if (job.synthetic) return 'historical';
  const raw = job.raw || job;
  const enabled = (() => {
    const c = [raw.enabled, raw.active];
    for (const v of c) {
      if (v === undefined || v === null) continue;
      if (typeof v === 'boolean') return v;
      if (typeof v === 'string' || typeof v === 'number') return readBoolean(v);
    }
    return null;
  })();
  if (enabled === false) return 'disabled';
  return 'active';
}

function parseScheduleMinutes(schedule) {
  if (schedule == null) return null;

  if (typeof schedule === 'object') {
    const everyVal = schedule.every ?? schedule.everyInterval ?? schedule.interval ?? schedule.everyMs ?? null;
    if (everyVal != null && everyVal !== schedule) return parseScheduleMinutes(everyVal);
    const nested = schedule.interval_minutes ?? schedule.intervalMinutes ?? schedule.minutes ?? schedule.cron ?? schedule.value ?? null;
    if (nested != null && nested !== schedule) return parseScheduleMinutes(nested);
    if (typeof schedule.expr === 'string') return parseScheduleMinutes(schedule.expr);
  }

  if (typeof schedule === 'number' && Number.isFinite(schedule)) {
    return schedule >= 60_000 ? schedule / 60_000 : schedule;
  }

  if (typeof schedule === 'object') {
    const everyVal = schedule.every ?? schedule.everyInterval ?? schedule.interval ?? schedule.everyMs ?? null;
    if (everyVal != null && everyVal !== schedule) return parseScheduleMinutes(everyVal);
    const nested = schedule.interval_minutes ?? schedule.intervalMinutes ?? schedule.minutes ?? schedule.cron ?? schedule.value ?? null;
    if (nested != null && nested !== schedule) return parseScheduleMinutes(nested);
    if (typeof schedule.expr === 'string') return parseScheduleMinutes(schedule.expr);
  }

  const text = stringify(schedule).trim().toLowerCase();
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

function formatShortDuration(minutes) {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes % 1440 === 0) return `${Math.round(minutes / 1440)}d`;
  if (minutes % 60 === 0) return `${Math.round(minutes / 60)}h`;
  const h = Math.floor(minutes / 60);
  const r = Math.round(minutes % 60);
  return `${h}h ${r}m`;
}

// ─────────────────────────────────────────────────────────────────────────────
// INLINED PRICING HELPERS (from src/pricing.ts / src/constants.ts)
// ─────────────────────────────────────────────────────────────────────────────

const COST_RATES = [
  { label: 'MiniMax M2.7', match: /\bminimax.*m2\.?7\b|\bm2\.?7\b/i, rate: 0.14 },
  { label: 'MiniMax M2.5', match: /\bminimax.*m2\.?5\b|\bm2\.?5\b/i, rate: 0.12 },
  { label: 'GPT-4o',       match: /\bgpt-?4o\b/i,                     rate: 2.5  },
  { label: 'Claude Sonnet',match: /\bsonnet\b/i,                       rate: 3    },
  { label: 'Claude Opus',  match: /\bopus\b/i,                         rate: 15   },
  { label: 'GPT-5-codex',  match: /\bgpt-?5[\d.]*.*codex\b|\bcodex\b/i, rate: 15 },
  { label: 'DeepSeek Chat',match: /\bdeepseek\b/i,                     rate: 0.28 },
];

function detectCostRate(model) {
  const s = stringify(model);
  const c = COST_RATES.find(r => r.match.test(s));
  if (c) return { label: c.label, rate: c.rate, pricingSource: 'known-local' };
  return { label: 'Unknown (conservative)', rate: 15, pricingSource: 'conservative-estimate' };
}

// ─────────────────────────────────────────────────────────────────────────────
// INLINED DIAGNOSTIC RULES (D1–D7 from src/rules.ts, simplified for probe)
// ─────────────────────────────────────────────────────────────────────────────

/** D1: Aggregate failure loop — fires at ≥80% error rate with ≥3 runs */
function diagnoseD1(job) {
  const totalRuns  = typeof job.totalRuns  === 'number' && Number.isFinite(job.totalRuns)  ? job.totalRuns  : NaN;
  const errorRuns = typeof job.errorRuns === 'number' && Number.isFinite(job.errorRuns) ? job.errorRuns : NaN;
  if (!Number.isFinite(totalRuns) || totalRuns < 3) return null;
  if (!Number.isFinite(errorRuns) || errorRuns < 0 || errorRuns > totalRuns) return null;
  const errorRate = errorRuns / totalRuns;
  if (errorRate < 0.8) return null;
  return {
    ruleId: 'D1', severity: 'warning',
    message: `Failure loop: ${errorRuns}/${totalRuns} runs (${(errorRate*100).toFixed(1)}% errors). Threshold: ≥80% error rate with ≥3 runs.`,
    explanation: `Aggregate failure ratio is ${(errorRate*100).toFixed(1)}% (${errorRuns} errors / ${totalRuns} runs).`,
    estimatedWaste: Math.round(job.totalTokens * Math.max(0, errorRate - 0.05)),
    observedValue: { totalRuns, errorRuns, errorRate },
  };
}

/** D2: Burst spend — rolling 60-min window with ≥3 jobs and ≥$50 */
function diagnoseD2(records) {
  if (!Array.isArray(records) || records.length === 0) return null;

  const parsed = [];
  for (const rec of records) {
    const tsRaw = rec.timestamp ?? rec.createdAt ?? rec.created_at ?? rec.startedAt ?? rec.started_at ?? rec.time;
    if (tsRaw == null) continue;
    const ts = Number(new Date(tsRaw).getTime());
    if (!Number.isFinite(ts) || ts <= 0) continue;

    const tokens = Number(rec.tokens ?? rec.total_tokens ?? rec.token_count ??
      rec.usage?.total_tokens ?? rec.usage?.tokens ?? rec.metrics?.tokens);
    if (!Number.isFinite(tokens) || tokens <= 0) continue;

    const modelRaw = stringify(rec.model ?? rec.model_name ?? rec.modelName ?? '');
    if (!modelRaw) continue;

    const jobObj = rec.job;
    const jobKey = (
      stringify(rec.jobId) || stringify(rec.job_id) ||
      stringify(jobObj?.id) || stringify(jobObj?.name) ||
      stringify(rec.jobName) || stringify(rec.job_name) ||
      stringify(rec.name) || stringify(rec.title) || stringify(rec.job)
    ).trim();
    if (!jobKey || jobKey === '[object Object]') continue;

    parsed.push({ timestamp: ts, model: modelRaw, totalTokens: tokens, jobKey });
  }
  if (parsed.length === 0) return null;
  parsed.sort((a, b) => a.timestamp - b.timestamp);

  const WINDOW_MS = 60 * 60 * 1000;
  let best = null;
  for (let i = 0; i < parsed.length; i++) {
    const wEnd = parsed[i].timestamp + WINDOW_MS;
    let totalCost = 0, distinctJobs = new Set();
    for (let j = i; j < parsed.length; j++) {
      if (parsed[j].timestamp > wEnd) break;
      const ri = detectCostRate(parsed[j].model);
      totalCost += (parsed[j].totalTokens / 1_000_000) * ri.rate;
      distinctJobs.add(parsed[j].jobKey);
      if (distinctJobs.size >= 3 && totalCost >= 50 && (best === null || totalCost > best.totalCost)) {
        best = { startTs: parsed[i].timestamp, endTs: parsed[j].timestamp, totalCost, distinctJobs: Array.from(distinctJobs) };
      }
    }
  }
  if (!best) return null;
  return {
    ruleId: 'D2', severity: 'info',
    message: `Burst spend: ${best.distinctJobs.length} jobs spent $${best.totalCost.toFixed(2)} in 60 min.`,
    explanation: `${best.distinctJobs.length} distinct jobs spent $${best.totalCost.toFixed(2)} in a 60-minute window.`,
    observedValue: { windowStart: new Date(best.startTs).toISOString(), windowEnd: new Date(best.endTs).toISOString(), totalCost: best.totalCost, distinctJobs: best.distinctJobs },
  };
}

/** D3: Premium model on simple job — rate ≥5x MiniMax M2.7 + simple check detected */
function diagnoseD3(job) {
  const model = stringify(job.model ?? job.model_name ?? job.modelName ?? '');
  if (!model) return null;
  const promptText = [job.task, job.type, job.description, job.prompt, job.name, job.title].filter(Boolean).join(' ');
  if (!isSimpleCheck(job, promptText)) return null;
  const ref = detectCostRate('MiniMax M2.7');
  const costInfo = detectCostRate(model);
  if (costInfo.pricingSource !== 'known-local') return null;
  if (!Number.isFinite(ref.rate) || ref.rate <= 0) return null;
  const multiplier = costInfo.rate / ref.rate;
  if (multiplier < 5) return null;
  return {
    ruleId: 'D3', severity: 'warning',
    message: `Premium model "${model}" (${costInfo.rate}/1M) used for simple check — ${multiplier.toFixed(1)}x reference rate.`,
    explanation: `Rate multiplier ${multiplier.toFixed(1)}x exceeds 5x threshold. Using premium models for simple checks is wasteful.`,
    estimatedWaste: Math.round(job.totalTokens * Math.max(0, (costInfo.rate - ref.rate) / costInfo.rate)),
    observedValue: { model, rate: costInfo.rate, referenceRate: ref.rate, multiplier },
  };
}

/** D4: Agent-turn on frequent cron — schedule <60 min with agentTurn enabled */
function diagnoseD4(job) {
  const agentTurn = readBoolean(job.agentTurn ?? job.agent_turn ?? job.agent_turn_enabled);
  if (!agentTurn) return null;
  const schedule = job.schedule ?? job.interval ?? job.frequency ?? job.cron;
  if (schedule == null) return null;
  const mins = parseScheduleMinutes(schedule);
  if (mins == null || !Number.isFinite(mins) || mins <= 0 || mins >= 60) return null;
  return {
    ruleId: 'D4', severity: 'warning',
    message: `Agent-turn on ${mins}-minute schedule burns tokens on cron-like work.`,
    explanation: `Agent-turn mode is enabled with schedule ${mins} min (<60 min). Frequent agent-turn jobs waste tokens.`,
    observedValue: { agentTurn: true, schedule, scheduleMinutes: mins },
  };
}

/** D5: Unknown model pricing — model not in COST_RATES */
function diagnoseD5(job) {
  const model = stringify(job.model ?? job.model_name ?? job.modelName ?? '');
  if (!model) return null;
  const costInfo = detectCostRate(model);
  if (costInfo.pricingSource === 'known-local') return null;
  return {
    ruleId: 'D5', severity: 'warning',
    message: `Model "${model}" is not in pricing database — conservative estimate ($${costInfo.rate}/1M) used.`,
    explanation: `Model not found; conservative estimate may be significantly wrong.`,
    estimatedWaste: null,
    observedValue: { model, pricingSource: costInfo.pricingSource, estimatedRate: costInfo.rate },
  };
}

/** D6: Zero-token abnormal run — runs>0 but tokens=0 */
function diagnoseD6(job) {
  const totalRuns   = typeof job.totalRuns   === 'number' && Number.isFinite(job.totalRuns)   ? job.totalRuns   : NaN;
  const totalTokens = typeof job.totalTokens === 'number' && Number.isFinite(job.totalTokens) ? job.totalTokens : NaN;
  if (!(totalRuns > 0) || totalTokens !== 0) return null;
  return {
    ruleId: 'D6', severity: 'warning',
    message: `Job ran ${totalRuns} time(s) but consumed zero tokens — token counting may have failed.`,
    explanation: `totalRuns=${totalRuns}, totalTokens=0. This is anomalous.`,
    observedValue: { totalRuns, totalTokens },
  };
}

/** D7: Exact duplicate active jobs — same model+schedule+task */
function diagnoseD7(jobs) {
  const active = jobs.filter(j => !((j.raw || j).active === false || (j.raw || j).enabled === false || (j.raw || j).disabled === true));
  const groups = new Map();
  for (const j of active) {
    const raw = j.raw || j;
    const model = stringify(raw.model ?? raw.model_name ?? raw.modelName ?? '').trim().toLowerCase();
    const sched = stringify(raw.schedule ?? raw.interval ?? raw.frequency ?? raw.cron ?? '').trim().toLowerCase();
    const task  = [raw.task, raw.type, raw.description, raw.prompt].map(v => typeof v === 'string' ? v.trim() : '').filter(v => v.length > 0).join('|').toLowerCase();
    if (!model || !sched) continue;
    const key = `${model}::${sched}::${task}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(j);
  }
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    return {
      ruleId: 'D7', severity: 'warning',
      message: `${group.length} active jobs share model+schedule — duplicate configuration.`,
      explanation: `${group.length} jobs: ${key}`,
      observedValue: { duplicateCount: group.length, duplicateKey: key, affectedJobIds: group.map(j => j.id || j.name || j.title) },
    };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSTIC RUNNER
// ─────────────────────────────────────────────────────────────────────────────

function runDiagnostics(jobs, allRecords) {
  const findings = [];
  for (const job of jobs) {
    const d1 = diagnoseD1(job);   if (d1) findings.push({ ...d1, jobId: job.id || job.name || job.title, jobName: job.name });
    const d3 = diagnoseD3(job);   if (d3) findings.push({ ...d3, jobId: job.id || job.name || job.title, jobName: job.name });
    const d4 = diagnoseD4(job);   if (d4) findings.push({ ...d4, jobId: job.id || job.name || job.title, jobName: job.name });
    const d5 = diagnoseD5(job);  if (d5) findings.push({ ...d5, jobId: job.id || job.name || job.title, jobName: job.name });
    const d6 = diagnoseD6(job);  if (d6) findings.push({ ...d6, jobId: job.id || job.name || job.title, jobName: job.name });
  }
  const d2 = diagnoseD2(allRecords); if (d2) findings.push(d2);
  const d7 = diagnoseD7(jobs);      if (d7) findings.push(d7);
  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
// RANKING & WASTE ESTIMATION
// ─────────────────────────────────────────────────────────────────────────────

function rankFindings(findings) {
  return findings.sort((a, b) => {
    // D1 (failure loop) always top priority
    if (a.ruleId === 'D1' && b.ruleId !== 'D1') return -1;
    if (b.ruleId === 'D1' && a.ruleId !== 'D1') return 1;
    // D4 (agent-turn cron) next
    if (a.ruleId === 'D4' && b.ruleId !== 'D4') return -1;
    if (b.ruleId === 'D4' && a.ruleId !== 'D4') return 1;
    // Then by estimated waste (desc), nulls last
    const wa = a.estimatedWaste ?? -1;
    const wb = b.estimatedWaste ?? -1;
    if (wa !== wb) return wb - wa;
    // D5 before D6 before D3 before D7 before D2
    const order = { D5: 1, D6: 2, D3: 3, D7: 4, D2: 5 };
    const oa = order[a.ruleId] ?? 99;
    const ob = order[b.ruleId] ?? 99;
    return oa - ob;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA LOADING
// ─────────────────────────────────────────────────────────────────────────────

function loadOpenClawData() {
  const jobsPath = join(process.env.HOME || '/root', '.openclaw/cron/jobs.json');
  const runsDir  = join(process.env.HOME || '/root', '.openclaw/cron/runs');

  let jobs = [];
  try {
    const raw = JSON.parse(readFileSync(jobsPath, 'utf8'));
    jobs = raw.jobs || [];
  } catch (e) {
    console.error('Cannot load jobs.json:', e.message);
  }

  const allRecords = [];
  try {
    for (const file of readdirSync(runsDir)) {
      if (!file.endsWith('.jsonl')) continue;
      try {
        const content = readFileSync(join(runsDir, file), 'utf8');
        for (const line of content.split('\n')) {
          if (!line.trim()) continue;
          try { allRecords.push(JSON.parse(line)); } catch (_e) {}
        }
      } catch (_e) {}
    }
  } catch (e) {
    console.error('Cannot read runs dir:', e.message);
  }

  return { jobs, allRecords };
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT AGGREGATION (per-job)
// ─────────────────────────────────────────────────────────────────────────────

function buildJobStats(jobs, allRecords) {
  // Map: jobId → stat
  const stats = new Map();

  // Init stats for each job
  for (const job of jobs) {
    const id = stringify(job.id);
    stats.set(id, {
      id, name: job.name || job.title || id,
      model: job.payload?.model ?? job.model ?? null,
      schedule: job.schedule,
      raw: job,
      totalTokens: 0, totalRuns: 0, errorRuns: 0,
      lifecycleStatus: isActiveJob({ raw: job }),
    });
  }

  // Aggregate run records
  for (const rec of allRecords) {
    const recJobId = stringify(rec.jobId ?? rec.job_id ?? rec.job?.id ?? rec.job?.name ?? '');
    // Try to match by job id or name
    let matched = stats.get(recJobId);
    if (!matched) {
      // Try by job name in stats map
      for (const stat of stats.values()) {
        if (recJobId && (rec.job?.name === stat.name || rec.job_name === stat.name)) {
          matched = stat; break;
        }
      }
    }

    const tokens = extractTokenCount(rec);
    const isError = isErrorRecord(rec);

    if (matched) {
      matched.totalRuns++;
      matched.totalTokens += tokens;
      if (isError) matched.errorRuns++;
    } else {
      // Synthetic/unmapped job
      const syntheticId = recJobId || cleanFileStem(basename(rec._file || 'unknown'));
      if (!stats.has(syntheticId)) {
        stats.set(syntheticId, {
          id: syntheticId, name: rec.jobName || rec.job_name || rec.name || syntheticId,
          model: rec.model ?? rec.model_name ?? null,
          schedule: null,
          raw: rec,
          totalTokens: 0, totalRuns: 0, errorRuns: 0,
          lifecycleStatus: 'historical',
          synthetic: true,
        });
      }
      const s = stats.get(syntheticId);
      s.totalRuns++;
      s.totalTokens += tokens;
      if (isError) s.errorRuns++;
    }
  }

  return Array.from(stats.values());
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUT FORMATTING
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function fmtCost(tokens, model) {
  const ri = detectCostRate(model || 'unknown');
  return `$${((tokens / 1_000_000) * ri.rate).toFixed(4)}`;
}

function formatFindings(findings, jobs) {
  const lines = [];
  lines.push('## Problem Summary\n');
  if (findings.length === 0) {
    lines.push('_No diagnostic findings — openclaw cron is clean._\n');
    return lines.join('\n');
  }

  const ranked = rankFindings([...findings]);
  for (let i = 0; i < ranked.length; i++) {
    const f = ranked[i];
    const rank = i + 1;
    const wasteStr = f.estimatedWaste != null ? `${fmt(f.estimatedWaste)} tokens` : 'waste TBD';
    const jobInfo = f.jobId ? `**Job:** ${f.jobId}` : '';

    lines.push(`**${rank}. [${f.ruleId}] ${f.message}**`);
    lines.push(`- Category: ${f.ruleId} (${f.severity})`);
    if (f.jobName) lines.push(`- Job: ${f.jobName}`);
    if (f.jobId) lines.push(`- Job ID: ${f.jobId}`);
    lines.push(`- Error rate: ${f.observedValue?.errorRate != null ? (f.observedValue.errorRate * 100).toFixed(1) + '%' : '—'}`);
    lines.push(`- Est. recurring waste: ${wasteStr}`);
    lines.push(`- Approx exposure: ${f.observedValue?.totalCost != null ? '$' + f.observedValue.totalCost.toFixed(2) : '—'}`);
    if (f.observedValue?.scheduleMinutes) lines.push(`- Schedule/Model/Provider: ${f.observedValue.scheduleMinutes}min / ${f.observedValue?.model || '—'} / ${f.observedValue?.provider || '—'}`);
    lines.push(`- Why here: ${f.explanation}`);
    lines.push('');
  }
  return lines.join('\n');
}

function formatWhatToDoFirst(findings) {
  const lines = [];
  lines.push('## What To Do First\n');
  const ranked = rankFindings([...findings]);
  const top = ranked.slice(0, 5);

  const actions = {
    D1: 'Fix the failure loop — check failed run logs and resolve root cause.',
    D4: 'Disable agent-turn mode OR slow schedule to ≥30 min.',
    D3: 'Switch to MiniMax M2.7 or cheaper model for simple check jobs.',
    D5: 'Verify model pricing — confirm actual rate with provider.',
    D6: 'Check token counting — verify API response includes usage data.',
    D7: 'Disable or consolidate duplicate jobs.',
    D2: 'Review burst window — confirm it was intentional.',
  };

  for (let i = 0; i < top.length; i++) {
    const f = top[i];
    lines.push(`${i + 1}. **[${f.ruleId}]** ${actions[f.ruleId] || 'Review and remediate.'} (${f.jobName || f.ruleId})`);
  }
  lines.push('');
  return lines.join('\n');
}

function formatAgentPrompt(findings, jobs, stats) {
  const ranked = rankFindings([...findings]);
  const top3 = ranked.slice(0, 3);

  const lines = [];
  lines.push('## Agent Diagnosis Prompt\n');
  lines.push('```');
  lines.push('You are reviewing openclaw cron jobs for token waste. Here are the top findings:');
  lines.push('');

  for (const f of top3) {
    const stat = stats.find(s => s.id === f.jobId || s.name === f.jobName);
    lines.push(`Rule ${f.ruleId} [${f.severity.toUpperCase()}]: ${f.message}`);
    if (stat) {
      lines.push(`  Job: ${stat.name}`);
      lines.push(`  Total runs: ${stat.totalRuns}, Total tokens: ${fmt(stat.totalTokens)}, Error rate: ${stat.errorRuns > 0 ? (stat.errorRuns / stat.totalRuns * 100).toFixed(1) + '%' : '0%'}`);
      lines.push(`  Estimated cost: ${fmtCost(stat.totalTokens, stat.model)}`);
    }
    lines.push(`  Action: ${f.explanation}`);
    lines.push('');
  }

  lines.push('For each finding:');
  lines.push('1. openclaw cron show <job-id> — verify current config');
  lines.push('2. openclaw cron runs --id <job-id> --limit 5 — check recent failures');
  lines.push('3. Apply fix: slow schedule / disable agent-turn / switch model / fix error');
  lines.push('4. openclaw cron run <job-id> — verify fix works');
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const { jobs, allRecords } = loadOpenClawData();
  const stats = buildJobStats(jobs, allRecords);
  const findings = runDiagnostics(stats, allRecords);
  const ranked = rankFindings([...findings]);

  // Attach job name to findings that have jobId
  for (const f of findings) {
    if (f.jobId) {
      const s = stats.find(s => s.id === f.jobId);
      if (s) f.jobName = s.name;
    }
  }

  const output = [
    formatFindings(findings, jobs),
    formatWhatToDoFirst(findings),
    formatAgentPrompt(findings, jobs, stats),
  ].join('\n');

  console.log(output);

  // Structured exit for testability
  return { findings, ranked, stats };
}

const result = main();
export { result };