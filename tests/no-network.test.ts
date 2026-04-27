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
  // fetch( — but exclude Vite's modulepreload polyfill which uses fetch(s.href,...)
  // Vite injects this automatically; it's build infra, not app code
  { pattern: /fetch\((?!s\.href)/, name: 'fetch(' },
  { pattern: /XMLHttpRequest/,       name: 'XMLHttpRequest' },
  { pattern: /sendBeacon/,           name: 'sendBeacon' },
  { pattern: /WebSocket/,            name: 'WebSocket' },
  { pattern: /https?:\/\//,         name: 'https?:// URL literal' },
];

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
