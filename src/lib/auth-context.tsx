'use client';

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient, isSupabaseConfigured } from './supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  sessionExpired: boolean;
  onboarded: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [onboarded, setOnboarded] = useState(true); // default true to avoid flash
  const configured = isSupabaseConfigured;
  const manualSignOutRef = useRef(false);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setOnboarded(!!session?.user?.user_metadata?.onboarded_at);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && !manualSignOutRef.current) {
        // Session expired without user choosing to sign out
        setSessionExpired(true);
      }
      if (event === 'SIGNED_IN') {
        setSessionExpired(false);
        manualSignOutRef.current = false;
      }
      setSession(session);
      setUser(session?.user ?? null);
      setOnboarded(!!session?.user?.user_metadata?.onboarded_at);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [configured]);

  const signUp = async (email: string, password: string, name: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    });
    return { error: error?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    manualSignOutRef.current = true;
    const supabase = createClient();
    await supabase.auth.signOut();
  };

  const completeOnboarding = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: { onboarded_at: new Date().toISOString() },
    });
    if (!error) setOnboarded(true);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, configured, sessionExpired, onboarded, signUp, signIn, signOut, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
