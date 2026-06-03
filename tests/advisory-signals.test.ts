import { describe, expect, it } from 'vitest';
import {
  buildReviewSignalOutput,
  diagnoseAdvisoryReviewSignals,
  diagnoseD1FailureLoopDetection,
} from '../src/rules';

describe('advisory review signals', () => {
  it('emits zero-token fast failure as a review signal only', () => {
    const [signal] = diagnoseAdvisoryReviewSignals([
      {
        id: 'fast-fail',
        totalTokens: 0,
        durationMs: 120,
        status: 'failed',
        model: null,
        output: '',
      },
    ]);

    expect(signal.signalId).toBe('A1_ZERO_TOKEN_FAST_FAILURE');
    expect(signal.kind).toBe('review-signal');
    expect(signal.message).toMatch(/Review signal/i);
    expect(signal.message).toMatch(/Not confirmed waste/i);
    expect(signal.evidence.observedValue).toMatchObject({
      totalTokens: 0,
      durationMs: 120,
    });
  });

  it('does not fire zero-token fast failure when available duration is not fast', () => {
    const signals = diagnoseAdvisoryReviewSignals([
      {
        id: 'slow-zero',
        totalTokens: 0,
        durationMs: 800,
        status: 'failed',
        output: '',
      },
    ]);

    expect(signals.some((signal) => signal.signalId === 'A1_ZERO_TOKEN_FAST_FAILURE')).toBe(false);
  });

  it('emits premium model plus repeated NO_REPLY as manual-verification review signal', () => {
    const signals = diagnoseAdvisoryReviewSignals([], [
      {
        jobId: 'heartbeat',
        model: 'Claude Opus',
        agentTurn: true,
        output: 'NO_REPLY',
      },
      {
        jobId: 'heartbeat',
        model: 'Claude Opus',
        agentTurn: true,
        output: 'NO_REPLY',
      },
    ]);

    const signal = signals.find((item) => item.signalId === 'A2_PREMIUM_MODEL_LOW_VALUE_OUTPUT');
    expect(signal).toBeDefined();
    expect(signal!.message).toMatch(/Manual verification is required/i);
    expect(signal!.message).toMatch(/before any model or schedule change/i);
    expect(signal!.safetyBoundary).toMatch(/No precise savings claim/i);
  });

  it('does not treat unknown or missing model as cheap pricing for premium NO_REPLY signal', () => {
    const signals = diagnoseAdvisoryReviewSignals([], [
      {
        jobId: 'unknown-model',
        model: 'unknown-frontier-model',
        agentTurn: true,
        output: 'NO_REPLY',
      },
      {
        jobId: 'unknown-model',
        model: 'unknown-frontier-model',
        agentTurn: true,
        output: 'NO_REPLY',
      },
    ]);

    expect(signals.some((signal) => signal.signalId === 'A2_PREMIUM_MODEL_LOW_VALUE_OUTPUT')).toBe(false);
  });

  it('emits cross-job shared failure signature with shared-layer inspect guidance', () => {
    const signals = diagnoseAdvisoryReviewSignals([], [
      {
        jobId: 'job-a',
        status: 'failed',
        error: 'dispatcher rejected missing profile',
      },
      {
        jobId: 'job-b',
        status: 'failed',
        error: 'dispatcher rejected missing profile',
      },
    ]);

    const signal = signals.find((item) => item.signalId === 'A3_CROSS_JOB_SHARED_FAILURE_SIGNATURE');
    expect(signal).toBeDefined();
    expect(signal!.affectedJobIds).toEqual(['job-a', 'job-b']);
    expect(signal!.message).toMatch(/dispatcher\/profile\/gateway/i);
    expect(signal!.firstAction).toMatch(/Inspect first/i);
    expect(signal!.firstAction).toMatch(/read-only inspection/i);
    expect(signal!.safetyBoundary).toMatch(/Do not directly disable jobs/i);
  });

  it('keeps first action copy free of mutation-first commands', () => {
    const signals = diagnoseAdvisoryReviewSignals([], [
      { jobId: 'a', status: 'failed', error: 'allowlist reject: profile x' },
      { jobId: 'b', status: 'failed', error: 'allowlist reject: profile y' },
      { jobId: 'premium', model: 'GPT-5-codex', agentTurn: true, output: 'NO_REPLY' },
      { jobId: 'premium', model: 'GPT-5-codex', agentTurn: true, output: 'NO_REPLY' },
    ]);

    for (const signal of signals) {
      expect(signal.firstAction.toLowerCase()).not.toMatch(/\b(disable|edit|restart|switch-model)\b/);
      expect(signal.firstAction).toMatch(/Inspect first/i);
    }
  });

  it('keeps confirmed D1-D7 findings primary and advisory signals separated', () => {
    const confirmed = diagnoseD1FailureLoopDetection({
      id: 'confirmed-loop',
      totalRuns: 5,
      errorRuns: 5,
    });
    const advisorySignals = diagnoseAdvisoryReviewSignals([
      {
        id: 'fast-fail',
        totalTokens: 0,
        durationMs: 50,
        status: 'failed',
      },
    ]);
    const output = buildReviewSignalOutput(confirmed ? [confirmed] : [], advisorySignals);

    expect(output.confirmedFindings).toHaveLength(1);
    expect(output.confirmedFindings[0].ruleId).toBe('D1');
    expect(output.advisorySignals).toHaveLength(1);
    expect(output.advisorySignals[0].kind).toBe('review-signal');
  });
});
