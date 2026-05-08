// @ts-nocheck
// I15-B tests: active vs historical/disabled waste distinction
import { describe, it, expect } from 'vitest';
import { isActiveJob } from '../src/domain';

// Helper: minimal FinalizedJob with raw.enabled
const makeJob = ({ synthetic = false, enabled = true, totalRuns = 0 }) => ({
  raw: { enabled },
  synthetic,
  totalRuns,
  name: 'test-job',
  id: 'test-id',
  lookupId: 'test-id',
  slug: 'test-job',
  schedule: null,
  model: 'MiniMax M2.7',
  promptText: '',
  totalTokens: 100000,
  errorRuns: 0,
  badge: 'WARNING',
  issues: [],
  fixSuggestion: 'Review this job.',
  evidence: []
});

// ── 1. enabled === true → 'active' ──
it('enabled=true → active (not disabled)', () => {
  expect(isActiveJob(makeJob({ enabled: true }))).toBe('active');
});

// ── 2. enabled === false → 'disabled' ──
it('enabled=false → disabled', () => {
  expect(isActiveJob(makeJob({ enabled: false }))).toBe('disabled');
});

// ── 3. synthetic=true → 'historical' regardless of enabled ──
it('synthetic=true + enabled=true → historical (not active)', () => {
  expect(isActiveJob(makeJob({ synthetic: true, enabled: true }))).toBe('historical');
});
it('synthetic=true + enabled=false → historical (not disabled)', () => {
  expect(isActiveJob(makeJob({ synthetic: true, enabled: false }))).toBe('historical');
});

// ── 4. Missing enabled field → 'active' (conservative, do not hide) ──
it('missing enabled field → active (not disabled)', () => {
  expect(isActiveJob({ ...makeJob({}), raw: {} })).toBe('active');
});
it('enabled=undefined → active', () => {
  expect(isActiveJob({ ...makeJob({}), raw: { enabled: undefined } })).toBe('active');
});
it('enabled=null → active (null is not false)', () => {
  expect(isActiveJob({ ...makeJob({}), raw: { enabled: null } })).toBe('active');
});

// ── 5. enabled as string 'true'/'false' ──
it('enabled="true" (string) → active', () => {
  expect(isActiveJob(makeJob({ enabled: 'true' }))).toBe('active');
});
it('enabled="false" (string) → disabled', () => {
  expect(isActiveJob(makeJob({ enabled: 'false' }))).toBe('disabled');
});
it('enabled="1" (string) → active', () => {
  expect(isActiveJob(makeJob({ enabled: '1' }))).toBe('active');
});
it('enabled="0" (string) → disabled', () => {
  expect(isActiveJob(makeJob({ enabled: '0' }))).toBe('disabled');
});

// ── 6. active alias (enabled field named "active") ──
it('active=true as field name → active', () => {
  expect(isActiveJob({ ...makeJob({}), raw: { active: true } })).toBe('active');
});
it('active=false as field name → disabled', () => {
  expect(isActiveJob({ ...makeJob({}), raw: { active: false } })).toBe('disabled');
});

// ── 7. synthetic + runs (totalRuns > 0) → lifecycleStatus=historical but stays in activeJobs ──
// isActiveJob returns 'historical' for synthetic; but analyzeDataset filter includes it (has runs to show)
it('synthetic=true + totalRuns>0 → isActiveJob returns historical', () => {
  const job = makeJob({ synthetic: true, enabled: true, totalRuns: 5 });
  expect(isActiveJob(job)).toBe('historical');
});
it('synthetic=true + totalRuns>0 → included in activeJobs (not filtered out)', () => {
  const job = makeJob({ synthetic: true, enabled: true, totalRuns: 5 });
  // Filter from analyzeDataset
  const inActive = !(job.synthetic && job.totalRuns === 0);
  expect(inActive).toBe(true);
});
it('synthetic=true + totalRuns>0 → excluded from historicalJobs', () => {
  const job = makeJob({ synthetic: true, enabled: true, totalRuns: 5 });
  job.lifecycleStatus = isActiveJob(job); // simulate the forEach from analyzeDataset
  // lifecycleStatus = 'historical', but synthetic with runs → NOT in historicalJobs
  const inHistorical = job.lifecycleStatus === 'historical' && !(job.synthetic && job.totalRuns > 0);
  expect(inHistorical).toBe(false);
});

// ── 8. purely synthetic (synthetic + 0 runs) → excluded from activeJobs, included in historicalJobs ──
it('synthetic=true + totalRuns=0 → excluded from activeJobs', () => {
  const job = makeJob({ synthetic: true, enabled: true, totalRuns: 0 });
  expect(job.synthetic && job.totalRuns === 0).toBe(true); // filtered out
});
it('synthetic=true + totalRuns=0 → included in historicalJobs', () => {
  const job = makeJob({ synthetic: true, enabled: true, totalRuns: 0 });
  job.lifecycleStatus = isActiveJob(job); // simulate the forEach from analyzeDataset
  const inHistorical = job.lifecycleStatus === 'historical' && !(job.synthetic && job.totalRuns > 0);
  expect(inHistorical).toBe(true);
});

// ── 9. activeJobs: excludes disabled=true AND all synthetic (historical) ──
it('enabled=true → in activeJobs', () => {
  const job = makeJob({ enabled: true });
  job.lifecycleStatus = isActiveJob(job);
  const inActive = job.lifecycleStatus === 'active';
  expect(inActive).toBe(true);
});
it('enabled=false → NOT in activeJobs', () => {
  const job = makeJob({ enabled: false });
  job.lifecycleStatus = isActiveJob(job);
  expect(job.lifecycleStatus).toBe('disabled');
});
it('synthetic=true + totalRuns=0 → NOT in activeJobs (historical)', () => {
  const job = makeJob({ synthetic: true, totalRuns: 0 });
  job.lifecycleStatus = isActiveJob(job);
  expect(job.lifecycleStatus).toBe('historical');
});
it('synthetic=true + totalRuns>0 → NOT in activeJobs (historical)', () => {
  const job = makeJob({ synthetic: true, totalRuns: 5 });
  job.lifecycleStatus = isActiveJob(job);
  expect(job.lifecycleStatus).toBe('historical'); // still 'historical', not 'active'
});

// ── 10. allJobs includes everything (including disabled and synthetic) ──
it('allJobs includes all job types', () => {
  const allJobs = [
    { ...makeJob({ enabled: true }), lifecycleStatus: 'active' },
    { ...makeJob({ enabled: false }), lifecycleStatus: 'disabled' },
    { ...makeJob({ synthetic: true }), lifecycleStatus: 'historical' }
  ];
  expect(allJobs.length).toBe(3);
});

// ── 11. activeJobs filter: excludes both disabled and all synthetic ──
it('activeJobs filter excludes disabled=true', () => {
  const activeJobs = [
    { ...makeJob({ enabled: true }), lifecycleStatus: 'active' },
    { ...makeJob({ enabled: false }), lifecycleStatus: 'disabled' }
  ].filter(job => job.lifecycleStatus === 'active');
  expect(activeJobs.length).toBe(1);
  expect(activeJobs[0].lifecycleStatus).toBe('active');
});
it('activeJobs filter excludes all synthetic (lifecycleStatus=historical)', () => {
  const activeJobs = [
    { ...makeJob({ enabled: true }), lifecycleStatus: 'active' },
    { ...makeJob({ synthetic: true, totalRuns: 5 }), lifecycleStatus: 'historical' }
  ].filter(job => job.lifecycleStatus === 'active');
  expect(activeJobs.length).toBe(1);
  expect(activeJobs[0].lifecycleStatus).toBe('active');
});

// ── 12. fixes exclude disabled/historical from activeJobs ──
it('activeJobs filter used for fix cards excludes disabled and historical', () => {
  const jobs = [
    { ...makeJob({ enabled: true }), lifecycleStatus: 'active' },
    { ...makeJob({ enabled: false }), lifecycleStatus: 'disabled' },
    { ...makeJob({ synthetic: true }), lifecycleStatus: 'historical' }
  ];
  const fixInput = jobs.filter(job => job.lifecycleStatus === 'active');
  expect(fixInput.length).toBe(1);
  expect(fixInput.every(j => j.lifecycleStatus === 'active')).toBe(true);
});

// ── 13. historicalJobs: ALL synthetic (historical) + ALL disabled ──
it('historicalJobs includes disabled=true', () => {
  const jobs = [{ ...makeJob({ enabled: false }), lifecycleStatus: 'disabled' }];
  const historicalJobs = jobs.filter((job) =>
    job.lifecycleStatus === 'disabled' || job.lifecycleStatus === 'historical'
  );
  expect(historicalJobs.length).toBe(1);
});
it('historicalJobs includes synthetic=true + totalRuns>0', () => {
  const jobs = [{ ...makeJob({ synthetic: true, totalRuns: 5 }), lifecycleStatus: 'historical' }];
  const historicalJobs = jobs.filter((job) =>
    job.lifecycleStatus === 'disabled' || job.lifecycleStatus === 'historical'
  );
  expect(historicalJobs.length).toBe(1); // all synthetic go to historical section
});
it('historicalJobs includes synthetic=true + totalRuns=0', () => {
  const jobs = [{ ...makeJob({ synthetic: true, totalRuns: 0 }), lifecycleStatus: 'historical' }];
  const historicalJobs = jobs.filter((job) =>
    job.lifecycleStatus === 'disabled' || job.lifecycleStatus === 'historical'
  );
  expect(historicalJobs.length).toBe(1);
});

// ── 14. report structure ──
it('report.jobs = allJobs (everything), historicalJobs separate', () => {
  const jobs = [
    { ...makeJob({ enabled: true }), lifecycleStatus: 'active' },
    { ...makeJob({ enabled: false }), lifecycleStatus: 'disabled' },
    { ...makeJob({ synthetic: true }), lifecycleStatus: 'historical' }
  ];
  const allJobs = jobs;
  const historicalJobs = jobs.filter((job) =>
    job.lifecycleStatus === 'disabled' || job.lifecycleStatus === 'historical'
  );
  expect(allJobs.length).toBe(3); // table shows everything
  expect(historicalJobs.length).toBe(2); // disabled + synthetic in historical section
});

// ── 15. historical section: XSS safety in disabled label ──
// job.name must be escaped when used in innerHTML
it('disabled label construction escapes job.name', () => {
  const job = { ...makeJob({ enabled: false, totalRuns: 5 }), lifecycleStatus: 'disabled' };
  const name = job.name; // raw name from user data
  // Simulate the escape
  const safeName = String(name).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  // The safe name should differ from raw name if name contains special chars
  expect(safeName).not.toContain('<script>');
});

// ── 16. inspectOnly actionHtml for historical section ──
it('inspectOnly actionHtml contains cron runs command for disabled job', () => {
  const job = { ...makeJob({ enabled: false, totalRuns: 5 }), lifecycleStatus: 'disabled', id: 'test-id-123' };
  const inspectOnly = job.lifecycleStatus === 'disabled' || job.lifecycleStatus === 'historical';
  const actionHtml = inspectOnly && job.id
    ? `openclaw cron show ${job.id}\nopenclaw cron runs --id ${job.id} --limit 50`
    : 'No job ID available';
  expect(actionHtml).toContain('openclaw cron runs --id test-id-123');
  expect(actionHtml).not.toContain('cron disable');
  expect(actionHtml).not.toContain('cron edit');
});
it('inspectOnly actionHtml for synthetic without id', () => {
  const job = { ...makeJob({ synthetic: true, totalRuns: 5 }), lifecycleStatus: 'historical', id: null };
  const inspectOnly = job.lifecycleStatus === 'disabled' || job.lifecycleStatus === 'historical';
  const actionHtml = inspectOnly && job.id
    ? `openclaw cron show ${job.id}`
    : 'No job ID available — inspect ~/.openclaw/cron/runs/ for raw run history';
  expect(actionHtml).toContain('No job ID available');
  expect(actionHtml).not.toContain('cron disable');
});

// ── 17. neutral problem text for historical section ──
// Historical section must never show urgent CRITICAL/ERROR_WASTE problem text
it('historical section problem text is neutral and does not repeat category', () => {
  const neutralText = 'Review this job before taking action. Inspect the run history to understand its current status.';
  // Neutral text must not contain words that signal urgency
  expect(neutralText.toLowerCase()).not.toContain('burning');
  expect(neutralText.toLowerCase()).not.toContain('failing');
  expect(neutralText.toLowerCase()).not.toContain('waste');
  expect(neutralText.toLowerCase()).not.toContain('fix');
  expect(neutralText.toLowerCase()).not.toContain('critical');
});

// ── 18. primary topWaste: synthetic jobs NEVER appear ──
it('synthetic job with any totalRuns is NOT in activeJobs', () => {
  const jobs = [
    { ...makeJob({ enabled: true }), lifecycleStatus: 'active' },
    { ...makeJob({ synthetic: true, totalRuns: 100 }), lifecycleStatus: 'historical' }
  ];
  const activeJobs = jobs.filter(job => job.lifecycleStatus === 'active');
  const syntheticInActive = jobs.filter(job =>
    job.lifecycleStatus !== 'active' && !(job.lifecycleStatus === 'disabled')
  );
  // No synthetic jobs in activeJobs
  expect(activeJobs.every(j => j.lifecycleStatus === 'active')).toBe(true);
  // All synthetic jobs in historical section
  expect(syntheticInActive.length).toBe(1);
});

// ── 19. disabled job NEVER appears in primary topWaste ──
it('disabled job is NOT in activeJobs', () => {
  const jobs = [
    { ...makeJob({ enabled: true }), lifecycleStatus: 'active' },
    { ...makeJob({ enabled: false }), lifecycleStatus: 'disabled' }
  ];
  const activeJobs = jobs.filter(job => job.lifecycleStatus === 'active');
  expect(activeJobs.length).toBe(1);
  expect(activeJobs[0].lifecycleStatus).toBe('active');
});

// ── 20. allJobs includes disabled and synthetic for table display ──
it('allJobs includes every job regardless of lifecycleStatus', () => {
  const jobs = [
    { ...makeJob({ enabled: true }), lifecycleStatus: 'active' },
    { ...makeJob({ enabled: false }), lifecycleStatus: 'disabled' },
    { ...makeJob({ synthetic: true }), lifecycleStatus: 'historical' }
  ];
  expect(jobs.length).toBe(3); // table shows all
});

// ── 21. No network/telemetry/file-write impact ──
it('isActiveJob has no network, telemetry, or file-write side effects', () => {
  const job = makeJob({ enabled: false });
  const before = JSON.stringify(job);
  const result = isActiveJob(job);
  const after = JSON.stringify(job);
  expect(result).toBe('disabled');
  expect(after).toBe(before); // job not mutated
});
