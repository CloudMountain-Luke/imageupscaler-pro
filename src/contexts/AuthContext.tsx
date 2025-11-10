import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

/**
 * User-facing profile kept simple for now.
 */
interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  creditsRemaining: number;
}

/**
 * PUBLIC CONTEXT SHAPE
 * - Adds `isAuthenticated` and `authReady` for plan-selection / checkout gating
 * - Keeps `isReady` for backward compatibility (alias of `authReady`)
 */
export type AuthShape = {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  /** @deprecated Use authReady instead. Kept for backward compatibility. */
  isReady: boolean;
  /** True once initial session check or first auth callback has fired. */
  authReady: boolean;
  /** True iff a user is signed in. */
  isAuthenticated: boolean;
  error?: string;
  // Auth actions
  signInWithOtp: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  register: (email: string, password: string, name: string, promoCode?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  recoverPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; message: string }>;
};

const AuthContext = createContext<AuthShape | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isReady, setReady] = useState(false); // kept to avoid breaking existing imports
  const [error, setError] = useState<string | undefined>();

  // --- INITIAL SESSION + LISTENER ---
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      if (!isSupabaseConfigured) {
        if (mounted) {
          console.warn('Supabase is not configured. Skipping auth initialization.');
          setError('Authentication service is not configured.');
          setReady(true);
        }
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          console.warn('Auth session error:', error);
          setError(error.message);
        } else {
          setSession(data.session ?? null);
          setUser(data.session?.user ?? null);

          if (data.session?.user) {
            const u = data.session.user;
            setUserProfile({
              id: u.id,
              email: u.email || '',
              displayName: (u.user_metadata as any)?.name || 'User',
              creditsRemaining: 250,
            });
          }
        }
      } catch (e: any) {
        if (!mounted) return;
        console.warn('Auth init error:', e);
        setError(e?.message ?? 'Auth init failed');
      } finally {
        if (mounted) setReady(true); // signal auth readiness
      }
    };

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;

      console.log('Auth state change:', _event, nextSession?.user?.email || 'no user');
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        const u = nextSession.user;
        setUserProfile({
          id: u.id,
          email: u.email || '',
          displayName: (u.user_metadata as any)?.name || 'User',
          creditsRemaining: 250,
        });
      } else {
        setUserProfile(null);
      }
    });

    return () => {
      mounted = false;
      // supabase-js v2 style:
      try { listener?.subscription?.unsubscribe(); } catch {}
    };
  }, []);

  // --- ACTIONS ---
  const login = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      throw new Error('Authentication service is not configured.');
    }
    console.log('AuthContext login called with:', email);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      console.log('Supabase signInWithPassword result:', { data: !!data, error: error?.message });
      if (error) throw error;
      console.log('Login successful, user:', data.user?.email);
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof Error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        } else if (error.message.includes('Email not confirmed')) {
          throw new Error('Please check your email and click the confirmation link before signing in.');
        } else if (error.message.includes('Too many requests')) {
          throw new Error('Too many login attempts. Please wait a few minutes before trying again.');
        } else {
          throw new Error(error.message);
        }
      } else {
        throw new Error('Login failed. Please try again.');
      }
    }
  };

  const logout = async () => {
    if (!isSupabaseConfigured) {
      setSession(null);
      setUser(null);
      setUserProfile(null);
      console.warn('Supabase not configured; cleared local auth state only.');
      return;
    }
    try {
      console.log('Logging out user...');
      await supabase.auth.signOut();
      console.log('Supabase signOut completed');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setSession(null);
      setUser(null);
      setUserProfile(null);
      console.log('Auth state cleared');
    }
  };

  const register = async (email: string, password: string, name: string, promoCode?: string) => {
    if (!isSupabaseConfigured) {
      throw new Error('Authentication service is not configured.');
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) throw error;
      if (data.user) {
        setUserProfile({
          id: data.user.id,
          email: data.user.email || email,
          displayName: name,
          creditsRemaining: 250,
        });
      }
    } catch (error) {
      console.error('Registration error:', error);
      if (error instanceof Error) {
        if (error.message.includes('User already registered')) {
          throw new Error('An account with this email already exists. Please sign in instead.');
        } else if (error.message.includes('Password should be at least')) {
          throw new Error('Password must be at least 6 characters long.');
        } else if (error.message.includes('Invalid email')) {
          throw new Error('Please enter a valid email address.');
        } else {
          throw new Error(error.message);
        }
      } else {
        throw new Error('Registration failed. Please try again.');
      }
    }
  };

  const recoverPassword = async (email: string): Promise<{ success: boolean; message: string }> => {
    if (!isSupabaseConfigured) {
      return { success: false, message: 'Authentication service is not configured.' };
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        if (error.message.includes('Invalid email')) {
          return { success: false, message: 'Please enter a valid email address.' };
        } else if (error.message.includes('Email not found')) {
          return { success: false, message: 'No account found with this email address.' };
        } else if (error.message.includes('Too many requests')) {
          return { success: false, message: 'Too many password reset attempts. Please wait before trying again.' };
        } else {
          return { success: false, message: error.message };
        }
      }
      return { success: true, message: 'Password reset email sent! Please check your inbox and follow the instructions.' };
    } catch (error) {
      console.error('Password recovery error:', error);
      return { success: false, message: 'Failed to send password reset email. Please try again.' };
    }
  };

  const updatePassword = async (newPassword: string): Promise<{ success: boolean; message: string }> => {
    if (!isSupabaseConfigured) {
      return { success: false, message: 'Authentication service is not configured.' };
    }
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        if (error.message.includes('New password should be different')) {
          return { success: false, message: 'New password must be different from your current password.' };
        } else if (error.message.includes('Password should be at least')) {
          return { success: false, message: 'Password must be at least 6 characters long.' };
        } else {
          return { success: false, message: error.message };
        }
      }
      return { success: true, message: 'Password updated successfully!' };
    } catch (error) {
      console.error('Password update error:', error);
      return { success: false, message: 'Failed to update password. Please try again.' };
    }
  };

  // --- CONTEXT VALUE ---
  const value = useMemo<AuthShape>(() => {
    const isAuthenticated = !!user; // also: !!session?.user
    const authReady = isReady; // expose a clearer alias
    return {
      session,
      user,
      userProfile,
      isReady, // legacy
      authReady,
      isAuthenticated,
      error,
      async signInWithOtp(email: string) {
        if (!isSupabaseConfigured) {
          return { error: 'Authentication service is not configured.' };
        }
        try {
          const { error } = await supabase.auth.signInWithOtp({ email });
          if (error) return { error: error.message };
          return {};
        } catch (e: any) {
          return { error: e?.message ?? 'Sign-in failed' };
        }
      },
      async signOut() {
        if (!isSupabaseConfigured) {
          setUserProfile(null);
          setSession(null);
          setUser(null);
          return;
        }
        try {
          await supabase.auth.signOut();
          setUserProfile(null);
        } catch {}
      },
      login,
      logout,
      register,
      recoverPassword,
      updatePassword,
    };
  }, [session, user, userProfile, isReady, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() used outside <AuthProvider>. Wrap your tree with <AuthProvider>.');
  return ctx;
}
