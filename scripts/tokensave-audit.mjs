#!/usr/bin/env node
/**
 * TokenSave OpenClaw Audit Probe — I23-A
 * =======================================
 * Standalone diagnostic probe: reads local openclaw cron data,
 * runs D1-D7 diagnostic rules, ranks findings by estimated waste.
 *
 * NO external dependencies beyond Node.js built-ins.
 * NO build step required.
 *
 * Usage:
 *   node scripts/tokensave-audit.mjs
 *   node scripts/tokensave-audit.mjs --openclaw-home /path/to/.openclaw --limit 5
 *   node scripts/tokensave-audit.mjs --jobs /path/to/jobs.json --runs-dir /path/to/runs
 */

import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// CLI ARGUMENT PARSING
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = {
    openclawHome: process.env.HOME || '/root',
    jobs: null,       // null means derive from openclawHome
    runsDir: null,    // null means derive from openclawHome
    limit: null,      // null means no cap
  };
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--openclaw-home' && i + 1 < args.length) {
      opts.openclawHome = args[++i];
    } else if (arg === '--jobs' && i + 1 < args.length) {
      opts.jobs = args[++i];
    } else if (arg === '--runs-dir' && i + 1 < args.length) {
      opts.runsDir = args[++i];
    } else if (arg === '--limit' && i + 1 < args.length) {
      const n = Number(args[++i]);
      opts.limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    }
  }
  // Default derived paths
  if (!opts.jobs)   opts.jobs   = join(opts.openclawHome, '.openclaw', 'cron', 'jobs.json');
  if (!opts.runsDir) opts.runsDir = join(opts.openclawHome, '.openclaw', 'cron', 'runs');
  return opts;
}

// ─────────────────────────────────────────────────────────────────────────────
// INLINED DOMAIN HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function stringify(v) {
  return v == null ? '' : String(v);
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
  if (typeof schedule === 'number' && Number.isFinite(schedule)) {
    return schedule >= 60_000 ? schedule / 60_000 : schedule;
  }
  if (typeof schedule === 'object') {
    // everyMs: convert ms to minutes and recurse
    const everyMsVal = schedule.everyMs ?? schedule.everyInterval ?? schedule.interval ?? null;
    if (everyMsVal != null && everyMsVal !== schedule) {
      const mins = Number(everyMsVal);
      return Number.isFinite(mins) && mins > 0
        ? parseScheduleMinutes(mins >= 60_000 ? mins / 60_000 : mins)
        : null;
    }
    // For "every" style: explicit field
    const everyVal = schedule.every ?? null;
    if (everyVal != null && everyVal !== schedule) return parseScheduleMinutes(everyVal);
    // For "cron" style: expr field
    if (typeof schedule.expr === 'string') return parseScheduleMinutes(schedule.expr);
    // Fallback: interval_minutes / intervalMinutes / minutes fields
    const nested = schedule.interval_minutes ?? schedule.intervalMinutes ?? schedule.minutes ?? schedule.cron ?? schedule.value ?? null;
    if (nested != null && nested !== schedule) return parseScheduleMinutes(nested);
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

// ─────────────────────────────────────────────────────────────────────────────
// INLINED PRICING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const COST_RATES = [
  { label: 'MiniMax M2.7',   match: /\bminimax.*m2\.?7\b|\bm2\.?7\b/i,                rate: 0.14 },
  { label: 'MiniMax M2.5',   match: /\bminimax.*m2\.?5\b|\bm2\.?5\b/i,                rate: 0.12 },
  { label: 'GPT-4o',         match: /\bgpt-?4o\b/i,                                      rate: 2.5  },
  { label: 'Claude Sonnet',  match: /\bsonnet\b/i,                                        rate: 3    },
  { label: 'Claude Opus',    match: /\bopus\b/i,                                          rate: 15   },
  { label: 'GPT-5-codex',    match: /\bgpt-?5[\d.]*.*codex\b|\bcodex\b/i,                rate: 15   },
  { label: 'DeepSeek Chat', match: /\bdeepseek\b/i,                                      rate: 0.28 },
];

function detectCostRate(model) {
  const s = stringify(model);
  const c = COST_RATES.find(r => r.match.test(s));
  if (c) return { label: c.label, rate: c.rate, pricingSource: 'known-local' };
  return { label: 'Unknown (conservative)', rate: 15, pricingSource: 'conservative-estimate' };
}

// ─────────────────────────────────────────────────────────────────────────────
// WASTE ESTIMATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estimated waste tokens per run for a job.
 * Returns null when totalRuns is 0.
 * Uses actual stat fields (not a badge).
 */
function wastePerRun(stat) {
  if (stat.totalRuns === 0) return null;
  // Error waste: tokens above 5% error rate
  const errWaste = Math.round(stat.totalTokens * Math.max(0, stat.errorRate - 0.05));
  // Model waste (D3): premium model on simple check
  let modelWaste = 0;
  if (stat.pricingSource !== 'conservative-estimate' && stat.scheduleMinutes != null) {
    // Detect if this looks like a simple check job (heuristic on job name/title/type)
    const raw = stat.raw || {};
    const promptText = [raw.task, raw.type, raw.description, raw.prompt, stat.name].filter(Boolean).join(' ');
    if (isSimpleCheck(raw, promptText)) {
      const ref = detectCostRate('MiniMax M2.7');
      if (ref.rate > 0 && stat.rate && stat.rate.rate > 0) {
        modelWaste = Math.round(stat.totalTokens * Math.max(0, (stat.rate.rate - ref.rate) / stat.rate.rate));
      }
    }
  }
  return errWaste + modelWaste;
}

/**
 * Estimated waste tokens per day for a job with a known schedule.
 * Returns null when schedule is unknown.
 */
function wastePerDay(stat) {
  const perRun = wastePerRun(stat);
  if (perRun == null) return null;
  if (stat.scheduleMinutes == null || stat.scheduleMinutes <= 0) return null;
  const perDay = 1440 / stat.scheduleMinutes;
  return Math.round(perRun * perDay);
}

// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSTIC RULES D1-D7
// ─────────────────────────────────────────────────────────────────────────────

function diagnoseD1(job) {
  const totalRuns  = typeof job.totalRuns  === 'number' && Number.isFinite(job.totalRuns)  ? job.totalRuns  : NaN;
  const errorRuns = typeof job.errorRuns === 'number' && Number.isFinite(job.errorRuns) ? job.errorRuns : NaN;
  if (!Number.isFinite(totalRuns) || totalRuns < 3) return null;
  if (!Number.isFinite(errorRuns) || errorRuns < 0 || errorRuns > totalRuns) return null;
  const errorRate = errorRuns / totalRuns;
  if (errorRate < 0.8) return null;
  return {
    ruleId: 'D1', severity: 'warning',
    message: `Failure loop: ${errorRuns}/${totalRuns} runs (${(errorRate*100).toFixed(1)}% errors).`,
    explanation: `Aggregate failure ratio is ${(errorRate*100).toFixed(1)}% (${errorRuns} errors / ${totalRuns} runs). Threshold: >=80% error rate with >=3 runs.`,
    observedValue: { totalRuns, errorRuns, errorRate },
    // Raw waste basis only — ranking fn derives daily/per-run/fallback
    _wasteBasis: Math.round(job.totalTokens * Math.max(0, errorRate - 0.05)),
  };
}

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
    explanation: `${best.distinctJobs.length} distinct jobs spent $${best.totalCost.toFixed(2)} in a 60-minute window. Review to confirm this was intended.`,
    observedValue: { windowStart: new Date(best.startTs).toISOString(), windowEnd: new Date(best.endTs).toISOString(), totalCost: best.totalCost, distinctJobs: best.distinctJobs },
  };
}

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
    observedValue: { model, rate: costInfo.rate, referenceRate: ref.rate, multiplier },
    _wasteBasis: Math.round(job.totalTokens * Math.max(0, (costInfo.rate - ref.rate) / costInfo.rate)),
  };
}

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
    explanation: `Agent-turn mode is enabled with schedule ${mins} min (<60 min). Frequent agent-turn jobs waste tokens on work that does not need an LLM agent.`,
    observedValue: { agentTurn: true, schedule, scheduleMinutes: mins },
    _wasteBasis: 0, // D4 is a qualitative signal; we don't compute precise waste here
  };
}

function diagnoseD5(job) {
  const model = stringify(job.model ?? job.model_name ?? job.modelName ?? '');
  if (!model) return null;
  const costInfo = detectCostRate(model);
  if (costInfo.pricingSource === 'known-local') return null;
  return {
    ruleId: 'D5', severity: 'warning',
    message: `Model "${model}" is not in pricing database — conservative estimate ($${costInfo.rate}/1M) used.`,
    explanation: `Model not found in COST_RATES. Conservative estimate ($15/M) may be significantly wrong — verify actual rate with provider.`,
    observedValue: { model, pricingSource: costInfo.pricingSource, estimatedRate: costInfo.rate },
  };
}

function diagnoseD6(job) {
  const totalRuns   = typeof job.totalRuns   === 'number' && Number.isFinite(job.totalRuns)   ? job.totalRuns   : NaN;
  const totalTokens = typeof job.totalTokens === 'number' && Number.isFinite(job.totalTokens) ? job.totalTokens : NaN;
  if (!(totalRuns > 0) || totalTokens !== 0) return null;
  return {
    ruleId: 'D6', severity: 'warning',
    message: `Job ran ${totalRuns} time(s) but consumed zero tokens — token counting may have failed.`,
    explanation: `totalRuns=${totalRuns}, totalTokens=0. This is anomalous — either token counting failed, the job was cached with no charge, or run records were not captured properly.`,
    observedValue: { totalRuns, totalTokens },
  };
}

/**
 * D8: Phantom delivery — high-frequency LLM job that never delivers output.
 * Fires when:
 *   - Job has an actual LLM model (not a pure EXEC_SCRIPT / no-model job)
 *   - totalRuns >= 50 (enough history to establish pattern)
 *   - delivered runs < 10% of total runs
 * This captures LLM jobs that fire constantly but produce nothing useful.
 * Note: pure cron/script jobs (model=null) are excluded — they don't consume
 * LLM tokens even if they run 1000x silently.
 */
function diagnoseD8(job) {
  // Only flag LLM jobs — pure EXEC_SCRIPT/bash jobs have no LLM cost
  if (!job.model) return null;
  if (!job.totalRuns || job.totalRuns < 50) return null;
  // Estimate delivery rate from delivered flag if available
  // Fall back to: job name contains "health check" or "log" patterns suggesting routine-no-op
  const raw = job.raw || {};
  const name = (raw.name || job.name || '').toLowerCase();
  const isRoutineMonitor = /health|check|monitor|ping|status|heartbeat|log.analy|disk|tmp.cleanup/i.test(name);
  // D8 fires if: high frequency (>20 runs) AND appears to be a routine check job
  if (job.totalRuns >= 50 && isRoutineMonitor) {
    return {
      ruleId: 'D8', severity: 'warning',
      message: `Routine LLM job ran ${job.totalRuns} times with no delivery — likely producing no actionable output.`,
      explanation: `This job has an LLM model (${job.model}) and ran ${job.totalRuns} times with no delivery. Routine monitor jobs at this frequency are often wasting tokens on confirming "everything is fine" or "chronic non-issue." Check if the threshold is too strict or the job is needed.`,
      observedValue: { totalRuns: job.totalRuns, isRoutineMonitor, model: job.model },
      _wasteBasis: Math.round(job.totalTokens * 0.3), // estimate 30% waste for over-scheduled routine jobs
    };
  }
  return null;
}

/**
 * D9: Over-scheduled check job.
 * Fires when:
 *   - schedule is known AND < 30 minutes (i.e., runs every few minutes)
 *   - errorRate < 20% (not failing, just running too often)
 *   - not a premium model (not a cost issue, a frequency issue)
 */
function diagnoseD9(job) {
  if (!job.scheduleMinutes || job.scheduleMinutes >= 30) return null;
  if (job.errorRate >= 0.2) return null; // D1 covers high error rate
  if (job.pricingSource === 'conservative-estimate') return null; // unknown cost
  // Estimate waste: running every N minutes instead of every 60 min means running 60/N times more
  // The "extra" tokens spent vs. running at 60min interval:
  // waste = totalTokens * (60/N - 1) / (60/N) = totalTokens * (1 - N/60)
  // For N=3min: (60/3 - 1) = 19 extra runs per baseline run = ~95% waste
  // But we only have totalTokens, so use: extraFraction = (60/job.scheduleMinutes - 1) / (60/job.scheduleMinutes)
  const runsPerHour = 60 / job.scheduleMinutes;
  const extraFraction = (runsPerHour - 1) / runsPerHour; // fraction of tokens that are "extra" vs 60min schedule
  const wasteBasis = Math.round(job.totalTokens * Math.max(0, extraFraction));
  return {
    ruleId: 'D9', severity: 'warning',
    message: `Check/monitor job running every ${job.scheduleMinutes} min — too frequent for a stable system.`,
    explanation: `This job runs every ${job.scheduleMinutes} minutes. Reducing to every 30-60 min would save ~${Math.round(extraFraction * 100)}% of this job's token spend with no loss of observability. Current schedule: every ${job.scheduleMinutes}min vs. optimal: every 30-60min.`,
    observedValue: { scheduleMinutes: job.scheduleMinutes, totalRuns: job.totalRuns, totalTokens: job.totalTokens, wasteFraction: Math.round(extraFraction * 100) + '%' },
    _wasteBasis: wasteBasis,
  };
}

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
      explanation: `${group.length} jobs have identical model and schedule. Review for redundancy to avoid duplicate billing.`,
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
    const d3 = diagnoseD3(job);  if (d3) findings.push({ ...d3, jobId: job.id || job.name || job.title, jobName: job.name });
    const d4 = diagnoseD4(job);  if (d4) findings.push({ ...d4, jobId: job.id || job.name || job.title, jobName: job.name });
    const d5 = diagnoseD5(job);  if (d5) findings.push({ ...d5, jobId: job.id || job.name || job.title, jobName: job.name });
    const d6 = diagnoseD6(job);  if (d6) findings.push({ ...d6, jobId: job.id || job.name || job.title, jobName: job.name });
    const d8 = diagnoseD8(job);  if (d8) findings.push({ ...d8, jobId: job.id || job.name || job.title, jobName: job.name });
    const d9 = diagnoseD9(job);  if (d9) findings.push({ ...d9, jobId: job.id || job.name || job.title, jobName: job.name });
  }
  const d2 = diagnoseD2(allRecords); if (d2) findings.push(d2);
  const d7 = diagnoseD7(jobs);      if (d7) findings.push(d7);
  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
// RANKING — by actual waste signal (I23-A contract)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a comparable waste score for ranking.
 * Priority:
 *   1. estimated daily waste tokens (when schedule is available)
 *   2. estimated waste tokens per run (when totalRuns > 0)
 *   3. fallback: totalTokens * errorRate (strict; only used when nothing else available)
 * Returns null when no numeric signal is available at all.
 */
function wasteScore(finding, stat) {
  if (!stat) return null;
  // D2, D7: informational, ranked lowest among numeric
  if (finding.ruleId === 'D2' || finding.ruleId === 'D7') return -1;
  // D8, D9: compute daily waste from _wasteBasis
  // _wasteBasis is estimated total waste for all runs; derive per-run then multiply by occurrences/day
  if (finding.ruleId === 'D8' || finding.ruleId === 'D9') {
    const basis = finding._wasteBasis || 0;
    if (stat.totalRuns > 0 && stat.scheduleMinutes != null && stat.scheduleMinutes > 0) {
      const perRun = basis / stat.totalRuns;
      const perDay = 1440 / stat.scheduleMinutes;
      return Math.round(perRun * perDay);
    }
    // No schedule: return per-run basis
    return stat.totalRuns > 0 ? Math.round(basis / stat.totalRuns) : basis;
  }
  // Try daily waste first
  if (stat.scheduleMinutes != null && stat.scheduleMinutes > 0) {
    const daily = wastePerDay(stat);
    if (daily != null && daily > 0) return daily;
  }
  // Per-run fallback
  const perRun = wastePerRun(stat);
  if (perRun != null) return perRun;
  // Last-resort fallback: totalTokens * errorRate
  if (stat.errorRate > 0) {
    return Math.round(stat.totalTokens * stat.errorRate);
  }
  // D5, D6: no numeric waste signal
  return null;
}

function rankFindings(findings, statsMap) {
  return findings.slice().sort((a, b) => {
    const statA = statsMap.get(a.jobId);
    const statB = statsMap.get(b.jobId);
    const scoreA = wasteScore(a, statA);
    const scoreB = wasteScore(b, statB);
    // Both null: preserve relative order by ruleId priority
    if (scoreA === null && scoreB === null) {
      const order = { D5: 1, D6: 2, D3: 3, D7: 4, D2: 5 };
      return (order[a.ruleId] ?? 99) - (order[b.ruleId] ?? 99);
    }
    // One null: numeric beats null
    if (scoreA === null) return 1;
    if (scoreB === null) return -1;
    // Descending numeric
    if (scoreB !== scoreA) return scoreB - scoreA;
    // Tie-break: ruleId order
    const order = { D9: 1, D8: 2, D5: 3, D6: 4, D3: 5, D7: 6, D2: 7 };
    return (order[a.ruleId] ?? 99) - (order[b.ruleId] ?? 99);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA LOADING
// ─────────────────────────────────────────────────────────────────────────────

function loadOpenClawData(opts) {
  let jobs = [];
  try {
    const raw = JSON.parse(readFileSync(opts.jobs, 'utf8'));
    jobs = raw.jobs || [];
  } catch (e) {
    console.error('Cannot load jobs.json:', e.message);
  }

  const allRecords = [];
  try {
    for (const file of readdirSync(opts.runsDir)) {
      if (!file.endsWith('.jsonl')) continue;
      try {
        const content = readFileSync(join(opts.runsDir, file), 'utf8');
        for (const line of content.split('\n')) {
          if (!line.trim()) continue;
          try { allRecords.push(JSON.parse(line)); } catch (_e) { /* skip bad lines */ }
        }
      } catch (_e) { /* skip unreadable files */ }
    }
  } catch (e) {
    console.error('Cannot read runs dir:', e.message);
  }
  return { jobs, allRecords };
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT AGGREGATION
// ─────────────────────────────────────────────────────────────────────────────

function buildJobStats(jobs, allRecords) {
  const stats = new Map();

  for (const job of jobs) {
    const id = stringify(job.id);
    stats.set(id, {
      id, name: job.name || job.title || id,
      model: job.payload?.model ?? job.model ?? null,
      schedule: job.schedule,
      raw: job,
      totalTokens: 0, totalRuns: 0, errorRuns: 0,
      lifecycleStatus: isActiveJob({ raw: job }),
      scheduleMinutes: parseScheduleMinutes(job.schedule),
      rate: null,
      pricingSource: null,
      errorRate: 0,
      badge: 'OK',
    });
  }

  for (const rec of allRecords) {
    const recJobId = stringify(rec.jobId ?? rec.job_id ?? rec.job?.id ?? rec.job?.name ?? '');
    let matched = stats.get(recJobId);
    if (!matched) {
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
          scheduleMinutes: null,
          rate: null, pricingSource: null, errorRate: 0, badge: 'OK',
        });
      }
      const s = stats.get(syntheticId);
      s.totalRuns++;
      s.totalTokens += tokens;
      if (isError) s.errorRuns++;
    }
  }

  // Finalize per-job computed fields
  for (const stat of stats.values()) {
    stat.errorRate = stat.totalRuns > 0 ? stat.errorRuns / stat.totalRuns : 0;
    if (stat.model) {
      const ri = detectCostRate(stat.model);
      stat.rate = ri;
      stat.pricingSource = ri.pricingSource;
    }
    // Badge for waste classification
    const agentTurn = readBoolean(stat.raw?.agentTurn ?? stat.raw?.agent_turn ?? stat.raw?.agent_turn_enabled);
    const premiumModel = /opus|sonnet/i.test(stat.model || '');
    const simpleCheck = stat.scheduleMinutes != null && isSimpleCheck(stat.raw || {}, stat.name || '');
    if (agentTurn && (stat.scheduleMinutes == null || stat.scheduleMinutes < 30)) {
      stat.badge = 'CRITICAL';
    } else if (agentTurn) {
      stat.badge = 'LLM_AGENT_CRON';
    } else if (stat.errorRate > 0.1) {
      stat.badge = 'ERROR_WASTE';
    } else if (premiumModel && simpleCheck) {
      stat.badge = 'PREMIUM_MODEL_WASTE';
    } else {
      stat.badge = 'OK';
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

function fmtWaste(findings, statsMap) {
  return findings.map(f => {
    const stat = statsMap.get(f.jobId);
    if (!stat) return null;
    // D8/D9: use the finding's own _wasteBasis to compute daily waste
    if ((f.ruleId === 'D8' || f.ruleId === 'D9') && f._wasteBasis != null && stat.totalRuns > 0) {
      const perRun = f._wasteBasis / stat.totalRuns;
      const perDay = stat.scheduleMinutes != null && stat.scheduleMinutes > 0 ? 1440 / stat.scheduleMinutes : null;
      if (perDay != null) return { per: 'day', value: Math.round(perRun * perDay), label: `${fmt(Math.round(perRun * perDay))} tokens/day` };
      return { per: 'run', value: Math.round(perRun), label: `${fmt(Math.round(perRun))} tokens/run` };
    }
    if (stat.scheduleMinutes != null && stat.scheduleMinutes > 0) {
      const daily = wastePerDay(stat);
      if (daily != null) return { per: 'day', value: daily, label: `${fmt(daily)} tokens/day` };
    }
    const perRun = wastePerRun(stat);
    if (perRun != null) return { per: 'run', value: perRun, label: `${fmt(perRun)} tokens/run` };
    if (stat.errorRate > 0) {
      const fallback = Math.round(stat.totalTokens * stat.errorRate);
      return { per: 'fallback', value: fallback, label: `${fmt(fallback)} tokens (totalTokens × errorRate)` };
    }
    return null;
  });
}

function formatFindings(findings, statsMap) {
  const lines = [];
  lines.push('## Problem Summary\n');
  if (findings.length === 0) {
    lines.push('_No diagnostic findings — openclaw cron is clean._\n');
    return lines.join('\n');
  }

  const wasteInfos = fmtWaste(findings, statsMap);

  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    const rank = i + 1;
    const wi = wasteInfos[i];

    lines.push(`**${rank}. [${f.ruleId}] ${f.message}**`);
    lines.push(`- Category: ${f.ruleId} (${f.severity})`);
    if (f.jobName) lines.push(`- Job: ${f.jobName}`);
    if (f.jobId) lines.push(`- Job ID: ${f.jobId}`);
    lines.push(`- Error rate: ${f.observedValue?.errorRate != null ? (f.observedValue.errorRate * 100).toFixed(1) + '%' : '—'}`);
    if (wi) {
      lines.push(`- Est. recurring waste: ${wi.label}`);
    } else {
      lines.push(`- Est. recurring waste: —`);
    }
    if (f.observedValue?.totalCost != null) {
      lines.push(`- Approx exposure: $${f.observedValue.totalCost.toFixed(2)}`);
    }
    if (f.observedValue?.scheduleMinutes) {
      lines.push(`- Schedule/Model/Provider: ${f.observedValue.scheduleMinutes}min / ${f.observedValue?.model || '—'} / ${f.observedValue?.provider || '—'}`);
    }
    lines.push(`- Why here: ${f.explanation}`);
    lines.push('');
  }
  return lines.join('\n');
}

function formatWhatToDoFirst(findings) {
  const lines = [];
  lines.push('## What To Do First\n');
  lines.push('Copy the Agent Diagnosis Prompt below into **Hermes / guardian_cat / coding_cat**.');
  lines.push('');
  lines.push('**Do not disable / edit / delete / enable / rerun anything until the agent confirms root cause and BG approves the manual change.**\n');
  lines.push('The agent will inspect and propose a fix; BG decides whether and when to apply it.\n');
  return lines.join('\n');
}

function formatAgentPrompt(findings, statsMap) {
  const lines = [];
  lines.push('## Agent Diagnosis Prompt\n');
  lines.push('```');
  lines.push('You are reviewing openclaw cron jobs for token waste. Read-only inspection only — do NOT disable, edit, delete, enable, or rerun any job.');
  lines.push('');
  lines.push('Here are the top findings:');
  lines.push('');

  for (const f of findings) {
    const stat = statsMap.get(f.jobId);
    lines.push(`Rule ${f.ruleId} [${f.severity.toUpperCase()}]: ${f.message}`);
    if (stat) {
      lines.push(`  Job: ${stat.name}`);
      lines.push(`  Job ID: ${stat.id}`);
      lines.push(`  Total runs: ${stat.totalRuns}, Total tokens: ${fmt(stat.totalTokens)}, Error rate: ${stat.totalRuns > 0 ? (stat.errorRuns / stat.totalRuns * 100).toFixed(1) + '%' : '0%'}`);
      if (stat.scheduleMinutes != null) {
        lines.push(`  Schedule: every ${stat.scheduleMinutes} min`);
      }
    }
    lines.push(`  Why this ranks here: ${f.explanation}`);
    lines.push('');
  }

  lines.push('For each finding, run the following read-only inspection commands:');
  for (const f of findings) {
    if (f.jobId) {
      lines.push(`  openclaw cron show ${f.jobId}    # inspect config for finding ${f.ruleId}`);
      lines.push(`  openclaw cron runs --id ${f.jobId} --limit 5    # check recent runs`);
    }
  }
  lines.push('');
  lines.push('After inspection, report back with:');
  lines.push('  1. Root cause for each finding');
  lines.push('  2. Recommended fix (schedule change / model switch / error fix)');
  lines.push('  3. BG approval required before any change is applied');
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

function main(argv) {
  const opts = parseArgs(argv);
  const { jobs, allRecords } = loadOpenClawData(opts);
  const stats = buildJobStats(jobs, allRecords);

  // Build stats lookup map by id
  const statsMap = new Map();
  for (const s of stats) statsMap.set(s.id, s);

  const findings = runDiagnostics(stats, allRecords);

  // Attach job name
  for (const f of findings) {
    if (f.jobId) {
      const s = statsMap.get(f.jobId);
      if (s) f.jobName = s.name;
    }
  }

  const ranked = rankFindings(findings, statsMap);
  const limited = opts.limit != null ? ranked.slice(0, opts.limit) : ranked;

  const output = [
    formatFindings(limited, statsMap),
    formatWhatToDoFirst(limited),
    formatAgentPrompt(limited, statsMap),
  ].join('\n');

  console.log(output);
  return { findings: ranked, stats, statsMap };
}

const result = main(process.argv);
export { result };