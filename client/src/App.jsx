import { useState } from 'react';
import {
  detectCandidates,
  redact,
  unredact,
  downloadMappingCsv,
  parseMappingCsv,
} from './api';
import { readDocument } from './documentReader';
import './App.css';

function downloadTextFile(filename, content, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getOutputFilename(sourceFilename, suffix) {
  const basename = sourceFilename.replace(/\.[^.]+$/, '') || 'document';
  return `${basename}-${suffix}.txt`;
}

function getTermContext(text, term) {
  const index = text.indexOf(term);
  if (index === -1) return '';

  const start = Math.max(0, index - 48);
  const end = Math.min(text.length, index + term.length + 48);
  const excerpt = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${excerpt}${end < text.length ? '…' : ''}`;
}

function RedactPanel() {
  const [sourceText, setSourceText] = useState('');
  const [termOptions, setTermOptions] = useState([]);
  const [customTerm, setCustomTerm] = useState('');
  const [redactedText, setRedactedText] = useState('');
  const [mapping, setMapping] = useState([]);
  const [sourceFilename, setSourceFilename] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedTerms = termOptions.filter((term) => term.selected).map((term) => term.value);

  function clearRedactionResult() {
    setRedactedText('');
    setMapping([]);
  }

  async function onDocumentFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setBusy(true);
    try {
      const text = await readDocument(file);
      setSourceText(text);
      setSourceFilename(file.name);
      setTermOptions([]);
      setCustomTerm('');
      clearRedactionResult();
    } catch (err) {
      setSourceFilename('');
      setError(err.message);
    } finally {
      e.target.value = '';
      setBusy(false);
    }
  }

  async function onDetect() {
    setError('');
    setBusy(true);
    try {
      const candidates = await detectCandidates(sourceText);
      setTermOptions((current) => {
        const merged = new Map(current.map((term) => [term.value, term]));
        for (const candidate of candidates) {
          if (!merged.has(candidate)) {
            merged.set(candidate, { value: candidate, selected: true });
          }
        }
        return [...merged.values()];
      });
      clearRedactionResult();
      if (candidates.length === 0) {
        setError('No likely names were found. Add a custom term below.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function onToggleTerm(value) {
    setTermOptions((current) =>
      current.map((term) =>
        term.value === value ? { ...term, selected: !term.selected } : term,
      ),
    );
    clearRedactionResult();
  }

  function onAddCustomTerm(e) {
    e.preventDefault();
    const value = customTerm.trim();
    if (!value) return;
    if (!sourceText.includes(value)) {
      setError(`“${value}” was not found in the uploaded document`);
      return;
    }

    setError('');
    setTermOptions((current) => {
      const existing = current.find((term) => term.value === value);
      if (existing) {
        return current.map((term) =>
          term.value === value ? { ...term, selected: true } : term,
        );
      }
      return [...current, { value, selected: true }];
    });
    setCustomTerm('');
    clearRedactionResult();
  }

  async function onRedact() {
    setError('');
    setBusy(true);
    try {
      const result = await redact(sourceText, selectedTerms);
      setRedactedText(result.redactedText);
      setMapping(result.mapping);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onDownloadCsv() {
    setError('');
    try {
      const csv = await downloadMappingCsv(mapping);
      downloadTextFile('redaction-mapping.csv', csv, 'text/csv');
    } catch (err) {
      setError(err.message);
    }
  }

  function onDownloadRedacted() {
    downloadTextFile(getOutputFilename(sourceFilename, 'redacted'), redactedText);
  }

  return (
    <section className="panel">
      <h2>1. Redact a document</h2>
      <label htmlFor="source-document">Upload document</label>
      <input
        id="source-document"
        type="file"
        accept=".txt,.md,.csv,.json,.docx,.pdf,text/plain,text/markdown,text/csv,application/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={onDocumentFileChange}
        disabled={busy}
      />
      {sourceFilename && <p className="file-status">Loaded {sourceFilename}</p>}

      <div className="button-row">
        <button type="button" onClick={onDetect} disabled={busy || !sourceText}>
          Suggest names
        </button>
      </div>

      {termOptions.length > 0 && (
        <fieldset className="candidate-review">
          <legend>Review sensitive terms</legend>
          {termOptions.map((term) => (
            <label className="candidate-row" key={term.value}>
              <input
                type="checkbox"
                checked={term.selected}
                onChange={() => onToggleTerm(term.value)}
              />
              <span>
                <strong>{term.value}</strong>
                <small>{getTermContext(sourceText, term.value)}</small>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {sourceText && (
        <form className="custom-term-form" onSubmit={onAddCustomTerm}>
          <label htmlFor="custom-term">Add custom term to redact</label>
          <div>
            <input
              id="custom-term"
              type="text"
              value={customTerm}
              onChange={(e) => setCustomTerm(e.target.value)}
              placeholder="Exact text from the document"
            />
            <button type="submit" disabled={!customTerm.trim()}>
              Add
            </button>
          </div>
        </form>
      )}

      <div className="button-row">
        <button
          type="button"
          onClick={onRedact}
          disabled={busy || !sourceText || selectedTerms.length === 0}
        >
          Redact selected terms
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {redactedText && (
        <>
          <p className="file-status">Redaction complete. Download both files to restore later.</p>
          <p className="mapping-warning">
            Keep the mapping CSV private. It contains every original sensitive value.
          </p>
          <h3>Redaction mapping ({mapping.length})</h3>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Original value</th>
              </tr>
            </thead>
            <tbody>
              {mapping.map((entry) => (
                <tr key={entry.code}>
                  <td>{entry.code}</td>
                  <td>{entry.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="button-row">
            <button type="button" onClick={onDownloadRedacted}>
              Download redacted document
            </button>
            <button type="button" onClick={onDownloadCsv}>
              Download mapping CSV
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function UnredactPanel() {
  const [redactedText, setRedactedText] = useState('');
  const [mapping, setMapping] = useState([]);
  const [restoredText, setRestoredText] = useState('');
  const [redactedFilename, setRedactedFilename] = useState('');
  const [mappingFilename, setMappingFilename] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onRedactedFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setBusy(true);
    try {
      const text = await readDocument(file);
      setRedactedText(text);
      setRedactedFilename(file.name);
      setRestoredText('');
    } catch (err) {
      setRedactedFilename('');
      setError(err.message);
    } finally {
      e.target.value = '';
      setBusy(false);
    }
  }

  async function onMappingFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    try {
      const parsedMapping = await parseMappingCsv(await file.text());
      setMapping(parsedMapping);
      setMappingFilename(file.name);
      setRestoredText('');
    } catch (err) {
      setMapping([]);
      setMappingFilename('');
      setError(err.message);
    } finally {
      e.target.value = '';
    }
  }

  async function onUnredact() {
    setError('');
    setBusy(true);
    try {
      if (!mapping.some((entry) => redactedText.includes(entry.code))) {
        throw new Error('This mapping does not match any codes in the redacted document');
      }
      const text = await unredact(redactedText, mapping);
      setRestoredText(text);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function onDownloadRestored() {
    downloadTextFile(getOutputFilename(redactedFilename, 'restored'), restoredText);
  }

  return (
    <section className="panel">
      <h2>2. Un-redact a document</h2>
      <label htmlFor="redacted-document-file">Redacted document file</label>
      <input
        id="redacted-document-file"
        type="file"
        accept=".txt,.md,.csv,.json,.docx,.pdf,text/plain,text/markdown,text/csv,application/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={onRedactedFileChange}
        disabled={busy}
      />
      {redactedFilename && <p className="file-status">Loaded {redactedFilename}</p>}

      <label htmlFor="mapping-csv-file">Redaction mapping CSV file</label>
      <input
        id="mapping-csv-file"
        type="file"
        accept=".csv,text/csv"
        onChange={onMappingFileChange}
        disabled={busy}
      />
      {mappingFilename && <p className="file-status">Loaded {mappingFilename}</p>}
      {mappingFilename && (
        <p className="mapping-warning">This mapping contains sensitive original values.</p>
      )}

      <div className="button-row">
        <button
          type="button"
          onClick={onUnredact}
          disabled={busy || !redactedText || mapping.length === 0}
        >
          Un-redact
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {restoredText && (
        <div className="button-row">
          <button type="button" onClick={onDownloadRestored}>
            Download restored document
          </button>
        </div>
      )}
    </section>
  );
}

function App() {
  return (
    <div className="app">
      <header>
        <h1>Redactor</h1>
        <p>
          Upload a document, replace sensitive terms with tracking codes (e.g.{' '}
          <code>[[R00458]]</code>), then download the redacted document and mapping needed to
          restore it later.
        </p>
      </header>
      <main>
        <RedactPanel />
        <UnredactPanel />
      </main>
    </div>
  );
}

export default App;
