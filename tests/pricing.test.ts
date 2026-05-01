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
    expect(r1.pricingSource).toBe("known-local");
  });

  // Test 3: MiniMax M2.5
  it('MiniMax M2.5', () => {
    const r2 = detectCostRate("MiniMax M2.5");
    expect(r2.label).toBe("MiniMax M2.5");
    expect(r2.rate).toBe(0.12);
    expect(r2.pricingSource).toBe("known-local");
  });

  // Test 4: GPT-4o
  it('GPT-4o', () => {
    const r3 = detectCostRate("gpt-4o");
    expect(r3.label).toBe("GPT-4o");
    expect(r3.rate).toBe(2.5);
    expect(r3.pricingSource).toBe("known-local");
  });

  // Test 5: Claude Sonnet
  it('Claude Sonnet', () => {
    const r4 = detectCostRate("sonnet");
    expect(r4.label).toBe("Claude Sonnet");
    expect(r4.rate).toBe(3);
    expect(r4.pricingSource).toBe("known-local");
  });

  // Test 6: Claude Opus
  it('Claude Opus', () => {
    const r5 = detectCostRate("opus");
    expect(r5.label).toBe("Claude Opus");
    expect(r5.rate).toBe(15);
    expect(r5.pricingSource).toBe("known-local");
  });

  // Test 7: GPT-5-codex / codex
  it('GPT-5-codex / codex', () => {
    const r6 = detectCostRate("codex");
    expect(r6.label).toBe("GPT-5-codex");
    expect(r6.rate).toBe(15);
    expect(r6.pricingSource).toBe("known-local");
  });

  // Test 8: DeepSeek
  it('DeepSeek', () => {
    const r7 = detectCostRate("deepseek");
    expect(r7.label).toBe("DeepSeek Chat");
    expect(r7.rate).toBe(0.28);
    expect(r7.pricingSource).toBe("known-local");
  });

  // Test 9: Unknown model fallback
  it('Unknown model fallback', () => {
    const r8 = detectCostRate("unknown-model-xyz");
    expect(r8.label).toBe("Unknown model (conservative estimate)");
    expect(r8.rate).toBe(15);
    expect(r8.pricingSource).toBe("conservative-estimate");
  });
});

describe('COST_RATES metadata fields', () => {
  it('COST_RATES has exactly 7 entries', () => {
    expect(COST_RATES).toHaveLength(7);
  });

  it('every entry has source, sourceType, checkedDate, status, approximationNote', () => {
    for (const entry of COST_RATES) {
      expect(entry).to.have.property('source');
      expect(entry).to.have.property('sourceType');
      expect(entry).to.have.property('checkedDate');
      expect(entry).to.have.property('status');
      expect(entry).to.have.property('approximationNote');
    }
  });

  it('all entries are marked unverified/unknown for this slice', () => {
    for (const entry of COST_RATES) {
      expect(entry.source).to.equal(null);
      expect(entry.sourceType).to.equal('unverified');
      expect(entry.checkedDate).to.equal(null);
      expect(entry.status).to.equal('unknown');
    }
  });

  it('existing detectCostRate behavior unchanged — all known models still pass', () => {
    const models = [
      { name: 'MiniMax M2.7', label: 'MiniMax M2.7', rate: 0.14 },
      { name: 'MiniMax M2.5', label: 'MiniMax M2.5', rate: 0.12 },
      { name: 'gpt-4o', label: 'GPT-4o', rate: 2.5 },
      { name: 'sonnet', label: 'Claude Sonnet', rate: 3 },
      { name: 'opus', label: 'Claude Opus', rate: 15 },
      { name: 'codex', label: 'GPT-5-codex', rate: 15 },
      { name: 'deepseek', label: 'DeepSeek Chat', rate: 0.28 },
    ];
    for (const m of models) {
      const r = detectCostRate(m.name);
      expect(r.label).toBe(m.label);
      expect(r.rate).toBe(m.rate);
      expect(r.pricingSource).toBe('known-local');
    }
  });

  it('unknown model still returns conservative estimate', () => {
    const r = detectCostRate('truly-unknown-xyz');
    expect(r.label).toBe('Unknown model (conservative estimate)');
    expect(r.rate).toBe(15);
    expect(r.pricingSource).toBe('conservative-estimate');
  });
});

describe('I4-B1: decouple premium-saving reference rate', () => {
  const fs = require('fs');
  const mainTs = fs.readFileSync('./src/main.ts', 'utf8');

  it('src/main.ts no longer contains hardcoded cheapRate = 0.14 literal', () => {
    expect(mainTs).not.toMatch(/const cheapRate\s*=\s*0\.14/);
  });

  it('src/main.ts uses detectCostRate for premium model saving', () => {
    expect(mainTs).toMatch(/detectCostRate\s*\(\s*["']MiniMax M2\.7["']\s*\)/);
  });

  it('premium model saving has safe guard for unknown/unsafe reference', () => {
    expect(mainTs).toMatch(/pricingSource\s*===\s*["']known-local["']/);
    expect(mainTs).toMatch(/isFinite\s*\(\s*minimaxRef\.rate\s*\)/);
    expect(mainTs).toMatch(/minimaxRef\.rate\s*>\s*0/);
  });
});