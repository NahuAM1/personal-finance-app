'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { USER_ROLES } from '@/types/database';
import type { UserRole } from '@/types/database';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: UserRole;
  hasRole: (roles: UserRole[]) => boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => ReturnType<typeof supabase.auth.signInWithPassword>;
  signUp: (email: string, password: string) => ReturnType<typeof supabase.auth.signUp>;
  signOut: () => ReturnType<typeof supabase.auth.signOut>;
  signInWithGoogle: () => ReturnType<typeof supabase.auth.signInWithOAuth>;
  resetPassword: (email: string) => ReturnType<typeof supabase.auth.resetPasswordForEmail>;
  updatePassword: (newPassword: string) => ReturnType<typeof supabase.auth.updateUser>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getRoleFromUser(userData: User | null): UserRole {
  if (!userData) return USER_ROLES.FREE;
  const userRole = userData.app_metadata?.role;
  const validRoles = Object.values(USER_ROLES) as string[];
  if (typeof userRole === 'string' && validRoles.includes(userRole)) {
    return userRole as UserRole;
  }
  return USER_ROLES.FREE;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(USER_ROLES.FREE);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    let mounted = true;

    const getInitialSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (mounted) {
          const sessionUser = session?.user ?? null;
          setUser(sessionUser);
          setRole(getRoleFromUser(sessionUser));
          setLoading(false);
        }
      } catch {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        const sessionUser = session?.user ?? null;
        setUser(sessionUser);
        setRole(getRoleFromUser(sessionUser));
        setLoading(false);
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          routerRef.current.refresh();
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isAdmin = useMemo(() => role === USER_ROLES.ADMIN, [role]);

  const hasRole = useCallback(
    (roles: UserRole[]): boolean => {
      if (role === USER_ROLES.ADMIN) return true;
      return roles.includes(role);
    },
    [role]
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { data, error };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    return { data, error };
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { data, error };
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      role,
      hasRole,
      isAdmin,
      signIn,
      signUp,
      signOut,
      signInWithGoogle,
      resetPassword,
      updatePassword,
    }),
    [user, loading, role, hasRole, isAdmin, signIn, signUp, signOut, signInWithGoogle, resetPassword, updatePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
