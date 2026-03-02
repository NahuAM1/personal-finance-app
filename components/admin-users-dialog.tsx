'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Crown, Star, Users, Shield, Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { USER_ROLES, type UserRole } from '@/types/database';

interface AdminUser {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface AdminUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getRoleBadge(role: UserRole) {
  switch (role) {
    case USER_ROLES.ADMIN:
      return (
        <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-full">
          <Crown className="w-3 h-3" />
          Admin
        </span>
      );
    case USER_ROLES.PREMIUM:
      return (
        <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 px-2 py-0.5 rounded-full">
          <Star className="w-3 h-3" />
          Premium
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 px-2 py-0.5 rounded-full">
          Free
        </span>
      );
  }
}

function getInitials(email: string, fullName: string | null): string {
  if (fullName) {
    return fullName
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return email
    .split('@')[0]
    .split('.')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function AdminUsersDialog({ open, onOpenChange }: AdminUsersDialogProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, UserRole>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al cargar usuarios');
      }
      const data = await response.json();
      setUsers(data.users);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al cargar usuarios',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) {
      fetchUsers();
      setPendingChanges({});
    }
  }, [open, fetchUsers]);

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    const currentRole = users.find((u) => u.id === userId)?.role;
    if (currentRole === newRole) {
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } else {
      setPendingChanges((prev) => ({ ...prev, [userId]: newRole }));
    }
  };

  const handleSave = async (userId: string) => {
    const newRole = pendingChanges[userId];
    if (!newRole) return;

    setSavingUserId(userId);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al actualizar rol');
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });

      toast({
        title: 'Rol actualizado',
        description: `El rol fue cambiado a ${newRole} exitosamente`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al actualizar rol',
        variant: 'destructive',
      });
    } finally {
      setSavingUserId(null);
    }
  };

  const isCurrentUser = (userId: string) => currentUser?.id === userId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Gestionar Usuarios
          </DialogTitle>
          <DialogDescription>
            Administra los roles de los usuarios de la plataforma.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            {users.map((u) => (
              <div
                key={u.id}
                className="p-3 rounded-lg border bg-card space-y-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={u.avatar_url ?? ''} alt={u.email} />
                    <AvatarFallback className="bg-blue-600 text-white text-sm">
                      {getInitials(u.email, u.full_name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {u.full_name ?? u.email.split('@')[0]}
                      </p>
                      {isCurrentUser(u.id) && (
                        <span className="text-xs text-muted-foreground shrink-0">(tú)</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    <div className="mt-1">{getRoleBadge(u.role)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={pendingChanges[u.id] ?? u.role}
                    onValueChange={(value) => handleRoleChange(u.id, value as UserRole)}
                    disabled={isCurrentUser(u.id)}
                  >
                    <SelectTrigger className="flex-1 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={USER_ROLES.ADMIN}>
                        <span className="flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5 text-amber-600" />
                          Admin
                        </span>
                      </SelectItem>
                      <SelectItem value={USER_ROLES.PREMIUM}>
                        <span className="flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5 text-purple-600" />
                          Premium
                        </span>
                      </SelectItem>
                      <SelectItem value={USER_ROLES.FREE}>
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-gray-600" />
                          Free
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSave(u.id)}
                    disabled={!pendingChanges[u.id] || savingUserId === u.id || isCurrentUser(u.id)}
                    className="h-9"
                  >
                    {savingUserId === u.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}

            {users.length === 0 && !loading && (
              <p className="text-center text-muted-foreground py-8">
                No se encontraron usuarios.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
