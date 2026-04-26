// @ts-nocheck
// Extracted from src/main.ts — pure domain helpers.
// No logic changed. No behavior changes.
import { stringify } from './utils';

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
