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

  // Don't add specific ngrok domains - use wildcard patterns instead
  // Add generic ngrok domains
  allowedHosts.push('*.ngrok-free.app');
  allowedHosts.push('*.ngrok.io');

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
