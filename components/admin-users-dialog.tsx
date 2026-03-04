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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Crown, Star, Users, Shield, Loader2, Save, Pencil, Trash2 } from 'lucide-react';
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

  // Edit state
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);

  // Delete state
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  // Edit handlers
  const openEditDialog = (u: AdminUser) => {
    setEditingUser(u);
    setEditName(u.full_name ?? '');
    setEditEmail(u.email);
    setEditPassword('');
    setShowEditConfirm(false);
  };

  const closeEditDialog = () => {
    setEditingUser(null);
    setEditName('');
    setEditEmail('');
    setEditPassword('');
    setShowEditConfirm(false);
  };

  const handleEditConfirm = async () => {
    if (!editingUser) return;

    setEditSaving(true);
    try {
      const body: { userId: string; email?: string; full_name?: string; password?: string } = {
        userId: editingUser.id,
      };

      if (editEmail !== editingUser.email) body.email = editEmail;
      if (editName !== (editingUser.full_name ?? '')) body.full_name = editName;
      if (editPassword) body.password = editPassword;

      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al editar usuario');
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                email: editEmail || u.email,
                full_name: editName || u.full_name,
              }
            : u
        )
      );

      toast({
        title: 'Usuario actualizado',
        description: `Los datos de ${editEmail} fueron actualizados exitosamente`,
      });

      closeEditDialog();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al editar usuario',
        variant: 'destructive',
      });
    } finally {
      setEditSaving(false);
      setShowEditConfirm(false);
    }
  };

  // Delete handlers
  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/admin/users?userId=${deletingUser.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al eliminar usuario');
      }

      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));

      toast({
        title: 'Usuario eliminado',
        description: `${deletingUser.email} fue eliminado permanentemente`,
      });

      setDeletingUser(null);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al eliminar usuario',
        variant: 'destructive',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const isCurrentUser = (userId: string) => currentUser?.id === userId;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col overflow-hidden p-4 sm:p-6">
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
            <div className="space-y-2 sm:space-y-3 mt-3 sm:mt-4 overflow-y-auto min-h-0 -mr-2 pr-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="p-2.5 sm:p-3 rounded-lg border bg-card space-y-2 sm:space-y-3"
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
                      <AvatarImage src={u.avatar_url ?? ''} alt={u.email} />
                      <AvatarFallback className="bg-blue-600 text-white text-xs sm:text-sm">
                        {getInitials(u.email, u.full_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs sm:text-sm font-medium truncate">
                          {u.full_name ?? u.email.split('@')[0]}
                        </p>
                        {isCurrentUser(u.id) && (
                          <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">(tú)</span>
                        )}
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{u.email}</p>
                      <div className="mt-0.5 sm:mt-1">{getRoleBadge(u.role)}</div>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 sm:h-8 sm:w-8"
                        onClick={() => openEditDialog(u)}
                        disabled={isCurrentUser(u.id)}
                        title="Editar usuario"
                      >
                        <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 sm:h-8 sm:w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                        onClick={() => setDeletingUser(u)}
                        disabled={isCurrentUser(u.id)}
                        title="Eliminar usuario"
                      >
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Select
                      value={pendingChanges[u.id] ?? u.role}
                      onValueChange={(value) => handleRoleChange(u.id, value as UserRole)}
                      disabled={isCurrentUser(u.id)}
                    >
                      <SelectTrigger className="flex-1 h-8 sm:h-9 text-xs sm:text-sm">
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
                      className="h-8 sm:h-9"
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

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) closeEditDialog(); }}>
        <DialogContent className="sm:max-w-[425px] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Pencil className="h-4 w-4 sm:h-5 sm:w-5" />
              Editar Usuario
            </DialogTitle>
            <DialogDescription className="truncate">
              Modificá los datos de {editingUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4 mt-1 sm:mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nombre</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nombre completo"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-password">Nueva contraseña (opcional)</Label>
              <Input
                id="edit-password"
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Dejar vacío para no cambiar"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeEditDialog} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button
                onClick={() => setShowEditConfirm(true)}
                disabled={editSaving}
                className="w-full sm:w-auto"
              >
                {editSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Guardar cambios
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Confirmation AlertDialog */}
      <AlertDialog open={showEditConfirm} onOpenChange={setShowEditConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar edición</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que querés modificar los datos de {editingUser?.email}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={editSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleEditConfirm} disabled={editSaving}>
              {editSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation AlertDialog */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => { if (!open) setDeletingUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar usuario</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro? Esta acción no se puede deshacer. El usuario{' '}
              <span className="font-semibold text-foreground">{deletingUser?.email}</span>{' '}
              será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700 text-white text-sm"
            >
              {deleteLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              <span className="sm:hidden">Eliminar</span>
              <span className="hidden sm:inline">Eliminar permanentemente</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
