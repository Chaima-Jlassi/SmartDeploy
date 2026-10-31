const express = require('express');
const client = require('prom-client');

const app = express();
const register = new client.Registry();
client.collectDefaultMetrics({ register });
app.use(express.json());

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

const notifications = [
  { id: 1, recipient: 'customer@example.com', message: 'Your order has been confirmed.', status: 'sent' },
  { id: 2, recipient: 'customer@example.com', message: 'Your order is being processed.', status: 'sent' },
  { id: 3, recipient: 'customer@example.com', message: 'Your order has shipped.', status: 'sent' }
];

app.get('/notifications', (req, res) => res.json(notifications));
app.get('/notifications/:id', (req, res) => {
  const notification = notifications.find(item => item.id === Number(req.params.id));
  notification ? res.json(notification) : res.status(404).json({ error: 'Not found' });
});
app.post('/notifications', (req, res) => {
  const { recipient, message } = req.body || {};
  if (typeof recipient !== 'string' || !recipient.trim() || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'recipient and message are required' });
  }

  const notification = {
    id: notifications.length ? Math.max(...notifications.map(item => item.id)) + 1 : 1,
    recipient: recipient.trim(),
    message: message.trim(),
    status: 'queued'
  };
  notifications.push(notification);
  res.status(201).json(notification);
});
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/ready', (req, res) => res.json({ status: 'ready' }));
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});

const PORT = process.env.PORT || 3000;
if (require.main === module) app.listen(PORT, () => console.log(`notification-service on :${PORT}`));
module.exports = app;
