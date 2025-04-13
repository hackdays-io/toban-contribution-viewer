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
        
        // Always try to get the session, whether real or mock
        const { session, error } = await getSession();

        if (error) {
          throw error;
        }

        // Cast session type to satisfy TypeScript
        if (session) {
          setSession(session as unknown as Session);
          setUser(session.user || null);
        } else {
          setSession(null);
          setUser(null);
        }

        // For mock clients, inform the developer
        // Check if we're using a mock client and in a development environment
        const isMockClient = !session && ('auth' in supabase) && !('http' in supabase);
        const isDevelopmentHost = window.location.hostname.includes('ngrok') || 
                                 window.location.hostname === 'localhost';
                                 
        if (isMockClient && isDevelopmentHost) {
          console.info('Running in development mode with mock authentication. This is normal when using placeholder Supabase credentials.');
          console.info('You can proceed without authentication or use the login/signup forms with any credentials.');
        }
      } catch (error) {
        setError(error as Error);
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Set up auth state change listener
    // Our mock client now also supports this
    const listener = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.info(`Auth state changed: ${event}`);
        // Cast session type to satisfy TypeScript
        if (session) {
          setSession(session as unknown as Session);
          setUser(session.user || null);
        } else {
          setSession(null);
          setUser(null);
        }
        setLoading(false);
      }
    );
    
    // Clean up the subscription
    return () => {
      if (listener && listener.data && listener.data.subscription) {
        listener.data.subscription.unsubscribe();
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
