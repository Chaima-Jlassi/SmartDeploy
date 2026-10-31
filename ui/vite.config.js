import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/products': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, '')
      },
      '/api/orders': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, '')
      },
      '/api/notifications': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, '')
      },
      '/api/order-health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: () => '/health'
      },
      '/api/notification-health': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: () => '/health'
      },
      '/api/catalog-health': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: () => '/health'
      }
    }
  }
});
