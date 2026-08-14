import assert from 'node:assert/strict';
import test from 'node:test';
import { readDocument } from './documentReader.js';

function createFile(contents, name, type = '') {
  const file = new Blob([contents], { type });
  Object.defineProperty(file, 'name', { value: name });
  return file;
}

test('reads supported text documents', async () => {
  const file = createFile('Sarah Mitchell met Daniel Rodriguez.', 'notes.txt', 'text/plain');

  assert.equal(await readDocument(file), 'Sarah Mitchell met Daniel Rodriguez.');
});

test('rejects unsupported document formats', async () => {
  const file = createFile('content', 'legacy.doc', 'application/msword');

  await assert.rejects(() => readDocument(file), /Unsupported document format/);
});

test('rejects documents larger than 20 MB', async () => {
  const file = createFile(new Uint8Array(20 * 1024 * 1024 + 1), 'large.txt', 'text/plain');

  await assert.rejects(() => readDocument(file), /20 MB or smaller/);
});