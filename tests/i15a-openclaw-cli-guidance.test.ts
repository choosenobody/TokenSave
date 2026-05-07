// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { FIX_LIBRARY } from '../src/constants';
import { buildFixCards } from '../src/fixes';

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

  // ── 3. ERROR_WASTE uses --enable flag (not --resume) ──
  it('ERROR_WASTE uses --enable to re-activate job (not --resume)', () => {
    expect(FIX_LIBRARY.ERROR_WASTE.action).toMatch(/--enable/);
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
    // html is built by buildFixSteps in main.ts; we verify the idList is not embedded raw in FIX_LIBRARY.action
    // The id substitution happens at render time; the template must NOT have bare ${idList} or ${id}
    expect(card.config.action).not.toMatch(/\$\{idList\}/);
    expect(card.config.action).not.toMatch(/\$\{id\}/);
  });

  it('ERROR_WASTE buildFixCards: uses --id flag syntax in action text', () => {
    const job = makeJob(['ERROR_WASTE'], {
      id: 'err-456',
      errorRate: 0.7,
      evidence: [{ ruleId: 'ERROR_WASTE', observedValue: 0.7, threshold: 0.1 }]
    });
    const cards = buildFixCards([job]);
    const card = cards.find(c => c.category === 'ERROR_WASTE');
    expect(card.config.action).toMatch(/--id/);
    expect(card.config.action).toMatch(/\-\-enable/);
    expect(card.config.action).not.toMatch(/openclaw jobs/);
    expect(card.config.action).not.toMatch(/--resume/);
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
  const makeJob = (issues, extra = {}) => ({
    issues,
    totalTokens: 1000,
    errorRate: 0,
    evidence: [],
    ...extra
  });

  const FORBIDDEN_PATTERNS = [
    { pattern: /openclaw jobs\b/,                reason: 'openclaw jobs subcommand removed in 2026.5.5' },
    { pattern: /openclaw export\b/,              reason: 'openclaw export does not exist in 2026.5.5' },
    { pattern: /--resume\b/,                     reason: '--resume flag removed; use cron edit --enable' },
    { pattern: /--no-agent-turn\b/,             reason: '--no-agent-turn not available; use cron disable' },
    { pattern: /--dry-run\b/,                   reason: '--dry-run not available on cron run' },
    { pattern: /--schedule "[^"]*\*[^"]*"/,     reason: 'cron expression strings not used; use --every duration' },
    { pattern: /--type cron\b/,                  reason: '--type not available on cron edit' },
    { pattern: /\$#\?id\b/,                      reason: 'no shell interpolation in action strings' },
  ];

  for (const [category, label] of [
    ['CRITICAL', 'CRITICAL'],
    ['LLM_AGENT_CRON', 'LLM_AGENT_CRON'],
    ['ERROR_WASTE', 'ERROR_WASTE'],
    ['PREMIUM_MODEL_WASTE', 'PREMIUM_MODEL_WASTE'],
    ['WARNING', 'WARNING'],
  ]) {
    for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
      it(`FIX_LIBRARY.${category} action has no forbidden pattern: ${reason}`, () => {
        const action = FIX_LIBRARY[category]?.action ?? '';
        expect(action).not.toMatch(pattern);
      });
    }
  }
});
