import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables based on mode
  const env = loadEnv(mode, process.cwd());

  // Extract domain from NGROK_URL if it exists
  const allowedHosts = [];
  if (env.VITE_FRONTEND_URL || process.env.NGROK_URL) {
    try {
      const url = new URL(env.VITE_FRONTEND_URL || process.env.NGROK_URL || '');
      if (url.hostname) {
        allowedHosts.push(url.hostname);
      }
    } catch (e) {
      console.warn('Could not parse NGROK_URL', e);
    }
  }

  // Add specific ngrok domain if needed
  allowedHosts.push('summary-locust-arriving.ngrok-free.app');
  // Add generic ngrok domains
  allowedHosts.push('*.ngrok-free.app');
  allowedHosts.push('*.ngrok.io');

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      hmr: {
        // Allow HMR from different hosts
        clientPort: 5173
      },
      cors: true,
      // Allow connections from these hosts
      allowedHosts,
      proxy: {
        // Proxy all API requests to the backend
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        }
      }
    }
  }
})
