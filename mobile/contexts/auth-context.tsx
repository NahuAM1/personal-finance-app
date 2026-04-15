import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, AuthResponse, AuthTokenResponsePassword, OAuthResponse } from '@supabase/supabase-js';
import { USER_ROLES } from '@/types/database';
import type { UserRole } from '@/types/database';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: UserRole;
  hasRole: (roles: UserRole[]) => boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<AuthTokenResponsePassword>;
  signUp: (email: string, password: string) => Promise<AuthResponse>;
  signOut: () => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<OAuthResponse>;
  resetPassword: (email: string) => Promise<{ data: object | null; error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ data: { user: User | null }; error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getRoleFromUser(userData: User | null): UserRole {
  if (!userData) return USER_ROLES.FREE;
  const userRole = userData.app_metadata?.role;
  const validRoles: string[] = Object.values(USER_ROLES);
  if (typeof userRole === 'string' && validRoles.includes(userRole)) {
    return userRole as UserRole;
  }
  return USER_ROLES.FREE;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(USER_ROLES.FREE);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    const getInitialSession = async (): Promise<void> => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          const sessionUser: User | null = session?.user ?? null;
          setUser(sessionUser);
          setRole(getRoleFromUser(sessionUser));
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        const sessionUser: User | null = session?.user ?? null;
        setUser(sessionUser);
        setRole(getRoleFromUser(sessionUser));
        setLoading(false);
      }
    });

    return (): void => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isAdmin = useMemo<boolean>(() => role === USER_ROLES.ADMIN, [role]);

  const hasRole = useCallback(
    (roles: UserRole[]): boolean => {
      if (role === USER_ROLES.ADMIN) return true;
      return roles.includes(role);
    },
    [role]
  );

  const signIn = useCallback((email: string, password: string): Promise<AuthTokenResponsePassword> => {
    return supabase.auth.signInWithPassword({ email, password });
  }, []);

  const signUp = useCallback((email: string, password: string): Promise<AuthResponse> => {
    return supabase.auth.signUp({ email, password });
  }, []);

  const signOut = useCallback(async (): Promise<{ error: Error | null }> => {
    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  const signInWithGoogle = useCallback((): Promise<OAuthResponse> => {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'personalfinance://auth/callback' },
    });
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<{ data: object | null; error: Error | null }> => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'personalfinance://auth/reset-password',
    });
    return { data, error };
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<{ data: { user: User | null }; error: Error | null }> => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    return { data, error };
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({ user, loading, role, hasRole, isAdmin, signIn, signUp, signOut, signInWithGoogle, resetPassword, updatePassword }),
    [user, loading, role, hasRole, isAdmin, signIn, signUp, signOut, signInWithGoogle, resetPassword, updatePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
