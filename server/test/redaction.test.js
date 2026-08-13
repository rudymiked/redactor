'use strict';

const {
  redactText,
  unredactText,
  detectNameCandidates,
  mappingToCsv,
  mappingFromCsv,
} = require('../src/redaction');

describe('redactText / unredactText round-trip', () => {
  test('redacts a name consistently across the document', () => {
    const text = 'James Smith went to the store. Later, James Smith came home.';
    const { redactedText, mapping } = redactText(text, ['James Smith']);

    expect(mapping).toHaveLength(1);
    expect(mapping[0].value).toBe('James Smith');
    expect(mapping[0].code).toBe('00001');
    expect(redactedText).toBe('00001 went to the store. Later, 00001 came home.');
    expect(redactedText).not.toContain('James Smith');
  });

  test('restores the original text using the mapping', () => {
    const text = 'James Smith met Jane Doe for lunch.';
    const { redactedText, mapping } = redactText(text, ['James Smith', 'Jane Doe']);
    const restored = unredactText(redactedText, mapping);
    expect(restored).toBe(text);
  });

  test('handles multiple distinct terms with unique codes', () => {
    const text = 'Alice called Bob, and Bob called Alice back.';
    const { redactedText, mapping } = redactText(text, ['Alice', 'Bob']);

    expect(mapping).toHaveLength(2);
    const codes = mapping.map((m) => m.code);
    expect(new Set(codes).size).toBe(2);

    const restored = unredactText(redactedText, mapping);
    expect(restored).toBe(text);
  });

  test('does not redact partial word matches', () => {
    const text = 'Jamestown is not James.';
    const { redactedText, mapping } = redactText(text, ['James']);
    expect(redactedText).toBe('Jamestown is not 00001.');
    expect(mapping[0].value).toBe('James');
  });

  test('handles overlapping terms by preferring the longest match', () => {
    const text = 'James Smith and James both attended.';
    const { redactedText, mapping } = redactText(text, ['James', 'James Smith']);
    // "James Smith" should be redacted as a whole, and the standalone "James" too.
    expect(redactedText).toContain('and');
    const restored = unredactText(redactedText, mapping);
    expect(restored).toBe(text);
  });

  test('ignores blank/duplicate terms', () => {
    const text = 'James Smith is here.';
    const { mapping } = redactText(text, ['James Smith', '  ', 'James Smith', '']);
    expect(mapping).toHaveLength(1);
  });

  test('supports custom starting id and padding', () => {
    const { mapping } = redactText('James Smith', ['James Smith'], { startId: 458, padding: 5 });
    expect(mapping[0].code).toBe('00458');
  });

  test('returns unchanged text when there are no terms', () => {
    const text = 'Nothing to redact here.';
    const { redactedText, mapping } = redactText(text, []);
    expect(redactedText).toBe(text);
    expect(mapping).toEqual([]);
  });

  test('unredactText is a no-op with an empty mapping', () => {
    const text = 'Some 00001 text.';
    expect(unredactText(text, [])).toBe(text);
  });
});

describe('detectNameCandidates', () => {
  test('detects capitalized multi-word sequences as name candidates', () => {
    const text = 'James Smith met with Jane Doe near Central Park yesterday.';
    const candidates = detectNameCandidates(text);
    expect(candidates).toEqual(expect.arrayContaining(['James Smith', 'Jane Doe', 'Central Park']));
  });

  test('returns unique candidates in order of first appearance', () => {
    const text = 'James Smith called James Smith again.';
    const candidates = detectNameCandidates(text);
    expect(candidates).toEqual(['James Smith']);
  });

  test('returns an empty array when there are no candidates', () => {
    expect(detectNameCandidates('nothing capitalized here')).toEqual([]);
  });
});

describe('mappingToCsv / mappingFromCsv round-trip', () => {
  test('produces a CSV with a header row', () => {
    const mapping = [
      { code: '00001', value: 'James Smith' },
      { code: '00002', value: 'Jane Doe' },
    ];
    const csv = mappingToCsv(mapping);
    expect(csv).toBe('code,value\n00001,James Smith\n00002,Jane Doe');
  });

  test('quotes values containing commas', () => {
    const mapping = [{ code: '00001', value: 'Smith, James' }];
    const csv = mappingToCsv(mapping);
    expect(csv).toContain('"Smith, James"');
  });

  test('parses CSV back into the original mapping', () => {
    const mapping = [
      { code: '00001', value: 'James Smith' },
      { code: '00002', value: 'Smith, James' },
    ];
    const csv = mappingToCsv(mapping);
    const parsed = mappingFromCsv(csv);
    expect(parsed).toEqual(mapping);
  });

  test('returns an empty array for blank input', () => {
    expect(mappingFromCsv('')).toEqual([]);
    expect(mappingFromCsv('   ')).toEqual([]);
  });
});
