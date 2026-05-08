// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── I16: RAR import guidance — mapErrorMessage regression ──────────────────────
//
// Tests the mapErrorMessage error-branching logic in src/main.ts.
// mapErrorMessage is module-scoped (not exported), so we extract it by reading
// the source file and evaluating the function body directly (same pattern as
// i15a-openclaw-cli-guidance.test.ts for buildFixSteps).

function extractMapErrorMessage() {
  const src = readFileSync(resolve(__dirname, '../src/main.ts'), 'utf8');

  const fnStart = src.indexOf('function mapErrorMessage(raw) {');
  if (fnStart === -1) throw new Error('mapErrorMessage not found in main.ts');

  let depth = 0, fnEnd = fnStart;
  for (let i = fnStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { fnEnd = i + 1; break; } }
  }
  const fnBody = src.slice(fnStart, fnEnd);

  const wrapper = `(function(){
    ${fnBody}
    return mapErrorMessage;
  })()`;
  // eslint-disable-next-line no-eval
  return eval(wrapper);
}

const mapErrorMessage = extractMapErrorMessage();

describe('I16: RAR import guidance', () => {

  it('RAR archive error maps to local-extract guidance with supported formats', () => {
    const input = 'RAR archive detected. Please extract locally and drag in jobs.json and runs/*.jsonl.';
    const result = mapErrorMessage(input);
    expect(result).toContain('.rar files need to be extracted locally first');
    expect(result).toContain('jobs.json');
    expect(result).toContain('runs/*.jsonl');
    expect(result).toContain('.zip, .json, and .jsonl');
  });

  it('generic unsupported file type still maps to OpenClaw export guidance', () => {
    const input = 'Unsupported file type: myfile.tar. Please use .zip, .json, or .jsonl.';
    const result = mapErrorMessage(input);
    expect(result).toBe('Use a .zip, .json, or .jsonl file from your OpenClaw export.');
  });

  it('RAR branch does not intercept other error messages', () => {
    const input = 'Some unrelated error message';
    const result = mapErrorMessage(input);
    expect(result).toBe('Some unrelated error message');
  });

  it('RAR branch is case-sensitive to "RAR archive detected" identifier', () => {
    const input = 'Archive detected. Please extract locally and drag in jobs.json and runs/*.jsonl.';
    const result = mapErrorMessage(input);
    // Should NOT trigger RAR branch (no "RAR archive detected" identifier)
    expect(result).toBe(input);
  });

});