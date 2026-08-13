const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const REQUEST_TIMEOUT_MS = 10000;

async function request(path, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Redactor API at ${API_BASE_URL} did not respond within 10 seconds`);
    }
    throw new Error(`Cannot reach Redactor API at ${API_BASE_URL}: ${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleResponse(res) {
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body && body.error) {
        message = body.error;
      }
    } catch {
      // ignore body parse errors, use default message
    }
    throw new Error(message);
  }
  return res;
}

export async function detectCandidates(text) {
  const res = await request('/api/detect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  await handleResponse(res);
  const data = await res.json();
  return data.candidates;
}

export async function redact(text, terms) {
  const res = await request('/api/redact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, terms }),
  });
  await handleResponse(res);
  return res.json();
}

export async function unredact(text, mapping) {
  const res = await request('/api/unredact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, mapping }),
  });
  await handleResponse(res);
  const data = await res.json();
  return data.text;
}

export async function downloadMappingCsv(mapping) {
  const res = await request('/api/mapping/csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mapping }),
  });
  await handleResponse(res);
  return res.text();
}

export async function parseMappingCsv(csv) {
  const res = await request('/api/mapping/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'text/csv' },
    body: csv,
  });
  await handleResponse(res);
  const data = await res.json();
  return data.mapping;
}

export { API_BASE_URL };
