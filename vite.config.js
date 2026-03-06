import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Allow ngrok and any external host to reach the Vite dev server
    allowedHosts: 'all',
    // In local dev, proxy API calls to the backend server
    proxy: {
      '/api':      'http://localhost:3000',
      '/callback': 'http://localhost:3000',
      '/webhook':  'http://localhost:3000',
    },
  },
});
