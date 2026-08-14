const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'csv', 'json']);

function getExtension(filename) {
  const lastDot = filename.lastIndexOf('.');
  return lastDot === -1 ? '' : filename.slice(lastDot + 1).toLowerCase();
}

export async function readDocument(file) {
  if (!(file instanceof Blob)) {
    throw new TypeError('A document file is required');
  }
  if (file.size > MAX_DOCUMENT_SIZE) {
    throw new Error('Document must be 20 MB or smaller');
  }

  const extension = getExtension(file.name || '');
  if (TEXT_EXTENSIONS.has(extension) || (!extension && file.type.startsWith('text/'))) {
    return file.text();
  }
  if (extension === 'docx') {
    return readDocx(file);
  }
  if (extension === 'pdf') {
    return readPdf(file);
  }

  throw new Error('Unsupported document format. Choose a TXT, Markdown, CSV, JSON, DOCX, or PDF file.');
}

async function readDocx(file) {
  const mammothModule = await import('mammoth');
  const mammoth = mammothModule.default ?? mammothModule;
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  const text = result.value.trim();

  if (!text) {
    throw new Error('No readable text was found in this Word document');
  }
  return text;
}

async function readPdf(file) {
  const [pdfjs, workerModule] = await Promise.all([
    import('pdfjs-dist/build/pdf.mjs'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  const pdfWorkerUrl = workerModule.default;
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = [];
    let currentLine = [];

    for (const item of content.items) {
      if (!('str' in item)) continue;
      currentLine.push(item.str);
      if (item.hasEOL) {
        lines.push(currentLine.join(' ').trim());
        currentLine = [];
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine.join(' ').trim());
    }
    pages.push(lines.filter(Boolean).join('\n'));
  }

  const text = pages.filter(Boolean).join('\n\n').trim();
  if (!text) {
    throw new Error('No selectable text was found in this PDF. Scanned PDFs require OCR.');
  }
  return text;
}