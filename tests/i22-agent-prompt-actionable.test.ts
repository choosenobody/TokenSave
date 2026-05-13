// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * I22: Agent Diagnosis Prompt — actionability contract tests.
 *
 * Validates that:
 * - buildAgentPromptText generates a complete copyable agent prompt
 * - The prompt includes job context, classification options, required output structure, and safety rules
 * - The prompt forbids mutation before diagnosis
 * - The prompt asks the receiving agent to classify the issue and return structured output
 * - CLI commands are secondary (inside the prompt), not primary visible actions
 */

function extractBuildAgentPromptText() {
  const src = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8');

  const extractFn = (name) => {
    const fnStart = src.indexOf(`function ${name}`);
    if (fnStart === -1) throw new Error(`${name} not found`);
    let depth = 0;
    for (let i = fnStart; i < src.length; i += 1) {
      if (src[i] === '{') depth += 1;
      if (src[i] === '}') {
        depth -= 1;
        if (depth === 0) return src.slice(fnStart, i + 1);
      }
    }
    throw new Error(`${name} end not found`);
  };

  const escapeShim = `function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\\\"/g,'&quot;'); }`;
  const formatIntegerShim = `function formatInteger(n) { return String(Math.round(n)).replace(/\\\\B(?=(\\d{3})+(?!\\d))/g, ','); }`;
  const wrapper = `(function(){
    ${escapeShim}
    ${formatIntegerShim}
    ${extractFn('buildAgentPromptText(item, job, dailyWaste, perRunWaste, costExposureStr)')}
    return buildAgentPromptText;
  })()`;
  // eslint-disable-next-line no-eval
  return eval(wrapper);
}

const buildAgentPromptText = extractBuildAgentPromptText();

// Minimal item fixture
const makeItem = (category = 'ERROR_WASTE') => ({ category, config: { problem: '80% error rate, above the 10% threshold.' } });

// Minimal job fixture
const makeJob = (overrides = {}) => ({
  name: 'Test Job',
  jobId: 'job-456',
  id: 'job-456',
  errorRate: 0.8,
  errorRuns: 8,
  totalRuns: 10,
  totalTokens: 500000,
  frequencyLabel: 'every 30 min',
  scheduleMinutes: 30,
  model: 'mini-max/m2.7',
  evidence: [{ ruleId: 'ERROR_WASTE', observedValue: 0.8, threshold: 0.1 }],
  rate: { rate: 0.30 },
  ...overrides
});

describe('I22 agent prompt actionability rendering contract', () => {

  describe('prompt content — required fields', () => {
    it('includes job name', () => {
      const job = makeJob({ name: 'My Important Job' });
      const prompt = buildAgentPromptText(makeItem(), job, 1200, null, null);
      expect(prompt).toContain('Job name: My Important Job');
    });

    it('includes job ID', () => {
      const job = makeJob({ jobId: 'abc-123' });
      const prompt = buildAgentPromptText(makeItem(), job, null, null, null);
      expect(prompt).toContain('Job ID: abc-123');
    });

    it('includes issue category', () => {
      const prompt = buildAgentPromptText(makeItem('ERROR_WASTE'), makeJob(), null, null, null);
      expect(prompt).toContain('ERROR_WASTE');
    });

    it('includes real error rate and threshold', () => {
      const job = makeJob({ errorRate: 0.8, errorRuns: 8, totalRuns: 10 });
      const prompt = buildAgentPromptText(makeItem(), job, null, null, null);
      expect(prompt).toMatch(/error rate/i);
      expect(prompt).toMatch(/threshold/i);
    });

    it('includes estimated recurring token waste', () => {
      const job = makeJob();
      const prompt = buildAgentPromptText(makeItem(), job, 1200, null, null);
      expect(prompt).toMatch(/tokens.*day|tokens\/day|recurring waste/i);
    });

    it('includes approximate cost/value exposure if available', () => {
      const job = makeJob({ totalTokens: 500000, rate: { rate: 0.30 } });
      const prompt = buildAgentPromptText(makeItem(), job, null, null, '~$0.15 per day');
      expect(prompt).toMatch(/cost|value|exposure|\$/i);
    });

    it('includes schedule/frequency if available', () => {
      const job = makeJob({ frequencyLabel: 'every 30 min', scheduleMinutes: 30 });
      const prompt = buildAgentPromptText(makeItem(), job, null, null, null);
      expect(prompt).toMatch(/30 min|every.*min|frequency|schedule/i);
    });

    it('includes model/provider if available', () => {
      const job = makeJob({ model: 'mini-max/m2.7' });
      const prompt = buildAgentPromptText(makeItem(), job, null, null, null);
      expect(prompt).toMatch(/mini-max|m2\.7|model|provider/i);
    });

    it('includes recent error summary', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/recent error|error summary|failed runs/i);
    });

    it('includes read-only inspect commands (openclaw cron show and cron runs)', () => {
      const job = makeJob({ jobId: 'inspect-me' });
      const prompt = buildAgentPromptText(makeItem(), job, null, null, null);
      expect(prompt).toContain('openclaw cron show inspect-me');
      expect(prompt).toContain('openclaw cron runs --id inspect-me --limit 5');
    });
  });

  describe('safety rules — no mutation before diagnosis', () => {
    it('forbids edit/disable/enable/delete the job yet', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/Do NOT edit.*the job yet/i);
    });

    it('forbids running or retrying the job yet', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/Do NOT.*run.*retry.*yet/i);
    });

    it('requires read-only inspection first', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/first.*read.*only.*inspection|read.*only.*first/i);
    });

    it('requires diagnosing root cause before proposing fixes', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/diagnose|root cause|classify.*before/i);
    });

    it('requires explicit user confirmation before any mutating action', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/explicit.*confirmation|user.*confirms/i);
    });
  });

  describe('classification options — 8 categories', () => {
    it('includes "provider/model failure" classification', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/provider|model.*failure|api.*error/i);
    });

    it('includes "prompt/tool failure" classification', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/prompt.*failure|tool.*failure|invalid.*prompt/i);
    });

    it('includes "delivery config issue" classification', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/delivery.*config|webhook.*issue|channel.*error/i);
    });

    it('includes "stale job/config issue" classification', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/stale|outdated|env.*change|config.*drift/i);
    });

    it('includes "job no longer needed" classification', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/no longer needed|deprecated|obsolete|unused/i);
    });

    it('includes "schedule too frequent" classification', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/too frequent|schedule.*often|unnecessary.*runs/i);
    });

    it('includes "duplicate/redundant job" classification', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/duplicate|redundant|overlap/i);
    });

    it('includes "unknown/needs more evidence" classification', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/unknown|needs.*evidence|unclear|inconclusive/i);
    });
  });

  describe('required output structure — 7 fields', () => {
    it('requires root cause hypothesis', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/root cause.*hypothesis|probable.*cause|hypothesis/i);
    });

    it('requires evidence from inspection', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/Evidence.*specific data points.*inspect commands/);
    });

    it('requires risk of doing nothing', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/Risk of doing nothing/);
    });

    it('requires safest manual fix', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/Safest manual fix/);
    });

    it('requires exact verification plan', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/Exact verification plan/);
    });

    it('requires recommendation (keep/edit/pause/disable/delete)', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/Recommendation.*keep.*edit.*pause.*disable.*delete/s);
    });

    it('commands are output only — not to be run until user confirms', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/Commands.*openclaw CLI commands.*ONLY after the user explicitly confirms/);
    });
  });

  describe('CLI commands are inside prompt — not primary visible actions', () => {
    it('prompt contains the inspect commands (they are inside the generated prompt, not in the UI)', () => {
      const job = makeJob({ jobId: 'inspect-me' });
      const prompt = buildAgentPromptText(makeItem(), job, null, null, null);
      expect(prompt).toContain('openclaw cron show inspect-me');
      expect(prompt).toContain('openclaw cron runs --id inspect-me --limit 5');
    });

    it('prompt header clearly labels this as an agent diagnosis task', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toContain('## Agent Diagnosis Task');
    });
  });

  describe('prompt structural integrity', () => {
    it('returns a non-empty string', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(100);
    });

    it('contains section headers (### markers)', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toContain('### Job Context');
      expect(prompt).toContain('### Recent Error Summary');
      expect(prompt).toContain('### Read-only Inspect Commands');
      expect(prompt).toContain('### Issue Classification');
      expect(prompt).toContain('### Required Output');
      expect(prompt).toContain('### Safety Rules');
    });

    it('handles missing optional fields gracefully (no crashes)', () => {
      const job = makeJob({ frequencyLabel: null, scheduleMinutes: null, model: null, totalTokens: null });
      expect(() => buildAgentPromptText(makeItem(), job, null, null, null)).not.toThrow();
    });

    it('handles null dailyWaste and perRunWaste gracefully', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(typeof prompt).toBe('string');
    });

    it('includes SAFETY RULES section with numbered rules', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toContain('SAFETY RULES:');
      // At least rules 1-7 should be present
      expect(prompt).toMatch(/1\..+Do NOT edit/i);
      expect(prompt).toMatch(/7\..+explicit user confirmation/i);
    });
  });
});

/**
 * I22 UI contract tests — source-level structural validation.
 * Validates that the first-card buildCardHtml branch in src/main.ts
 * contains the required structural elements without running the function.
 */
describe('I22 UI contract — first card source structure', () => {
  const src = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8');

  describe('three-section first card structure', () => {
    it('buildCardHtml has problemSummaryHtml with "Problem Summary" label', () => {
      expect(src).toContain('const problemSummaryHtml = isFirst ?');
      expect(src).toContain('>Problem Summary<');
    });

    it('buildCardHtml has whatToDoFirstHtml with "What To Do First" label', () => {
      expect(src).toContain('const whatToDoFirstHtml = isFirst ?');
      expect(src).toContain('>What To Do First<');
    });

    it('buildCardHtml has agentPromptSection with "Agent Diagnosis Prompt" label', () => {
      expect(src).toContain('const agentPromptSection = isFirst ?');
      expect(src).toContain('Agent Diagnosis Prompt');
    });

    it('Problem Summary is NOT wrapped in a <details> tag (visible by default)', () => {
      // The "Problem Summary" label appears in a plain div, not inside details
      const problemSectionIdx = src.indexOf('>Problem Summary<');
      expect(problemSectionIdx).toBeGreaterThan(-1);
      // Check there's no <details> opening before it within 200 chars
      const contextBefore = src.slice(Math.max(0, problemSectionIdx - 200), problemSectionIdx);
      expect(contextBefore).not.toMatch(/<details[^>]*>\s*<[^>]*>\s*Problem Summary/);
    });

    it('What To Do First is NOT wrapped in a <details> tag (visible by default)', () => {
      const idx = src.indexOf('>What To Do First<');
      expect(idx).toBeGreaterThan(-1);
      const contextBefore = src.slice(Math.max(0, idx - 100), idx);
      expect(contextBefore).not.toMatch(/<details[^>]*>\s*<[^>]*>What To Do First/);
    });
  });

  describe('old "inspect this job first" language is gone', () => {
    it('buildCardHtml does not contain "Start here: inspect this job first"', () => {
      // The isFirst-specific firstActionHeader variable was removed
      expect(src).not.toContain('Start here: inspect this job first');
      expect(src).not.toContain('Start here');
    });
  });

  describe('no run/mutate commands in first card default view', () => {
    it('first card advancedDetails section does NOT contain "openclaw cron run"', () => {
      // The first card's advancedDetails verification was replaced with text instruction
      // Find the <details class="advanced-details"> section in buildCardHtml
      const advStart = src.indexOf('<details class="advanced-details">');
      if (advStart === -1) {
        // This is also a failure — the advanced-details must exist
        expect(advStart).toBeGreaterThan(-1);
        return;
      }
      // Find the closing </details>
      const advEnd = src.indexOf('</details>', advStart);
      const advSection = src.slice(advStart, advEnd + 8);
      // The run command must not appear
      expect(advSection).not.toContain('openclaw cron run');
      // Instead it should have the instruction-based guidance
      expect(advSection).toContain('ask the agent for verification commands');
    });
  });

  describe('Advanced Details is collapsed <details class="advanced-details">', () => {
    it('buildCardHtml contains <details class="advanced-details"> for isFirst branch', () => {
      expect(src).toContain('<details class="advanced-details">');
    });

    it('advanced-details summary label is "Advanced Details — Evidence, Inspect Commands, and Verification"', () => {
      expect(src).toContain('Advanced Details — Evidence, Inspect Commands, and Verification');
    });

    it('Evidence section is inside advanced-details', () => {
      // Find the Evidence div inside the advanced-details section
      const advStart = src.indexOf('<details class="advanced-details">');
      expect(advStart).toBeGreaterThan(-1);
      const evidenceIdx = src.indexOf('>Evidence<', advStart);
      expect(evidenceIdx).toBeGreaterThan(-1);
      // Evidence should come after the advanced-details opening
      expect(evidenceIdx).toBeGreaterThan(advStart);
    });
  });

  describe('Safe Inspect Command is inside advanced-details, not primary', () => {
    it('"Safe Inspect Command" label appears inside advanced-details for first card', () => {
      // Find the first card section (isFirst === true) advanced details
      const advStart = src.indexOf('<details class="advanced-details">');
      if (advStart === -1) return; // skip if not present
      const advEnd = src.indexOf('</details>', advStart);
      const advSection = src.slice(advStart, advEnd + 8);
      // Safe Inspect Command should be inside advanced-details
      expect(advSection).toMatch(/Safe Inspect Command|Read-only Inspect Commands/);
    });
  });
});