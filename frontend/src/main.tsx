import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { validateEnvironment } from './config/env';

// Validate environment variables before rendering the app
const envValid = validateEnvironment();

// Render the application
const rootElement = document.getElementById('root');

if (rootElement) {
  const root = createRoot(rootElement);

  root.render(
    <StrictMode>
      {envValid ? (
        <App />
      ) : (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
          <h1>Environment Configuration Error</h1>
          <p>
            The application is missing required environment variables.
            Please check the console for more information.
          </p>
          {import.meta.env.DEV && (
            <div>
              <h2>Development Instructions</h2>
              <p>
                Make sure you have a <code>.env.local</code> file in the project root with all required variables.
                See <code>.env.example</code> for a list of required variables.
              </p>
              <p>After updating your environment variables, restart the development server.</p>
            </div>
          )}
        </div>
      )}
    </StrictMode>,
  );
}
