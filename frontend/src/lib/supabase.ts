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
  console.warn('Using fully mocked Supabase client. Authentication and database operations will not work.');
  
  // Create a fully mocked Supabase client to prevent CORS errors
  // This approach prevents any actual network requests
  const mockResponse = { error: null, data: null };
  
  // Create a dummy client with all methods mocked
  supabase = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signInWithPassword: async () => ({ data: null, error: { message: "Authentication is disabled with mock client" } }),
      signInWithOAuth: async () => ({ data: null, error: { message: "Authentication is disabled with mock client" } }),
      signUp: async () => ({ data: null, error: { message: "Authentication is disabled with mock client" } }),
      signOut: async () => ({ error: null }),
    },
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

// Auth helpers
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
};

export const signUp = async (email: string, password: string) => {
  // In development, provide auto-confirmation option if desired
  if (env.isDev) {
    console.log('Development mode: Proceeding with standard signup. You may need to verify via the Supabase dashboard.');

    // Use standard flow for consistency
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // For development only - set this to true to bypass email confirmation
        // This requires "Confirm email" to be disabled in Supabase Auth settings
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });

    return { data, error };
  }

  // In production, use normal sign-up flow with email confirmation
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`
    }
  });

  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
};

// Social login helpers
export const signInWithGithub = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  return { data, error };
};

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  return { data, error };
};

export default supabase;
