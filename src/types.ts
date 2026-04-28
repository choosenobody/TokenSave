/**
 * TokenSave Type Inventory
 * Extracted from src/main.ts (1295 lines, // @ts-nocheck)
 * Purpose: map current runtime data shapes without modifying runtime code.
 * Status: verified against source; some field types are best-effort (any) due to
 * the source using loose property access patterns and 'as any' casts.
 */

// ---------------------------------------------------------------------------
// Constant-data types (imported from src/main.ts top-level const declarations)
// ---------------------------------------------------------------------------

export type PricingSource =
  | 'known-local'
  | 'configured-plan-zero'
  | 'configured-explicit'
  | 'observed-model'
  | 'observed-fallback'
  | 'inferred-config-primary'
  | 'inferred-config-fallback'
  | 'conservative-estimate'
  | 'unpriced';

/** USD per 1M tokens (input + output combined).  PricingSource indicates whether the rate is known-local, conservative-estimate, or another future source. */
export interface CostRate {
  label: string;
  match: RegExp;
  rate: number;
  pricingSource?: PricingSource;
}

/** Human-readable fix guidance attached to a waste category. */
export interface FixConfig {
  title: string;
  problem: string;
  action: string;
  impactLabel: string;
}

/** Badge styling config for a waste category. */
export interface FixBadge {
  label: string;
  color: string;
}

// ---------------------------------------------------------------------------
// Job / run record types
// ---------------------------------------------------------------------------

/**
 * Raw job input — the source JSON object as loaded from a .json file.
 * Many fields are aliased (id/name, model/model_name/modelName, schedule/interval/frequency/cron).
 * src/main.ts accesses these with fallback chains; the exact shape varies per export.
 */
export interface JobInput {
  id?: unknown;
  name?: unknown;
  title?: unknown;
  model?: unknown;
  model_name?: unknown;
  modelName?: unknown;
  schedule?: unknown;
  interval?: unknown;
  frequency?: unknown;
  cron?: unknown;
  task?: unknown;
  type?: unknown;
  description?: unknown;
  prompt?: unknown;
  agentTurn?: unknown;
  agent_turn?: unknown;
  agent_turn_enabled?: unknown;
  // openclaw export shape (job-level)
  runs?: RunRecord[];
  [key: string]: unknown;
}

/**
 * Normalized representation of a Job after parsing but before run-record aggregation.
 * Produced by normalizeJobs() — one entry per distinct job in the source export.
 */
export interface NormalizedJob {
  raw: unknown;               // original JobInput object
  id: string;
  lookupId: string;           // normalized (lowercase, trimmed) job id key
  name: string;
  slug: string;               // slugify(name)
  schedule: unknown;          // original schedule value (string | object | number | null)
  model: string;
  promptText: string;
  synthetic: boolean;        // true if this job was synthesised from run-records with no matching job entry
}

/**
 * Accumulator for run statistics attached to a NormalizedJob.
 * Produced by createJobStat() at the start of analyseDataset();
 * mutated in-place by applyRunRecord();
 * finalised by finalizeStat().
 */
export interface JobStat extends NormalizedJob {
  totalTokens: number;
  totalRuns: number;
  errorRuns: number;
}

/**
 * Final job record returned by analyseDataset() and displayed in the UI.
 * Fields are added by finalizeStat().
 */
export interface FinalizedJob extends JobStat {
  rate: CostRate;
  pricingSource?: PricingSource;
  totalCost: number;          // (totalTokens / 1_000_000) * rate.rate
  errorRate: number;          // totalRuns > 0 ? totalErrors / totalRuns : 0
  scheduleMinutes: number | null;
  frequencyLabel: string;
  issues: WasteCategory[];    // all detected waste categories
  badge: WasteCategory;       // primary (highest-severity) waste category
  fixSuggestion: string;
}

/**
 * Single run / execution record inside a run bundle.
 * Shape varies widely — src/main.ts checks many field-name variants.
 * Marked Record<string, unknown> with documented token/error field locations.
 */
export interface RunRecord {
  // Token count — one of these paths is populated
  tokens?: unknown;
  total_tokens?: unknown;
  token_count?: unknown;
  usage?: { total_tokens?: unknown; tokens?: unknown };
  metrics?: { tokens?: unknown };

  // Error flag — one of these paths is populated
  error?: unknown;           // boolean | non-empty string | object
  status?: unknown;
  result?: unknown;

  // Job identity — one of these paths is populated
  jobId?: unknown;
  job_id?: unknown;
  job?: { id?: unknown; name?: unknown };
  jobName?: unknown;
  job_name?: unknown;
  name?: unknown;

  // Model override
  model?: unknown;
  model_name?: unknown;

  // Catch-all for any other fields present in the record
  [key: string]: unknown;
}

/**
 * Sentinel / guard result of isJobLike(), isRunLike(), isMetaLike() predicates.
 * Documents the minimum set of fields required by each recognizer.
 */
export type RecordKind = 'job' | 'run' | 'meta' | 'unknown';

/**
 * openclaw export meta object.  Either embedded at payload.meta or at payload root.
 */
export interface Meta {
  openclaw_version?: string;
  export_date?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Waste classification types
// ---------------------------------------------------------------------------

/** Waste categories assigned by classifyWaste().  Order = display priority. */
export type WasteCategory =
  | 'CRITICAL'
  | 'LLM_AGENT_CRON'
  | 'ERROR_WASTE'
  | 'PREMIUM_MODEL_WASTE'
  | 'WARNING'
  | 'OK';

/** Summary row in the "Top Waste" panel.  Same shape as FinalizedJob. */
export type TopWasteJob = FinalizedJob;

// ---------------------------------------------------------------------------
// Dataset / aggregation types
// ---------------------------------------------------------------------------

/**
 * Set of records from one file (either a .json bundle or a .jsonl file).
 * Produced by ingestLooseFile() and ingestZipFile().
 */
export interface RunBundle {
  fileName: string;
  records: RunRecord[];
}

/**
 * In-memory accumulator populated by handleFiles().
 * Passed through to analyseDataset().
 */
export interface Dataset {
  jobs: JobInput[];
  meta: Meta | null;
  runBundles: RunBundle[];
}

// ---------------------------------------------------------------------------
// Report / summary types
// ---------------------------------------------------------------------------

/**
 * Aggregate statistics shown in the Summary panel.
 * Produced by analyseDataset().
 */
export interface SummaryStats {
  totalTokens: number;
  totalCost: number;
  jobCount: number;
  errorRate: number;          // totalErrors / totalRuns  (0 if no runs)
  totalWasteTokens: number;
  wasteRate: number;          // totalWasteTokens / totalTokens  (0 if no tokens)
  totalCostSaving: number;    // USD saving if waste is eliminated
  hasConservativeEstimates?: boolean;
  knownLocalCost: number;        // sum of totalCost where pricingSource === 'known-local'
  conservativeEstimateCost: number; // sum of totalCost where pricingSource === 'conservative-estimate'
}

/**
 * The primary output of analyseDataset().
 * Fed to renderReport().
 */
export interface Report {
  meta: Meta | null;
  summary: SummaryStats;
  jobs: FinalizedJob[];
  topWaste: TopWasteJob[];
  fixes: FixCardItem[];
}

/**
 * One fix card rendered by buildFixCards().
 * category → FIX_LIBRARY config → list of up to 4 jobs.
 */
export interface FixCardItem {
  category: WasteCategory;
  config: FixConfig;
  jobs: FinalizedJob[];       // max 4 in the card; FixGrid renders .slice(0,4)
}

// ---------------------------------------------------------------------------
// UI / state types
// ---------------------------------------------------------------------------

/**
 * Module-level UI state mutated by event handlers.
 * Initialised at src/main.ts line ~63.
 */
export interface State {
  report: Report | null;
  sortKey: SortKey;
  sortDir: SortDirection;
}

/** Column used for sorting the job table. Matches data-sort attribute values in index.html. */
export type SortKey = 'name' | 'tokens' | 'cost' | 'frequency' | 'errorRate';

/** Sort direction. */
export type SortDirection = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Utility / helper return types (for documentation; no implementation here)
// ---------------------------------------------------------------------------

/** Return type of parseJson(text, fileName).  Value is a parsed JSON object. */
export type ParseJsonResult = Record<string, unknown>;

/** Return type of parseJsonl(text, fileName).  Array of RunRecord-like objects. */
export type ParseJsonlResult = RunRecord[];

/** Return type of parseZipEntries(buffer).  Array of {name, text} entries. */
export type ZipEntry = { name: string; text: string };
export type ParseZipResult = ZipEntry[];
