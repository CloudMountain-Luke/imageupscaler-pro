import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  creditsRemaining: number;
}

type AuthShape = {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  isReady: boolean;
  error?: string;
  signInWithOtp: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  register: (email: string, password: string, name: string, promoCode?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  recoverPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  recoverPassword: (email: string) => Promise<{ success: boolean; message: string }>;
};

const AuthContext = createContext<AuthShape | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isReady, setReady] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let mounted = true;
    
    const initAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        
        if (error) {
          console.warn('Auth session error:', error);
          setError(error.message);
        } else {
          setSession(data.session ?? null);
          setUser(data.session?.user ?? null);
          
          // Create a simple user profile if user exists
          if (data.session?.user) {
            setUserProfile({
              id: data.session.user.id,
              email: data.session.user.email || '',
              displayName: data.session.user.user_metadata?.name || 'User',
              creditsRemaining: 250,
            });
          }
        }
      } catch (e: any) {
        if (!mounted) return;
        console.warn('Auth init error:', e);
        setError(e?.message ?? 'Auth init failed');
      } finally {
        if (mounted) {
          setReady(true);
        }
      }
    };

    initAuth();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setUserProfile({
          id: session.user.id,
          email: session.user.email || '',
          displayName: session.user.user_metadata?.name || 'User',
          creditsRemaining: 250,
        });
      } else {
        setUserProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
   console.log('AuthContext login called with:', email);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

     console.log('Supabase signInWithPassword result:', { data: !!data, error: error?.message });
     
      if (error) throw error;
     
     console.log('Login successful, user:', data.user?.email);
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof Error) {
        // Handle specific Supabase auth errors with user-friendly messages
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
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUserProfile(null);
    }
  };

  const register = async (email: string, password: string, name: string, promoCode?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        // Simple profile creation without complex tracking service
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
        // Handle specific Supabase auth errors with user-friendly messages
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

      return { 
        success: true, 
        message: 'Password reset email sent! Please check your inbox and follow the instructions.' 
      };
    } catch (error) {
      console.error('Password recovery error:', error);
      return { 
        success: false, 
        message: 'Failed to send password reset email. Please try again.' 
      };
    }
  };

  const value = useMemo<AuthShape>(() => ({
    session, 
    user, 
    userProfile,
    isReady, 
    error,
    async signInWithOtp(email: string) {
      try {
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) return { error: error.message };
        return {};
      } catch (e: any) {
        return { error: e?.message ?? 'Sign-in failed' };
      }
    },
    async signOut() {
      try { 
        await supabase.auth.signOut(); 
        setUserProfile(null);
      } catch {}
    },
    login,
    logout,
    register,
    recoverPassword
  }), [session, user, userProfile, isReady, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() used outside <AuthProvider>. Wrap your tree with <AuthProvider>.');
  }
  return ctx;
}