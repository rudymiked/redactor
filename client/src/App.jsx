import { useState } from 'react';
import {
  detectCandidates,
  redact,
  unredact,
  downloadMappingCsv,
  parseMappingCsv,
} from './api';
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

function RedactPanel() {
  const [sourceText, setSourceText] = useState('');
  const [termsInput, setTermsInput] = useState('');
  const [redactedText, setRedactedText] = useState('');
  const [mapping, setMapping] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const terms = termsInput
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);

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

  return (
    <section className="panel">
      <h2>1. Redact a document</h2>
      <label htmlFor="source-text">Document text</label>
      <textarea
        id="source-text"
        rows={10}
        placeholder="Paste the document text you want to redact..."
        value={sourceText}
        onChange={(e) => setSourceText(e.target.value)}
      />

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
          <label htmlFor="redacted-output">Redacted document</label>
          <textarea id="redacted-output" rows={10} readOnly value={redactedText} />

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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const text = await file.text();
    setMappingCsv(text);
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

  return (
    <section className="panel">
      <h2>2. Un-redact a document</h2>
      <label htmlFor="redacted-input">Redacted document text</label>
      <textarea
        id="redacted-input"
        rows={10}
        placeholder="Paste the redacted document (with codes like 00458)..."
        value={redactedText}
        onChange={(e) => setRedactedText(e.target.value)}
      />

      <label htmlFor="mapping-csv-file">Redaction mapping CSV file</label>
      <input id="mapping-csv-file" type="file" accept=".csv,text/csv" onChange={onFileChange} />
      <label htmlFor="mapping-csv">Or paste mapping CSV</label>
      <textarea
        id="mapping-csv"
        rows={6}
        placeholder="code,value&#10;00001,James Smith"
        value={mappingCsv}
        onChange={(e) => setMappingCsv(e.target.value)}
      />

      <div className="button-row">
        <button type="button" onClick={onUnredact} disabled={busy || !redactedText || !mappingCsv}>
          Un-redact
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {restoredText && (
        <>
          <label htmlFor="restored-output">Restored document</label>
          <textarea id="restored-output" rows={10} readOnly value={restoredText} />
        </>
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
          Redact sensitive terms like names into tracking codes (e.g. <code>00458</code>), edit the
          redacted document, then use the mapping spreadsheet to restore the original values later.
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
