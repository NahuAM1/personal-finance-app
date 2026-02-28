"use client";

import { useAuth } from "@/contexts/auth-context";
import type { UserRole } from "@/types/database";
import type { ReactNode } from "react";

interface AccessControlProps {
  allowedRoles: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function AccessControl({
  allowedRoles,
  children,
  fallback = null,
}: AccessControlProps) {
  const { hasRole, loading } = useAuth();

  if (loading) {
    return <>{fallback}</>;
  }

  if (!hasRole(allowedRoles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
