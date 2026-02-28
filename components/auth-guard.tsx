'use client';

import type React from 'react';
import { useAuth } from '@/contexts/auth-context';
import { LoginForm } from './login-form';
import { Loader } from '@/components/loader';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loader />;
  }

  if (!user) {
    return <LoginForm />;
  }

  return <>{children}</>;
}
