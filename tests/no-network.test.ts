import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * I7A: No-Network Regression Test
 * 
 * Static scan of built dist/assets/*.js files to ensure no forbidden
 * network APIs are present after build.
 * 
 * Forbidden patterns:
 *   - fetch( — XMLHttpRequest / fetch API calls
 *   - XMLHttpRequest — XHR object constructor
 *   - sendBeacon — navigator.sendBeacon
 *   - WebSocket — WebSocket constructor
 *   - EventSource — EventSource constructor
 *   - https?:// — external URL literals (data URIs and allowlisted internal refs OK)
 */

function globJsFiles(dir: string): string[] {
  try {
    return readdirSync(dir).filter(f => f.endsWith('.js')).map(f => join(dir, f));
  } catch {
    return [];
  }
}

const DIST_DIR = 'dist/assets';
const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /XMLHttpRequest/,       name: 'XMLHttpRequest' },
  { pattern: /sendBeacon/,           name: 'sendBeacon' },
  { pattern: /WebSocket/,            name: 'WebSocket' },
  { pattern: /EventSource/,          name: 'EventSource' },
  { pattern: /https?:\/\//,         name: 'https?:// URL literal' },
];

function isViteModulepreloadPolyfillFetch(content: string, fetchIndex: number): boolean {
  const fetchCall = /^fetch\(([A-Za-z_$][\w$]*)\.href,([A-Za-z_$][\w$]*)\)/.exec(content.slice(fetchIndex));
  if (!fetchCall) {
    return false;
  }

  const [, linkVar, optionsVar] = fetchCall;
  const functionStart = content.lastIndexOf('function ', fetchIndex);
  if (functionStart === -1) {
    return false;
  }

  const functionHeader = /^function\s+[A-Za-z_$][\w$]*\(([A-Za-z_$][\w$]*)\)\{/.exec(
    content.slice(functionStart, functionStart + 80),
  );
  if (!functionHeader || functionHeader[1] !== linkVar) {
    return false;
  }

  const bodyBeforeFetch = content.slice(functionStart, fetchIndex);
  const polyfillPrelude = content.slice(Math.max(0, functionStart - 700), functionStart);

  // Vite emits a modulepreload compatibility polyfill that preloads local bundle
  // chunks via fetch(link.href, options). That browser feature shim is build
  // output, not TokenSave app code, so this precise shape is exempted while any
  // other runtime fetch(...) remains a violation.
  return (
    polyfillPrelude.includes('relList') &&
    polyfillPrelude.includes('modulepreload') &&
    polyfillPrelude.includes('querySelectorAll') &&
    polyfillPrelude.includes('MutationObserver') &&
    bodyBeforeFetch.includes(`${linkVar}.ep`) &&
    bodyBeforeFetch.includes(`${linkVar}.ep=!0`) &&
    new RegExp(`const\\s+${optionsVar}=[A-Za-z_$][\\w$]*\\(${linkVar}\\);\\s*$`).test(bodyBeforeFetch)
  );
}

function collectFetchViolations(content: string, file: string): Array<{ file: string; name: string; line: number; context: string }> {
  const violations: Array<{ file: string; name: string; line: number; context: string }> = [];
  const fetchPattern = /fetch\(/g;
  let match: RegExpExecArray | null;

  while ((match = fetchPattern.exec(content)) !== null) {
    if (isViteModulepreloadPolyfillFetch(content, match.index)) {
      continue;
    }

    const line = content.slice(0, match.index).split('\n').length;
    const lineStart = content.lastIndexOf('\n', match.index - 1) + 1;
    const lineEnd = content.indexOf('\n', match.index);
    const fullLine = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);

    violations.push({
      file,
      name: 'fetch(',
      line,
      context: fullLine.trim().slice(0, 120),
    });
  }

  return violations;
}

describe('I7A — No-Network Regression Test', () => {
  it('dist JS files exist after build', () => {
    const files = globJsFiles(DIST_DIR);
    expect(files.length, `Expected at least one JS file in dist/assets/, found ${files.length}`).toBeGreaterThan(0);
  });

  it('no forbidden network APIs in built output', () => {
    const files = globJsFiles(DIST_DIR);
    expect(files.length, `dist/assets/*.js not found — run \`npm run build\` first`).toBeGreaterThan(0);

    const violations: Array<{ file: string; name: string; line: number; context: string }> = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      violations.push(...collectFetchViolations(content, file));

      for (const { pattern, name } of FORBIDDEN_PATTERNS) {
        lines.forEach((line, idx) => {
          if (pattern.test(line)) {
            violations.push({
              file,
              name,
              line: idx + 1,
              context: line.trim().slice(0, 120),
            });
          }
        });
      }
    }

    if (violations.length > 0) {
      const report = violations
        .map(v => `  [${v.name}] ${v.file}:${v.line}\n    ${v.context}`)
        .join('\n');
      expect.fail(`Forbidden network API(s) found in dist/assets/*.js:\n${report}`);
    }
  });
});
