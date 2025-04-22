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
  
  // FUTURE ENHANCEMENT: If we need to extract specific domains to include instead of allowing all:
  // 
  // function extractHostname(url) {
  //   try {
  //     return new URL(url).hostname;
  //   } catch {
  //     return null;
  //   }
  // }
  // 
  // const ngrokHost = env.VITE_FRONTEND_URL ? extractHostname(env.VITE_FRONTEND_URL) : null;
  // const allowedHostsList = ['localhost', '127.0.0.1', ngrokHost].filter(Boolean);

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
    allowedHosts: string[] | true;
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
      // When allowedHosts is true, keep it as true (allow all hosts)
      // Otherwise, ensure we include both localhost and ngrok domains
      allowedHosts,
      // Initialize proxy as empty object to satisfy TypeScript
      proxy: {} as ServerConfig['proxy']
    } as ServerConfig
  };
  
  
  console.log('Allowed hosts:', allowedHosts === true ? 'All hosts allowed' : allowedHosts);
  return config;
})
