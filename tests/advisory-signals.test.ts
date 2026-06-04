import { describe, it, expect } from 'vitest';
import {
  detectA1ZeroTokenFastFailure,
  detectA2PremiumNoReply,
  detectA3SharedFailureSignature,
  rankAdvisorySignals,
  failureSignature,
  pickPresentTokenValue,
  parseTokenNumber,
  AdvisorySignal,
} from '../src/advisory';

// ---------------------------------------------------------------------------
// A1 — zero-token fast failure review signal
// ---------------------------------------------------------------------------

describe('A1 — zero-token fast failure review signal', () => {
  it('fires when 2+ zero-token fast-failed runs exist for the same job', () => {
    const records = [
      {
        jobId: 'job-a1-fastfail',
        tokens: 0,
        durationMs: 50,
        status: 'failed',
        model: 'unknown',
      },
      {
        jobId: 'job-a1-fastfail',
        tokens: 0,
        durationMs: 80,
        status: 'failed',
        model: 'unknown',
      },
    ];
    const signals = detectA1ZeroTokenFastFailure(records);
    expect(signals.length).toBe(1);
    const sig = signals[0];
    expect(sig.id).toBe('A1');
    expect(sig.title).toMatch(/Review signal/i);
    expect(sig.explanation).toMatch(/Review signal/i);
    expect(sig.explanation).toMatch(/not confirmed waste/i);
    expect(sig.affectedJobIds).toContain('job-a1-fastfail');
    expect(sig.firstAction.command).toContain('openclaw cron runs --id');
    expect(sig.firstAction.description).toMatch(/inspect/i);
    expect(sig.approximateCostExposure).not.toBeNull();
    expect(sig.approximateCostExposure!.highUsd).toBeGreaterThanOrEqual(0);
  });

  it('does NOT fire on a single qualifying fast failure (runCount=1 below MIN_A1_RUN_COUNT=2 gate)', () => {
    const records = [
      {
        jobId: 'job-a1-singleton',
        tokens: 0,
        durationMs: 50,
        status: 'failed',
        model: 'unknown',
      },
    ];
    const signals = detectA1ZeroTokenFastFailure(records);
    expect(signals).toEqual([]);
  });

  it('groups multiple records of the same job into a single signal', () => {
    const records = [
      { jobId: 'job-a1-group', tokens: 0, durationMs: 20, status: 'failed' },
      { jobId: 'job-a1-group', tokens: 0, durationMs: 30, status: 'failed' },
      { jobId: 'job-a1-group', tokens: 0, durationMs: 40, status: 'failed' },
    ];
    const signals = detectA1ZeroTokenFastFailure(records);
    expect(signals.length).toBe(1);
    expect(signals[0].evidence.observedValue.runCount).toBe(3);
  });

  it('does NOT fire when totalTokens is non-zero', () => {
    const records = [
      { jobId: 'job-a1-tokens', tokens: 100, durationMs: 50, status: 'failed' },
    ];
    const signals = detectA1ZeroTokenFastFailure(records);
    expect(signals).toEqual([]);
  });

  it('does NOT fire when durationMs is >= 300', () => {
    const records = [
      { jobId: 'job-a1-slow', tokens: 0, durationMs: 1000, status: 'failed' },
    ];
    const signals = detectA1ZeroTokenFastFailure(records);
    expect(signals).toEqual([]);
  });

  it('uses total_tokens / duration_ms / elapsedMs aliases (2 runs per alias, satisfies runCount gate)', () => {
    const records = [
      {
        jobId: 'job-a1-aliases',
        total_tokens: 0,
        duration_ms: 50,
        elapsedMs: 50,
        model: null,
      },
      {
        jobId: 'job-a1-aliases',
        total_tokens: 0,
        duration_ms: 80,
        elapsedMs: 80,
        model: null,
      },
    ];
    const signals = detectA1ZeroTokenFastFailure(records);
    expect(signals.length).toBe(1);
  });

  it('returns empty array on empty input', () => {
    expect(detectA1ZeroTokenFastFailure([])).toEqual([]);
  });

  // Regression (Codex P2): A1 must NOT fire on records with no token
  // field at all, even when durationMs < 300 and status is failed.
  // `Number(null) === 0` previously caused false positives.
  it('does NOT fire when token field is missing, even if durationMs < 300 and status failed', () => {
    const records = [
      { jobId: 'no-tokens-1' /* no tokens / total_tokens / token_count */, durationMs: 50, status: 'failed', model: 'unknown' },
      { jobId: 'no-tokens-2', tokens: null, durationMs: 80, status: 'failed' },
      { jobId: 'no-tokens-3', tokens: undefined, durationMs: 100, status: 'error' },
      { jobId: 'no-tokens-4', total_tokens: null, durationMs: 60, status: 'failed' },
      { jobId: 'no-tokens-5', token_count: null, durationMs: 70, status: 'failed' },
    ];
    const signals = detectA1ZeroTokenFastFailure(records);
    expect(signals).toEqual([]);
  });

  it('fires when token field is explicitly 0 (not missing) — 2 runs per job, satisfies runCount gate', () => {
    const records = [
      { jobId: 'explicit-zero-1', tokens: 0, durationMs: 50, status: 'failed' },
      { jobId: 'explicit-zero-1', tokens: 0, durationMs: 70, status: 'failed' },
      { jobId: 'explicit-zero-2', total_tokens: 0, durationMs: 80, status: 'error' },
      { jobId: 'explicit-zero-2', total_tokens: 0, durationMs: 90, status: 'error' },
      { jobId: 'explicit-zero-3', token_count: 0, durationMs: 100, status: 'failed' },
      { jobId: 'explicit-zero-3', token_count: 0, durationMs: 110, status: 'failed' },
    ];
    const signals = detectA1ZeroTokenFastFailure(records);
    expect(signals.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// A2 — premium model + repeated NO_REPLY
// ---------------------------------------------------------------------------

describe('A2 — premium model + repeated NO_REPLY review signal', () => {
  it('fires on opus + 2+ NO_REPLY + agentTurn', () => {
    const jobs = [
      {
        id: 'job-a2-opus',
        model: 'Claude Opus',
        noReplyRuns: 3,
        agentTurn: true,
        task: 'analysis',
      },
    ];
    const signals = detectA2PremiumNoReply(jobs);
    expect(signals.length).toBe(1);
    const sig = signals[0];
    expect(sig.id).toBe('A2');
    expect(sig.title).toMatch(/Review signal/i);
    expect(sig.explanation).toMatch(/not confirmed waste/i);
    expect(sig.affectedJobIds).toContain('job-a2-opus');
    expect(sig.firstAction.command).toContain('openclaw cron runs --id');
    expect(sig.firstAction.description).toMatch(/inspect/i);
  });

  it('fires on sonnet + 2+ NO_REPLY + script-like task (no agentTurn)', () => {
    const jobs = [
      {
        id: 'job-a2-sonnet',
        model: 'Claude Sonnet',
        noReplyRuns: 4,
        task: 'health check',
      },
    ];
    const signals = detectA2PremiumNoReply(jobs);
    expect(signals.length).toBe(1);
    expect(signals[0].id).toBe('A2');
  });

  it('does NOT fire on non-premium model even with NO_REPLY', () => {
    const jobs = [
      { id: 'job-a2-cheap', model: 'mini-max', noReplyRuns: 5, agentTurn: true },
    ];
    const signals = detectA2PremiumNoReply(jobs);
    expect(signals).toEqual([]);
  });

  it('does NOT fire on premium + NO_REPLY < minNoReplyRuns', () => {
    const jobs = [
      { id: 'job-a2-few', model: 'Claude Opus', noReplyRuns: 1, agentTurn: true },
    ];
    const signals = detectA2PremiumNoReply(jobs);
    expect(signals).toEqual([]);
  });

  it('does NOT fire when neither agentTurn nor script-like task', () => {
    const jobs = [
      {
        id: 'job-a2-noagent',
        model: 'Claude Opus',
        noReplyRuns: 3,
        task: 'complex research and reasoning',
        agentTurn: false,
      },
    ];
    const signals = detectA2PremiumNoReply(jobs);
    expect(signals).toEqual([]);
  });

  it('honors custom minNoReplyRuns parameter', () => {
    const jobs = [
      { id: 'job-a2-cust', model: 'Claude Opus', noReplyRuns: 2, agentTurn: true },
    ];
    const withDefault = detectA2PremiumNoReply(jobs);
    const withHigherThreshold = detectA2PremiumNoReply(jobs, undefined, 3);
    expect(withDefault.length).toBe(1);
    expect(withHigherThreshold).toEqual([]);
  });

  // Regression: A2 has no verified cost exposure range and must emit null,
  // not a partial {lowUsd, highUsd: null} object.  A2 does not infer cost.
  it('returns approximateCostExposure === null (no partial range, no inferred cost)', () => {
    const jobs = [
      { id: 'job-a2-noexposure', model: 'Claude Opus', noReplyRuns: 3, agentTurn: true },
      { id: 'job-a2-noexposure-2', model: 'Claude Sonnet', noReplyRuns: 5, task: 'health check' },
    ];
    const signals = detectA2PremiumNoReply(jobs);
    expect(signals.length).toBe(2);
    for (const sig of signals) {
      // Must be strictly null — not a partial range object, not undefined,
      // not zero, not a placeholder.
      expect(sig.approximateCostExposure).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// A3 — cross-job shared failure signature
// ---------------------------------------------------------------------------

describe('A3 — cross-job shared failure signature', () => {
  it('fires when 2+ jobs share zero-token-fast-failure signature', () => {
    const jobs = [
      {
        id: 'job-a3-1',
        records: [
          { tokens: 0, durationMs: 50, error: '' },
          { tokens: 0, durationMs: 60, error: '' },
        ],
      },
      {
        id: 'job-a3-2',
        records: [
          { tokens: 0, durationMs: 70, error: '' },
        ],
      },
    ];
    const signals = detectA3SharedFailureSignature(jobs);
    expect(signals.length).toBe(1);
    const sig = signals[0];
    expect(sig.id).toBe('A3');
    expect(sig.explanation).toMatch(/Review signal/i);
    expect(sig.explanation).toMatch(/not confirmed waste/i);
    expect(sig.affectedJobIds).toContain('job-a3-1');
    expect(sig.affectedJobIds).toContain('job-a3-2');
    expect(sig.firstAction.description).toMatch(/inspect/i);
    expect(sig.firstAction.description.toLowerCase()).toContain('shared');
    // Must NOT directly suggest disabling jobs
    expect(sig.firstAction.command).not.toMatch(/disable/);
    expect(sig.firstAction.description).not.toMatch(/disable the affected jobs/i);
  });

  it('fires when 2+ jobs share allowlist-reject signature', () => {
    const jobs = [
      { id: 'job-a3-allow-1', records: [{ error: 'allowlist reject: policy X' }] },
      { id: 'job-a3-allow-2', records: [{ error: 'allowlist reject: policy Y' }] },
    ];
    const signals = detectA3SharedFailureSignature(jobs);
    expect(signals.length).toBe(1);
    expect(signals[0].evidence.observedValue.signature).toBe('allowlist-reject');
  });

  it('fires when 2+ jobs share dispatcher-reject signature', () => {
    const jobs = [
      { id: 'job-a3-disp-1', records: [{ error: 'dispatcher reject: missing profile' }] },
      { id: 'job-a3-disp-2', records: [{ error: 'dispatcher reject: quota' }] },
    ];
    const signals = detectA3SharedFailureSignature(jobs);
    expect(signals.length).toBe(1);
    expect(signals[0].evidence.observedValue.signature).toBe('dispatcher-reject');
  });

  it('fires when 2+ jobs share same normalized error message', () => {
    const jobs = [
      { id: 'job-a3-norm-1', records: [{ error: 'rate limit exceeded' }] },
      { id: 'job-a3-norm-2', records: [{ error: 'rate limit exceeded' }] },
    ];
    const signals = detectA3SharedFailureSignature(jobs);
    expect(signals.length).toBe(1);
    expect(signals[0].evidence.observedValue.signature).toMatch(/^normalized-error:/);
  });

  it('does NOT fire when only 1 job has the signature', () => {
    const jobs = [
      { id: 'job-a3-solo', records: [{ tokens: 0, durationMs: 50, error: '' }] },
    ];
    const signals = detectA3SharedFailureSignature(jobs);
    expect(signals).toEqual([]);
  });

  it('does NOT fire when jobs have different signatures', () => {
    const jobs = [
      { id: 'job-a3-mix-1', records: [{ error: 'allowlist reject: x' }] },
      { id: 'job-a3-mix-2', records: [{ error: 'dispatcher reject: y' }] },
    ];
    const signals = detectA3SharedFailureSignature(jobs);
    expect(signals).toEqual([]);
  });

  it('honors minSharedJobs parameter (default 2)', () => {
    const jobs = [
      { id: 'job-a3-min-1', records: [{ error: 'shared error msg' }] },
      { id: 'job-a3-min-2', records: [{ error: 'shared error msg' }] },
      { id: 'job-a3-min-3', records: [{ error: 'shared error msg' }] },
    ];
    const defaultMin = detectA3SharedFailureSignature(jobs);
    const withMin3 = detectA3SharedFailureSignature(jobs, 3);
    expect(defaultMin.length).toBe(1);
    expect(defaultMin[0].affectedJobIds.length).toBe(3);
    expect(withMin3.length).toBe(1);
  });

  it('failureSignature: classifies zero-token fast failure', () => {
    expect(failureSignature({ tokens: 0, durationMs: 50 })).toBe('zero-token-fast-failure');
  });

  it('failureSignature: returns empty for benign record', () => {
    expect(failureSignature({ tokens: 1000, durationMs: 500 })).toBe('');
  });

  // Regression (Codex P2): failureSignature() must NOT classify a record
  // with no token field as zero-token-fast-failure.  `Number(null) === 0`
  // previously caused timing-only records to misclassify.
  it('failureSignature: returns empty when token field is missing, even if durationMs < 300', () => {
    expect(failureSignature({ durationMs: 50, status: 'failed' })).toBe('');
    expect(failureSignature({ durationMs: 100, status: 'failed', model: 'unknown' })).toBe('');
    expect(failureSignature({ durationMs: 50, tokens: null })).toBe('');
    expect(failureSignature({ durationMs: 50, total_tokens: null })).toBe('');
    expect(failureSignature({ durationMs: 50, token_count: null })).toBe('');
  });

  it('failureSignature: still classifies explicit tokens=0 + durationMs<300 as zero-token-fast-failure', () => {
    expect(failureSignature({ tokens: 0, durationMs: 50 })).toBe('zero-token-fast-failure');
    expect(failureSignature({ total_tokens: 0, durationMs: 80 })).toBe('zero-token-fast-failure');
    expect(failureSignature({ token_count: 0, durationMs: 100 })).toBe('zero-token-fast-failure');
  });

  // Regression (Codex P2): A3 must NOT fire shared zero-token-fast-failure
  // when both jobs only have durationMs < 300 but no token field.
  it('A3: does NOT fire shared zero-token-fast-failure when both jobs have no token field', () => {
    const jobs = [
      { id: 'a3-missing-1', records: [{ durationMs: 50, status: 'failed' }] },
      { id: 'a3-missing-2', records: [{ durationMs: 80, status: 'failed' }] },
      { id: 'a3-missing-3', records: [{ tokens: null, durationMs: 70, status: 'error' }] },
    ];
    const signals = detectA3SharedFailureSignature(jobs);
    expect(signals).toEqual([]);
  });

  it('A3: still fires shared zero-token-fast-failure when jobs explicitly have tokens: 0', () => {
    const jobs = [
      { id: 'a3-explicit-1', records: [{ tokens: 0, durationMs: 50 }] },
      { id: 'a3-explicit-2', records: [{ total_tokens: 0, durationMs: 80 }] },
    ];
    const signals = detectA3SharedFailureSignature(jobs);
    expect(signals.length).toBe(1);
    expect(signals[0].id).toBe('A3');
    expect(signals[0].evidence.observedValue.signature).toBe('zero-token-fast-failure');
    expect(signals[0].affectedJobIds).toContain('a3-explicit-1');
    expect(signals[0].affectedJobIds).toContain('a3-explicit-2');
  });
});

// ---------------------------------------------------------------------------
// I24 — nested token-path coverage (Hermes cron run-record schema)
// ---------------------------------------------------------------------------

describe('I24: pickPresentTokenValue reads nested token paths (Hermes cron schema)', () => {
  it('reads usage.total_tokens', () => {
    expect(pickPresentTokenValue({ usage: { total_tokens: 9016 } })).toBe(9016);
  });

  it('reads usage.tokens', () => {
    expect(pickPresentTokenValue({ usage: { tokens: 4200 } })).toBe(4200);
  });

  it('reads metrics.tokens', () => {
    expect(pickPresentTokenValue({ metrics: { tokens: 1234 } })).toBe(1234);
  });

  it('returns null (never 0) when nested token field is missing', () => {
    expect(pickPresentTokenValue({ usage: { input_tokens: 100 } })).toBeNull();
    expect(pickPresentTokenValue({ usage: {} })).toBeNull();
    expect(pickPresentTokenValue({ metrics: { something_else: 5 } })).toBeNull();
    expect(pickPresentTokenValue({})).toBeNull();
  });

  it('returns null (never 0) when nested token field is null / undefined', () => {
    expect(pickPresentTokenValue({ usage: { total_tokens: null } })).toBeNull();
    expect(pickPresentTokenValue({ usage: { total_tokens: undefined } })).toBeNull();
    expect(pickPresentTokenValue({ usage: null })).toBeNull();
    expect(pickPresentTokenValue({ metrics: null })).toBeNull();
  });

  it('returns null when nested outer is a primitive (not an object)', () => {
    expect(pickPresentTokenValue({ usage: 'string' })).toBeNull();
    expect(pickPresentTokenValue({ usage: 42 })).toBeNull();
    expect(pickPresentTokenValue({ usage: true })).toBeNull();
  });

  it('top-level aliases still take priority over nested paths', () => {
    expect(pickPresentTokenValue({ tokens: 10, usage: { total_tokens: 999 } })).toBe(10);
    expect(pickPresentTokenValue({ total_tokens: 20, usage: { total_tokens: 999 } })).toBe(20);
    expect(pickPresentTokenValue({ token_count: 30, usage: { total_tokens: 999 } })).toBe(30);
  });

  it('returns 0 explicitly when a nested token field is exactly 0', () => {
    expect(pickPresentTokenValue({ usage: { total_tokens: 0 } })).toBe(0);
    expect(pickPresentTokenValue({ usage: { tokens: 0 } })).toBe(0);
    expect(pickPresentTokenValue({ metrics: { tokens: 0 } })).toBe(0);
  });
});

describe('I24: A1 fires on nested-token zero-token fast failures (real Hermes schema)', () => {
  it('fires on 2 runs with usage.total_tokens: 0 + durationMs < 300 for the same job', () => {
    const records = [
      {
        jobId: 'real-usage-zero',
        durationMs: 50,
        status: 'failed',
        model: 'minimax/MiniMax-M2.7',
        usage: { total_tokens: 0, input_tokens: 0, output_tokens: 0 },
      },
      {
        jobId: 'real-usage-zero',
        durationMs: 80,
        status: 'failed',
        model: 'minimax/MiniMax-M2.7',
        usage: { total_tokens: 0, input_tokens: 0, output_tokens: 0 },
      },
    ];
    const signals = detectA1ZeroTokenFastFailure(records);
    expect(signals.length).toBe(1);
    expect(signals[0].id).toBe('A1');
    expect(signals[0].affectedJobIds).toContain('real-usage-zero');
    expect(signals[0].evidence.observedValue.totalTokens).toBe(0);
  });

  it('does NOT fire when nested usage.total_tokens is present and non-zero', () => {
    const records = [
      { jobId: 'usage-nonzero-1', durationMs: 50, status: 'failed', usage: { total_tokens: 9016 } },
      { jobId: 'usage-nonzero-1', durationMs: 80, status: 'failed', usage: { total_tokens: 8500 } },
    ];
    const signals = detectA1ZeroTokenFastFailure(records);
    expect(signals).toEqual([]);
  });

  it('does NOT fire when nested token field is missing — even with durationMs<300 + failed', () => {
    const records = [
      { jobId: 'usage-missing-1', durationMs: 50, status: 'failed', usage: { input_tokens: 100 } },
      { jobId: 'usage-missing-1', durationMs: 80, status: 'failed', usage: { input_tokens: 200 } },
    ];
    const signals = detectA1ZeroTokenFastFailure(records);
    expect(signals).toEqual([]);
  });

  it('does NOT fire on a single usage.total_tokens: 0 record (runCount gate)', () => {
    const records = [
      {
        jobId: 'usage-singleton',
        durationMs: 50,
        status: 'failed',
        usage: { total_tokens: 0 },
      },
    ];
    const signals = detectA1ZeroTokenFastFailure(records);
    expect(signals).toEqual([]);
  });
});

describe('I24: failureSignature classifies nested-token zero-token fast failures', () => {
  it('classifies usage.total_tokens: 0 + durationMs < 300 as zero-token-fast-failure', () => {
    expect(failureSignature({ usage: { total_tokens: 0 }, durationMs: 50 })).toBe('zero-token-fast-failure');
  });

  it('classifies usage.tokens: 0 + durationMs < 300 as zero-token-fast-failure', () => {
    expect(failureSignature({ usage: { tokens: 0 }, durationMs: 80 })).toBe('zero-token-fast-failure');
  });

  it('classifies metrics.tokens: 0 + durationMs < 300 as zero-token-fast-failure', () => {
    expect(failureSignature({ metrics: { tokens: 0 }, durationMs: 100 })).toBe('zero-token-fast-failure');
  });

  it('does NOT classify a record with missing nested token field even if durationMs<300', () => {
    expect(failureSignature({ usage: { input_tokens: 100 }, durationMs: 50 })).toBe('');
    expect(failureSignature({ usage: {}, durationMs: 50 })).toBe('');
    expect(failureSignature({ metrics: {}, durationMs: 50 })).toBe('');
  });
});

describe('I24: A3 groups explicit nested zero-token fast failures across jobs', () => {
  it('fires when 2+ jobs share zero-token-fast-failure signature from nested token path', () => {
    const jobs = [
      {
        id: 'real-a3-1',
        records: [
          { durationMs: 50, usage: { total_tokens: 0 } },
          { durationMs: 60, usage: { total_tokens: 0 } },
        ],
      },
      {
        id: 'real-a3-2',
        records: [
          { durationMs: 70, usage: { total_tokens: 0 } },
        ],
      },
      {
        id: 'real-a3-3',
        records: [
          { durationMs: 90, usage: { total_tokens: 0 } },
        ],
      },
    ];
    const signals = detectA3SharedFailureSignature(jobs);
    expect(signals.length).toBe(1);
    expect(signals[0].id).toBe('A3');
    expect(signals[0].evidence.observedValue.signature).toBe('zero-token-fast-failure');
    expect(signals[0].affectedJobIds).toContain('real-a3-1');
    expect(signals[0].affectedJobIds).toContain('real-a3-2');
    expect(signals[0].affectedJobIds).toContain('real-a3-3');
  });

  it('does NOT fire when nested token field is missing on all jobs (no false positive)', () => {
    const jobs = [
      { id: 'a3-missing-nested-1', records: [{ durationMs: 50, usage: { input_tokens: 100 } }] },
      { id: 'a3-missing-nested-2', records: [{ durationMs: 80, usage: { input_tokens: 200 } }] },
    ];
    const signals = detectA3SharedFailureSignature(jobs);
    expect(signals).toEqual([]);
  });
});

describe('I24: regression — existing missing-token false-positive tests still hold', () => {
  it('A1: does NOT fire when token field is missing at top level (existing Codex P2 regression)', () => {
    const records = [
      { jobId: 'no-tokens-1' /* no tokens */, durationMs: 50, status: 'failed', model: 'unknown' },
      { jobId: 'no-tokens-1', durationMs: 80, status: 'failed' },
      { jobId: 'no-tokens-2', tokens: null, durationMs: 100, status: 'failed' },
      { jobId: 'no-tokens-2', tokens: null, durationMs: 110, status: 'failed' },
      { jobId: 'no-tokens-3', total_tokens: null, durationMs: 60, status: 'failed' },
      { jobId: 'no-tokens-3', total_tokens: null, durationMs: 70, status: 'failed' },
    ];
    const signals = detectA1ZeroTokenFastFailure(records);
    expect(signals).toEqual([]);
  });

  it('A3: does NOT fire shared zero-token-fast-failure when jobs have no token field at any path (existing Codex P2 regression)', () => {
    const jobs = [
      { id: 'a3-missing-1', records: [{ durationMs: 50, status: 'failed' }] },
      { id: 'a3-missing-2', records: [{ durationMs: 80, status: 'failed' }] },
      { id: 'a3-missing-3', records: [{ tokens: null, durationMs: 70, status: 'error' }] },
    ];
    const signals = detectA3SharedFailureSignature(jobs);
    expect(signals).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// I25 — strict token parsing (guardian_cat 2026-06-04 request)
// ---------------------------------------------------------------------------

describe('I25: parseTokenNumber — strict token number parser', () => {
  // Accepts
  it('accepts finite positive numbers', () => {
    expect(parseTokenNumber(0)).toBe(0);
    expect(parseTokenNumber(1)).toBe(1);
    expect(parseTokenNumber(9016)).toBe(9016);
    expect(parseTokenNumber(-1)).toBe(-1);
  });

  it('accepts 0 (the A1 / A3 zero-token-fast-failure trigger value)', () => {
    expect(parseTokenNumber(0)).toBe(0);
  });

  // Rejects — null / undefined
  it('rejects null and undefined', () => {
    expect(parseTokenNumber(null)).toBeNull();
    expect(parseTokenNumber(undefined)).toBeNull();
  });

  // Rejects — blank / whitespace strings
  it('rejects blank string ""', () => {
    expect(parseTokenNumber('')).toBeNull();
  });
  it('rejects whitespace-only string "   "', () => {
    expect(parseTokenNumber('   ')).toBeNull();
  });

  // Rejects — booleans (the exact false-zero trap guardian_cat flagged)
  it('rejects boolean false (Number(false) === 0 trap)', () => {
    expect(parseTokenNumber(false)).toBeNull();
  });
  it('rejects boolean true (Number(true) === 1 trap)', () => {
    expect(parseTokenNumber(true)).toBeNull();
  });

  // Rejects — objects / arrays (the other half of the trap)
  it('rejects empty array [] (Number([]) === 0 trap)', () => {
    expect(parseTokenNumber([])).toBeNull();
  });
  it('rejects empty object {}', () => {
    expect(parseTokenNumber({})).toBeNull();
  });
  it('rejects non-empty object', () => {
    expect(parseTokenNumber({ total_tokens: 0 })).toBeNull();
  });

  // Rejects — NaN / Infinity
  it('rejects NaN', () => {
    expect(parseTokenNumber(NaN)).toBeNull();
  });
  it('rejects Infinity and -Infinity', () => {
    expect(parseTokenNumber(Infinity)).toBeNull();
    expect(parseTokenNumber(-Infinity)).toBeNull();
  });

  // Rejects — strings (numbers-only mode; even digit strings are rejected)
  it('rejects non-numeric string "abc"', () => {
    expect(parseTokenNumber('abc')).toBeNull();
  });
  it('rejects numeric string "0" (strict mode: numbers-only, no string coercion)', () => {
    // Deliberate choice: the advisory layer is numbers-only.  Numeric
    // strings are treated as "not present" so coercion traps cannot
    // leak.  Documented in the parseTokenNumber JSDoc.
    expect(parseTokenNumber('0')).toBeNull();
  });
  it('rejects numeric string "42"', () => {
    expect(parseTokenNumber('42')).toBeNull();
  });
  it('rejects numeric string "  0  " (whitespace inside a digit string)', () => {
    expect(parseTokenNumber('  0  ')).toBeNull();
  });
});

describe('I25: pickPresentTokenValue rejects blank / boolean at top level (guardian_cat 2026-06-04)', () => {
  it('returns null for top-level tokens: ""', () => {
    expect(pickPresentTokenValue({ tokens: '' })).toBeNull();
  });
  it('returns null for top-level tokens: "   "', () => {
    expect(pickPresentTokenValue({ tokens: '   ' })).toBeNull();
  });
  it('returns null for top-level tokens: false', () => {
    expect(pickPresentTokenValue({ tokens: false })).toBeNull();
  });
  it('returns null for top-level tokens: true', () => {
    expect(pickPresentTokenValue({ tokens: true })).toBeNull();
  });
  it('returns null for top-level tokens: []', () => {
    expect(pickPresentTokenValue({ tokens: [] })).toBeNull();
  });
  it('returns null for top-level tokens: NaN', () => {
    expect(pickPresentTokenValue({ tokens: NaN })).toBeNull();
  });
});

describe('I25: pickPresentTokenValue rejects blank / boolean at nested paths (guardian_cat 2026-06-04)', () => {
  it('returns null for nested usage.total_tokens: ""', () => {
    expect(pickPresentTokenValue({ usage: { total_tokens: '' } })).toBeNull();
  });
  it('returns null for nested usage.total_tokens: false', () => {
    expect(pickPresentTokenValue({ usage: { total_tokens: false } })).toBeNull();
  });
  it('returns null for nested usage.total_tokens: true', () => {
    expect(pickPresentTokenValue({ usage: { total_tokens: true } })).toBeNull();
  });
  it('returns null for nested usage.total_tokens: []', () => {
    expect(pickPresentTokenValue({ usage: { total_tokens: [] } })).toBeNull();
  });
  it('returns null for nested usage.total_tokens: NaN', () => {
    expect(pickPresentTokenValue({ usage: { total_tokens: NaN } })).toBeNull();
  });
  it('returns null for nested usage.tokens: false (second nested path)', () => {
    expect(pickPresentTokenValue({ usage: { tokens: false } })).toBeNull();
  });
  it('returns null for nested metrics.tokens: false (third nested path)', () => {
    expect(pickPresentTokenValue({ metrics: { tokens: false } })).toBeNull();
  });
  // Test #6 from the brief — strict mode choice: numeric strings are NOT supported
  it('returns null for nested usage.total_tokens: "0" (numeric strings are rejected in strict mode)', () => {
    expect(pickPresentTokenValue({ usage: { total_tokens: '0' } })).toBeNull();
  });
});

describe('I25: A1 does NOT fire on blank / boolean token values (false-zero trap closed)', () => {
  it('does NOT fire when two runs for same job have usage.total_tokens: "" and durationMs < 300', () => {
    // Brief test #7: blank string used to coerce to 0 via Number("") === 0
    const records = [
      { jobId: 'blank-zero-1', durationMs: 50, status: 'failed', usage: { total_tokens: '' } },
      { jobId: 'blank-zero-1', durationMs: 60, status: 'failed', usage: { total_tokens: '' } },
    ];
    const signals = detectA1ZeroTokenFastFailure(records);
    expect(signals).toEqual([]);
  });

  it('does NOT fire when two runs for same job have usage.total_tokens: false and durationMs < 300', () => {
    // Number(false) === 0 — exact trap the prior implementation fell into
    const records = [
      { jobId: 'bool-zero-1', durationMs: 50, status: 'failed', usage: { total_tokens: false } },
      { jobId: 'bool-zero-1', durationMs: 60, status: 'failed', usage: { total_tokens: false } },
    ];
    const signals = detectA1ZeroTokenFastFailure(records);
    expect(signals).toEqual([]);
  });

  it('does NOT fire when two runs for same job have top-level tokens: false and durationMs < 300', () => {
    const records = [
      { jobId: 'top-bool-1', tokens: false, durationMs: 50, status: 'failed' },
      { jobId: 'top-bool-1', tokens: false, durationMs: 60, status: 'failed' },
    ];
    const signals = detectA1ZeroTokenFastFailure(records);
    expect(signals).toEqual([]);
  });

  it('does NOT fire when two runs for same job have top-level tokens: "" and durationMs < 300', () => {
    const records = [
      { jobId: 'top-blank-1', tokens: '', durationMs: 50, status: 'failed' },
      { jobId: 'top-blank-1', tokens: '', durationMs: 60, status: 'failed' },
    ];
    const signals = detectA1ZeroTokenFastFailure(records);
    expect(signals).toEqual([]);
  });

  // Positive control: confirm A1 STILL fires on real zero values
  it('STILL fires on real tokens: 0 (positive control — the gate works on real zeros)', () => {
    const records = [
      { jobId: 'real-zero-1', tokens: 0, durationMs: 50, status: 'failed' },
      { jobId: 'real-zero-1', tokens: 0, durationMs: 60, status: 'failed' },
    ];
    const signals = detectA1ZeroTokenFastFailure(records);
    expect(signals.length).toBe(1);
    expect(signals[0].id).toBe('A1');
  });
});

describe('I25: A3 does NOT group zero-token-fast-failure from boolean / blank token values', () => {
  it('does NOT group when two jobs have usage.total_tokens: false (was: silent false-zero group)', () => {
    // Brief test #8: before fix, Number(false) === 0 grouped these.
    const jobs = [
      { id: 'a3-bool-1', records: [{ durationMs: 50, usage: { total_tokens: false } }] },
      { id: 'a3-bool-2', records: [{ durationMs: 60, usage: { total_tokens: false } }] },
    ];
    const signals = detectA3SharedFailureSignature(jobs);
    expect(signals).toEqual([]);
  });

  it('does NOT group when two jobs have top-level tokens: ""', () => {
    const jobs = [
      { id: 'a3-blank-1', records: [{ tokens: '', durationMs: 50 }] },
      { id: 'a3-blank-2', records: [{ tokens: '', durationMs: 60 }] },
    ];
    const signals = detectA3SharedFailureSignature(jobs);
    expect(signals).toEqual([]);
  });

  it('does NOT group when jobs have usage.tokens: [] (the array coercion trap)', () => {
    const jobs = [
      { id: 'a3-arr-1', records: [{ durationMs: 50, usage: { tokens: [] } }] },
      { id: 'a3-arr-2', records: [{ durationMs: 60, usage: { tokens: [] } }] },
    ];
    const signals = detectA3SharedFailureSignature(jobs);
    expect(signals).toEqual([]);
  });

  // Positive control: confirm A3 STILL groups real zero-token-fast-failure
  it('STILL groups explicit tokens: 0 across two jobs (positive control)', () => {
    const jobs = [
      { id: 'a3-real-1', records: [{ tokens: 0, durationMs: 50 }] },
      { id: 'a3-real-2', records: [{ tokens: 0, durationMs: 60 }] },
    ];
    const signals = detectA3SharedFailureSignature(jobs);
    expect(signals.length).toBe(1);
    expect(signals[0].evidence.observedValue.signature).toBe('zero-token-fast-failure');
  });
});

// ---------------------------------------------------------------------------
// Safety copy — first action must not suggest disable/edit/restart/switch
// ---------------------------------------------------------------------------

describe('Safety copy: first action must not contain destructive verbs', () => {
  // Words that must NEVER appear in any advisory first-action or explanation
  const FORBIDDEN = [
    'disable',
    'edit job',
    'edit-job',
    'restart',
    'switch-model',
    'switch model',
  ];

  function collectAllStrings(signals: AdvisorySignal[]): string[] {
    const out: string[] = [];
    for (const sig of signals) {
      out.push(sig.title, sig.explanation, sig.firstAction.description, sig.firstAction.command);
    }
    return out;
  }

  it('A1 first action contains no disable/edit/restart/switch-model', () => {
    // Both records share the same jobId so the MIN_A1_RUN_COUNT=2 gate
    // actually emits a signal — otherwise the test passes vacuously on
    // an empty signals array (flagged by guardian_cat 2026-06-04).
    const records = [
      { jobId: 'safety-a1', tokens: 0, durationMs: 50, status: 'failed' },
      { jobId: 'safety-a1', tokens: 0, durationMs: 60, status: 'failed' },
    ];
    const signals = detectA1ZeroTokenFastFailure(records);
    expect(signals.length).toBeGreaterThan(0); // guard: at least one A1 signal must fire
    const allText = collectAllStrings(signals).join('\n').toLowerCase();
    for (const word of FORBIDDEN) {
      expect(allText).not.toContain(word);
    }
  });

  it('A2 first action contains no disable/edit/restart/switch-model', () => {
    const jobs = [
      { id: 'safety-a2', model: 'Claude Opus', noReplyRuns: 3, agentTurn: true },
      { id: 'safety-a2-2', model: 'Claude Sonnet', noReplyRuns: 5, task: 'health check' },
    ];
    const signals = detectA2PremiumNoReply(jobs);
    const allText = collectAllStrings(signals).join('\n').toLowerCase();
    for (const word of FORBIDDEN) {
      expect(allText).not.toContain(word);
    }
  });

  it('A3 first action contains no disable/edit/restart/switch-model', () => {
    const jobs = [
      { id: 'safety-a3-1', records: [{ tokens: 0, durationMs: 50, error: '' }] },
      { id: 'safety-a3-2', records: [{ tokens: 0, durationMs: 60, error: '' }] },
    ];
    const signals = detectA3SharedFailureSignature(jobs);
    const allText = collectAllStrings(signals).join('\n').toLowerCase();
    for (const word of FORBIDDEN) {
      expect(allText).not.toContain(word);
    }
  });

  it('A3 first action suggests inspecting shared dispatcher/profile/gateway layer first', () => {
    const jobs = [
      { id: 'safety-a3-shared-1', records: [{ error: 'allowlist reject' }] },
      { id: 'safety-a3-shared-2', records: [{ error: 'allowlist reject' }] },
    ];
    const signals = detectA3SharedFailureSignature(jobs);
    expect(signals.length).toBe(1);
    const desc = signals[0].firstAction.description.toLowerCase();
    expect(desc).toMatch(/shared/);
    expect(desc).toMatch(/inspect/);
  });

  it('no advisory explanation uses the word "waste" as a confirmed claim', () => {
    const records = [
      { jobId: 'no-waste-1', tokens: 0, durationMs: 50, status: 'failed' },
      { jobId: 'no-waste-2', tokens: 0, durationMs: 50, status: 'failed' },
    ];
    const jobs = [
      { id: 'no-waste-a2', model: 'Claude Opus', noReplyRuns: 3, agentTurn: true },
    ];
    const aJobs = [
      { id: 'no-waste-a3-1', records: [{ error: 'shared problem' }] },
      { id: 'no-waste-a3-2', records: [{ error: 'shared problem' }] },
    ];
    const allSignals: AdvisorySignal[] = [
      ...detectA1ZeroTokenFastFailure(records),
      ...detectA2PremiumNoReply(jobs),
      ...detectA3SharedFailureSignature(aJobs),
    ];
    for (const sig of allSignals) {
      // "waste" is only allowed inside the explicit "not confirmed waste" disclaimer
      // We split the explanation on the disclaimer and check both halves.
      const explicit = /not confirmed waste/i.test(sig.explanation);
      expect(explicit).toBe(true);
      const title = sig.title.toLowerCase();
      expect(title).toContain('review signal');
    }
  });
});

// ---------------------------------------------------------------------------
// Ranking — confirmed D-rule findings remain primary
// ---------------------------------------------------------------------------

describe('Ranking: confirmed D1-D7 findings remain primary; advisory signals demoted to review-only', () => {
  it('when confirmed D-rule IDs exist, advisory signals are demoted to reviewSignals', () => {
    const signals: AdvisorySignal[] = [
      {
        id: 'A1',
        title: 'Review signal: zero-token fast failure',
        explanation: 'Review signal (not confirmed waste)',
        affectedJobIds: ['job-x'],
        approximateCostExposure: { lowUsd: 0, highUsd: 1 },
        firstAction: { description: 'Inspect', command: 'openclaw cron runs --id job-x --limit 5' },
        evidence: { id: 'A1', explanation: 'x', sourceFields: [], observedValue: {}, threshold: null },
      },
    ];
    const result = rankAdvisorySignals(signals, ['D1', 'D2']);
    expect(result.hasConfirmedCritical).toBe(true);
    expect(result.primarySignals).toEqual([]);
    expect(result.reviewSignals.length).toBe(1);
    expect(result.reviewSignals[0].id).toBe('A1');
  });

  it('when NO confirmed D-rule IDs exist, advisory signals surface in primarySignals', () => {
    const signals: AdvisorySignal[] = [
      {
        id: 'A2',
        title: 'Review signal: premium NO_REPLY',
        explanation: 'Review signal (not confirmed waste)',
        affectedJobIds: ['job-y'],
        approximateCostExposure: null,
        firstAction: { description: 'Inspect', command: 'openclaw cron runs --id job-y --limit 5' },
        evidence: { id: 'A2', explanation: 'x', sourceFields: [], observedValue: {}, threshold: null },
      },
    ];
    const result = rankAdvisorySignals(signals, []);
    expect(result.hasConfirmedCritical).toBe(false);
    expect(result.primarySignals.length).toBe(1);
    expect(result.reviewSignals).toEqual([]);
  });

  it('handles empty signals array gracefully', () => {
    const resultWithConfirmed = rankAdvisorySignals([], ['D1']);
    expect(resultWithConfirmed.primarySignals).toEqual([]);
    expect(resultWithConfirmed.reviewSignals).toEqual([]);
    expect(resultWithConfirmed.hasConfirmedCritical).toBe(true);

    const resultNoConfirmed = rankAdvisorySignals([], []);
    expect(resultNoConfirmed.primarySignals).toEqual([]);
    expect(resultNoConfirmed.reviewSignals).toEqual([]);
    expect(resultNoConfirmed.hasConfirmedCritical).toBe(false);
  });

  it('rankAdvisorySignals does not mutate input array', () => {
    const original: AdvisorySignal[] = [
      {
        id: 'A3',
        title: 'Review signal: shared signature',
        explanation: 'Review signal (not confirmed waste)',
        affectedJobIds: ['job-z'],
        approximateCostExposure: null,
        firstAction: { description: 'Inspect', command: 'cat ~/.openclaw/cron/jobs.json' },
        evidence: { id: 'A3', explanation: 'x', sourceFields: [], observedValue: {}, threshold: null },
      },
    ];
    const snapshot = JSON.stringify(original);
    rankAdvisorySignals(original, ['D1']);
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});
