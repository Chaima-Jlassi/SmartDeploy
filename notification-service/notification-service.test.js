const request = require('supertest');
const app = require('./index');

test('GET /notifications returns list', async () => {
  const res = await request(app).get('/notifications');
  expect(res.status).toBe(200);
  expect(res.body.length).toBe(3);
});

test('GET /notifications/:id returns notification', async () => {
  const res = await request(app).get('/notifications/1');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('sent');
});

test('POST /notifications queues a notification', async () => {
  const res = await request(app)
    .post('/notifications')
    .send({ recipient: 'new@example.com', message: 'Thanks for your order.' });

  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({
    recipient: 'new@example.com',
    message: 'Thanks for your order.',
    status: 'queued'
  });
});

test('POST /notifications requires recipient and message', async () => {
  const res = await request(app).post('/notifications').send({ recipient: 'new@example.com' });
  expect(res.status).toBe(400);
});

test('GET /health returns ok', async () => {
  const res = await request(app).get('/health');
  expect(res.status).toBe(200);
});

test('GET /ready returns ready', async () => {
  const res = await request(app).get('/ready');
  expect(res.status).toBe(200);
});

test('GET /metrics exposes request counts and latency histograms', async () => {
  await request(app).get('/health');
  const res = await request(app).get('/metrics');
  expect(res.status).toBe(200);
  expect(res.text).toContain('http_requests_total');
  expect(res.text).toContain('http_request_duration_seconds_bucket');
});
