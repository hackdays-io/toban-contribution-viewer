import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables based on mode
  const env = loadEnv(mode, process.cwd());

  // Create a list of allowed hosts, always starting with an empty array
  const allowedHosts = [];
  
  // Log all environment variables to debug
  console.log('Environment variables in Vite config:');
  console.log('env.VITE_FRONTEND_URL:', env.VITE_FRONTEND_URL);
  console.log('process.env.NGROK_URL:', process.env.NGROK_URL);
  console.log('process.env.VITE_FRONTEND_URL:', process.env.VITE_FRONTEND_URL);
  
  // Try to extract domain from VITE_FRONTEND_URL first (highest priority)
  if (env.VITE_FRONTEND_URL) {
    try {
      const url = new URL(env.VITE_FRONTEND_URL);
      if (url.hostname) {
        allowedHosts.push(url.hostname);
        console.log(`Added host from env.VITE_FRONTEND_URL: ${url.hostname}`);
      }
    } catch (e) {
      console.warn('Could not parse env.VITE_FRONTEND_URL:', env.VITE_FRONTEND_URL, e);
    }
  }
  
  // Try process.env.VITE_FRONTEND_URL as another option
  if (process.env.VITE_FRONTEND_URL && !allowedHosts.some(h => h.includes('ngrok'))) {
    try {
      const url = new URL(process.env.VITE_FRONTEND_URL);
      if (url.hostname) {
        allowedHosts.push(url.hostname);
        console.log(`Added host from process.env.VITE_FRONTEND_URL: ${url.hostname}`);
      }
    } catch (e) {
      console.warn('Could not parse process.env.VITE_FRONTEND_URL:', process.env.VITE_FRONTEND_URL, e);
    }
  }
  
  // Then try NGROK_URL as a fallback
  if (process.env.NGROK_URL && !allowedHosts.some(h => h.includes('ngrok'))) {
    try {
      const url = new URL(process.env.NGROK_URL);
      if (url.hostname) {
        allowedHosts.push(url.hostname);
        console.log(`Added host from NGROK_URL: ${url.hostname}`);
      }
    } catch (e) {
      console.warn('Could not parse NGROK_URL', e);
    }
  }
  
  // Explicitly add the ngrok domain we know exists in container env
  if (!allowedHosts.some(h => h.includes('ngrok'))) {
    allowedHosts.push('summary-locust-arriving.ngrok-free.app');
    console.log('Added hardcoded ngrok domain as last resort');
  }
  
  // Always add wildcard patterns as a further fallback
  allowedHosts.push('*.ngrok-free.app');
  allowedHosts.push('*.ngrok.io');
  
  // Log all allowed hosts for debugging
  console.log('Final allowed hosts:', allowedHosts);

  // Determine if we're in development mode
  const isDev = mode === 'development';
  
  // Define the server configuration type
  interface ServerConfig {
    host: string;
    port: number;
    strictPort: boolean;
    hmr: {
      clientPort: number;
    };
    cors: boolean;
    allowedHosts: string[];
    proxy?: {
      [key: string]: {
        target: string;
        changeOrigin: boolean;
        secure: boolean;
      };
    };
  }

  // Base configuration with proper typing
  const config = {
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
      // Initialize proxy as empty object to satisfy TypeScript
      proxy: {} as ServerConfig['proxy']
    } as ServerConfig
  };
  
  // Only add proxy configuration in development mode
  if (isDev) {
    config.server.proxy = {
      // Proxy all API requests to the backend
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    };
    console.log('Development mode: API proxy enabled');
  } else {
    console.log('Production mode: API proxy disabled');
  }
  
  return config;
})
