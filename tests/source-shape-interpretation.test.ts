import { describe, it, expect } from 'vitest';
import { buildSourceShapeCopy } from '../src/parser';

// ---------------------------------------------------------------------------
// Source-shape interpretation (W-light slice, UI/copy contract)
// ---------------------------------------------------------------------------
//
// The user-facing source-shape interpretation block is rendered by
// `renderImportSummary` in `src/main.ts`.  The block reads the
// `sourceShape` field produced by `detectImportSource` and shows a short
// paragraph that frames the imported data.
//
// This file is a pure-string contract test for the copy.  It does NOT
// touch the DOM, the network, or the filesystem.  Render-side escapeHtml
// is the caller's responsibility — these tests check the raw copy.

const FORBIDDEN_PHRASES = [
  'precise saving',
  'exact saving',
  'guaranteed saving',
  'quota exhaustion',
  'quota exceeded',
  'agent-cron-fix',
  'auto fix',
  'auto-apply',
  'auto-disable',
  'auto-edit',
  'auto-restart',
  'PR #155',
  'PR #156',
  'A1',  // internal advisory id — must not appear in user-facing copy
  'A2',
  'A3',
];

const FORBIDDEN_FIRST_ACTION_VERBS = [
  'disable this',
  'edit this',
  'switch model',
  'switch-model',
  'restart this',
];

function assertCopyClean(copy: string) {
  const lower = copy.toLowerCase();
  for (const phrase of FORBIDDEN_PHRASES) {
    expect(lower).not.toContain(phrase.toLowerCase());
  }
  for (const verb of FORBIDDEN_FIRST_ACTION_VERBS) {
    expect(lower).not.toContain(verb);
  }
}

describe('buildSourceShapeCopy — openclaw-export', () => {
  const copy = buildSourceShapeCopy('openclaw-export');

  it('mentions OpenClaw export shape', () => {
    expect(copy.toLowerCase()).toContain('openclaw');
  });

  it('frames the findings as review signals (not confirmed waste)', () => {
    expect(copy.toLowerCase()).toContain('review signal');
  });

  it('prescribes read-only manual inspection (not disable/edit/restart)', () => {
    expect(copy.toLowerCase()).toContain('inspect');
    expect(copy.toLowerCase()).not.toMatch(/disable|edit|restart/);
  });

  it('does not contain any forbidden phrase', () => {
    assertCopyClean(copy);
  });
});

describe('buildSourceShapeCopy — hermes-cron', () => {
  const copy = buildSourceShapeCopy('hermes-cron');

  it('mentions Hermes cron-style records', () => {
    expect(copy.toLowerCase()).toContain('hermes');
    expect(copy.toLowerCase()).toContain('cron');
  });

  it('frames the findings as review signals (not confirmed waste)', () => {
    expect(copy.toLowerCase()).toContain('review signal');
    expect(copy.toLowerCase()).toContain('not confirmed waste');
  });

  it('prescribes read-only inspection (not disable/edit/restart)', () => {
    expect(copy.toLowerCase()).toContain('read-only');
    expect(copy.toLowerCase()).not.toMatch(/disable|edit|restart/);
  });

  it('does not contain any forbidden phrase', () => {
    assertCopyClean(copy);
  });
});

describe('buildSourceShapeCopy — unknown / fallback', () => {
  it('returns the conservative unknown-source copy for sourceShape: "unknown"', () => {
    const copy = buildSourceShapeCopy('unknown');
    expect(copy.toLowerCase()).toContain('source shape is unclear');
  });

  it('returns the conservative unknown-source copy for null', () => {
    const copy = buildSourceShapeCopy(null);
    expect(copy.toLowerCase()).toContain('source shape is unclear');
  });

  it('returns the conservative unknown-source copy for undefined', () => {
    const copy = buildSourceShapeCopy(undefined);
    expect(copy.toLowerCase()).toContain('source shape is unclear');
  });

  it('returns the conservative unknown-source copy for an unrecognized shape value', () => {
    const copy = buildSourceShapeCopy('not-a-real-shape');
    expect(copy.toLowerCase()).toContain('source shape is unclear');
  });

  it('unknown-source copy prescribes read-only inspection', () => {
    const copy = buildSourceShapeCopy('unknown');
    expect(copy.toLowerCase()).toContain('read-only');
    expect(copy.toLowerCase()).not.toMatch(/disable|edit|restart/);
  });

  it('unknown-source copy does not contain any forbidden phrase', () => {
    assertCopyClean(buildSourceShapeCopy('unknown'));
    assertCopyClean(buildSourceShapeCopy(null));
    assertCopyClean(buildSourceShapeCopy(undefined));
  });
});

describe('buildSourceShapeCopy — cross-cutting invariants', () => {
  it('all three copy branches are non-empty strings', () => {
    expect(buildSourceShapeCopy('openclaw-export').length).toBeGreaterThan(20);
    expect(buildSourceShapeCopy('hermes-cron').length).toBeGreaterThan(20);
    expect(buildSourceShapeCopy('unknown').length).toBeGreaterThan(20);
  });

  it('no copy branch claims precise savings', () => {
    const all = [
      buildSourceShapeCopy('openclaw-export'),
      buildSourceShapeCopy('hermes-cron'),
      buildSourceShapeCopy('unknown'),
    ].join('\n');
    expect(all).not.toMatch(/\$\s*\d+/); // no dollar-figure claims
    expect(all.toLowerCase()).not.toContain('precise');
    expect(all.toLowerCase()).not.toContain('exact');
    expect(all.toLowerCase()).not.toContain('guaranteed');
  });
});
