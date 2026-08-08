const request = require('supertest');
const app = require('./index');

test('GET /products returns list', async () => {
  const res = await request(app).get('/products');
  expect(res.status).toBe(200);
  expect(res.body.length).toBe(3);
});

test('GET /products/:id returns product', async () => {
  const res = await request(app).get('/products/1');
  expect(res.status).toBe(200);
  expect(res.body.name).toBe('Laptop');
});

test('GET /health returns ok', async () => {
  const res = await request(app).get('/health');
  expect(res.status).toBe(200);
});

test('GET /ready returns ready', async () => {
  const res = await request(app).get('/ready');
  expect(res.status).toBe(200);
});