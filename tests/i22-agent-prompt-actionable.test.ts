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

const escapeShim = `function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\"/g,'&quot;'); }`;
  const formatIntegerShim = `function formatInteger(n) { return String(Math.round(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ','); }`;
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
      const prompt = buildAgentPromptText(makeItem('CRITICAL'), makeJob({ evidence: [{ ruleId: 'CRITICAL', observedValue: 5, threshold: 30 }] }), null, null, null);
      expect(prompt).toContain('Issue category: CRITICAL');
    });

    it('includes error rate and threshold', () => {
      const job = makeJob({ errorRate: 0.67, evidence: [{ ruleId: 'ERROR_WASTE', observedValue: 0.67, threshold: 0.10 }] });
      const prompt = buildAgentPromptText(makeItem('ERROR_WASTE'), job, null, null, null);
      expect(prompt).toMatch(/Error rate: 67\.0%.*threshold: 10\.0%/);
    });

    it('includes estimated recurring token waste (tokens/day when schedule available)', () => {
      const job = makeJob();
      const prompt = buildAgentPromptText(makeItem(), job, 1440, null, null);
      expect(prompt).toMatch(/Estimated recurring token waste:.*tokens\/day/);
    });

    it('falls back to tokens/run when daily estimate unavailable', () => {
      const job = makeJob({ frequencyLabel: null, scheduleMinutes: null });
      const prompt = buildAgentPromptText(makeItem(), job, null, 320, null);
      expect(prompt).toMatch(/Estimated recurring token waste:.*tokens\/run/);
    });

    it('includes approximate secondary cost exposure when available', () => {
      const job = makeJob({ totalTokens: 1000000, rate: { rate: 0.30 } });
      const prompt = buildAgentPromptText(makeItem(), job, null, null, '~$0.30 total processed');
      expect(prompt).toContain('Approx cost exposure (secondary): ~$0.30 total processed');
    });

    it('includes schedule/frequency when available', () => {
      const job = makeJob({ frequencyLabel: 'every 30 min' });
      const prompt = buildAgentPromptText(makeItem(), job, null, null, null);
      expect(prompt).toMatch(/Schedule\/frequency: every 30 min/);
    });

    it('includes model/provider when available', () => {
      const job = makeJob({ model: 'mini-max/m2.7' });
      const prompt = buildAgentPromptText(makeItem(), job, null, null, null);
      expect(prompt).toMatch(/Model\/provider: mini-max\/m2\.7/);
    });

    it('includes read-only inspect commands', () => {
      const job = makeJob({ jobId: 'my-job-id' });
      const prompt = buildAgentPromptText(makeItem(), job, null, null, null);
      expect(prompt).toContain('openclaw cron show my-job-id');
      expect(prompt).toContain('openclaw cron runs --id my-job-id --limit 5');
    });
  });

  describe('prompt safety rules — forbid mutation before diagnosis', () => {
    it('forbids edit/disable/enable/delete before diagnosis', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/Do NOT edit.*the job yet/i);
    });

    it('forbids running or retrying the job before diagnosis', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/Do NOT run or retry the job yet/i);
    });

    it('requires read-only inspection as the first step', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/read-only inspection/i);
    });

    it('commands are output only — do not run until user confirms', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/Commands are output only[^C\n]*do not run/i);
    });

    it('asks for explicit user confirmation before destructive action', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/explicit user confirmation before any destructive or mutating action/i);
    });
  });

  describe('issue classification — required output structure', () => {
    it('includes issue classification options', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toContain('### Issue Classification');
      expect(prompt).toContain('Classify the issue as one or more of:');
    });

    it('includes provider/model failure classification option', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toContain('provider/model failure');
    });

    it('includes prompt/tool failure classification option', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toContain('prompt/tool failure');
    });

    it('includes delivery configuration issue classification option', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toContain('delivery configuration issue');
    });

    it('includes stale job/config issue classification option', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toContain('stale job/config issue');
    });

    it('includes job no longer needed classification option', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toContain('job no longer needed');
    });

    it('includes schedule too frequent classification option', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toContain('schedule too frequent');
    });

    it('includes duplicate or redundant recurring job classification option', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toContain('duplicate or redundant recurring job');
    });

    it('includes unknown / needs more evidence classification option', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toContain('unknown / needs more evidence');
    });
  });

  describe('required output structure for receiving agent', () => {
    it('includes required output section', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toContain('### Required Output');
    });

    it('requires root cause hypothesis', () => {
      const prompt = buildAgentPromptText(makeItem(), makeJob(), null, null, null);
      expect(prompt).toMatch(/Root cause hypothesis/);
    });

    it('requires evidence from inspect commands', () => {
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