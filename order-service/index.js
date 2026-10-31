const express = require('express');
const client = require('prom-client');

const app = express();
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

const requestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  registers: [register]
});

app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const route = req.route?.path || 'unmatched';
    httpRequests.inc({ method: req.method, route, status: res.statusCode });
    requestDuration.observe(
      { method: req.method, route },
      Number(process.hrtime.bigint() - startedAt) / 1e9
    );
  });
  next();
});

const orders = [
  { id: 1, productId: 1, quantity: 1, status: 'confirmed' },
  { id: 2, productId: 2, quantity: 2, status: 'processing' },
  { id: 3, productId: 3, quantity: 1, status: 'shipped' }
];

app.get('/orders', (req, res) => res.json(orders));
app.get('/orders/:id', (req, res) => {
  const order = orders.find(item => item.id === Number(req.params.id));
  order ? res.json(order) : res.status(404).json({ error: 'Not found' });
});
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/ready', (req, res) => res.json({ status: 'ready' }));
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});

const PORT = process.env.PORT || 3000;
if (require.main === module) app.listen(PORT, () => console.log(`order-service on :${PORT}`));
module.exports = app;
