# Redactor

Redactor lets you take a document, redact sensitive terms like names into
tracking codes (e.g. `James Smith` becomes `00458`), and generate a mapping
spreadsheet. The redacted document can be freely edited and shared, and later
"un-redacted" using the mapping to turn `00458` back into `James Smith`
everywhere it appears.

No AI/ML is required for the initial version — redaction is driven by
explicit terms you provide, plus a simple built-in heuristic that suggests
likely names (sequences of capitalized words) as candidates. AI-assisted
detection can be layered on top later.

## Project structure

- `server/` — Node.js/Express API implementing redact/un-redact logic and
  mapping (CSV) generation/parsing.
- `client/` — React app (built with Vite) providing the UI to redact and
  un-redact documents.

## Getting started

### API (server)

```bash
cd server
npm install
npm test    # run unit tests
npm start   # starts the API on http://localhost:3001
```

### Client

```bash
cd client
npm install
npm run dev     # starts the dev server on http://localhost:5173
npm run build   # production build to client/dist
```

Set `VITE_API_URL` (e.g. in a `.env` file in `client/`) to point the client
at a non-default API URL. It defaults to `http://localhost:3001`.

## How it works

1. Paste or upload a document's text, and provide the terms to redact (or use
   "Suggest names" to detect likely candidates).
2. Redact the document — each unique term is replaced with a stable numeric
   code (e.g. `00001`, `00002`, ...) everywhere it appears.
3. Download the generated mapping as a CSV "redaction spreadsheet".
4. Share/edit the redacted document freely.
5. When ready, paste the (possibly edited) redacted document and the mapping
   CSV back into the app and un-redact it to restore the original values.

## Deploying to Azure

This repo includes GitHub Actions workflows to deploy:

- `client/` to [Azure Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/)
  via `.github/workflows/azure-static-web-apps-client.yml` (requires the
  `AZURE_STATIC_WEB_APPS_API_TOKEN` secret and, optionally, a
  `REDACTOR_API_URL` repository/environment variable pointing at the deployed
  API).
- `server/` to [Azure App Service](https://learn.microsoft.com/azure/app-service/)
  via `.github/workflows/azure-app-service-server.yml` (requires the
  `AZURE_WEBAPP_PUBLISH_PROFILE` secret).
