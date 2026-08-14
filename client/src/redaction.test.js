import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectNameCandidates,
  mappingFromCsv,
  mappingToCsv,
  redactText,
  unredactText,
} from './redaction.js';

test('detects unique multi-word name candidates in appearance order', () => {
  const candidates = detectNameCandidates('James Smith met Jane Doe. James Smith left.');

  assert.deepEqual(candidates, ['James Smith', 'Jane Doe']);
});

test('redacts whole terms and restores the original text', () => {
  const source = 'James Smith and James attended. Jamestown did not.';
  const result = redactText(source, ['James', 'James Smith']);

  assert.equal(result.redactedText, '00001 and 00002 attended. Jamestown did not.');
  assert.equal(unredactText(result.redactedText, result.mapping), source);
});

test('round-trips mapping values containing commas and quotes through CSV', () => {
  const mapping = [{ code: '00001', value: 'Smith, "James"' }];

  assert.deepEqual(mappingFromCsv(mappingToCsv(mapping)), mapping);
});