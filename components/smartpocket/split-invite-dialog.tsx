'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Send, Copy, Check, Link } from 'lucide-react';
import type { SplitGroup } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

interface SplitInviteDialogProps {
  group: SplitGroup;
  onClose: () => void;
  onInviteSent: (inviteLink?: string) => void;
}

export function SplitInviteDialog({ group, onClose, onInviteSent }: SplitInviteDialogProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [sending, setSending] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSendInvite = async () => {
    if (!email.trim() || !displayName.trim()) {
      toast({
        title: 'Error',
        description: 'Completa el email y nombre del invitado',
        variant: 'destructive',
      });
      return;
    }

    if (!isValidEmail(email.trim())) {
      toast({
        title: 'Error',
        description: 'Ingresa un email válido',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/smartpocket/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: group.id,
          email: email.trim(),
          displayName: displayName.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al enviar invitación');
      }

      const result = await response.json();

      if (result.inviteLink) {
        setInviteLink(result.inviteLink);
      }

      toast({
        title: 'Invitación enviada',
        description: `Se invitó a ${displayName} al grupo`,
      });

      setEmail('');
      setDisplayName('');
      onInviteSent(result.inviteLink);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo enviar la invitación',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const copyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Copiado',
      description: 'Link de invitación copiado al portapapeles',
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar miembro</DialogTitle>
          <DialogDescription>
            Invita a alguien al grupo &ldquo;{group.name}&rdquo;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="invite-name">Nombre</Label>
            <Input
              id="invite-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nombre del invitado\u2026"
              className="hover:border-purple-300 focus-visible:border-purple-500 focus-visible:ring-purple-500/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@ejemplo.com"
              spellCheck={false}
              autoComplete="email"
              inputMode="email"
              className="hover:border-purple-300 focus-visible:border-purple-500 focus-visible:ring-purple-500/20"
            />
          </div>

          <Button
            onClick={handleSendInvite}
            disabled={sending || !email.trim() || !displayName.trim() || !isValidEmail(email.trim())}
            className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" aria-hidden="true" />
                Enviar invitación
              </>
            )}
          </Button>

          {inviteLink && (
            <div className="space-y-2 mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
              <div className="flex items-center gap-2">
                <Link className="h-4 w-4 text-purple-600" aria-hidden="true" />
                <Label className="text-sm font-medium text-purple-700 dark:text-purple-300">
                  Link de invitación
                </Label>
              </div>
              <div className="flex gap-2">
                <Input
                  value={inviteLink}
                  readOnly
                  className="text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyLink}
                  aria-label="Copiar link de invitación"
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Comparte este link con el invitado para que se una al grupo
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
