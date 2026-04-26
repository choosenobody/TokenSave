// @ts-nocheck
// Extracted from src/main.ts — file parsing only.
// No logic changed. Mechanically copied.

export function parseJson(text, fileName) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Malformed JSON in ${fileName}: ${error.message}`);
  }
}

export function parseJsonl(text, fileName) {
  const records = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    try {
      const record = JSON.parse(trimmed);
      if (record == null || typeof record !== "object" || Array.isArray(record)) {
        throw new Error("Expected an object per line");
      }
      records.push(record);
    } catch (error) {
      throw new Error(`Malformed JSONL in ${fileName} at line ${index + 1}: ${error.message}`);
    }
  });

  return records;
}

export async function parseZipEntries(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const decoder = new TextDecoder();
  const eocdOffset = findEndOfCentralDirectory(bytes);

  if (eocdOffset < 0) {
    throw new Error("Unable to locate ZIP central directory.");
  }

  const totalEntries = readUint16(bytes, eocdOffset + 10);
  const centralDirOffset = readUint32(bytes, eocdOffset + 16);
  const entries = [];
  let pointer = centralDirOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (readUint32(bytes, pointer) !== 0x02014b50) {
      throw new Error("ZIP central directory is malformed.");
    }

    const compressionMethod = readUint16(bytes, pointer + 10);
    const compressedSize = readUint32(bytes, pointer + 20);
    const fileNameLength = readUint16(bytes, pointer + 28);
    const extraLength = readUint16(bytes, pointer + 30);
    const commentLength = readUint16(bytes, pointer + 32);
    const localHeaderOffset = readUint32(bytes, pointer + 42);
    const nameBytes = bytes.slice(pointer + 46, pointer + 46 + fileNameLength);
    const fileName = decoder.decode(nameBytes);

    pointer += 46 + fileNameLength + extraLength + commentLength;

    if (fileName.endsWith("/")) {
      continue;
    }

    const text = await readZipEntryText(bytes, localHeaderOffset, compressedSize, compressionMethod);
    entries.push({ name: fileName, text });
  }

  return entries;
}

async function readZipEntryText(bytes, localHeaderOffset, compressedSize, compressionMethod) {
  if (readUint32(bytes, localHeaderOffset) !== 0x04034b50) {
    throw new Error("ZIP local entry header is malformed.");
  }

  const nameLength = readUint16(bytes, localHeaderOffset + 26);
  const extraLength = readUint16(bytes, localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + nameLength + extraLength;
  const compressed = bytes.slice(dataStart, dataStart + compressedSize);

  if (compressionMethod === 0) {
    return new TextDecoder().decode(compressed);
  }

  if (compressionMethod === 8) {
    if (typeof DecompressionStream !== "function") {
      throw new Error("This browser cannot unpack deflated ZIP files. Please use a recent Chromium-based browser.");
    }

    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const buffer = await new Response(stream).arrayBuffer();
    return new TextDecoder().decode(buffer);
  }

  throw new Error(`ZIP compression method ${compressionMethod} is not supported by this viewer.`);
}

function findEndOfCentralDirectory(bytes) {
  const minOffset = Math.max(0, bytes.length - 65557);
  for (let index = bytes.length - 22; index >= minOffset; index -= 1) {
    if (readUint32(bytes, index) === 0x06054b50) {
      return index;
    }
  }
  return -1;
}

function readUint16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes, offset) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}
