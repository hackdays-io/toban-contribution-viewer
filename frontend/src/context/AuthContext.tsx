import React, { createContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, getSession } from '../lib/supabase';

// Define the shape of our auth context
type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: Error | null;
  signOut: () => Promise<void>;
};

// Create the context with a default value
const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  error: null,
  signOut: async () => {},
});

// useAuth hook is exported from separate file

// Provider component to wrap the app
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Get the initial session
    const initializeAuth = async () => {
      try {
        setLoading(true);
        
        // Check if we have a mock implementation (environment with missing Supabase credentials)
        const isMockEnvironment = !('onAuthStateChange' in supabase.auth);
        
        if (isMockEnvironment) {
          console.warn('Running in development mode with mock authentication. Bypassing auth checks.');
          // In mock mode, allow access without authentication
          setLoading(false);
          return;
        }
        
        // Normal auth flow with real Supabase client
        const { session, error } = await getSession();

        if (error) {
          throw error;
        }

        setSession(session);
        setUser(session?.user || null);
      } catch (error) {
        setError(error as Error);
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Set up auth state change listener only if we have a real Supabase client
    let authListener: { subscription?: { unsubscribe: () => void } } = {};
    
    if ('onAuthStateChange' in supabase.auth) {
      const listener = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          setSession(session);
          setUser(session?.user || null);
          setLoading(false);
        }
      );
      
      authListener = listener.data;
    }

    // Clean up the subscription
    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  // Sign out function
  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
    } catch (error) {
      setError(error as Error);
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  // The value that will be provided to consumers of this context
  const value = {
    session,
    user,
    loading,
    error,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
