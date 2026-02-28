"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/types/database";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>('free');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Helper to extract role from user metadata
  const getRoleFromUser = (userData: User | null): UserRole => {
    if (!userData) return 'free';
    // Supabase stores role in app_metadata
    const userRole = (userData as any).app_metadata?.role;
    if (userRole === 'admin' || userRole === 'premium' || userRole === 'free') {
      return userRole;
    }
    return 'free';
  };

  // Helper methods
  const hasRole = (roles: UserRole[]): boolean => {
    return roles.includes(role);
  };

  const isAdmin = role === 'admin';
  const isPremium = role === 'premium';
  const isFree = role === 'free';

  useEffect(() => {
    let mounted = true;

    const getInitialSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (mounted) {
          // Get fresh user data to get updated role from database
          if (session?.user) {
            const { data: { user: freshUser } } = await supabase.auth.getUser();
            setUser(freshUser);
            setRole(getRoleFromUser(freshUser));
          } else {
            setUser(null);
            setRole('free');
          }
          setLoading(false);
        }
      } catch (error) {
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
        // Get fresh user data to get updated role from database
        if (session?.user) {
          const { data: { user: freshUser } } = await supabase.auth.getUser();
          setUser(freshUser);
          setRole(getRoleFromUser(freshUser));
        } else {
          setUser(null);
          setRole('free');
        }
        setLoading(false);
        if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
          router.refresh();
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { data, error };
  };

  const resetPassword = async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    return { data, error };
  };

  const updatePassword = async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { data, error };
  };

  return {
    user,
    loading,
    role,
    hasRole,
    isAdmin,
    isPremium,
    isFree,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    resetPassword,
    updatePassword,
  };
}
