import { describe, it, expect } from 'vitest';
import { buildEvidenceBackedProblem, buildFixCards } from '../src/fixes';
import { FIX_LIBRARY } from '../src/constants';

describe('buildEvidenceBackedProblem', () => {
  // Helper: minimal job with evidence
  const makeJob = (issues, evidence) => ({
    issues,
    id: `job-${Math.random()}`,
    name: 'test job',
    lifecycleStatus: 'active',
    totalTokens: 1000,
    errorRate: 0.5,
    evidence: evidence || []
  });

  it('1. CRITICAL with schedule evidence => returns evidence-backed problem', () => {
    const job = makeJob(['CRITICAL'], [{ ruleId: 'CRITICAL', observedValue: 10, threshold: 30 }]);
    const result = buildEvidenceBackedProblem('CRITICAL', [job]);
    expect(result).toBe('Runs every 10 min, below the 30 min threshold.');
  });

  it('2. CRITICAL with no evidence => returns null', () => {
    const result = buildEvidenceBackedProblem('CRITICAL', []);
    expect(result).toBeNull();
  });

  it('3. CRITICAL with no matching evidence entry => returns null', () => {
    const job = makeJob(['CRITICAL'], [{ ruleId: 'ERROR_WASTE', observedValue: 0.67, threshold: 0.10 }]);
    const result = buildEvidenceBackedProblem('CRITICAL', [job]);
    expect(result).toBeNull();
  });

  it('4. ERROR_WASTE with errorRate evidence => returns evidence-backed problem with percentages', () => {
    const job = makeJob(['ERROR_WASTE'], [{ ruleId: 'ERROR_WASTE', observedValue: 0.67, threshold: 0.10 }]);
    const result = buildEvidenceBackedProblem('ERROR_WASTE', [job]);
    expect(result).toBe('67% error rate, above the 10% threshold.');
  });

  it('5. ERROR_WASTE with no evidence => returns null', () => {
    const result = buildEvidenceBackedProblem('ERROR_WASTE', []);
    expect(result).toBeNull();
  });

  it('6. WARNING with evidence => returns null (no override in I14-B)', () => {
    const job = makeJob(['WARNING'], [{ ruleId: 'WARNING', observedValue: 45, threshold: 60 }]);
    const result = buildEvidenceBackedProblem('WARNING', [job]);
    expect(result).toBeNull();
  });

  it('7. LLM_AGENT_CRON with evidence => buildEvidenceBackedProblem returns null (no override in I14-B)', () => {
    // LLM_AGENT_CRON is not in buildFixCards order array, so test the helper directly
    const job = makeJob(['LLM_AGENT_CRON'], [{ ruleId: 'LLM_AGENT_CRON', observedValue: 10, threshold: 30 }]);
    const result = buildEvidenceBackedProblem('LLM_AGENT_CRON', [job]);
    expect(result).toBeNull();
  });

  it('8. PREMIUM_MODEL_WASTE with evidence => returns null (no override in I14-B)', () => {
    const job = makeJob(['PREMIUM_MODEL_WASTE'], [{ ruleId: 'PREMIUM_MODEL_WASTE', observedValue: 'Claude Opus', threshold: null }]);
    const result = buildEvidenceBackedProblem('PREMIUM_MODEL_WASTE', [job]);
    expect(result).toBeNull();
  });

  it('9. OK category => does not crash, returns null', () => {
    const job = makeJob(['OK'], []);
    const result = buildEvidenceBackedProblem('OK', [job]);
    expect(result).toBeNull();
  });

  it('10. NaN observedValue => returns null (fallback)', () => {
    const job = makeJob(['CRITICAL'], [{ ruleId: 'CRITICAL', observedValue: NaN, threshold: 30 }]);
    expect(buildEvidenceBackedProblem('CRITICAL', [job])).toBeNull();
  });

  it('11. Infinity observedValue => returns null (fallback)', () => {
    const job = makeJob(['ERROR_WASTE'], [{ ruleId: 'ERROR_WASTE', observedValue: Infinity, threshold: 0.10 }]);
    expect(buildEvidenceBackedProblem('ERROR_WASTE', [job])).toBeNull();
  });

  it('12. missing threshold => returns null (fallback)', () => {
    const job = makeJob(['CRITICAL'], [{ ruleId: 'CRITICAL', observedValue: 10 }]);
    expect(buildEvidenceBackedProblem('CRITICAL', [job])).toBeNull();
  });

  it('13. non-finite threshold => returns null (fallback)', () => {
    const job = makeJob(['CRITICAL'], [{ ruleId: 'CRITICAL', observedValue: 10, threshold: NaN }]);
    expect(buildEvidenceBackedProblem('CRITICAL', [job])).toBeNull();
  });

  it('14. finds evidence from first job that has it', () => {
    const job1 = makeJob(['CRITICAL'], []);
    const job2 = makeJob(['CRITICAL'], [{ ruleId: 'CRITICAL', observedValue: 15, threshold: 30 }]);
    const result = buildEvidenceBackedProblem('CRITICAL', [job1, job2]);
    expect(result).toBe('Runs every 15 min, below the 30 min threshold.');
  });

  it('15. no job has matching evidence entry => returns null', () => {
    const job1 = makeJob(['CRITICAL'], [{ ruleId: 'WARNING', observedValue: 45, threshold: 60 }]);
    const job2 = makeJob(['CRITICAL'], [{ ruleId: 'ERROR_WASTE', observedValue: 0.67, threshold: 0.10 }]);
    const result = buildEvidenceBackedProblem('CRITICAL', [job1, job2]);
    expect(result).toBeNull();
  });
});

describe('buildFixCards with evidence-backed problem', () => {
  const makeJob = (issues, evidence) => ({
    issues,
    totalTokens: 1000,
    errorRate: 0.5,
    evidence: evidence || []
  });

  it('CRITICAL with evidence => config.problem is evidence-backed', () => {
    const job = makeJob(['CRITICAL'], [{ ruleId: 'CRITICAL', observedValue: 10, threshold: 30 }]);
    const cards = buildFixCards([job]);
    const card = cards.find((c) => c.category === 'CRITICAL');
    expect(card.config.problem).toBe('Runs every 10 min, below the 30 min threshold.');
  });

  it('CRITICAL without evidence => config.problem === FIX_LIBRARY.CRITICAL.problem', () => {
    const job = makeJob(['CRITICAL'], []);
    const cards = buildFixCards([job]);
    const card = cards.find((c) => c.category === 'CRITICAL');
    expect(card.config.problem).toBe(FIX_LIBRARY.CRITICAL.problem);
  });

  it('ERROR_WASTE with evidence => config.problem is evidence-backed', () => {
    const job = makeJob(['ERROR_WASTE'], [{ ruleId: 'ERROR_WASTE', observedValue: 0.67, threshold: 0.10 }]);
    const cards = buildFixCards([job]);
    const card = cards.find((c) => c.category === 'ERROR_WASTE');
    expect(card.config.problem).toBe('67% error rate, above the 10% threshold.');
  });

  it('ERROR_WASTE without evidence => config.problem === FIX_LIBRARY.ERROR_WASTE.problem', () => {
    const job = makeJob(['ERROR_WASTE'], []);
    const cards = buildFixCards([job]);
    const card = cards.find((c) => c.category === 'ERROR_WASTE');
    expect(card.config.problem).toBe(FIX_LIBRARY.ERROR_WASTE.problem);
  });

  it('action text remains exactly equal to FIX_LIBRARY[category].action', () => {
    const job = makeJob(['CRITICAL'], [{ ruleId: 'CRITICAL', observedValue: 10, threshold: 30 }]);
    const cards = buildFixCards([job]);
    const card = cards.find((c) => c.category === 'CRITICAL');
    expect(card.config.action).toBe(FIX_LIBRARY.CRITICAL.action);
    expect(card.config.impactLabel).toBe(FIX_LIBRARY.CRITICAL.impactLabel);
  });

  it('WARNING with evidence => FIX_LIBRARY.WARNING.problem (no override)', () => {
    const job = makeJob(['WARNING'], [{ ruleId: 'WARNING', observedValue: 45, threshold: 60 }]);
    const cards = buildFixCards([job]);
    const card = cards.find((c) => c.category === 'WARNING');
    expect(card.config.problem).toBe(FIX_LIBRARY.WARNING.problem);
  });

  it('PREMIUM_MODEL_WASTE with evidence => FIX_LIBRARY.PREMIUM_MODEL_WASTE.problem (no override)', () => {
    const job = makeJob(['PREMIUM_MODEL_WASTE'], [{ ruleId: 'PREMIUM_MODEL_WASTE', observedValue: 'Claude Opus', threshold: null }]);
    const cards = buildFixCards([job]);
    const card = cards.find((c) => c.category === 'PREMIUM_MODEL_WASTE');
    expect(card.config.problem).toBe(FIX_LIBRARY.PREMIUM_MODEL_WASTE.problem);
  });

  it('category order preserved: CRITICAL before ERROR_WASTE', () => {
    const cJob = makeJob(['CRITICAL'], [{ ruleId: 'CRITICAL', observedValue: 10, threshold: 30 }]);
    const eJob = makeJob(['ERROR_WASTE'], [{ ruleId: 'ERROR_WASTE', observedValue: 0.67, threshold: 0.10 }]);
    const cards = buildFixCards([cJob, eJob]);
    const cats = cards.map((c) => c.category);
    expect(cats.indexOf('CRITICAL')).toBeLessThan(cats.indexOf('ERROR_WASTE'));
  });

  it('CRITICAL observedValue null => fallback to FIX_LIBRARY.CRITICAL.problem through buildFixCards()', () => {
    const job = makeJob(['CRITICAL'], [{ ruleId: 'CRITICAL', observedValue: null, threshold: 30 }]);
    const cards = buildFixCards([job]);
    const card = cards.find((c) => c.category === 'CRITICAL');
    expect(card.config.problem).toBe(FIX_LIBRARY.CRITICAL.problem);
  });

  it('CRITICAL threshold null => fallback to FIX_LIBRARY.CRITICAL.problem through buildFixCards()', () => {
    const job = makeJob(['CRITICAL'], [{ ruleId: 'CRITICAL', observedValue: 10, threshold: null }]);
    const cards = buildFixCards([job]);
    const card = cards.find((c) => c.category === 'CRITICAL');
    expect(card.config.problem).toBe(FIX_LIBRARY.CRITICAL.problem);
  });

  it('ERROR_WASTE observedValue "" => fallback to FIX_LIBRARY.ERROR_WASTE.problem through buildFixCards()', () => {
    const job = makeJob(['ERROR_WASTE'], [{ ruleId: 'ERROR_WASTE', observedValue: '', threshold: 0.10 }]);
    const cards = buildFixCards([job]);
    const card = cards.find((c) => c.category === 'ERROR_WASTE');
    expect(card.config.problem).toBe(FIX_LIBRARY.ERROR_WASTE.problem);
  });

  it('ERROR_WASTE threshold "" => fallback to FIX_LIBRARY.ERROR_WASTE.problem through buildFixCards()', () => {
    const job = makeJob(['ERROR_WASTE'], [{ ruleId: 'ERROR_WASTE', observedValue: 0.67, threshold: '' }]);
    const cards = buildFixCards([job]);
    const card = cards.find((c) => c.category === 'ERROR_WASTE');
    expect(card.config.problem).toBe(FIX_LIBRARY.ERROR_WASTE.problem);
  });

  it('whitespace-only string observedValue => fallback to FIX_LIBRARY.CRITICAL.problem through buildFixCards()', () => {
    const job = makeJob(['CRITICAL'], [{ ruleId: 'CRITICAL', observedValue: '   ', threshold: 30 }]);
    const cards = buildFixCards([job]);
    const card = cards.find((c) => c.category === 'CRITICAL');
    expect(card.config.problem).toBe(FIX_LIBRARY.CRITICAL.problem);
  });

  it('valid finite numbers still produce evidence-backed problem through buildFixCards()', () => {
    const job = makeJob(['CRITICAL'], [{ ruleId: 'CRITICAL', observedValue: 10, threshold: 30 }]);
    const cards = buildFixCards([job]);
    const card = cards.find((c) => c.category === 'CRITICAL');
    expect(card.config.problem).toBe('Runs every 10 min, below the 30 min threshold.');
  });

  it('multiple jobs with same category produce separate job-level cards', () => {
    const j1 = makeJob(['CRITICAL'], [{ ruleId: 'CRITICAL', observedValue: 10, threshold: 30 }]);
    j1.totalTokens = 100; j1.errorRate = 0.1;
    const j2 = makeJob(['CRITICAL'], [{ ruleId: 'CRITICAL', observedValue: 10, threshold: 30 }]);
    j2.totalTokens = 1000; j2.errorRate = 0.5;
    const cards = buildFixCards([j1, j2]);
    const criticalCards = cards.filter((c) => c.category === 'CRITICAL');
    expect(criticalCards).toHaveLength(2);
    expect(criticalCards[0].jobs).toHaveLength(1);
    expect(criticalCards[0].job.totalTokens).toBe(1000); // higher waste first inside category
  });
});

describe('I20: LLM_AGENT_CRON in buildFixCards ordering', () => {
  const makeJob = (issues, evidence = []) => ({
    issues,
    id: `job-${Math.random()}`,
    name: 'test job',
    lifecycleStatus: 'active',
    totalTokens: 1000,
    errorRate: 0.5,
    evidence
  });

  it('LLM_AGENT_CRON appears in output when jobs have that issue', () => {
    const job = makeJob(['LLM_AGENT_CRON'], []);
    const cards = buildFixCards([job]);
    const cats = cards.map((c) => c.category);
    expect(cats).toContain('LLM_AGENT_CRON');
  });

  it('LLM_AGENT_CRON appears before ERROR_WASTE in output order', () => {
    const llmJob = makeJob(['LLM_AGENT_CRON'], []);
    const errJob = makeJob(['ERROR_WASTE'], [{ ruleId: 'ERROR_WASTE', observedValue: 0.67, threshold: 0.10 }]);
    const cards = buildFixCards([llmJob, errJob]);
    const cats = cards.map((c) => c.category);
    expect(cats.indexOf('LLM_AGENT_CRON')).toBeLessThan(cats.indexOf('ERROR_WASTE'));
  });

  it('LLM_AGENT_CRON appears after CRITICAL in output order', () => {
    const critJob = makeJob(['CRITICAL'], [{ ruleId: 'CRITICAL', observedValue: 10, threshold: 30 }]);
    const llmJob = makeJob(['LLM_AGENT_CRON'], []);
    const cards = buildFixCards([llmJob, critJob]);
    const cats = cards.map((c) => c.category);
    expect(cats.indexOf('CRITICAL')).toBeLessThan(cats.indexOf('LLM_AGENT_CRON'));
  });
});

describe('I21: buildFixCards active actionability', () => {
  const makeJob = (overrides = {}) => ({
    id: overrides.id || 'job-id',
    name: overrides.name || 'job name',
    issues: overrides.issues || ['ERROR_WASTE'],
    lifecycleStatus: overrides.lifecycleStatus || 'active',
    totalTokens: overrides.totalTokens ?? 1000,
    errorRate: overrides.errorRate ?? 0.5,
    evidence: overrides.evidence || [{ ruleId: 'ERROR_WASTE', observedValue: 0.5, threshold: 0.1 }],
  });

  it('OK jobs are not rendered in How To Fix input cards', () => {
    expect(buildFixCards([makeJob({ issues: ['OK'] })])).toHaveLength(0);
  });

  it('historical jobs are not rendered as active action cards', () => {
    expect(buildFixCards([makeJob({ lifecycleStatus: 'historical' })])).toHaveLength(0);
  });

  it('disabled jobs are not rendered as active action cards', () => {
    expect(buildFixCards([makeJob({ lifecycleStatus: 'disabled' })])).toHaveLength(0);
  });

  it('multiple ERROR_WASTE jobs produce separate job action cards', () => {
    const cards = buildFixCards([
      makeJob({ id: 'err-a', name: 'err a', totalTokens: 1000 }),
      makeJob({ id: 'err-b', name: 'err b', totalTokens: 2000 }),
    ]);
    expect(cards).toHaveLength(2);
    expect(cards.every((card) => card.category === 'ERROR_WASTE')).toBe(true);
    expect(cards.every((card) => card.jobs.length === 1)).toBe(true);
    expect(cards.map((card) => card.job.id)).toEqual(['err-b', 'err-a']);
  });
});
