import { useCallback, useEffect, useState } from 'react';

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body;
}

function StatusBadge({ status }) {
  const online = status === 'online';
  return (
    <span className={`status-badge ${online ? 'is-online' : 'is-offline'}`}>
      <span className="status-dot" />
      {online ? 'Operational' : 'Unavailable'}
    </span>
  );
}

function OrderStatus({ status }) {
  return <span className={`order-status status-${status}`}>{status}</span>;
}

function App() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [services, setServices] = useState({ catalog: 'checking', orders: 'checking', notifications: 'checking' });
  const [errors, setErrors] = useState({ catalog: '', orders: '', notifications: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const refresh = useCallback(async () => {
    const results = await Promise.allSettled([
      fetchJson('/api/products'),
      fetchJson('/api/catalog-health'),
      fetchJson('/api/orders'),
      fetchJson('/api/order-health'),
      fetchJson('/api/notifications'),
      fetchJson('/api/notification-health')
    ]);

    const [productResult, catalogHealth, orderResult, orderHealth, notificationResult, notificationHealth] = results;
    setProducts(productResult.status === 'fulfilled' ? productResult.value : []);
    setOrders(orderResult.status === 'fulfilled' ? orderResult.value : []);
    setNotifications(notificationResult.status === 'fulfilled' ? notificationResult.value : []);
    setServices({
      catalog: catalogHealth.status === 'fulfilled' ? 'online' : 'offline',
      orders: orderHealth.status === 'fulfilled' ? 'online' : 'offline',
      notifications: notificationHealth.status === 'fulfilled' ? 'online' : 'offline'
    });
    setErrors({
      catalog: productResult.status === 'rejected' ? 'Could not load products. Check that product-catalog is running on port 3000.' : '',
      orders: orderResult.status === 'rejected' ? 'Could not load orders. Check that order-service is running on port 3001.' : '',
      notifications: notificationResult.status === 'rejected' ? 'Could not load notifications. Check that notification-service is running on port 3002.' : ''
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function submitNotification(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setFormError('');
    setFormSuccess('');

    const formData = new FormData(form);
    const recipient = formData.get('recipient').trim();
    const message = formData.get('message').trim();
    setSubmitting(true);

    try {
      const notification = await fetchJson('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient, message })
      });
      setNotifications(current => [notification, ...current]);
      form.reset();
      setFormSuccess('Notification added to the queue.');
    } catch (error) {
      setFormError(error.message || 'Could not queue notification.');
    } finally {
      setSubmitting(false);
    }
  }

  const operationalCount = Object.values(services).filter(status => status === 'online').length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="SmartDeploy home">
          <span className="brand-mark">S</span>
          <span>smart<span className="brand-light">deploy</span></span>
        </a>
        <div className="sidebar-label">WORKSPACE</div>
        <a className="nav-link active" href="#overview">
          <span className="nav-icon">▦</span> Overview
        </a>
        <a className="nav-link" href="#products">
          <span className="nav-icon">◇</span> Catalog
        </a>
        <a className="nav-link" href="#orders">
          <span className="nav-icon">▤</span> Orders
        </a>
        <a className="nav-link" href="#notifications">
          <span className="nav-icon">◉</span> Notifications
        </a>
        <div className="sidebar-bottom">
          <span className="environment-dot" />
          <span><strong>Development</strong><small>Local environment</small></span>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> Service console</div>
          <button className="refresh-button" type="button" onClick={refresh} disabled={loading}>
            <span className={loading ? 'refresh-icon spinning' : 'refresh-icon'}>↻</span>
            Refresh
          </button>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">SMARTDEPLOY PLATFORM</p>
              <h1>Service console</h1>
              <p className="subtitle">A live view of products, orders, and customer notifications.</p>
            </div>
            <div className="health-summary">
              <span className={`health-check ${operationalCount === 3 ? 'all-good' : ''}`}>✓</span>
              <span><strong>{operationalCount} of 3 services</strong><small>operational</small></span>
            </div>
          </section>

          <section className="service-grid" aria-label="Service status">
            <article className="service-card">
              <div className="service-icon catalog-icon">◇</div>
              <div className="service-info">
                <span>Product Catalog</span>
                <small>Product inventory API</small>
              </div>
              <StatusBadge status={services.catalog} />
            </article>
            <article className="service-card">
              <div className="service-icon orders-icon">↗</div>
              <div className="service-info">
                <span>Order service</span>
                <small>Order management API</small>
              </div>
              <StatusBadge status={services.orders} />
            </article>
            <article className="service-card">
              <div className="service-icon notifications-icon">✳</div>
              <div className="service-info">
                <span>Notification service</span>
                <small>Customer messaging API</small>
              </div>
              <StatusBadge status={services.notifications} />
            </article>
          </section>

          <section className="panel catalog-panel" id="products">
            <div className="panel-heading">
              <div>
                <h2>Product catalog</h2>
                <p>Products available from the catalog service</p>
              </div>
              <span className="count-pill">{products.length} total</span>
            </div>
            {errors.catalog ? <div className="inline-error" role="alert">{errors.catalog}</div> : null}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>PRODUCT</th><th>NAME</th><th>PRICE</th></tr>
                </thead>
                <tbody>
                  {products.map(product => (
                    <tr key={product.id}>
                      <td className="order-id">#PRD-{String(product.id).padStart(4, '0')}</td>
                      <td>{product.name}</td>
                      <td>${Number(product.price).toLocaleString()}</td>
                    </tr>
                  ))}
                  {!loading && !errors.catalog && products.length === 0 ? (
                    <tr><td className="empty-row" colSpan="3">No products to show.</td></tr>
                  ) : null}
                  {loading ? <tr><td className="empty-row" colSpan="3">Loading products…</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="content-grid">
            <article className="panel orders-panel" id="orders">
              <div className="panel-heading">
                <div>
                  <h2>Recent orders</h2>
                  <p>Orders currently handled by the service</p>
                </div>
                <span className="count-pill">{orders.length} total</span>
              </div>
              {errors.orders ? <div className="inline-error" role="alert">{errors.orders}</div> : null}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>ORDER</th><th>PRODUCT</th><th>QUANTITY</th><th>STATUS</th></tr>
                  </thead>
                  <tbody>
                    {orders.map(order => (
                      <tr key={order.id}>
                        <td className="order-id">#ORD-{String(order.id).padStart(4, '0')}</td>
                        <td>Product {order.productId}</td>
                        <td>{order.quantity}</td>
                        <td><OrderStatus status={order.status} /></td>
                      </tr>
                    ))}
                    {!loading && !errors.orders && orders.length === 0 ? (
                      <tr><td className="empty-row" colSpan="4">No orders to show.</td></tr>
                    ) : null}
                    {loading ? <tr><td className="empty-row" colSpan="4">Loading orders…</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="panel compose-panel">
              <div className="panel-heading">
                <div>
                  <h2>Send a notification</h2>
                  <p>Queue a message for a recipient</p>
                </div>
                <span className="compose-icon">✉</span>
              </div>
              <form className="notification-form" onSubmit={submitNotification}>
                <label htmlFor="recipient">Recipient</label>
                <input id="recipient" name="recipient" type="email" placeholder="name@example.com" required />
                <label htmlFor="message">Message</label>
                <textarea id="message" name="message" placeholder="Write your notification…" rows="4" required />
                {formError ? <p className="form-message form-error" role="alert">{formError}</p> : null}
                {formSuccess ? <p className="form-message form-success" role="status">{formSuccess}</p> : null}
                <button className="submit-button" type="submit" disabled={submitting || services.notifications !== 'online'}>
                  {submitting ? 'Queuing…' : 'Queue notification'} <span>→</span>
                </button>
                {services.notifications !== 'online' ? <p className="form-hint">Notification service must be online to send.</p> : null}
              </form>
            </article>
          </section>

          <section className="panel activity-panel" id="notifications">
            <div className="panel-heading">
              <div>
                <h2>Notification activity</h2>
                <p>Recent messages from the notification service</p>
              </div>
              <span className="count-pill">{notifications.length} total</span>
            </div>
            {errors.notifications ? <div className="inline-error" role="alert">{errors.notifications}</div> : null}
            <div className="activity-list">
              {notifications.slice().reverse().slice(0, 5).map(notification => (
                <div className="activity-item" key={notification.id}>
                  <span className="activity-icon">✉</span>
                  <span className="activity-copy">
                    <strong>{notification.message}</strong>
                    <small>To {notification.recipient}</small>
                  </span>
                  <span className={`notification-status notification-${notification.status}`}>{notification.status}</span>
                </div>
              ))}
              {!loading && !errors.notifications && notifications.length === 0 ? (
                <p className="empty-activity">No notifications to show.</p>
              ) : null}
              {loading ? <p className="empty-activity">Loading notifications…</p> : null}
            </div>
          </section>
          <footer className="footer">SmartDeploy <span>·</span> Local service console <span>·</span> Refreshes every 15 seconds</footer>
        </div>
      </main>
    </div>
  );
}

export default App;
