import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables based on mode
  // This loads .env files into env object - this is NOT the same as process.env
  const env = loadEnv(mode, process.cwd());
  
  console.log('=== Vite Configuration ===');
  console.log('Mode:', mode);
  console.log('Environment variables:', {
    VITE_FRONTEND_URL: env.VITE_FRONTEND_URL,
    VITE_ADDITIONAL_ALLOWED_HOSTS: env.VITE_ADDITIONAL_ALLOWED_HOSTS,
  });
  
  // For development with ngrok, allow all hosts
  // This is a more permissive approach that will solve the immediate issue
  const allowedHosts = true; // Allow all hosts
  
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
        target: 'http://backend:8000',  // Use Docker service name
        changeOrigin: true,
        secure: false,
      }
    };
    console.log('Development mode: API proxy enabled (target: http://backend:8000)');
  } else {
    console.log('Production mode: API proxy disabled');
  }
  
  console.log('Allowed hosts:', allowedHosts);
  return config;
})
