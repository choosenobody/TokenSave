// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function extractBuildFixSteps() {
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

  const escapeShim = `function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }`;
  const wrapper = `(function(){
    ${escapeShim}
    ${extractFn('cmdLine(text)')}
    ${extractFn('cmdBlock(label, content)')}
    ${extractFn('buildFixSteps(category, idList, genericAction)')}
    return buildFixSteps;
  })()`;
  // eslint-disable-next-line no-eval
  return eval(wrapper);
}

const buildFixSteps = extractBuildFixSteps();

describe('I21 real smoke actionability rendering contract', () => {
  it('active ERROR_WASTE job renders job-level read-only inspect commands first', () => {
    const html = buildFixSteps('ERROR_WASTE', 'job-123', 'generic');
    expect(html).toContain('openclaw cron show job-123');
    expect(html).toContain('openclaw cron runs --id job-123 --limit 5');
    expect(html).not.toMatch(/openclaw cron (edit|disable|enable|delete)\b/);
  });

  it('non-error action cards also use inspect-only first commands', () => {
    const src = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8');
    expect(src).toMatch(/: buildInspectSteps\(idList\)/);
    expect(src).toMatch(/function buildInspectSteps\(id\)/);
    const fnStart = src.indexOf('function buildInspectSteps(id)');
    const fnEnd = src.indexOf('\n\n    function buildWhyFirstText', fnStart);
    const fnBody = src.slice(fnStart, fnEnd);
    expect(fnBody).toMatch(/openclaw cron show/);
    expect(fnBody).toMatch(/openclaw cron runs --id/);
    expect(fnBody).not.toMatch(/openclaw cron (edit|disable|enable|delete)\b/);
  });

  it('primary action area contains "What To Do First" with copy-the-prompt CTA', () => {
    const src = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8');
    // The old "Start here" language is gone
    expect(src).not.toMatch(/Start here: inspect this job first/);
    // The new first card uses "What To Do First" section with copy CTA
    expect(src).toMatch(/What To Do First/);
    expect(src).toMatch(/Copy the agent diagnosis prompt below/);
    expect(src).toMatch(/first-action-card/);
  });

  it('synthetic unmatched historical records show re-export guidance, not active fix commands', () => {
    const src = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8');
    const historicalStart = src.indexOf("className = 'historical-review'");
    const historicalEnd = src.indexOf('// Add copy function to window', historicalStart);
    const historicalBlock = src.slice(historicalStart, historicalEnd);
    expect(historicalBlock).toMatch(/This run record has no matching current job definition\. Re-export current OpenClaw cron data before acting\./);
    expect(historicalBlock).not.toMatch(/buildFixSteps\(/);
    expect(historicalBlock).not.toMatch(/openclaw cron (edit|disable|enable|delete)\b/);
  });

  it('OK healthy state uses the no active recurring waste findings message', () => {
    const src = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8');
    expect(src).toMatch(/No active recurring waste findings detected in this import\./);
  });

  it('stale snapshot warning is scoped to unmatched historical records only', () => {
    const src = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8');
    expect(src).toMatch(/const hasSyntheticJobs = historicalJobs && historicalJobs\.some\(j => j\.lifecycleStatus === 'historical'\)/);
    expect(src).toMatch(/Active jobs with current job definitions are not marked stale by this warning\./);
  });

  it('cost chart is demoted as secondary in the primary page', () => {
    const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
    expect(html).toMatch(/Approx\. Cost by Job \(Secondary\)/);
    expect(html).not.toMatch(/<div class="pie-title">Cost by Job<\/div>/);
  });

  // --- reboot/v0-action-first contract tests ---

  it('action section (fixGrid) appears before all report sections in index.html', () => {
    const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
    const fixGridPos = html.indexOf('id="fixGrid"');
    const importSummaryPos = html.indexOf('id="importSummary"');
    const summaryGridPos = html.indexOf('id="summaryGrid"');
    const wasteSectionBodyPos = html.indexOf('id="wasteSectionBody"');
    const jobTableBodyPos = html.indexOf('id="jobTableBody"');
    expect(fixGridPos).toBeGreaterThan(0);
    expect(importSummaryPos).toBeGreaterThan(fixGridPos);
    expect(summaryGridPos).toBeGreaterThan(fixGridPos);
    expect(wasteSectionBodyPos).toBeGreaterThan(fixGridPos);
    expect(jobTableBodyPos).toBeGreaterThan(fixGridPos);
  });

  it('fullReportDetails is a <details> block and is not open by default', () => {
    const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
    expect(html).toMatch(/<details[^>]*id="fullReportDetails"[^>]*>/);
    // Must NOT have open attribute
    expect(html).not.toMatch(/<details[^>]*id="fullReportDetails"[^>]*open/);
  });

  it('other active findings are rendered as <details class="other-findings">', () => {
    const src = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8');
    // details element created via createElement('details')
    expect(src).toMatch(/createElement\('details'\)/);
    // className property sets the class
    expect(src).toMatch(/className = 'other-findings'/);
    // innerHTML contains a summary with the expected class
    expect(src).toMatch(/<summary class="other-findings-summary">/);
  });

  it('summary labels do not include hard-coded ▼ arrows — CSS ::before controls state', () => {
    const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
    expect(html).not.toMatch(/▼ View full report/);
    expect(html).not.toMatch(/full-report-summary-label">▼/);

    const src = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8');
    // Other-findings summary must not start with ▼
    expect(src).not.toMatch(/summary class="other-findings-summary">\s*▼/);
  });
});
