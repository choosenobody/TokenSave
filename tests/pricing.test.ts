import { describe, it, expect } from 'vitest';
// @ts-nocheck
import { COST_RATES } from '../src/constants.ts';
import { detectCostRate } from '../src/pricing.ts';

describe('detectCostRate', () => {
  // Test 1: COST_RATES has exactly 7 entries
  it('COST_RATES has exactly 7 entries', () => {
    expect(COST_RATES).toHaveLength(7);
  });

  // Test 2: MiniMax M2.7
  it('MiniMax M2.7', () => {
    const r1 = detectCostRate("MiniMax M2.7");
    expect(r1.label).toBe("MiniMax M2.7");
    expect(r1.rate).toBe(0.14);
  });

  // Test 3: MiniMax M2.5
  it('MiniMax M2.5', () => {
    const r2 = detectCostRate("MiniMax M2.5");
    expect(r2.label).toBe("MiniMax M2.5");
    expect(r2.rate).toBe(0.12);
  });

  // Test 4: GPT-4o
  it('GPT-4o', () => {
    const r3 = detectCostRate("gpt-4o");
    expect(r3.label).toBe("GPT-4o");
    expect(r3.rate).toBe(2.5);
  });

  // Test 5: Claude Sonnet
  it('Claude Sonnet', () => {
    const r4 = detectCostRate("sonnet");
    expect(r4.label).toBe("Claude Sonnet");
    expect(r4.rate).toBe(3);
  });

  // Test 6: Claude Opus
  it('Claude Opus', () => {
    const r5 = detectCostRate("opus");
    expect(r5.label).toBe("Claude Opus");
    expect(r5.rate).toBe(15);
  });

  // Test 7: GPT-5-codex / codex
  it('GPT-5-codex / codex', () => {
    const r6 = detectCostRate("codex");
    expect(r6.label).toBe("GPT-5-codex");
    expect(r6.rate).toBe(15);
  });

  // Test 8: DeepSeek
  it('DeepSeek', () => {
    const r7 = detectCostRate("deepseek");
    expect(r7.label).toBe("DeepSeek Chat");
    expect(r7.rate).toBe(0.28);
  });

  // Test 9: Unknown model fallback
  it('Unknown model fallback', () => {
    const r8 = detectCostRate("unknown-model-xyz");
    expect(r8.label).toBe("MiniMax-M2.7 (default)");
    expect(r8.rate).toBe(0.14);
  });
});
