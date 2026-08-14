# Redactor client

React/Vite implementation of the Redactor MVP. Detection, redaction,
un-redaction, and mapping CSV processing run entirely in the browser; no API is
required and document contents never leave the device.

Document upload supports TXT, Markdown, CSV, JSON, DOCX, and text-based PDF
files up to 20 MB. Scanned PDFs require OCR before they can be processed.
The interface uses file uploads and downloads only; document and mapping
contents are not pasted into the page.

## Commands

```bash
npm install
npm test
npm run lint
npm run dev
npm run build
```

The production artifact is written to `dist/` and deployed by the repository's
Azure Static Web Apps workflow.
