const DEFAULT_CODE_PADDING = 5;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatCode(id, padding = DEFAULT_CODE_PADDING) {
  return `[[R${String(id).padStart(padding, '0')}]]`;
}

export function detectNameCandidates(text) {
  const pattern = /\b(?:[A-Z][a-zA-Z-]*(?:['’][A-Za-z]+)*)(?:\s+[A-Z][a-zA-Z-]*(?:['’][A-Za-z]+)*)+\b|\b[A-Z][a-zA-Z-]*(?:['’][A-Z][a-zA-Z-]*)*['’]s\b/g;
  const seen = new Set();
  const results = [];
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const candidate = match[0].replace(/['’]s$/, '');
    if (!seen.has(candidate)) {
      seen.add(candidate);
      results.push(candidate);
    }
  }

  return results;
}

export function redactText(text, terms = [], options = {}) {
  const { startId = 1, padding = DEFAULT_CODE_PADDING } = options;

  if (typeof text !== 'string') {
    throw new TypeError('text must be a string');
  }

  const uniqueTerms = Array.from(
    new Set(terms.map((term) => (typeof term === 'string' ? term.trim() : '')).filter(Boolean)),
  ).sort((first, second) => second.length - first.length);

  const mapping = [];
  let nextId = startId;
  let redactedText = text;

  for (const term of uniqueTerms) {
    let code;
    do {
      code = formatCode(nextId, padding);
      nextId += 1;
    } while (redactedText.includes(code));
    mapping.push({ code, value: term });

    const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'g');
    redactedText = redactedText.replace(pattern, code);
  }

  return { redactedText, mapping };
}

export function unredactText(text, mapping = []) {
  if (typeof text !== 'string') {
    throw new TypeError('text must be a string');
  }

  let result = text;
  const sortedMapping = [...mapping].sort(
    (first, second) => second.code.length - first.code.length,
  );

  for (const entry of sortedMapping) {
    if (!entry?.code) continue;
    const pattern = new RegExp(escapeRegExp(entry.code), 'g');
    result = result.replace(pattern, entry.value);
  }

  return result;
}

export function mappingToCsv(mapping = []) {
  const escapeCsv = (value) => {
    const stringValue = String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const rows = [['code', 'value'], ...mapping.map((entry) => [entry.code, entry.value])];
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

export function mappingFromCsv(csv) {
  if (typeof csv !== 'string' || csv.trim() === '') {
    throw new Error('Mapping CSV is empty');
  }

  const lines = csv.split(/\r?\n/).filter((line) => line.length > 0);
  const header = parseCsvLine(lines[0]).map((field) => field.trim().toLowerCase());
  if (header.length !== 2 || header[0] !== 'code' || header[1] !== 'value') {
    throw new Error('Mapping CSV must start with the header code,value');
  }

  const mapping = [];
  const codes = new Set();
  const values = new Set();

  for (let index = 1; index < lines.length; index += 1) {
    const fields = parseCsvLine(lines[index]);
    if (fields.length !== 2) {
      throw new Error(`Mapping CSV row ${index + 1} must contain exactly two columns`);
    }

    const code = fields[0].trim();
    const value = fields[1].trim();
    if (!/^(?:\[\[R\d+\]\]|\d+)$/.test(code)) {
      throw new Error(`Mapping CSV row ${index + 1} has an invalid code`);
    }
    if (!value) {
      throw new Error(`Mapping CSV row ${index + 1} has an empty value`);
    }
    if (codes.has(code)) {
      throw new Error(`Mapping CSV contains duplicate code ${code}`);
    }
    if (values.has(value)) {
      throw new Error(`Mapping CSV contains duplicate value ${value}`);
    }

    codes.add(code);
    values.add(value);
    mapping.push({ code, value });
  }

  if (mapping.length === 0) {
    throw new Error('Mapping CSV does not contain any mappings');
  }

  return mapping;
}

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (inQuotes) {
      if (character === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += character;
      }
    } else if (character === '"') {
      inQuotes = true;
    } else if (character === ',') {
      fields.push(current);
      current = '';
    } else {
      current += character;
    }
  }

  if (inQuotes) {
    throw new Error('Mapping CSV contains an unclosed quoted value');
  }

  fields.push(current);
  return fields;
}