'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');

const app = createApp();

describe('Redactor API', () => {
  test('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('POST /api/detect returns candidate names', async () => {
    const res = await request(app)
      .post('/api/detect')
      .send({ text: 'James Smith went home.' });
    expect(res.status).toBe(200);
    expect(res.body.candidates).toContain('James Smith');
  });

  test('POST /api/detect rejects missing text', async () => {
    const res = await request(app).post('/api/detect').send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/redact redacts terms and returns a mapping', async () => {
    const res = await request(app)
      .post('/api/redact')
      .send({ text: 'James Smith went home.', terms: ['James Smith'] });
    expect(res.status).toBe(200);
    expect(res.body.redactedText).toBe('00001 went home.');
    expect(res.body.mapping).toEqual([{ code: '00001', value: 'James Smith' }]);
  });

  test('POST /api/redact rejects invalid terms', async () => {
    const res = await request(app)
      .post('/api/redact')
      .send({ text: 'James Smith went home.', terms: 'not-an-array' });
    expect(res.status).toBe(400);
  });

  test('POST /api/unredact restores original text from a mapping', async () => {
    const res = await request(app)
      .post('/api/unredact')
      .send({
        text: '00001 went home.',
        mapping: [{ code: '00001', value: 'James Smith' }],
      });
    expect(res.status).toBe(200);
    expect(res.body.text).toBe('James Smith went home.');
  });

  test('POST /api/unredact rejects invalid mapping', async () => {
    const res = await request(app)
      .post('/api/unredact')
      .send({ text: '00001 went home.', mapping: 'nope' });
    expect(res.status).toBe(400);
  });

  test('POST /api/mapping/csv returns downloadable CSV', async () => {
    const res = await request(app)
      .post('/api/mapping/csv')
      .send({ mapping: [{ code: '00001', value: 'James Smith' }] });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toBe('code,value\n00001,James Smith');
  });

  test('full redact -> unredact round trip via the API', async () => {
    const text = 'James Smith met Jane Doe for lunch.';
    const redactRes = await request(app)
      .post('/api/redact')
      .send({ text, terms: ['James Smith', 'Jane Doe'] });
    expect(redactRes.status).toBe(200);

    const unredactRes = await request(app)
      .post('/api/unredact')
      .send({ text: redactRes.body.redactedText, mapping: redactRes.body.mapping });
    expect(unredactRes.status).toBe(200);
    expect(unredactRes.body.text).toBe(text);
  });
});
