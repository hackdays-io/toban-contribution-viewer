import { createClient } from '@supabase/supabase-js';
import env from '../config/env';

// Initialize the Supabase client
const supabaseUrl = env.supabase.url;
const supabaseAnonKey = env.supabase.anonKey;

// The real Supabase client with appropriate types

// Always use the real Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Log auth configuration
console.info('Using real Supabase authentication at:', supabaseUrl);

export { supabase };

// Auth helpers
export const signIn = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { data, error };
  } catch (e) {
    console.error('Error in signIn:', e);
    return { data: null, error: e instanceof Error ? e : new Error('Unknown error during sign in') };
  }
};

export const signUp = async (email: string, password: string) => {
  try {
    // In development, provide info about email confirmation
    if (env.isDev) {
      console.info('Development mode: Proceeding with standard signup. Verification via Supabase dashboard may be needed.');
    }

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

    return { data: data || null, error };
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

    return { data: data || null, error };
  } catch (e) {
    console.error('Error in signInWithGoogle:', e);
    return { data: null, error: e instanceof Error ? e : new Error('Unknown error during Google sign in') };
  }
};

export default supabase;
