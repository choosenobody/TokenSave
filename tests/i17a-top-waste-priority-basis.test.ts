// @ts-nocheck
// I17-A: Top Waste priority basis — evidence-chain clarity for ranking transparency
//
// Tests verify:
// 1. All three Priority basis branches exist (Tier 1 / Tier 2 / Tier 3)
// 2. Wording avoids cost/saving/precise projection claims
// 3. Historical/disabled section does not receive Priority basis
// 4. No forbidden strings: "daily saving", "guaranteed", "precise", "cost/day", "auto-apply"
//
// Tests use source inspection (same pattern as i16-rar-import-guidance.test.ts)
// since renderTopWaste is module-scoped and DOM testing requires browser environment.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Extract buildPriorityBasisText by reading the source ────────────────────
function extractBuildPriorityBasisText() {
  const src = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8');
  const fnStart = src.indexOf('function buildPriorityBasisText(dailyWaste, perRunWaste) {');
  if (fnStart === -1) throw new Error('buildPriorityBasisText not found in src/main.ts');
  // Find closing brace: look for the "    function showError" that follows buildPriorityBasisText
  const afterFn = src.indexOf('\n\n    function showError', fnStart);
  // The closing brace of buildPriorityBasisText is the last } before the blank-line-before-showError
  let fnEnd = afterFn;
  // Walk backward to find that last }
  while (fnEnd > fnStart && src[fnEnd - 1] !== '}') fnEnd--;
  const fnBody = src.slice(fnStart, fnEnd);
  // formatInteger is used inside buildPriorityBasisText; mock it for isolated testing
  const wrapper = `(function(){
    function formatInteger(n) { return String(Math.round(Number(n))); }
    ${fnBody}
    return buildPriorityBasisText;
  })()`;
  // eslint-disable-next-line no-eval
  return eval(wrapper);
}

const buildPriorityBasisText = extractBuildPriorityBasisText();

// ── Fake job stub (minimal, satisfies the function signature) ───────────────
const fakeJob = { id: 'test', name: 'test-job' };

describe('I17-A: Top Waste priority basis', () => {

  // ── 1. All three Priority basis branches exist ─────────────────────────────

  it('1a. Tier 1: dailyWaste > 0 returns Tier 1 wording with token count', () => {
    const result = buildPriorityBasisText(12345.6, null);
    expect(result).toMatch(/^Priority basis: approx\./);
    expect(result).toMatch(/token waste\/day/);
    expect(result).toMatch(/schedule × estimated waste\/run/);
    expect(result).toMatch(/12346/); // rounded
  });

  it('1b. Tier 1 fires when dailyWaste > 0 even if perRunWaste > 0', () => {
    // Tier 1 takes priority over Tier 2 (same as ranking sort)
    const result = buildPriorityBasisText(999.9, 50.0);
    expect(result).toMatch(/token waste\/day/);
    expect(result).not.toMatch(/token waste\/run/);
  });

  it('1c. Tier 2: dailyWaste === null and perRunWaste > 0 returns Tier 2 wording', () => {
    const result = buildPriorityBasisText( null, 4321.0);
    expect(result).toMatch(/^Priority basis: approx\./);
    expect(result).toMatch(/token waste\/run/);
    expect(result).toMatch(/schedule unavailable/);
    expect(result).toMatch(/daily priority is not projected/);
    expect(result).toMatch(/4321/);
  });

  it('1d. Tier 2: dailyWaste === 0 and perRunWaste > 0 also returns Tier 2', () => {
    const result = buildPriorityBasisText( 0, 2500.5);
    expect(result).toMatch(/token waste\/run/);
    expect(result).not.toMatch(/token waste\/day/);
  });

  it('1e. Tier 3: both null/zero returns Tier 3 fallback wording', () => {
    const result = buildPriorityBasisText( null, null);
    expect(result).toBe('Priority basis: fallback ranking by tokens × error rate; import schedules and run history for stronger priority.');
  });

  it('1f. Tier 3: dailyWaste === 0 and perRunWaste === 0 returns Tier 3', () => {
    const result = buildPriorityBasisText( 0, 0);
    expect(result).toBe('Priority basis: fallback ranking by tokens × error rate; import schedules and run history for stronger priority.');
  });

  it('1g. Tier 1: dailyWaste === null, perRunWaste === null → Tier 3', () => {
    const result = buildPriorityBasisText( null, null);
    expect(result).toBe('Priority basis: fallback ranking by tokens × error rate; import schedules and run history for stronger priority.');
  });

  // ── 2. Wording avoids cost/saving/precise projection claims ─────────────────

  it('2a. Tier 1 uses "approx." not "guaranteed" or "precise"', () => {
    const result = buildPriorityBasisText( 5000, null);
    expect(result).toMatch(/approx\./);
    expect(result).not.toMatch(/guaranteed/i);
    expect(result).not.toMatch(/precise/i);
  });

  it('2b. Tier 2 uses "approx." not "guaranteed" or "precise"', () => {
    const result = buildPriorityBasisText( null, 3000);
    expect(result).toMatch(/approx\./);
    expect(result).not.toMatch(/guaranteed/i);
    expect(result).not.toMatch(/precise/i);
  });

  it('2c. No tier uses "daily saving" or "saving" language', () => {
    const t1 = buildPriorityBasisText( 5000, null);
    const t2 = buildPriorityBasisText( null, 3000);
    const t3 = buildPriorityBasisText( null, null);
    [t1, t2, t3].forEach(text => {
      expect(text).not.toMatch(/daily saving/i);
      expect(text).not.toMatch(/\bsaving\b/i);
    });
  });

  it('2d. No tier uses "cost/day" or cost projection language', () => {
    const t1 = buildPriorityBasisText( 5000, null);
    const t2 = buildPriorityBasisText( null, 3000);
    const t3 = buildPriorityBasisText( null, null);
    [t1, t2, t3].forEach(text => {
      expect(text).not.toMatch(/cost\/day/i);
      expect(text).not.toMatch(/\bcost\b/i); // cost word never appears in priority basis
    });
  });

  it('2e. No tier mentions "auto-apply"', () => {
    const t1 = buildPriorityBasisText( 5000, null);
    const t2 = buildPriorityBasisText( null, 3000);
    const t3 = buildPriorityBasisText( null, null);
    [t1, t2, t3].forEach(text => {
      expect(text).not.toMatch(/auto-apply/i);
    });
  });

  // ── 3. Forbidden strings absent from entire source file ─────────────────────

  it('3. priority basis output (buildPriorityBasisText) contains no forbidden strings', () => {
    // Check only the buildPriorityBasisText function body and its output, not pre-existing text
    const src = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8');
    const fnStart = src.indexOf('function buildPriorityBasisText(dailyWaste, perRunWaste) {');
    const fnEnd = src.indexOf('\n\n    function showError', fnStart);
    const fnBody = src.slice(fnStart, fnEnd);
    const forbidden = ['daily saving', 'guaranteed', 'cost/day', 'auto-apply'];
    forbidden.forEach(term => {
      expect(fnBody).not.toMatch(new RegExp(term, 'i'));
    });
    // "precise" already exists in pre-existing summary help text (line 621), not in new code
    expect(fnBody).not.toMatch(/precise/i);
  });

  // ── 4. renderTopWaste gates priorityBasis on !isSynthetic && !isDisabled ────

  it('4a. renderTopWaste source shows priorityBasis gated on !isSynthetic && !isDisabled', () => {
    const src = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8');
    // The guard must appear inside the sortedWaste.map callback, before buildPriorityBasisText call
    const mapCallbackStart = src.indexOf('wasteList.innerHTML = sortedWaste.map((job, rank) => {');
    const mapCallbackEnd = src.indexOf('}).join("");', mapCallbackStart) + '}).join("");'.length;
    const mapCallback = src.slice(mapCallbackStart, mapCallbackStart + 3000);

    // priorityBasis must only be set for active (non-synthetic, non-disabled) jobs
    expect(mapCallback).toMatch(/priorityBasis = \(\!isSynthetic && \!isDisabled\)/);
    // buildPriorityBasisText must appear in the map callback
    expect(mapCallback).toMatch(/buildPriorityBasisText\(/);
    // The gated priorityBasis must be used in the template
    expect(mapCallback).toMatch(/\$\{priorityBasis \? .*?priorityBasis.*? : ''\}/);
  });

  it('4b. Historical/disabled jobs have no priorityBasis in renderTopWaste template', () => {
    const src = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8');
    // Historical section (separate from active map) should NOT call buildPriorityBasisText
    const histSectionStart = src.indexOf("historicalJobs && historicalJobs.length");
    const histSection = src.slice(histSectionStart, histSectionStart + 2000);
    expect(histSection).not.toMatch(/buildPriorityBasisText/);
    expect(histSection).not.toMatch(/priorityBasis/);
  });

  // ── 5. No ranking algorithm changes ─────────────────────────────────────────

  it('5. renderTopWaste tier-sort logic is unchanged from main.ts HEAD', () => {
    const src = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8');
    // The 3-tier sort must still be present (no changes to sorting logic)
    expect(src).toMatch(/Tier 1: positive estimatedDailyWasteTokens/);
    expect(src).toMatch(/Tier 2: positive estimatedWastePerRun/);
    expect(src).toMatch(/Tier 3: totalTokens × errorRate/);
    // These must appear in the sort comparator, NOT modified
    expect(src).toMatch(/const aDaily = estimateDailyWasteTokens\(a, cheapRate\)/);
    expect(src).toMatch(/const bDaily = estimateDailyWasteTokens\(b, cheapRate\)/);
  });

  // ── 6. Helper imports unchanged ─────────────────────────────────────────────

  it('6. estimateDailyWasteTokens and estimateWastePerRun already imported in main.ts', () => {
    const src = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8');
    const importLine = src.slice(0, src.indexOf('const state = {'));
    expect(importLine).toMatch(/estimateDailyWasteTokens/);
    expect(importLine).toMatch(/estimateWastePerRun/);
  });
});

// ── I18-C: Top Waste subtitle accuracy ─────────────────────────────────────
// I18-C: subtitle must reflect actual 3-tier ranking, not flat absolute tokens

describe('I18-C: Top Waste subtitle reflects actual tier ranking', () => {

  it('old stale subtitle "Ranked by absolute wasted tokens" is absent from index.html', () => {
    const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
    expect(html).not.toMatch(/Ranked by absolute wasted tokens/);
  });

  it('updated subtitle "Ranked by recurring token waste" is present in index.html', () => {
    const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
    expect(html).toMatch(/Ranked by recurring token waste/);
  });

  it('new subtitle mentions tokens/day first', () => {
    const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
    expect(html).toMatch(/tokens\/day/);
  });

  it('new subtitle mentions fallback tokens × error rate', () => {
    const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
    expect(html).toMatch(/fallback tokens × error rate/);
  });
});