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

function RedactPanel() {
  const [sourceText, setSourceText] = useState('');
  const [termsInput, setTermsInput] = useState('');
  const [redactedText, setRedactedText] = useState('');
  const [mapping, setMapping] = useState([]);
  const [sourceFilename, setSourceFilename] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const terms = termsInput
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);

  async function onDocumentFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setBusy(true);
    try {
      const text = await readDocument(file);
      setSourceText(text);
      setSourceFilename(file.name);
      setTermsInput('');
      setRedactedText('');
      setMapping([]);
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
      const merged = Array.from(new Set([...terms, ...candidates]));
      setTermsInput(merged.join('\n'));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onRedact() {
    setError('');
    setBusy(true);
    try {
      const result = await redact(sourceText, terms);
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

      <label htmlFor="terms-input">Terms to redact (one per line)</label>
      <textarea
        id="terms-input"
        rows={4}
        placeholder="James Smith&#10;Jane Doe"
        value={termsInput}
        onChange={(e) => setTermsInput(e.target.value)}
      />

      <div className="button-row">
        <button type="button" onClick={onDetect} disabled={busy || !sourceText}>
          Suggest names
        </button>
        <button type="button" onClick={onRedact} disabled={busy || !sourceText || terms.length === 0}>
          Redact
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {redactedText && (
        <>
          <p className="file-status">Redaction complete. Download both files to restore later.</p>
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
  const [mappingCsv, setMappingCsv] = useState('');
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
      setMappingCsv(await file.text());
      setMappingFilename(file.name);
      setRestoredText('');
    } catch (err) {
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
      const mapping = await parseMappingCsv(mappingCsv);
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

      <div className="button-row">
        <button type="button" onClick={onUnredact} disabled={busy || !redactedText || !mappingCsv}>
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
          Upload a document, replace sensitive terms with tracking codes (e.g. <code>00458</code>),
          then download the redacted document and mapping needed to restore it later.
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
