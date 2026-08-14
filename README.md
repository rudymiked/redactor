# Redactor

Redactor lets you take a document, redact sensitive terms like names into
tracking codes (e.g. `James Smith` becomes `[[R00458]]`), and generate a mapping
spreadsheet. The redacted document can be freely edited and shared, and later
"un-redacted" using the mapping to turn `[[R00458]]` back into `James Smith`
everywhere it appears.

No AI/ML is required for the initial version — redaction is driven by
explicit terms you provide, plus a simple built-in heuristic that suggests
likely names (sequences of capitalized words) as candidates. AI-assisted
detection can be layered on top later.

All document processing happens locally in the browser. Document text and
redaction mappings are not sent to a server.

## Project structure

- `client/` — React/Vite app containing the UI and browser-side redaction engine.
- `server/` — optional legacy Express implementation retained as a reference;
  it is not required by the MVP.

## Getting started

### Client

```bash
cd client
npm install
npm test        # run redaction engine tests
npm run dev     # starts the dev server on http://localhost:5173
npm run build   # production build to client/dist
```

## How it works

1. Upload a document, use "Suggest names" to detect likely candidates, and
   review the selected terms and their context. Exact custom terms can also be
   added manually.
   Uploads support TXT, Markdown, CSV, JSON, DOCX, and text-based PDF files up
   to 20 MB. Scanned PDFs require OCR and are not supported by this MVP.
2. Redact the document — each unique term is replaced with a stable wrapped
   code (e.g. `[[R00001]]`, `[[R00002]]`, ...) everywhere it appears. Codes
   already present in the source document are skipped to prevent collisions.
3. Download the redacted document and its mapping CSV.
4. Share/edit the redacted document freely.
5. When ready, upload the (possibly edited) redacted document and mapping CSV,
   restore the original values, and download the restored document. Mapping
   files are validated before restoration; legacy numeric codes are accepted.

## Deploying to Azure

The MVP deploys `client/` to
[Azure Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/)
through `.github/workflows/azure-static-web-apps-client.yml`. The workflow
requires the `AZURE_STATIC_WEB_APPS_API_TOKEN` GitHub Actions secret. No API,
App Service, CORS configuration, or `VITE_API_URL` setting is required.
