import React, { createContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, getSession } from '../lib/supabase';
import env from '../config/env';

// Define the team types
export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Team {
  id: string;
  name: string;
  slug: string;
  role: TeamRole;
}

export interface TeamContext {
  currentTeamId?: string;
  currentTeamRole?: TeamRole;
  teams: Team[];
}

// Define the shape of our auth context
type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: Error | null;
  teamContext: TeamContext;
  setTeamContext: (context: TeamContext) => void;
  switchTeam: (teamId: string) => Promise<void>;
  signOut: () => Promise<void>;
};

// Create the context with a default value
const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  error: null,
  teamContext: { teams: [] },
  setTeamContext: () => {},
  switchTeam: async () => {},
  signOut: async () => {},
});

// useAuth hook is exported from separate file

// Provider component to wrap the app
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [teamContext, setTeamContext] = useState<TeamContext>({ teams: [] });

  // Function to load team context from API
  const loadTeamContext = useCallback(async () => {
    try {
      if (!user) return;
      
      const response = await fetch(`${env.apiUrl}/teams/auth/context`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Error loading team context: ${response.status}`);
      }
      
      const data = await response.json();
      setTeamContext({
        currentTeamId: data.current_team_id,
        currentTeamRole: data.current_team_role as TeamRole,
        teams: data.teams || [],
      });
      
      console.info('Team context loaded:', data);
    } catch (error) {
      console.error('Error loading team context:', error);
      // Don't set error state here, as this is supplementary information
    }
  }, [user, session?.access_token]);
  
  // Function to switch the current team
  const switchTeam = async (teamId: string) => {
    try {
      setLoading(true);
      
      const response = await fetch(`${env.apiUrl}/teams/auth/switch-team`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ team_id: teamId, refresh_token: true }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Error switching team: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update team context
      setTeamContext({
        currentTeamId: data.current_team_id,
        currentTeamRole: data.current_team_role as TeamRole,
        teams: data.teams || [],
      });
      
      // Update session with new token if provided
      if (data.token && session) {
        // Update the session object with the new token
        // Note: This doesn't actually refresh the Supabase session
        // but allows our app to use the new token with team context
        const updatedSession = {
          ...session,
          access_token: data.token,
        };
        setSession(updatedSession as unknown as Session);
      }
      
      console.info('Switched to team:', data.current_team_id);
    } catch (error) {
      setError(error as Error);
      console.error('Error switching team:', error);
    } finally {
      setLoading(false);
    }
  };

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

        // Set user session
        if (session) {
          setSession(session as unknown as Session);
          setUser(session.user || null);
          
          // Load team context after authentication
          await loadTeamContext();
        } else {
          setSession(null);
          setUser(null);
          setTeamContext({ teams: [] });
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
    const listener = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.info(`Auth state changed: ${event}`);
        if (session) {
          setSession(session as unknown as Session);
          setUser(session.user || null);
          
          // Load team context on auth state change
          if (event === 'SIGNED_IN') {
            await loadTeamContext();
          }
        } else {
          setSession(null);
          setUser(null);
          setTeamContext({ teams: [] });
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
  }, [loadTeamContext]);

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
    teamContext,
    setTeamContext,
    switchTeam,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
