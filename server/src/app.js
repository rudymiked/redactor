'use strict';

const express = require('express');
const cors = require('cors');
const {
  redactText,
  unredactText,
  detectNameCandidates,
  mappingToCsv,
  mappingFromCsv,
} = require('./redaction');

const MAX_TEXT_LENGTH = 200000; // ~200 KB of text, generous for a document body

function createApp() {
  const app = express();
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  app.use(cors(allowedOrigin ? { origin: allowedOrigin } : {}));
  app.use(express.json({ limit: '5mb' }));
  app.use(express.text({ type: 'text/csv', limit: '5mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/detect', (req, res) => {
    const { text } = req.body || {};
    if (typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required and must be a string' });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ error: `text exceeds maximum length of ${MAX_TEXT_LENGTH}` });
    }
    const candidates = detectNameCandidates(text);
    res.json({ candidates });
  });

  app.post('/api/redact', (req, res) => {
    const { text, terms } = req.body || {};
    if (typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required and must be a string' });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ error: `text exceeds maximum length of ${MAX_TEXT_LENGTH}` });
    }
    if (terms !== undefined && !Array.isArray(terms)) {
      return res.status(400).json({ error: 'terms must be an array of strings' });
    }

    const { redactedText, mapping } = redactText(text, terms || []);
    res.json({ redactedText, mapping });
  });

  app.post('/api/unredact', (req, res) => {
    const { text, mapping } = req.body || {};
    if (typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required and must be a string' });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ error: `text exceeds maximum length of ${MAX_TEXT_LENGTH}` });
    }
    if (!Array.isArray(mapping)) {
      return res.status(400).json({ error: 'mapping must be an array of { code, value } entries' });
    }

    const restoredText = unredactText(text, mapping);
    res.json({ text: restoredText });
  });

  app.post('/api/mapping/csv', (req, res) => {
    const { mapping } = req.body || {};
    if (!Array.isArray(mapping)) {
      return res.status(400).json({ error: 'mapping must be an array of { code, value } entries' });
    }
    const csv = mappingToCsv(mapping);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="redaction-mapping.csv"');
    res.send(csv);
  });

  app.post('/api/mapping/parse', (req, res) => {
    const csv = typeof req.body === 'string' ? req.body : req.body && req.body.csv;
    if (typeof csv !== 'string') {
      return res.status(400).json({ error: 'csv text is required' });
    }
    const mapping = mappingFromCsv(csv);
    res.json({ mapping });
  });

  return app;
}

module.exports = { createApp };
