"use client";

import { useAuth } from "@/hooks/use-auth";
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
  const { hasRole } = useAuth();

  if (!hasRole(allowedRoles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
