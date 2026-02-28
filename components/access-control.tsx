"use client";

import { useAuth } from "@/hooks/use-auth";
import type { UserRoleValue, USER_ROLES } from "@/types/database";
import type { ReactNode } from "react";

interface AccessControlProps {
  allowedRoles: UserRoleValue[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function AccessControl({
  allowedRoles,
  children,
  fallback = null,
}: AccessControlProps) {
  const { hasRole, isAdmin } = useAuth();

  // Admin always has access
  if (isAdmin) {
    return <>{children}</>;
  }

  if (!hasRole(allowedRoles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
