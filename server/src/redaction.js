'use strict';

/**
 * Core redaction engine.
 *
 * Given a document's text and a list of terms to redact (e.g. names),
 * replaces each unique term with a stable numeric code (e.g. "00458").
 * A mapping of code -> original value is returned so the document can
 * later be "un-redacted" by reversing the substitution.
 *
 * No AI/NLP is used: callers supply the terms to redact explicitly, and/or
 * rely on the built-in heuristic name detector (capitalized word sequences)
 * to find likely candidates.
 */

const DEFAULT_CODE_PADDING = 5;

/**
 * Escape a string for safe use inside a RegExp.
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format a numeric id as a zero-padded code string, e.g. 458 -> "00458".
 * @param {number} id
 * @param {number} padding
 * @returns {string}
 */
function formatCode(id, padding = DEFAULT_CODE_PADDING) {
  return String(id).padStart(padding, '0');
}

/**
 * Heuristically detect likely "name" candidates in a block of text.
 * This looks for sequences of two or more capitalized words (e.g. "James Smith"),
 * which is a simple, AI-free approximation of named-entity recognition.
 * @param {string} text
 * @returns {string[]} unique detected candidates, in order of first appearance
 */
function detectNameCandidates(text) {
  const pattern = /\b[A-Z][a-zA-Z'-]*(?:\s+[A-Z][a-zA-Z'-]*)+\b/g;
  const seen = new Set();
  const results = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const candidate = match[0];
    if (!seen.has(candidate)) {
      seen.add(candidate);
      results.push(candidate);
    }
  }
  return results;
}

/**
 * Redact a set of terms out of the given text, replacing each unique term
 * with a stable code. Longer terms are matched first so that overlapping
 * terms (e.g. "James Smith" and "James") are handled predictably.
 *
 * @param {string} text - the source document text
 * @param {string[]} terms - explicit terms to redact (e.g. names)
 * @param {object} [options]
 * @param {number} [options.startId=1] - starting numeric id for generated codes
 * @param {number} [options.padding=5] - zero-padding width for codes
 * @returns {{ redactedText: string, mapping: Array<{code: string, value: string}> }}
 */
function redactText(text, terms = [], options = {}) {
  const { startId = 1, padding = DEFAULT_CODE_PADDING } = options;

  if (typeof text !== 'string') {
    throw new TypeError('text must be a string');
  }

  // De-duplicate terms, ignore blanks, and sort longest-first so that
  // substrings of other terms don't get partially redacted first.
  const uniqueTerms = Array.from(
    new Set(terms.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean))
  ).sort((a, b) => b.length - a.length);

  const mapping = [];
  const valueToCode = new Map();
  let nextId = startId;
  let redactedText = text;

  for (const term of uniqueTerms) {
    if (!valueToCode.has(term)) {
      const code = formatCode(nextId, padding);
      nextId += 1;
      valueToCode.set(term, code);
      mapping.push({ code, value: term });
    }
    const code = valueToCode.get(term);
    const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'g');
    redactedText = redactedText.replace(pattern, code);
  }

  return { redactedText, mapping };
}

/**
 * Reverse a previous redaction, restoring original values from a mapping.
 * @param {string} text - redacted text containing codes
 * @param {Array<{code: string, value: string}>} mapping
 * @returns {string} the un-redacted text
 */
function unredactText(text, mapping = []) {
  if (typeof text !== 'string') {
    throw new TypeError('text must be a string');
  }

  let result = text;
  // Replace longer codes first to avoid partial collisions (not typical with
  // fixed-width codes, but keeps behavior predictable if padding varies).
  const sorted = [...mapping].sort((a, b) => b.code.length - a.code.length);
  for (const entry of sorted) {
    if (!entry || !entry.code) continue;
    const pattern = new RegExp(escapeRegExp(entry.code), 'g');
    result = result.replace(pattern, entry.value);
  }
  return result;
}

/**
 * Convert a mapping array into CSV text, suitable for download as a
 * "redaction spreadsheet" that can be used to un-redact later.
 * @param {Array<{code: string, value: string}>} mapping
 * @returns {string} CSV content
 */
function mappingToCsv(mapping = []) {
  const escapeCsv = (value) => {
    const str = String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = [['code', 'value'], ...mapping.map((m) => [m.code, m.value])];
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

/**
 * Parse CSV text (as produced by mappingToCsv) back into a mapping array.
 * @param {string} csv
 * @returns {Array<{code: string, value: string}>}
 */
function mappingFromCsv(csv) {
  if (typeof csv !== 'string' || csv.trim() === '') {
    return [];
  }

  const lines = csv.split(/\r?\n/).filter((line) => line.length > 0);
  const mapping = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fields = parseCsvLine(line);
    if (i === 0 && fields[0] && fields[0].toLowerCase() === 'code') {
      continue; // skip header
    }
    if (fields.length >= 2) {
      mapping.push({ code: fields[0], value: fields[1] });
    }
  }

  return mapping;
}

/**
 * Parse a single CSV line into fields, handling quoted values.
 * @param {string} line
 * @returns {string[]}
 */
function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

module.exports = {
  redactText,
  unredactText,
  detectNameCandidates,
  mappingToCsv,
  mappingFromCsv,
  formatCode,
  escapeRegExp,
};
