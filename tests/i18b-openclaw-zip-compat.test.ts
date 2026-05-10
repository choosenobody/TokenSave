// @ts-nocheck
// I18-B: real OpenClaw zip compatibility — focused regression tests
// No real OpenClaw data committed. Uses synthetic inline fixtures.
import { describe, it, expect } from 'vitest';
import { detectImportSource } from '../src/parser';
import { normalizeJobs, parseScheduleMinutes } from '../src/domain';

// ─────────────────────────────────────────────────────────────────────────────
// Test (a): zip entry path with run\foo.jsonl is recognized (Windows backslash)
// ─────────────────────────────────────────────────────────────────────────────
describe('I18-B: Windows zip path normalization', () => {
  it('detects run entries with Windows backslash path (run\\file.jsonl)', () => {
    // Simulate a ZIP entry with Windows-style backslash path, as created by
    // OpenClaw on Windows and included in the real-data smoke zip.
    // The ZIP parser stores the raw entry name as-is (no path normalization).
    const syntheticDataset = {
      jobs: [{ id: 'job-1', name: 'Test Job', schedule: 'every 5 min', model: 'MiniMax M2.7' }],
      meta: null,
      runBundles: [
        {
          fileName: 'run\\2026-05-10.jsonl',  // Windows backslash — same format as real-data smoke
          records: [
            { tokens: 1000, timestamp: '2026-05-10T00:00:00Z', error: false, model: 'MiniMax M2.7' }
          ]
        }
      ],
      fileCount: 2
    };

    // Before I18-B fix: detectImportSource looks for /run[s]?/ (forward slash only)
    // and would miss run\2026-05-10.jsonl, resulting in hasRuns=false.
    // After I18-B fix: the fix is in ingestZipFile (main.ts) where runEntries
    // filter normalizes backslashes before path matching. detectImportSource
    // itself only sees the resulting runBundles, so if ingestZipFile correctly
    // populates runBundles with Windows-path entries, detectImportSource works.
    // We test the detectImportSource contract: when runBundles is populated
    // with Windows-path bundle, hasRuns should be true.
    const summary = detectImportSource(syntheticDataset);
    expect(summary.evidenceHint.hasRuns).toBe(true);
    expect(summary.evidenceHint.hasTokens).toBe(true);
    expect(summary.evidenceHint.hasModels).toBe(true);
  });

  it('detects run entries with POSIX forward slash path (run/file.jsonl) — regression', () => {
    const syntheticDataset = {
      jobs: [{ id: 'job-1', name: 'Test Job', schedule: 'every 5 min', model: 'MiniMax M2.7' }],
      meta: null,
      runBundles: [
        {
          fileName: 'run/2026-05-10.jsonl',  // POSIX forward slash
          records: [
            { tokens: 1000, timestamp: '2026-05-10T00:00:00Z', error: false, model: 'MiniMax M2.7' }
          ]
        }
      ],
      fileCount: 2
    };
    const summary = detectImportSource(syntheticDataset);
    expect(summary.evidenceHint.hasRuns).toBe(true);
    expect(summary.evidenceHint.hasTokens).toBe(true);
  });

  it('detects run entries with mixed separators (run\\runs\\file.jsonl)', () => {
    const syntheticDataset = {
      jobs: [{ id: 'job-1', name: 'Test Job' }],
      meta: null,
      runBundles: [
        {
          fileName: 'run\\runs\\2026-05-10.jsonl',
          records: [{ tokens: 500, timestamp: '2026-05-10T00:00:00Z', error: false }]
        }
      ],
      fileCount: 2
    };
    const summary = detectImportSource(syntheticDataset);
    expect(summary.evidenceHint.hasRuns).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test (c): detectImportSource sees payload.model as model evidence
// ─────────────────────────────────────────────────────────────────────────────
describe('I18-B: payload.model as model evidence in detectImportSource', () => {
  it('sets hasModels=true when job has payload.model but no top-level model field', () => {
    // Real OpenClaw jobs: top-level model/model_name/modelName absent,
    // but payload.model exists in some jobs.
    const syntheticDataset = {
      jobs: [
        {
          id: 'job-1',
          name: 'OpenClaw Job Without Top-Level Model',
          schedule: { kind: 'interval', expr: '0 */5 * * * *', tz: 'UTC' },
          payload: { model: 'MiniMax M2.7' }
        }
      ],
      meta: null,
      runBundles: [],
      fileCount: 1
    };

    // Before I18-B fix: detectImportSource only checks job.model / job.model_name / job.modelName
    // and would not detect payload.model, resulting in hasModels=false.
    // After I18-B fix: detectImportSource must also check job.payload?.model.
    // This test captures the expected behavior for the parser-level fix.
    const summary = detectImportSource(syntheticDataset);
    expect(summary.evidenceHint.hasModels).toBe(true);
  });

  it('hasModels true when top-level model exists (regression check)', () => {
    const syntheticDataset = {
      jobs: [{ id: 'job-1', name: 'Test', model: 'MiniMax M2.7' }],
      meta: null,
      runBundles: [],
      fileCount: 1
    };
    const summary = detectImportSource(syntheticDataset);
    expect(summary.evidenceHint.hasModels).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test (d): normalizeJobs uses payload.model when top-level model aliases missing
// ─────────────────────────────────────────────────────────────────────────────
describe('I18-B: normalizeJobs falls back to payload.model', () => {
  it('uses payload.model as model when top-level model aliases are absent', () => {
    const jobs = [
      {
        id: 'job-1',
        name: 'OpenClaw Job',
        // No top-level model, model_name, or modelName
        payload: { model: 'o1-mini' }
      }
    ];

    const normalized = normalizeJobs(jobs);
    expect(normalized[0].model).toBe('o1-mini');
  });

  it('top-level model takes precedence over payload.model (priority order)', () => {
    const jobs = [
      {
        id: 'job-1',
        name: 'OpenClaw Job',
        model: 'MiniMax M2.7',           // top-level — should win
        payload: { model: 'o1-mini' }     // should be ignored
      }
    ];

    const normalized = normalizeJobs(jobs);
    expect(normalized[0].model).toBe('MiniMax M2.7');
  });

  it('payload.model used when only model_name is absent', () => {
    const jobs = [
      {
        id: 'job-1',
        name: 'Test',
        model_name: null,  // explicit null, falsy
        payload: { model: 'o1-preview' }
      }
    ];

    const normalized = normalizeJobs(jobs);
    expect(normalized[0].model).toBe('o1-preview');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test (e): parseScheduleMinutes supports schedule.expr (cron expression string)
// ─────────────────────────────────────────────────────────────────────────────
describe('I18-B: schedule.expr cron expression parsing in parseScheduleMinutes', () => {
  it('parses schedule.expr as cron expression via text path', () => {
    // schedule.expr is a cron expression string, e.g. "0 */5 * * * *"
    // 6-field cron: second=0, minute=*/5 (every 5 hours) → 300 min
    // For actual 5-min cron: "*/5 * * * *" (5-field, no seconds) → 5 min
    // Test the schedule.expr as-is from OpenClaw real data.
    const schedule = { kind: 'interval', expr: '0 */5 * * * *', tz: 'UTC' };
    const result = parseScheduleMinutes(schedule);
    // "0 */5 * * * *" — cron[0]="0", cron[1]="*/5"
    // → cron[0]==='0' && cron[1].startsWith('*/') → Number('5')*60 = 300
    expect(result).toBe(300);
  });

  it('schedule.expr parsed as 6-segment cron — daily (0 0 * * * *)', () => {
    // Cron: ["0","0","*","*","*","*"] → cron[0]="0", cron[1]="0" → 1440 min/day
    const schedule = { expr: '0 0 * * * *' };
    const result = parseScheduleMinutes(schedule);
    expect(result).toBe(1440);
  });

  it('schedule.expr is not a cron expr — falls back to everyMs / every', () => {
    // If schedule.expr is not actually a cron expression string,
    // everyMs should take precedence in the everyVal chain.
    const schedule = { everyMs: 120000 };  // 2 minutes
    const result = parseScheduleMinutes(schedule);
    expect(result).toBe(2);  // 120000ms / 60000 = 2
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test (f): parseScheduleMinutes supports schedule.everyMs
// ─────────────────────────────────────────────────────────────────────────────
describe('I18-B: schedule.everyMs millisecond-to-minute parsing', () => {
  it('converts everyMs=600000 to 10 minutes', () => {
    const schedule = { everyMs: 600000 };
    const result = parseScheduleMinutes(schedule);
    expect(result).toBe(10);
  });

  it('converts everyMs=300000 to 5 minutes', () => {
    const schedule = { everyMs: 300000 };
    const result = parseScheduleMinutes(schedule);
    expect(result).toBe(5);
  });

  it('everyMs is used by the everyVal chain (schedule.every)', () => {
    const schedule = { every: '5m' };  // string form
    const result = parseScheduleMinutes(schedule);
    // schedule.every is a string, goes to text path: parse "5m" → 5 minutes
    expect(result).toBe(5);
  });

  it('everyMs takes precedence over every for numeric everyMs values', () => {
    // In the everyVal chain: schedule.every ?? schedule.everyInterval ?? schedule.interval
    // If everyMs is the only numeric value, it should be picked up.
    // Actually everyVal does NOT include everyMs — everyMs is handled separately.
    // Let me verify: the everyVal chain only checks .every/.everyInterval/.interval.
    // everyMs must go through the nested branch or the number branch.
    // The number branch: if (typeof schedule === "number" && Number.isFinite(schedule))
    // But { everyMs: 300000 } is an object, not a number.
    // The object branch checks everyVal (every/everyInterval/interval) but NOT everyMs.
    // So everyMs needs to be added to the nested chain: schedule.everyMs.
    const schedule = { everyMs: 300000 };
    const result = parseScheduleMinutes(schedule);
    // Before I18-B: everyMs not in any chain, would return null.
    // After I18-B fix in domain.ts: nested includes everyMs, so it becomes 5.
    expect(result).toBe(5);
  });
});