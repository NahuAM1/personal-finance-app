'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Plus, ChevronRight } from 'lucide-react';
import type { SplitGroup } from '@/types/database';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import * as smartpocketApi from '@/lib/smartpocket-api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SplitGroupsProps {
  groups: SplitGroup[];
  onSelectGroup: (group: SplitGroup) => void;
  onGroupCreated: () => void;
}

export function SplitGroups({ groups, onSelectGroup, onGroupCreated }: SplitGroupsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('ARS');

  const handleCreate = async () => {
    if (!user || !name.trim()) return;

    setCreating(true);
    try {
      const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario';
      await smartpocketApi.createSplitGroup(
        {
          created_by: user.id,
          name: name.trim(),
          description: description.trim() || null,
          currency,
        },
        displayName
      );

      toast({
        title: 'Grupo creado',
        description: `El grupo "${name}" fue creado correctamente`,
      });

      setName('');
      setDescription('');
      setCurrency('ARS');
      setDialogOpen(false);
      onGroupCreated();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo crear el grupo',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card className="border-purple-200 dark:border-purple-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" aria-hidden="true" />
              Dividir Gastos
            </CardTitle>
            <CardDescription>
              Crea grupos para dividir gastos con amigos, familia o compañeros
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white">
                <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                Nuevo Grupo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear nuevo grupo</DialogTitle>
                <DialogDescription>
                  Crea un grupo para dividir gastos compartidos
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="group-name">Nombre del grupo</Label>
                  <Input
                    id="group-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ej: Viaje a la costa\u2026"
                    className="hover:border-purple-300 focus-visible:border-purple-500 focus-visible:ring-purple-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="group-desc">Descripción (opcional)</Label>
                  <Textarea
                    id="group-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="ej: Gastos del viaje de vacaciones\u2026"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="group-currency">Moneda</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="group-currency" className="hover:border-purple-300 focus-visible:border-purple-500 focus-visible:ring-purple-500/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">ARS - Peso Argentino</SelectItem>
                      <SelectItem value="USD">USD - Dólar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={creating || !name.trim()}
                  className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white"
                >
                  {creating ? 'Creando...' : 'Crear grupo'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-purple-300 dark:text-purple-700 mx-auto mb-4" aria-hidden="true" />
            <p className="text-gray-500 dark:text-gray-400">
              No tienes grupos todavía. Crea uno para empezar a dividir gastos.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <button
                type="button"
                key={group.id}
                onClick={() => onSelectGroup(group)}
                className="w-full text-left flex items-center justify-between p-4 rounded-xl border border-purple-100 dark:border-purple-800 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 cursor-pointer transition-colors hover:shadow-md hover:shadow-purple-100/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {group.name}
                    </p>
                    <Badge
                      variant={group.is_active ? 'default' : 'secondary'}
                      className={group.is_active
                        ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border-0'
                        : ''
                      }
                    >
                      {group.is_active ? 'Activo' : 'Cerrado'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {group.currency}
                    </Badge>
                  </div>
                  {group.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                      {group.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Creado {format(new Date(group.created_at), "dd MMM yyyy", { locale: es })}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
