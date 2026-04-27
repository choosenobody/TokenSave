// @ts-nocheck
// Extracted from src/main.ts — pure domain helpers.
// No logic changed. No behavior changes.
import { stringify, normalizeKey, slugify, cleanFileStem, formatShortDuration } from './utils';

export function extractTokenCount(record) {
  const candidates = [
    record.tokens,
    record.total_tokens,
    record.token_count,
    record.usage && record.usage.total_tokens,
    record.usage && record.usage.tokens,
    record.metrics && record.metrics.tokens
  ];

  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value >= 0) {
      return value;
    }
  }
  return 0;
}

export function isErrorRecord(record) {
  if (typeof record.error === "boolean") {
    return record.error;
  }
  if (typeof record.error === "string") {
    return record.error.trim().length > 0 && record.error.toLowerCase() !== "false";
  }
  if (record.error && typeof record.error === "object") {
    return true;
  }
  const status = stringify(record.status || record.result || "").toLowerCase();
  return status === "error" || status === "failed" || status === "failure";
}

export function isExecType(rawJob, promptText) {
  const tokens = [
    rawJob.type,
    rawJob.taskType,
    rawJob.mode,
    rawJob.task,
    rawJob.command,
    promptText
  ].filter(Boolean).join(" ").toLowerCase();
  return /\b(exec|execute|execution|shell|command|terminal|run task|exec-type)\b/.test(tokens);
}

export function isSimpleCheck(rawJob, promptText) {
  const tokens = [
    rawJob.type,
    rawJob.taskType,
    rawJob.name,
    rawJob.description,
    rawJob.prompt,
    promptText
  ].filter(Boolean).join(" ").toLowerCase();
  return /\b(check|health|status|ping|monitor|probe|verify|heartbeat|smoke|lint)\b/.test(tokens);
}

export function isJobLike(value) {
  return !!value && typeof value === "object" && !Array.isArray(value) && ("id" in value || "name" in value) && ("schedule" in value || "model" in value || "task" in value || "type" in value || "prompt" in value);
}

export function isRunLike(value) {
  return !!value && typeof value === "object" && !Array.isArray(value) && ("tokens" in value || "timestamp" in value || "error" in value || "usage" in value);
}

export function isMetaLike(value) {
  return !!value && typeof value === "object" && !Array.isArray(value) && ("openclaw_version" in value || "export_date" in value);
}

export function readBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
  }
  return Boolean(value);
}

export function classifyWaste(job, errorRate, scheduleMinutes) {
  const issues = [];
  const agentTurn = readBoolean(job.raw.agentTurn ?? job.raw.agent_turn ?? job.raw.agent_turn_enabled ?? false);
  const execType = isExecType(job.raw, job.promptText);
  const simpleCheck = isSimpleCheck(job.raw, job.promptText);
  const premiumModel = /opus|sonnet/i.test(job.model);
  const highFrequencyExec = execType && scheduleMinutes != null && scheduleMinutes < 60;

  if (agentTurn && execType && scheduleMinutes != null && scheduleMinutes < 30) {
    issues.push("CRITICAL");
  }
  if (agentTurn && scheduleMinutes != null && !issues.includes("CRITICAL")) {
    issues.push("LLM_AGENT_CRON");
  }
  if (errorRate > 0.1) {
    issues.push("ERROR_WASTE");
  }
  if (premiumModel && simpleCheck) {
    issues.push("PREMIUM_MODEL_WASTE");
  }
  if (highFrequencyExec && !issues.includes("CRITICAL")) {
    issues.push("WARNING");
  }

  return issues.length ? issues : ["OK"];
}

export function buildFixSuggestion(badge, scheduleMinutes) {
  if (badge === "CRITICAL") {
    return "Reduce frequency (>= 30 min) or disable agent-turn mode.";
  }
  if (badge === "ERROR_WASTE") {
    return "Check failed run logs for the error and fix the root cause.";
  }
  if (badge === "PREMIUM_MODEL_WASTE") {
    return "Switch to a cheaper model like MiniMax M2.7 for this task type.";
  }
  if (badge === "WARNING") {
    return "Consider slowing down the schedule to save tokens.";
  }
  return "Running within acceptable parameters.";
}

export function normalizeJobs(jobs) {
  return jobs.map((job, index) => {
    const id = stringify(job.id != null ? job.id : `job-${index + 1}`);
    const name = stringify(job.name || job.title || `Unnamed Job ${index + 1}`);
    const schedule = job.schedule ?? job.interval ?? job.frequency ?? job.cron ?? null;
    const model = stringify(job.model || job.model_name || job.modelName || "Unknown");
    const promptText = [job.task, job.type, job.description, job.prompt, name].filter(Boolean).join(" ");
    return {
      raw: job,
      id,
      lookupId: normalizeKey(id),
      name,
      slug: slugify(name),
      schedule,
      model,
      promptText,
      synthetic: false
    };
  });
}

export function createJobStat(job) {
  return {
    ...job,
    totalTokens: 0,
    totalRuns: 0,
    errorRuns: 0
  };
}

export function ensureSyntheticStat(record, fileName, statsById) {
  const inferredName = stringify(record.jobName || record.job_name || record.name || cleanFileStem(fileName) || "Unmapped Job");
  const inferredId = normalizeKey(stringify(record.jobId || record.job_id || inferredName));
  const key = `synthetic:${inferredId}`;

  if (!statsById.has(key)) {
    statsById.set(key, {
      raw: {},
      id: key,
      lookupId: key,
      name: inferredName,
      slug: slugify(inferredName),
      schedule: null,
      model: stringify(record.model || record.model_name || "Unknown"),
      promptText: inferredName,
      synthetic: true,
      totalTokens: 0,
      totalRuns: 0,
      errorRuns: 0
    });
  }

  return statsById.get(key);
}

export function resolveJob(record, fileName, indexes) {
  const fileStem = cleanFileStem(fileName);
  const idCandidates = [
    record.jobId,
    record.job_id,
    record.job && record.job.id,
    fileStem
  ].filter((value) => value != null).map((value) => normalizeKey(value));

  for (const candidate of idCandidates) {
    if (indexes.byId.has(candidate)) {
      return indexes.byId.get(candidate);
    }
  }

  const nameCandidates = [
    record.jobName,
    record.job_name,
    record.job && record.job.name,
    fileStem
  ].filter(Boolean).map((value) => slugify(value));

  for (const candidate of nameCandidates) {
    if (indexes.bySlug.has(candidate)) {
      return indexes.bySlug.get(candidate);
    }
  }

  return null;
}

export function applyRunRecord(stat, record) {
  stat.totalRuns += 1;
  stat.totalTokens += extractTokenCount(record);
  if (isErrorRecord(record)) {
    stat.errorRuns += 1;
  }
  if ((stat.model === "Unknown" || !stat.model) && (record.model || record.model_name)) {
    stat.model = stringify(record.model || record.model_name);
  }
}

export function parseScheduleMinutes(schedule) {
  if (schedule == null) {
    return null;
  }

  if (typeof schedule === "object") {
    const everyVal = schedule.every ?? schedule.everyInterval ?? schedule.interval ?? null;
    if (everyVal != null && everyVal !== schedule) {
      return parseScheduleMinutes(everyVal);
    }
    const nested = schedule.interval_minutes ?? schedule.intervalMinutes ?? schedule.minutes ?? schedule.cron ?? schedule.value;
    if (nested != null && nested !== schedule) {
      return parseScheduleMinutes(nested);
    }
  }

  if (typeof schedule === "number" && Number.isFinite(schedule)) {
    if (schedule >= 60_000) {
      return schedule / 60_000;
    }
    return schedule;
  }

  const text = stringify(schedule).trim().toLowerCase();
  if (!text) {
    return null;
  }

  if (/hourly/.test(text)) {
    return 60;
  }
  if (/daily/.test(text)) {
    return 1440;
  }

  let match = text.match(/every\s+(\d+)\s*(minute|min|minutes|mins|m)\b/);
  if (match) {
    return Number(match[1]);
  }

  match = text.match(/every\s+(\d+)\s*(hour|hours|hr|hrs|h)\b/);
  if (match) {
    return Number(match[1]) * 60;
  }

  match = text.match(/^(\d+)\s*(minute|min|minutes|mins|m)\b/);
  if (match) {
    return Number(match[1]);
  }

  match = text.match(/^(\d+)\s*(hour|hours|hr|hrs|h)\b/);
  if (match) {
    return Number(match[1]) * 60;
  }

  match = text.match(/^(\d+)\s*(day|days|d)\b/);
  if (match) {
    return Number(match[1]) * 1440;
  }

  const cron = text.trim().split(/\s+/);
  if (cron.length >= 5) {
    if (cron[0].startsWith("*/")) {
      return Number(cron[0].slice(2));
    }
    if (cron[0] === "0" && cron[1].startsWith("*/")) {
      return Number(cron[1].slice(2)) * 60;
    }
    if (cron[0] === "0" && cron[1] === "*") {
      return 60;
    }
    if (cron[0] === "0" && cron[1] === "0") {
      return 1440;
    }
  }

  return null;
}

export function formatFrequency(schedule, scheduleMinutes) {
  if (scheduleMinutes != null) {
    return `Every ${formatShortDuration(scheduleMinutes)}`;
  }
  if (schedule && typeof schedule === "object") {
    const nested = schedule.label ?? schedule.cron ?? schedule.every ?? schedule.interval ?? schedule.value;
    if (nested != null) {
      return stringify(nested);
    }
  }
  return schedule ? stringify(schedule) : "Unknown";
}
