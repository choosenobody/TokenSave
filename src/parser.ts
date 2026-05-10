// @ts-nocheck
// Extracted from src/main.ts — file parsing only.
// No logic changed. Mechanically copied.

export function parseJson(text, fileName) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Malformed JSON in ${fileName}: ${error.message}`);
  }
}

export function parseJsonl(text, fileName) {
  const records = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    try {
      const record = JSON.parse(trimmed);
      if (record == null || typeof record !== "object" || Array.isArray(record)) {
        throw new Error("Expected an object per line");
      }
      records.push(record);
    } catch (error) {
      throw new Error(`Malformed JSONL in ${fileName} at line ${index + 1}: ${error.message}`);
    }
  });

  return records;
}

export async function parseZipEntries(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const decoder = new TextDecoder();
  const eocdOffset = findEndOfCentralDirectory(bytes);

  if (eocdOffset < 0) {
    throw new Error("Unable to locate ZIP central directory.");
  }

  const totalEntries = readUint16(bytes, eocdOffset + 10);
  const centralDirOffset = readUint32(bytes, eocdOffset + 16);
  const entries = [];
  let pointer = centralDirOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (readUint32(bytes, pointer) !== 0x02014b50) {
      throw new Error("ZIP central directory is malformed.");
    }

    const compressionMethod = readUint16(bytes, pointer + 10);
    const compressedSize = readUint32(bytes, pointer + 20);
    const fileNameLength = readUint16(bytes, pointer + 28);
    const extraLength = readUint16(bytes, pointer + 30);
    const commentLength = readUint16(bytes, pointer + 32);
    const localHeaderOffset = readUint32(bytes, pointer + 42);
    const nameBytes = bytes.slice(pointer + 46, pointer + 46 + fileNameLength);
    const fileName = decoder.decode(nameBytes);

    pointer += 46 + fileNameLength + extraLength + commentLength;

    if (fileName.endsWith("/")) {
      continue;
    }

    const text = await readZipEntryText(bytes, localHeaderOffset, compressedSize, compressionMethod);
    entries.push({ name: fileName, text });
  }

  return entries;
}

async function readZipEntryText(bytes, localHeaderOffset, compressedSize, compressionMethod) {
  if (readUint32(bytes, localHeaderOffset) !== 0x04034b50) {
    throw new Error("ZIP local entry header is malformed.");
  }

  const nameLength = readUint16(bytes, localHeaderOffset + 26);
  const extraLength = readUint16(bytes, localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + nameLength + extraLength;
  const compressed = bytes.slice(dataStart, dataStart + compressedSize);

  if (compressionMethod === 0) {
    return new TextDecoder().decode(compressed);
  }

  if (compressionMethod === 8) {
    if (typeof DecompressionStream !== "function") {
      throw new Error("This browser cannot unpack deflated ZIP files. Please use a recent Chromium-based browser.");
    }

    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const buffer = await new Response(stream).arrayBuffer();
    return new TextDecoder().decode(buffer);
  }

  throw new Error(`ZIP compression method ${compressionMethod} is not supported by this viewer.`);
}

/**
 * Returns true if record has a finite non-negative token field present.
 * Handles aliases: tokens, total_tokens, token_count, usage.total_tokens.
 * Field must be a finite number (0 is valid; NaN/Infinity are not).
 */
function hasFiniteTokenField(record) {
  const aliases = [
    record.tokens,
    record.total_tokens,
    record.token_count,
    record.usage && record.usage.total_tokens
  ];
  for (const v of aliases) {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      return true;
    }
  }
  return false;
}

/**
 * Detect the import source type and audit readiness from a parsed dataset.
 * Pure function — no side effects, no network.
 */
export function detectImportSource(dataset) {
  const { jobs, meta, runBundles } = dataset;

  // Use actual user-imported file count when available; fall back to runBundle count.
  const rawFileCount = dataset.fileCount;
  const fileCount = (
    typeof rawFileCount === 'number' &&
    Number.isFinite(rawFileCount) &&
    rawFileCount >= 0
  ) ? rawFileCount : runBundles.length;

  const recordCount = runBundles.reduce((sum, b) => sum + b.records.length, 0);

  // Evidence detection
  const evidenceHint = {
    hasJobs: jobs.length > 0,
    hasRuns: recordCount > 0,
    hasTokens: false,
    hasErrors: false,
    hasSchedules: false,
    hasModels: false
  };

  // Scan run records for evidence signals (sample first 20 per bundle)
  runBundles.forEach((bundle) => {
    bundle.records.slice(0, 20).forEach((record) => {
      if (hasFiniteTokenField(record)) {
        evidenceHint.hasTokens = true;
      }
      if (record.error ?? record.status === 'error' ?? record.result === 'error') {
        evidenceHint.hasErrors = true;
      }
      if (record.model ?? record.model_name) {
        evidenceHint.hasModels = true;
      }
    });
  });

  // Check jobs for schedules and models and embedded runs
  jobs.slice(0, 20).forEach((job) => {
    if (job.schedule ?? job.interval ?? job.frequency ?? job.cron) {
      evidenceHint.hasSchedules = true;
    }
    if (job.model ?? job.model_name ?? job.modelName ?? (job.payload && job.payload.model)) {
      evidenceHint.hasModels = true;
    }
    if (Array.isArray(job.runs) && job.runs.length > 0) {
      evidenceHint.hasRuns = true;
    }
  });

  // Source detection
  let detectedSource = 'unknown';
  if (meta && (meta.openclaw_version || meta.export_date)) {
    detectedSource = 'openclaw-like';
  } else if (jobs.length > 0 && recordCount === 0) {
    // Jobs only
    const first = jobs[0];
    if (first && typeof first === 'object') {
      const hasAgentTurn = first.agent_turn_enabled !== undefined || first.agentTurn !== undefined;
      const hasRuns = Array.isArray(first.runs) && first.runs.length > 0;
      if (hasAgentTurn || hasRuns) {
        detectedSource = 'openclaw-like';
      } else {
        detectedSource = 'generic-json';
      }
    } else {
      detectedSource = 'generic-json';
    }
  } else if (jobs.length === 0 && recordCount > 0) {
    detectedSource = 'jsonl-records';
  } else if (jobs.length > 0 && recordCount > 0) {
    detectedSource = 'zip-mixed';
  }

  // Confidence
  let confidence = 'low';
  if (recordCount > 0 && evidenceHint.hasTokens) {
    confidence = 'high';
  } else if ((recordCount > 0) || (jobs.length > 0 && evidenceHint.hasSchedules)) {
    confidence = 'medium';
  }

  // Supported rule hint — 'full' requires jobs + runs + tokens + schedules + models
  let supportedRuleHint = 'unavailable';
  if (
    jobs.length > 0 &&
    recordCount > 0 &&
    evidenceHint.hasTokens &&
    evidenceHint.hasSchedules &&
    evidenceHint.hasModels
  ) {
    supportedRuleHint = 'full';
  } else if ((jobs.length > 0 && evidenceHint.hasTokens) || (recordCount > 0 && evidenceHint.hasTokens)) {
    supportedRuleHint = 'partial';
  } else if (jobs.length > 0 || recordCount > 0) {
    supportedRuleHint = 'limited';
  }

  return {
    detectedSource,
    fileCount,
    recordCount,
    confidence,
    supportedRuleHint,
    evidenceHint
  };
}

/**
 * Map an ImportSummary's evidence hints to specific diagnostic coverage gaps.
 * Pure function — no side effects, no network.
 *
 * Input:  ImportSummary from detectImportSource()
 * Output: array of ReadinessGap describing what is missing and what to do next
 *
 * Each gap maps missing evidence → affected diagnostics → manual next step.
 */
export function buildReadinessGaps(summary) {
  const { evidenceHint, supportedRuleHint } = summary;
  const gaps = [];

  // Tokens missing → token waste and cost exposure are weak/unavailable
  if (!evidenceHint.hasTokens) {
    gaps.push({
      missingEvidence: 'hasTokens',
      label: 'Tokens missing',
      affectedDiagnostics: [
        'Token waste analysis weakened',
        'D1 failure-loop detection relies on errors without token context',
        'D6 zero-token abnormal-run check unavailable without token evidence',
        'D2 burst-spend cannot compute cost-per-token without token data'
      ],
      manualNextStep: 'Include run JSONL / history files containing token fields (tokens, total_tokens, token_count, or usage.total_tokens).'
    });
  }

  // Runs missing → failure loop / zero-token / burst analysis weakened
  if (!evidenceHint.hasRuns) {
    gaps.push({
      missingEvidence: 'hasRuns',
      label: 'Run history missing',
      affectedDiagnostics: [
        'D1 failure-loop detection (80%+ error rate across runs) unavailable',
        'D6 zero-token abnormal-run check unavailable',
        'D2 burst-spend concentration analysis unavailable'
      ],
      manualNextStep: 'Include run JSONL files (run records with timestamps, status, and error fields).'
    });
  }

  // Schedules missing → schedule waste / cron burn / duplicate recurring-job analysis weakened
  if (!evidenceHint.hasSchedules) {
    gaps.push({
      missingEvidence: 'hasSchedules',
      label: 'Schedules missing',
      affectedDiagnostics: [
        'D4 LLM_AGENT_CRON burn (agent-turn + frequent schedule) unavailable',
        'D7 duplicate recurring-job detection weakened without schedule comparison',
        'Schedule-frequency waste recommendations unavailable'
      ],
      manualNextStep: 'Include jobs.json containing schedule fields (schedule, interval, frequency, cron).'
    });
  }

  // Models missing → premium model / unknown model pricing diagnostics weakened
  if (!evidenceHint.hasModels) {
    gaps.push({
      missingEvidence: 'hasModels',
      label: 'Models missing',
      affectedDiagnostics: [
        'D3 premium-model-on-simple-job diagnostic unavailable',
        'D5 unknown-model pricing warnings unavailable',
        'Premium vs. budget model comparison unavailable'
      ],
      manualNextStep: 'Include jobs.json or run records containing model fields (model, model_name, modelName).'
    });
  }

  // Jobs missing → duplicate active job and job-level manual fixes weakened
  if (!evidenceHint.hasJobs) {
    gaps.push({
      missingEvidence: 'hasJobs',
      label: 'Job definitions missing',
      affectedDiagnostics: [
        'D7 exact-duplicate active-job detection (same model+schedule+task) unavailable',
        'Job-level fix cards (CRITICAL, ERROR_WASTE, PREMIUM_MODEL_WASTE, WARNING) weakened',
        'Manual fix steps cannot reference specific job identifiers'
      ],
      manualNextStep: 'Include jobs.json for job definitions, schedules, and model fields.'
    });
  }

  // Errors missing → failure-loop diagnostics weakened
  if (!evidenceHint.hasErrors) {
    gaps.push({
      missingEvidence: 'hasErrors',
      label: 'Error evidence missing',
      affectedDiagnostics: [
        'D1 failure-loop detection (requires error runs) unavailable',
        'ERROR_WASTE fix category cannot fire without error evidence'
      ],
      manualNextStep: 'Ensure run records include error/status/result fields (error, status=\'error\', result=\'error\').'
    });
  }

  return gaps;
}

function findEndOfCentralDirectory(bytes) {
  const minOffset = Math.max(0, bytes.length - 65557);
  for (let index = bytes.length - 22; index >= minOffset; index -= 1) {
    if (readUint32(bytes, index) === 0x06054b50) {
      return index;
    }
  }
  return -1;
}

function readUint16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes, offset) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}
