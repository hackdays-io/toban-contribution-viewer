/**
 * Environment variables management and validation
 * Utility for centralizing access to environment variables and validating their presence
 */

// Required environment variables that must be defined
const REQUIRED_ENV_VARS = [
  'VITE_API_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
] as const;

// Optional environment variables with default values
const OPTIONAL_ENV_VARS = {
  VITE_DEV_MODE: 'false',
  VITE_ENABLE_NOTION_INTEGRATION: 'true',
  VITE_ENABLE_SLACK_INTEGRATION: 'true',
  VITE_ENABLE_GITHUB_INTEGRATION: 'true',
  VITE_AUTH_REDIRECT_URI: window.location.origin + '/auth/callback',
} as const;

// Type definitions
type RequiredEnvVar = typeof REQUIRED_ENV_VARS[number];
type OptionalEnvVar = keyof typeof OPTIONAL_ENV_VARS;
type EnvVar = RequiredEnvVar | OptionalEnvVar;

// Validate required environment variables
const validateEnv = (): { valid: boolean; missing: string[]; placeholders: string[] } => {
  const missing: string[] = [];
  const placeholders: string[] = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    const value = import.meta.env[envVar];
    
    if (!value) {
      missing.push(envVar);
      console.error(`Missing required environment variable: ${envVar}`);
    } else if (
      value === 'your_supabase_url' || 
      value === 'your_supabase_anon_key'
    ) {
      placeholders.push(envVar);
      console.warn(`Environment variable contains placeholder: ${envVar}`);
    }
  }

  return {
    valid: missing.length === 0 && placeholders.length === 0,
    missing,
    placeholders,
  };
};

// Get a specific environment variable with fallback to defaults for optional ones
export const getEnvVar = <T extends EnvVar>(name: T): string => {
  const value = import.meta.env[name];

  // If it's a required environment variable and it's missing, throw an error
  if (!value && REQUIRED_ENV_VARS.includes(name as RequiredEnvVar)) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  // For optional environment variables, use the default value if not provided
  if (!value && name in OPTIONAL_ENV_VARS) {
    return OPTIONAL_ENV_VARS[name as OptionalEnvVar];
  }

  return value as string;
};

// Helper to get a boolean environment variable
export const getBooleanEnvVar = (name: EnvVar): boolean => {
  const value = getEnvVar(name).toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
};

// Validate environment on load
export const validateEnvironment = (): boolean => {
  const { valid, missing, placeholders } = validateEnv();

  if (!valid) {
    // Handle missing variables
    if (missing.length > 0) {
      console.error(
        'The app is missing required environment variables:',
        missing.join(', ')
      );
    }
    
    // Handle placeholder values
    if (placeholders.length > 0) {
      console.warn(
        'The app has placeholder values for required environment variables:',
        placeholders.join(', ')
      );
    }

    // Only show alert in development mode to avoid exposing errors to users
    if (getBooleanEnvVar('VITE_DEV_MODE')) {
      let message = '';
      
      if (missing.length > 0) {
        message += `Missing required environment variables: ${missing.join(', ')}. `;
      }
      
      if (placeholders.length > 0) {
        message += `Please replace placeholder values for: ${placeholders.join(', ')}. `;
      }
      
      message += 'Please check your .env file and restart the development server.';
      
      // Use console warning instead of alert for a better developer experience
      console.warn(message);
    }
  }

  // Return valid status but allow the app to continue even with placeholders
  return missing.length === 0;
};

// Create a config object with all environment variables
export const env = {
  apiUrl: getEnvVar('VITE_API_URL'),
  supabase: {
    url: getEnvVar('VITE_SUPABASE_URL'),
    anonKey: getEnvVar('VITE_SUPABASE_ANON_KEY'),
    redirectUri: getEnvVar('VITE_AUTH_REDIRECT_URI'),
  },
  features: {
    enableNotion: getBooleanEnvVar('VITE_ENABLE_NOTION_INTEGRATION'),
    enableSlack: getBooleanEnvVar('VITE_ENABLE_SLACK_INTEGRATION'),
    enableGithub: getBooleanEnvVar('VITE_ENABLE_GITHUB_INTEGRATION'),
  },
  isDev: getBooleanEnvVar('VITE_DEV_MODE'),
};

export default env;
