// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { FIX_LIBRARY } from '../src/constants';
import { buildFixCards } from '../src/fixes';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Helper: minimal job with issues
const makeJob = (issues, extra = {}) => ({
  issues,
  totalTokens: 1000,
  errorRate: 0,
  evidence: [],
  ...extra
});

describe('I15-A: OpenClaw CLI guidance — fix-card actionability', () => {

  // ── 1. No "openclaw jobs" command family anywhere in FIX_LIBRARY actions ──
  it('FIX_LIBRARY.CRITICAL.action uses openclaw cron (not openclaw jobs)', () => {
    expect(FIX_LIBRARY.CRITICAL.action).not.toMatch(/openclaw jobs\b/);
    expect(FIX_LIBRARY.CRITICAL.action).toMatch(/openclaw cron/);
  });

  it('FIX_LIBRARY.LLM_AGENT_CRON.action uses openclaw cron (not openclaw jobs)', () => {
    expect(FIX_LIBRARY.LLM_AGENT_CRON.action).not.toMatch(/openclaw jobs\b/);
    expect(FIX_LIBRARY.LLM_AGENT_CRON.action).toMatch(/openclaw cron/);
  });

  it('FIX_LIBRARY.ERROR_WASTE.action uses openclaw cron runs --id (not positional idList)', () => {
    expect(FIX_LIBRARY.ERROR_WASTE.action).not.toMatch(/openclaw jobs\b/);
    expect(FIX_LIBRARY.ERROR_WASTE.action).toMatch(/openclaw cron runs --id/);
    // Must NOT have bare positional job id after "cron runs"
    expect(FIX_LIBRARY.ERROR_WASTE.action).not.toMatch(/cron runs [a-f0-9-]{10,}/);
  });

  it('FIX_LIBRARY.PREMIUM_MODEL_WASTE.action uses openclaw cron (not openclaw jobs)', () => {
    expect(FIX_LIBRARY.PREMIUM_MODEL_WASTE.action).not.toMatch(/openclaw jobs\b/);
    expect(FIX_LIBRARY.PREMIUM_MODEL_WASTE.action).toMatch(/openclaw cron/);
  });

  it('FIX_LIBRARY.WARNING.action uses openclaw cron (not openclaw jobs)', () => {
    expect(FIX_LIBRARY.WARNING.action).not.toMatch(/openclaw jobs\b/);
    expect(FIX_LIBRARY.WARNING.action).toMatch(/openclaw cron/);
  });

  // ── 2. No "openclaw export" anywhere in FIX_LIBRARY ──
  it('FIX_LIBRARY actions contain no "openclaw export" references', () => {
    const allActions = Object.values(FIX_LIBRARY).map(v => v.action).join('\n');
    expect(allActions).not.toMatch(/openclaw export\b/);
  });

  // ── 3. ERROR_WASTE uses inspect + root-cause fix + manual verification (no --enable) ──
  it('ERROR_WASTE uses cron show + cron runs --id + cron run + cron runs confirm (no --enable)', () => {
    expect(FIX_LIBRARY.ERROR_WASTE.action).toMatch(/openclaw cron show/);
    expect(FIX_LIBRARY.ERROR_WASTE.action).toMatch(/openclaw cron runs --id/);
    expect(FIX_LIBRARY.ERROR_WASTE.action).toMatch(/openclaw cron run\b/);
    expect(FIX_LIBRARY.ERROR_WASTE.action).not.toMatch(/--enable/);
    expect(FIX_LIBRARY.ERROR_WASTE.action).not.toMatch(/--resume/);
  });

  // ── 4. ERROR_WASTE uses "cron runs --id" flag syntax (not positional) ──
  it('ERROR_WASTE uses "cron runs --id [JOB_ID]" flag syntax', () => {
    expect(FIX_LIBRARY.ERROR_WASTE.action).toMatch(/\-\-id\s+\[JOB_ID\]/);
  });

  // ── 5. buildFixCards output: single-job idList emits correct one-command-per-ID structure ──
  it('CRITICAL buildFixCards single job: no multi-ID in commands', () => {
    const job = makeJob(['CRITICAL'], {
      id: 'abc-123',
      scheduleMinutes: 5,
      evidence: [{ ruleId: 'CRITICAL', observedValue: 5, threshold: 30 }]
    });
    const cards = buildFixCards([job]);
    const card = cards.find(c => c.category === 'CRITICAL');
    expect(card.config.action).not.toMatch(/\$\{idList\}/);
    expect(card.config.action).not.toMatch(/\$\{id\}/);
  });

  it('ERROR_WASTE buildFixCards: uses inspect + verify flow (no --enable, no edit)', () => {
    const job = makeJob(['ERROR_WASTE'], {
      id: 'err-456',
      errorRate: 0.7,
      evidence: [{ ruleId: 'ERROR_WASTE', observedValue: 0.7, threshold: 0.1 }]
    });
    const cards = buildFixCards([job]);
    const card = cards.find(c => c.category === 'ERROR_WASTE');
    expect(card.config.action).toMatch(/--id/);
    expect(card.config.action).not.toMatch(/--enable/);
    expect(card.config.action).not.toMatch(/openclaw jobs/);
    expect(card.config.action).not.toMatch(/--resume/);
    expect(card.config.action).toMatch(/cron show/);
    expect(card.config.action).toMatch(/cron run\b/);
    expect(card.config.action).toMatch(/cron runs --id.*--limit 5/);
    expect(card.config.action).toMatch(/cron runs --id.*--limit 10/);
  });

  // ── 6. CRITICAL uses "cron disable" (not edit --disable, not --no-agent-turn) ──
  it('CRITICAL uses "cron disable" as separate command (not edit --disable)', () => {
    expect(FIX_LIBRARY.CRITICAL.action).toMatch(/cron disable\b/);
    expect(FIX_LIBRARY.CRITICAL.action).not.toMatch(/--no-agent-turn/);
    expect(FIX_LIBRARY.CRITICAL.action).not.toMatch(/edit.*--disable/);
  });

  // ── 7. LLM_AGENT_CRON uses cron disable ──
  it('LLM_AGENT_CRON uses "cron disable" (not "cron edit --no-agent-turn")', () => {
    expect(FIX_LIBRARY.LLM_AGENT_CRON.action).toMatch(/cron disable/);
    expect(FIX_LIBRARY.LLM_AGENT_CRON.action).not.toMatch(/--no-agent-turn/);
    expect(FIX_LIBRARY.LLM_AGENT_CRON.action).not.toMatch(/openclaw jobs/);
  });

  // ── 8. Local path references in FIX_LIBRARY actions ──
  it('actions reference local data path ~/.openclaw/cron/jobs.json (not openclaw export)', () => {
    const allActions = Object.values(FIX_LIBRARY).map(v => v.action).join('\n');
    expect(allActions).toMatch(/\~\/\.openclaw\/cron\/jobs\.json/);
    expect(allActions).not.toMatch(/openclaw export/);
  });

  // ── 9. WARNING uses --every (not --schedule with cron expr) ──
  it('WARNING uses --every 6h (not cron expression string)', () => {
    expect(FIX_LIBRARY.WARNING.action).toMatch(/--every 6h/);
    expect(FIX_LIBRARY.WARNING.action).not.toMatch(/--schedule "0 \*\/6/);
  });

  // ── 10. PREMIUM_MODEL_WASTE uses --model flag (not --dry-run) ──
  it('PREMIUM_MODEL_WASTE uses --model and cron run (not --dry-run)', () => {
    expect(FIX_LIBRARY.PREMIUM_MODEL_WASTE.action).toMatch(/--model/);
    expect(FIX_LIBRARY.PREMIUM_MODEL_WASTE.action).toMatch(/cron run/);
    expect(FIX_LIBRARY.PREMIUM_MODEL_WASTE.action).not.toMatch(/--dry-run/);
  });

});

describe('I15-A: buildFixCards — no forbidden patterns in action', () => {
  const FORBIDDEN_PATTERNS = [
    { pattern: /openclaw jobs\b/,                reason: 'openclaw jobs subcommand removed in 2026.5.5' },
    { pattern: /openclaw export\b/,              reason: 'openclaw export does not exist in 2026.5.5' },
    { pattern: /--resume\b/,                     reason: '--resume flag removed; use cron edit --enable' },
    { pattern: /--no-agent-turn\b/,             reason: '--no-agent-turn not available; use cron disable' },
    { pattern: /--dry-run\b/,                   reason: '--dry-run not available on cron run' },
    { pattern: /--schedule "[^"]*\*[^"]*"/,     reason: 'cron expression strings not used; use --every duration' },
    { pattern: /--type cron\b/,                  reason: '--type not available on cron edit' },
    { pattern: /\$\#\?id\b/,                      reason: 'no shell interpolation in action strings' },
  ];

  for (const [category] of [
    ['CRITICAL'], ['LLM_AGENT_CRON'], ['ERROR_WASTE'], ['PREMIUM_MODEL_WASTE'], ['WARNING'],
  ]) {
    for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
      it(`FIX_LIBRARY.${category} action has no forbidden pattern: ${reason}`, () => {
        const action = FIX_LIBRARY[category]?.action ?? '';
        expect(action).not.toMatch(pattern);
      });
    }
  }
});

// ── I15-A: buildFixSteps multi-ID rendering ──────────────────────────────────
// Extracts the buildFixSteps function from main.ts to test it directly.

function extractBuildFixSteps() {
  const src = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8');

  // Extract cmdLine helper
  const cmdLineStart = src.indexOf('function cmdLine(text) {');
  let depth = 0, cmdLineEnd = cmdLineStart;
  for (let i = cmdLineStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { cmdLineEnd = i + 1; break; } }
  }
  const cmdLineFn = src.slice(cmdLineStart, cmdLineEnd);

  // Extract cmdBlock helper (I19-A: copy-once multi-line block renderer)
  const cmdBlockStart = src.indexOf('function cmdBlock(label, content) {');
  if (cmdBlockStart !== -1) {
    depth = 0; let cmdBlockEnd = cmdBlockStart;
    for (let i = cmdBlockStart; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) { cmdBlockEnd = i + 1; break; } }
    }
    var cmdBlockFn = src.slice(cmdBlockStart, cmdBlockEnd);
  }

  // Extract buildFixSteps
  const fnStart = src.indexOf('function buildFixSteps(category, idList, genericAction) {');
  if (fnStart === -1) throw new Error('buildFixSteps not found');
  depth = 0; let fnEnd = fnStart;
  for (let i = fnStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { fnEnd = i + 1; break; } }
  }
  const fnBody = src.slice(fnStart, fnEnd);

  // Minimal escapeHtml shim
  const escapeShim = `function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }`;

  const wrapper = `(function(){
    ${cmdLineFn}
    ${cmdBlockFn || ''}
    ${escapeShim}
    ${fnBody}
    return buildFixSteps;
  })()`;
  // eslint-disable-next-line no-eval
  return eval(wrapper);
}

const buildFixSteps = extractBuildFixSteps();

// Forbidden multi-ID command patterns (I15-A: one command per job ID)
const FORBIDDEN_MULTI_ID_PATTERNS = [
  // Only flag-style patterns where the second ID is preceded by a space (not a dash)
  { pattern: /cron runs\s+--id\s+[\w-]+\s+[a-z]{3,}/i, label: 'cron runs --id ID1 ID2' },
  { pattern: /cron edit\s+[\w-]+\s+[a-z]{3,}\s+--/i, label: 'cron edit ID1 ID2 --' },
  { pattern: /cron disable\s+[\w-]+\s+[a-z]{3,}/i, label: 'cron disable ID1 ID2' },
  { pattern: /cron run\s+[\w-]+\s+[a-z]{3,}/i, label: 'cron run ID1 ID2' },
  { pattern: /cron show\s+[\w-]+\s+[a-z]{3,}/i, label: 'cron show ID1 ID2' },
];

// Per-category expected command counts (whitespace-separated multi-ID)
// NOTE: ERROR_WASTE now uses copy-once shell-loop blocks (I19-A) — no per-ID cmdLine counts
const CATEGORY_WS_COUNTS = {
  ERROR_WASTE:         { show: 0, runs: 0, edit: 0, disable: 0, run: 0 },
  CRITICAL:            { show: 0, runs: 0, edit: 2, disable: 2, run: 0 },
  LLM_AGENT_CRON:      { show: 0, runs: 0, edit: 0, disable: 2, run: 0 },
  PREMIUM_MODEL_WASTE: { show: 0, runs: 0, edit: 2, disable: 0, run: 2 },
  WARNING:             { show: 0, runs: 0, edit: 2, disable: 0, run: 0 },
} as const;

// Per-category expected command counts (comma-separated multi-ID — same as whitespace)
const CATEGORY_COMMA_COUNTS = CATEGORY_WS_COUNTS;

const WS_TEST_CASES = [
  ['ERROR_WASTE',  'err-aaaa-bbbb-cccc err-dddd-eeee-ffff'],
  ['CRITICAL',     'crit-x-y crit-p-q'],
  ['LLM_AGENT_CRON','llm-a-b lmm-c-d'],
  ['PREMIUM_MODEL_WASTE', 'prem-a-b prem-c-d'],
  ['WARNING',      'warn-a-b warn-c-d'],
] as const;

const COMMA_TEST_CASES = [
  ['ERROR_WASTE',  'err-aaaa-bbbb-cccc,err-dddd-eeee-ffff'],
  ['CRITICAL',     'crit-x-y,crit-p-q'],
  ['LLM_AGENT_CRON','llm-a-b,llm-c-d'],
  ['PREMIUM_MODEL_WASTE', 'prem-a-b,prem-c-d'],
  ['WARNING',      'warn-a-b,warn-c-d'],
] as const;

function assertCommandCounts(html, expected) {
  if (expected.show > 0) {
    const matches = html.match(/cron show\s+[\w-]+/g) ?? [];
    expect(matches).toHaveLength(expected.show);
  }
  if (expected.runs > 0) {
    const matches = html.match(/cron runs\s+--id\s+[\w-]+/g) ?? [];
    expect(matches).toHaveLength(expected.runs);
  }
  if (expected.edit > 0) {
    const matches = html.match(/cron edit\s+[\w-]+/g) ?? [];
    expect(matches).toHaveLength(expected.edit);
  }
  if (expected.disable > 0) {
    const matches = html.match(/cron disable\s+[\w-]+/g) ?? [];
    expect(matches).toHaveLength(expected.disable);
  }
  if (expected.run > 0) {
    const matches = html.match(/cron run\s+[\w-]+/g) ?? [];
    expect(matches).toHaveLength(expected.run);
  }
}

describe('buildFixSteps — whitespace-separated multi-ID (I15-A fix)', () => {
  for (const [category, multiId] of WS_TEST_CASES) {
    const html = buildFixSteps(category, multiId, 'generic action');
    const expected = CATEGORY_WS_COUNTS[category];

    it(`${category}: correct command counts (show=${expected.show} runs=${expected.runs} edit=${expected.edit} disable=${expected.disable} run=${expected.run})`, () => {
      assertCommandCounts(html, expected);
    });

    for (const { pattern, label } of FORBIDDEN_MULTI_ID_PATTERNS) {
      it(`${category}: FORBIDDEN — no "${label}"`, () => {
        expect(html).not.toMatch(pattern);
      });
    }
  }
});

describe('buildFixSteps — comma-separated multi-ID (I15-A regression)', () => {
  for (const [category, commaId] of COMMA_TEST_CASES) {
    const html = buildFixSteps(category, commaId, 'generic action');
    const expected = CATEGORY_COMMA_COUNTS[category];

    it(`${category}: correct command counts`, () => {
      assertCommandCounts(html, expected);
    });

    for (const { pattern, label } of FORBIDDEN_MULTI_ID_PATTERNS) {
      it(`${category}: FORBIDDEN — no "${label}"`, () => {
        expect(html).not.toMatch(pattern);
      });
    }
  }
});

describe('buildFixSteps — stale forbidden patterns remain absent', () => {
  const STALE_PATTERNS = [
    { pattern: /openclaw jobs\b/,   label: 'openclaw jobs' },
    { pattern: /openclaw export\b/, label: 'openclaw export' },
    { pattern: /--resume\b/,        label: '--resume' },
    { pattern: /--watch\b/,         label: '--watch' },
    { pattern: /--last\s+1\b/,      label: '--last 1' },
  ];

  for (const [category] of COMMA_TEST_CASES) {
    for (const { pattern, label } of STALE_PATTERNS) {
      it(`${category}: no stale "${label}"`, () => {
        const html = buildFixSteps(category, 'id-a id-b id-c', 'generic action');
        expect(html).not.toMatch(pattern);
      });
    }
  }
});

describe('buildFixSteps — single ID still works', () => {
  // Use realistic long IDs for single-ID tests (same format as multi-ID tests)
  for (const [category] of COMMA_TEST_CASES) {
    // I19-A: ERROR_WASTE uses cmdBlock/pre format, not <code> cmdLine — skip in single-ID <code> check
    if (category === 'ERROR_WASTE') continue;
    it(`${category}: single ID produces no multi-ID command pattern`, () => {
      const html = buildFixSteps(category, 'single-long-job-id-abc', 'generic action');
      // Extract all raw command text from <code> elements
      const cmds = [...html.matchAll(/<code>([^<]+)<\/code>/g)].map(m => m[1].trim());
      let checked = 0;
      for (const cmd of cmds) {
        // Only check commands that target a specific job (have an ID position)
        // cron list --all, Re-import, Compare results, Monitor — have no ID, skip them
        if (!/cron\s+(show|runs\s+--id|edit|disable|run)\s+/.test(cmd)) continue;
        // Job IDs are long (>= 12 chars) with multiple hyphens
        // Flags like --enable, --every, --limit are short and start with dashes — not IDs
        const idTokens = cmd.split(/\s+/).filter(t => t.length >= 12 && /[a-z]+-[a-z]+-[a-z]+/i.test(t));
        expect(idTokens.length, `command "${cmd}" should have exactly 1 ID token`).toBe(1);
        checked++;
      }
      // Sanity: at least one command should have been checked
      expect(checked).toBeGreaterThan(0);
    });
  }
});

// I21: ERROR_WASTE first action is a job-level read-only inspect packet.
describe('ERROR_WASTE — I21 read-only first action structure', () => {
  const multiId = 'err-aaaa-bbbb-cccc err-dddd-eeee-ffff';
  const singleId = 'err-single-job-id-abc';
  const htmlMulti = buildFixSteps('ERROR_WASTE', multiId, 'generic action');
  const htmlSingle = buildFixSteps('ERROR_WASTE', singleId, 'generic action');

  it('renders cron show and recent runs with --id for the first job only', () => {
    expect(htmlMulti).toContain('openclaw cron show err-aaaa-bbbb-cccc');
    expect(htmlMulti).toContain('openclaw cron runs --id err-aaaa-bbbb-cccc --limit 5');
    expect(htmlMulti).not.toContain('err-dddd-eeee-ffff');
  });

  it('single-job output also uses read-only inspect commands', () => {
    expect(htmlSingle).toContain('openclaw cron show err-single-job-id-abc');
    expect(htmlSingle).toContain('openclaw cron runs --id err-single-job-id-abc --limit 5');
  });

  it('does not render forbidden first-action commands', () => {
    expect(htmlMulti).not.toMatch(/openclaw cron (edit|disable|enable|delete)\b/);
    expect(htmlSingle).not.toMatch(/openclaw cron (edit|disable|enable|delete)\b/);
  });

  it('uses simple command lines, not shell loops or numbered mutation steps', () => {
    expect(htmlMulti).not.toContain('for id in \\');
    expect(htmlMulti).not.toContain('done');
    expect(htmlMulti).not.toMatch(/<span class="step-num">\d+\.<\/span>/);
    expect(htmlSingle).not.toContain('for id in \\');
  });

  it('keeps copy buttons wired to the single-line copy handler', () => {
    expect(htmlMulti).toMatch(/onclick="copyCmd\(this\)"/);
  });
});
