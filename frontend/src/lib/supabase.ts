import { createClient } from '@supabase/supabase-js';
import env from '../config/env';

// Initialize the Supabase client
const supabaseUrl = env.supabase.url;
const supabaseAnonKey = env.supabase.anonKey;

// Check if the values are placeholders or missing
const isPlaceholder = (value: string) => {
  return !value || value === 'your_supabase_url' || value === 'your_supabase_anon_key';
};

// Check if we need to use mock implementation
const usesMockClient = isPlaceholder(supabaseUrl) || isPlaceholder(supabaseAnonKey);

// Choose between real client or completely mocked implementation
let supabase;

if (usesMockClient) {
  console.info('Using mock Supabase client in development mode. Authentication is bypassed for easier testing.');
  
  // Create a fully mocked Supabase client to prevent CORS errors
  // This approach prevents any actual network requests
  const mockResponse = { error: null, data: null };
  
  // Create a comprehensive mock client for development mode
  // This provides a more realistic experience without real auth
  const mockUser = {
    id: 'mock-user-id',
    email: 'dev@example.com',
    app_metadata: { provider: 'email' },
    user_metadata: { name: 'Development User' },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  };

  const mockSession = {
    access_token: 'mock-jwt-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: mockUser,
  };

  // Store mock auth state
  let mockAuthState = {
    isAuthenticated: false,
    session: null as typeof mockSession | null,
    user: null as typeof mockUser | null,
    authChangeCallbacks: [] as Array<(event: string, session: any) => void>,
  };

  supabase = {
    auth: {
      // Get the current session
      getSession: async () => {
        console.info('Mock auth: getSession called');
        return { 
          data: { session: mockAuthState.session }, 
          error: null 
        };
      },
      
      // Get the current user
      getUser: async () => {
        console.info('Mock auth: getUser called');
        return { 
          data: { user: mockAuthState.user }, 
          error: null 
        };
      },
      
      // Sign in with email/password
      signInWithPassword: async ({ email, password }: { email: string, password: string }) => {
        console.info(`Mock auth: Signing in user ${email} in development mode`);
        
        // Mock successful login
        mockAuthState.isAuthenticated = true;
        mockAuthState.user = { ...mockUser, email };
        mockAuthState.session = { ...mockSession, user: { ...mockUser, email } };
        
        // Notify listeners
        mockAuthState.authChangeCallbacks.forEach(cb => 
          cb('SIGNED_IN', mockAuthState.session)
        );

        return { 
          data: { 
            user: mockAuthState.user, 
            session: mockAuthState.session 
          }, 
          error: null 
        };
      },
      
      // Sign in with OAuth provider
      signInWithOAuth: async ({ provider }: { provider: string, options?: any }) => {
        console.info(`Mock auth: OAuth sign-in with ${provider} in development mode`);
        
        // Since we can't do real OAuth flow, just redirect to dashboard in dev
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
        
        return { 
          data: { provider, url: '#' }, 
          error: null 
        };
      },
      
      // Sign up with email/password
      signUp: async ({ email, password }: { email: string, password: string, options?: any }) => {
        console.info(`Mock auth: Registering user ${email} in development mode`);
        
        // In development, we'll simulate instant verification
        mockAuthState.isAuthenticated = true;
        mockAuthState.user = { ...mockUser, email };
        mockAuthState.session = { ...mockSession, user: { ...mockUser, email } };
        
        // Notify listeners
        mockAuthState.authChangeCallbacks.forEach(cb => 
          cb('SIGNED_IN', mockAuthState.session)
        );
        
        return { 
          data: { 
            user: mockAuthState.user, 
            session: mockAuthState.session 
          }, 
          error: null 
        };
      },
      
      // Sign out
      signOut: async () => {
        console.info('Mock auth: Signing out in development mode');
        
        // Reset auth state
        mockAuthState.isAuthenticated = false;
        mockAuthState.user = null;
        mockAuthState.session = null;
        
        // Notify listeners
        mockAuthState.authChangeCallbacks.forEach(cb => 
          cb('SIGNED_OUT', null)
        );
        
        return { error: null };
      },
      
      // Auth state change listener
      onAuthStateChange: (callback: (event: string, session: any) => void) => {
        console.info('Mock auth: Registered auth state change listener');
        mockAuthState.authChangeCallbacks.push(callback);
        
        // Return mock subscription
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                mockAuthState.authChangeCallbacks = 
                  mockAuthState.authChangeCallbacks.filter(cb => cb !== callback);
              }
            }
          }
        };
      }
    },
    
    // Mock database operations
    from: () => ({
      select: () => ({ data: [], error: null }),
      insert: () => ({ data: null, error: null }),
      update: () => ({ data: null, error: null }),
      delete: () => ({ data: null, error: null }),
    }),
  };
} else {
  // Use actual Supabase client with real credentials
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };

// Auth helpers - these work with both real and mock clients
export const signIn = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // In development mode with mock client, redirect to dashboard after successful login
    if (!error && data?.user && isUsingMockClient()) {
      console.info('Mock auth successful, redirecting to dashboard');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 500);
    }

    return { data, error };
  } catch (e) {
    console.error('Error in signIn:', e);
    return { data: null, error: e instanceof Error ? e : new Error('Unknown error during sign in') };
  }
};

export const signUp = async (email: string, password: string) => {
  try {
    // Determine if we're using the mock client
    const usingMockClient = isUsingMockClient();
    
    // In mock mode, we'll provide a seamless experience
    if (usingMockClient) {
      console.info('Development mode: Using mock signup with auto-confirmation');
      
      // Use the appropriate method depending on the mock client structure
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });
      
      // Redirect to dashboard after fake signup 
      if (!error) {
        console.info('Mock signup successful, redirecting to dashboard shortly');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1500);
      }
      
      return { data, error };
    }
    
    // In development with real client, provide info about email confirmation
    if (env.isDev) {
      console.info('Development mode: Proceeding with standard signup. Verification via Supabase dashboard may be needed.');
    }

    // Standard flow for all environments
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });

    return { data, error };
  } catch (e) {
    console.error('Error in signUp:', e);
    return { data: null, error: e instanceof Error ? e : new Error('Unknown error during sign up') };
  }
};

export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    
    // In mock mode, redirect to login after signout
    if (!error && isUsingMockClient()) {
      console.info('Mock sign out successful, redirecting to login');
      setTimeout(() => {
        window.location.href = '/login';
      }, 500);
    }
    
    return { error };
  } catch (e) {
    console.error('Error in signOut:', e);
    return { error: e instanceof Error ? e : new Error('Unknown error during sign out') };
  }
};

export const getSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    return { session: data.session, error };
  } catch (e) {
    console.error('Error in getSession:', e);
    return { session: null, error: e instanceof Error ? e : new Error('Unknown error getting session') };
  }
};

// Social login helpers
export const signInWithGithub = async () => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    return { data, error };
  } catch (e) {
    console.error('Error in signInWithGithub:', e);
    return { data: null, error: e instanceof Error ? e : new Error('Unknown error during GitHub sign in') };
  }
};

export const signInWithGoogle = async () => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    return { data, error };
  } catch (e) {
    console.error('Error in signInWithGoogle:', e);
    return { data: null, error: e instanceof Error ? e : new Error('Unknown error during Google sign in') };
  }
};

// Helper to detect if we're using mock client
function isUsingMockClient(): boolean {
  // Check if we have placeholder credentials
  const isPlaceholder = (value: string) => {
    return !value || value === 'your_supabase_url' || value === 'your_supabase_anon_key';
  };
  
  return isPlaceholder(env.supabase.url) || isPlaceholder(env.supabase.anonKey);
}

export default supabase;
