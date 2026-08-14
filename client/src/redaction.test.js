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

test('detects single and full-name possessives as base names', () => {
  const candidates = detectNameCandidates(
    "Smith's house is near John's shop and John Smith's office.",
  );

  assert.deepEqual(candidates, ['Smith', 'John', 'John Smith']);
});

test('supports curly possessives without stripping apostrophes inside names', () => {
  const candidates = detectNameCandidates("O'Connor’s notes mention Mary O'Connor.");

  assert.deepEqual(candidates, ["O'Connor", "Mary O'Connor"]);
});

test('redacts whole terms and restores the original text', () => {
  const source = 'James Smith and James attended. Jamestown did not.';
  const result = redactText(source, ['James', 'James Smith']);

  assert.equal(result.redactedText, '[[R00001]] and [[R00002]] attended. Jamestown did not.');
  assert.equal(unredactText(result.redactedText, result.mapping), source);
});

test('redacts plain and possessive forms while preserving the possessive suffix', () => {
  const source = "John filled John's bottle at John Smith's house.";
  const result = redactText(source, ['John Smith', 'John']);

  assert.equal(
    result.redactedText,
    "[[R00002]] filled [[R00002]]'s bottle at [[R00001]]'s house.",
  );
  assert.equal(unredactText(result.redactedText, result.mapping), source);
});

test('skips tokens that already exist in the source document', () => {
  const source = 'Existing token [[R00001]]. James Smith arrived.';
  const result = redactText(source, ['James Smith']);

  assert.equal(result.mapping[0].code, '[[R00002]]');
  assert.equal(result.redactedText, 'Existing token [[R00001]]. [[R00002]] arrived.');
  assert.equal(unredactText(result.redactedText, result.mapping), source);
});

test('round-trips mapping values containing commas and quotes through CSV', () => {
  const mapping = [{ code: '[[R00001]]', value: 'Smith, "James"' }];

  assert.deepEqual(mappingFromCsv(mappingToCsv(mapping)), mapping);
});

test('accepts legacy numeric mapping codes', () => {
  assert.deepEqual(mappingFromCsv('code,value\n00001,James Smith'), [
    { code: '00001', value: 'James Smith' },
  ]);
});

test('rejects malformed and ambiguous mappings', () => {
  assert.throws(() => mappingFromCsv(''), /empty/);
  assert.throws(() => mappingFromCsv('value,code\nJames Smith,[[R00001]]'), /header/);
  assert.throws(
    () => mappingFromCsv('code,value\n[[R00001]],James Smith\n[[R00001]],Jane Doe'),
    /duplicate code/,
  );
  assert.throws(
    () => mappingFromCsv('code,value\n[[R00001]],James Smith\n[[R00002]],James Smith'),
    /duplicate value/,
  );
});