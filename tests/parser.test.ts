// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { parseJson, parseJsonl, parseZipEntries, detectImportSource } from '../src/parser.ts';

// ---------------------------------------------------------------------------
// ZIP helper
// ---------------------------------------------------------------------------

function makeStoredZip(filename, content) {
  const encoder = new TextEncoder();
  const nameBytes = encoder.encode(filename);
  const contentBytes = encoder.encode(content);
  const nameLen = nameBytes.length;
  const contentLen = contentBytes.length;

  // ── Local file header (offset 0) ────────────────────────────────────────
  // 30 bytes fixed header + name + content
  const localHeader = new Uint8Array(30 + nameLen + contentLen);
  const localView = new DataView(localHeader.buffer);

  localView.setUint32(0, 0x04034b50, true);          // sig
  localView.setUint16(4, 20, true);                  // version needed
  localView.setUint16(6, 0, true);                    // general purpose bit flag
  localView.setUint16(8, 0, true);                    // compression method (stored)
  localView.setUint16(10, 0, true);                   // last mod time
  localView.setUint16(12, 0, true);                   // last mod date
  localView.setUint32(14, 0, true);                   // crc32
  localView.setUint32(18, contentLen, true);          // compressed size
  localView.setUint32(22, contentLen, true);          // uncompressed size
  localView.setUint16(26, nameLen, true);             // filename length
  localView.setUint16(28, 0, true);                    // extra field length
  localHeader.set(nameBytes, 30);
  localHeader.set(contentBytes, 30 + nameLen);

  // ── Central directory file header ────────────────────────────────────────
  // 46 bytes fixed header + name
  const centralDirEntry = new Uint8Array(46 + nameLen);
  const cdView = new DataView(centralDirEntry.buffer);

  const cdOffset = 30 + nameLen + contentLen;         // offset of central directory

  cdView.setUint32(0, 0x02014b50, true);              // sig
  cdView.setUint16(4, 20, true);                       // version made by
  cdView.setUint16(6, 20, true);                      // version needed
  cdView.setUint16(8, 0, true);                        // general purpose bit flag
  cdView.setUint16(10, 0, true);                       // compression method (stored) ← parser reads this
  cdView.setUint16(12, 0, true);                       // last mod time
  cdView.setUint16(14, 0, true);                       // last mod date
  cdView.setUint32(16, 0, true);                       // crc32
  cdView.setUint32(20, contentLen, true);             // compressed size
  cdView.setUint32(24, contentLen, true);             // uncompressed size
  cdView.setUint16(28, nameLen, true);                 // filename length
  cdView.setUint16(30, 0, true);                        // extra field length
  cdView.setUint16(32, 0, true);                        // file comment length
  cdView.setUint16(34, 0, true);                        // disk number start
  cdView.setUint16(36, 0, true);                        // internal file attributes
  cdView.setUint32(38, 0, true);                        // external file attributes
  cdView.setUint32(42, 0, true);                        // local header offset (points to local header at offset 0)
  centralDirEntry.set(nameBytes, 46);

  // ── End of Central Directory (22 bytes) ──────────────────────────────────
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  const cdSize = centralDirEntry.length;              // size of central directory

  eocdView.setUint32(0, 0x06054b50, true);            // sig
  eocdView.setUint16(4, 0, true);                      // disk number
  eocdView.setUint16(6, 0, true);                      // disk with central directory
  eocdView.setUint16(8, 1, true);                      // entries on this disk
  eocdView.setUint16(10, 1, true);                     // total entries
  eocdView.setUint32(12, cdSize, true);                // size of central directory
  eocdView.setUint32(16, cdOffset, true);             // offset of central directory
  eocdView.setUint16(20, 0, true);                      // comment length

  // Concatenate: local header + central directory entry + EOCD
  const zip = new Uint8Array(localHeader.length + centralDirEntry.length + eocd.length);
  zip.set(localHeader, 0);
  zip.set(centralDirEntry, localHeader.length);
  zip.set(eocd, localHeader.length + centralDirEntry.length);

  return zip.buffer;
}

// ---------------------------------------------------------------------------
// parseJson
// ---------------------------------------------------------------------------

describe('parseJson', () => {
  it('parses valid JSON object', () => {
    const result = parseJson('{"model":"gpt-4o","tokens":100}');
    expect(result).toEqual({ model: 'gpt-4o', tokens: 100 });
  });

  it('parses valid JSON array', () => {
    const result = parseJson('[1,2,3]');
    expect(result).toEqual([1, 2, 3]);
  });

  it('throws on malformed JSON including filename', () => {
    expect(() => parseJson('{invalid}', 'bad.json')).toThrow('Malformed JSON in bad.json');
  });

  it('throws on empty input', () => {
    expect(() => parseJson('', 'empty.json')).toThrow('Malformed JSON in empty.json');
  });
});

// ---------------------------------------------------------------------------
// parseJsonl
// ---------------------------------------------------------------------------

describe('parseJsonl', () => {
  it('parses multiple JSONL object records', () => {
    const result = parseJsonl('{"a":1}\n{"b":2}\n{"c":3}');
    expect(result).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
  });

  it('ignores blank lines', () => {
    const result = parseJsonl('{"x":1}\n\n{"y":2}\n\n');
    expect(result).toEqual([{ x: 1 }, { y: 2 }]);
  });

  it('malformed line throws error containing filename and line number', () => {
    expect(() => parseJsonl('{"ok":true}\n{broken}\n{"after":true}', 'broken.jsonl'))
      .toThrow('Malformed JSONL in broken.jsonl at line 2');
  });

  it('rejects non-object record — string', () => {
    expect(() => parseJsonl('"string"\n{"a":1}')).toThrow('Expected an object per line');
  });

  it('rejects non-object record — array', () => {
    expect(() => parseJsonl('[1,2]\n{"a":1}')).toThrow('Expected an object per line');
  });
});

// ---------------------------------------------------------------------------
// parseZipEntries
// ---------------------------------------------------------------------------

describe('parseZipEntries', () => {
  it('parses a complete minimal stored/uncompressed ZIP entry', async () => {
    const buf = makeStoredZip('hello.txt', 'world');
    const entries = await parseZipEntries(buf);
    expect(entries).toEqual([{ name: 'hello.txt', text: 'world' }]);
  });

  it('rejects malformed buffer with no EOCD', async () => {
    const incomplete = new Uint8Array([1, 2, 3, 4, 5]).buffer;
    await expect(parseZipEntries(incomplete)).rejects.toThrow('Unable to locate ZIP central directory.');
  });

  it('rejects unsupported compression method', async () => {
    // Build a ZIP where the central directory declares compression method 1 (Shrunk / unsupported).
    // The parser will reject it at the unsupported-method branch, not the deflate branch.
    const encoder = new TextEncoder();
    const filename = 'test.txt';
    const content = 'hello';
    const nameBytes = encoder.encode(filename);
    const contentBytes = encoder.encode(content);
    const nameLen = nameBytes.length;
    const contentLen = contentBytes.length;

    // Local header (method=1 to trigger the unsupported branch)
    const localHeader = new Uint8Array(30 + nameLen + contentLen);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 1, true);                   // compression method: 1 (Shrunk / unsupported) in local header
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, 0, true);
    localView.setUint32(18, contentLen, true);
    localView.setUint32(22, contentLen, true);
    localView.setUint16(26, nameLen, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localHeader.set(contentBytes, 30 + nameLen);

    // Central directory entry (method=1 — this is what the parser reads)
    const centralDirEntry = new Uint8Array(46 + nameLen);
    const cdView = new DataView(centralDirEntry.buffer);
    const cdOffset = 30 + nameLen + contentLen;
    cdView.setUint32(0, 0x02014b50, true);
    cdView.setUint16(4, 20, true);
    cdView.setUint16(6, 20, true);
    cdView.setUint16(8, 0, true);
    cdView.setUint16(10, 1, true);                      // compression method: 1 ← parser reads this
    cdView.setUint16(12, 0, true);
    cdView.setUint16(14, 0, true);
    cdView.setUint32(16, 0, true);
    cdView.setUint32(20, contentLen, true);
    cdView.setUint32(24, contentLen, true);
    cdView.setUint16(28, nameLen, true);
    cdView.setUint16(30, 0, true);
    cdView.setUint16(32, 0, true);
    cdView.setUint16(34, 0, true);
    cdView.setUint16(36, 0, true);
    cdView.setUint32(38, 0, true);
    cdView.setUint32(42, 0, true);
    centralDirEntry.set(nameBytes, 46);

    // EOCD
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, 1, true);
    eocdView.setUint16(10, 1, true);
    eocdView.setUint32(12, centralDirEntry.length, true);
    eocdView.setUint32(16, cdOffset, true);
    eocdView.setUint16(20, 0, true);

    const zip = new Uint8Array(localHeader.length + centralDirEntry.length + eocd.length);
    zip.set(localHeader, 0);
    zip.set(centralDirEntry, localHeader.length);
    zip.set(eocd, localHeader.length + centralDirEntry.length);

    await expect(parseZipEntries(zip.buffer)).rejects.toThrow('ZIP compression method 1 is not supported');
  });
});

// ---------------------------------------------------------------------------
// Fixture-based parser tests
// ---------------------------------------------------------------------------

describe('parseJson — fixtures', () => {
  it('parses a realistic jobs JSON file', () => {
    const content = readFileSync('tests/fixtures/parser/jobs.valid.json', 'utf8');
    const result = parseJson(content);
    expect(Array.isArray(result.jobs)).toBe(true);
    expect(result.jobs.length).toBeGreaterThan(0);
    expect(result.jobs[0]).toHaveProperty('model');
    expect(result.jobs[0]).toHaveProperty('totalTokens');
  });

  it('throws on malformed JSON fixture with filename', () => {
    expect(() => parseJson(readFileSync('tests/fixtures/parser/malformed.json', 'utf8'), 'malformed.json'))
      .toThrow(/Malformed JSON in malformed.json/);
  });
});

describe('detectImportSource', () => {
  it('detects openclaw-like from meta', () => {
    const result = detectImportSource({ jobs: [], meta: { openclaw_version: '1.0.0' }, runBundles: [] });
    expect(result.detectedSource).toBe('openclaw-like');
    expect(result.confidence).toBe('low');
    expect(result.fileCount).toBe(0);
    expect(result.recordCount).toBe(0);
  });

  it('detects jsonl-records from runs only', () => {
    const result = detectImportSource({ jobs: [], meta: null, runBundles: [{ fileName: 'runs.jsonl', records: [{ tokens: 100 }] }] });
    expect(result.detectedSource).toBe('jsonl-records');
    expect(result.recordCount).toBe(1);
    expect(result.evidenceHint.hasTokens).toBe(true);
    expect(result.evidenceHint.hasRuns).toBe(true);
    expect(result.confidence).toBe('high');
    expect(result.supportedRuleHint).toBe('partial');
  });

  it('detects generic-json from jobs only', () => {
    const result = detectImportSource({ jobs: [{ id: '1', name: 'test', schedule: 'daily' }], meta: null, runBundles: [] });
    expect(result.detectedSource).toBe('generic-json');
    expect(result.evidenceHint.hasJobs).toBe(true);
    expect(result.evidenceHint.hasSchedules).toBe(true);
    expect(result.evidenceHint.hasRuns).toBe(false);
  });

  it('detects zip-mixed from jobs + runs', () => {
    const result = detectImportSource({ jobs: [{ id: '1', name: 'test' }], meta: null, runBundles: [{ fileName: 'run.jsonl', records: [{ tokens: 100, error: false }] }] });
    expect(result.detectedSource).toBe('zip-mixed');
    expect(result.evidenceHint.hasJobs).toBe(true);
    expect(result.evidenceHint.hasRuns).toBe(true);
    expect(result.evidenceHint.hasTokens).toBe(true);
    expect(result.confidence).toBe('high');
    // full requires jobs + runs + tokens + schedules + models; this dataset has no schedule/model → partial
    expect(result.supportedRuleHint).toBe('partial');
  });

  it('returns full supportedRuleHint only when jobs+runs+tokens+schedules+models are all present', () => {
    const result = detectImportSource({ jobs: [{ id: '1', name: 'test', schedule: 'hourly', model: 'gpt-4o' }], meta: null, runBundles: [{ fileName: 'run.jsonl', records: [{ tokens: 100, model: 'gpt-4o' }] }] });
    expect(result.supportedRuleHint).toBe('full');
    expect(result.confidence).toBe('high');
    expect(result.evidenceHint.hasJobs).toBe(true);
    expect(result.evidenceHint.hasRuns).toBe(true);
    expect(result.evidenceHint.hasTokens).toBe(true);
    expect(result.evidenceHint.hasSchedules).toBe(true);
    expect(result.evidenceHint.hasModels).toBe(true);
  });

  it('returns partial when only tokens (no jobs)', () => {
    const result = detectImportSource({ jobs: [], meta: null, runBundles: [{ fileName: 'run.jsonl', records: [{ tokens: 100 }] }] });
    expect(result.supportedRuleHint).toBe('partial');
    expect(result.confidence).toBe('high');
  });

  it('medium confidence when no tokens but has records', () => {
    const result = detectImportSource({ jobs: [{ id: '1', name: 'test' }], meta: null, runBundles: [{ fileName: 'run.jsonl', records: [{}] }] });
    expect(result.confidence).toBe('medium');
    expect(result.evidenceHint.hasTokens).toBe(false);
  });

  it('detects hasErrors from run record', () => {
    const result = detectImportSource({ jobs: [], meta: null, runBundles: [{ fileName: 'run.jsonl', records: [{ tokens: 50, error: 'connection refused' }] }] });
    expect(result.evidenceHint.hasErrors).toBe(true);
    expect(result.evidenceHint.hasTokens).toBe(true);
  });

  it('unknown source when empty dataset', () => {
    const result = detectImportSource({ jobs: [], meta: null, runBundles: [] });
    expect(result.detectedSource).toBe('unknown');
    expect(result.supportedRuleHint).toBe('unavailable');
    expect(result.confidence).toBe('low');
  });

  it('openclaw-like when job has agentTurn', () => {
    const result = detectImportSource({ jobs: [{ id: '1', name: 'agent', agentTurn: true }], meta: null, runBundles: [] });
    expect(result.detectedSource).toBe('openclaw-like');
  });

  it('openclaw-like when job has runs embedded', () => {
    const result = detectImportSource({ jobs: [{ id: '1', name: 'agent', runs: [{ tokens: 100 }] }], meta: null, runBundles: [] });
    expect(result.detectedSource).toBe('openclaw-like');
    expect(result.evidenceHint.hasRuns).toBe(true);
  });

  it('fileCount equals number of runBundles', () => {
    const result = detectImportSource({ jobs: [], meta: null, runBundles: [{ fileName: 'a.jsonl', records: [] }, { fileName: 'b.jsonl', records: [] }] });
    expect(result.fileCount).toBe(2);
  });

  it('fileCount uses dataset.fileCount when provided as finite non-negative number', () => {
    const result = detectImportSource({ jobs: [{ id: '1', name: 'test' }], meta: null, runBundles: [], fileCount: 1 });
    expect(result.fileCount).toBe(1);
  });

  it('fileCount falls back to runBundles.length when dataset.fileCount is absent', () => {
    const result = detectImportSource({ jobs: [], meta: null, runBundles: [{ fileName: 'a.jsonl', records: [] }, { fileName: 'b.jsonl', records: [] }] });
    expect(result.fileCount).toBe(2);
  });

  it('fileCount falls back to runBundles.length when dataset.fileCount is undefined', () => {
    const result = detectImportSource({ jobs: [], meta: null, runBundles: [{ fileName: 'a.jsonl', records: [] }] });
    expect(result.fileCount).toBe(1);
  });

  it('zero tokens: 0 is detected as token evidence via tokens field', () => {
    const result = detectImportSource({ jobs: [], meta: null, runBundles: [{ fileName: 'run.jsonl', records: [{ tokens: 0 }] }] });
    expect(result.evidenceHint.hasTokens).toBe(true);
    expect(result.confidence).toBe('high');
  });

  it('zero tokens: 0 is detected as token evidence via total_tokens field', () => {
    const result = detectImportSource({ jobs: [], meta: null, runBundles: [{ fileName: 'run.jsonl', records: [{ total_tokens: 0 }] }] });
    expect(result.evidenceHint.hasTokens).toBe(true);
  });

  it('zero tokens: 0 is detected as token evidence via token_count field', () => {
    const result = detectImportSource({ jobs: [], meta: null, runBundles: [{ fileName: 'run.jsonl', records: [{ token_count: 0 }] }] });
    expect(result.evidenceHint.hasTokens).toBe(true);
  });

  it('zero tokens: 0 is detected as token evidence via usage.total_tokens field', () => {
    const result = detectImportSource({ jobs: [], meta: null, runBundles: [{ fileName: 'run.jsonl', records: [{ usage: { total_tokens: 0 } }] }] });
    expect(result.evidenceHint.hasTokens).toBe(true);
  });

  it('non-finite token values do not count as token evidence', () => {
    const result = detectImportSource({ jobs: [], meta: null, runBundles: [{ fileName: 'run.jsonl', records: [{ tokens: NaN }, { tokens: Infinity }, { tokens: -1 }] }] });
    expect(result.evidenceHint.hasTokens).toBe(false);
    // recordCount > 0 gives medium confidence even without token evidence
    expect(result.confidence).toBe('medium');
  });
});

