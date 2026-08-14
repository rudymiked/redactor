import {
  detectNameCandidates,
  mappingFromCsv,
  mappingToCsv,
  redactText,
  unredactText,
} from './redaction';

export async function detectCandidates(text) {
  return detectNameCandidates(text);
}

export async function redact(text, terms) {
  return redactText(text, terms);
}

export async function unredact(text, mapping) {
  return unredactText(text, mapping);
}

export async function downloadMappingCsv(mapping) {
  return mappingToCsv(mapping);
}

export async function parseMappingCsv(csv) {
  return mappingFromCsv(csv);
}
