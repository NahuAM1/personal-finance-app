'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Check, X, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { AuthGuard } from '@/components/auth-guard';
import * as smartpocketApi from '@/lib/smartpocket-api';
import { useToast } from '@/hooks/use-toast';
import type { SplitGroup, SplitGroupMember } from '@/types/database';

function InviteContent() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [member, setMember] = useState<SplitGroupMember & { split_groups: SplitGroup } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInvite = async () => {
      try {
        setLoading(true);
        const data = await smartpocketApi.getMemberByInviteToken(token);
        setMember(data as SplitGroupMember & { split_groups: SplitGroup });
      } catch {
        setError('Invitación no encontrada o ya fue utilizada');
      } finally {
        setLoading(false);
      }
    };
    loadInvite();
  }, [token]);

  const handleAccept = async () => {
    if (!member || !user) return;

    setAccepting(true);
    try {
      await smartpocketApi.updateGroupMember(member.id, {
        user_id: user.id,
        invite_status: 'accepted',
      });

      toast({
        title: 'Invitación aceptada',
        description: `Te uniste al grupo "${member.split_groups.name}"`,
      });

      router.push('/smartpocket');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo aceptar la invitación',
        variant: 'destructive',
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!member) return;

    setDeclining(true);
    try {
      await smartpocketApi.updateGroupMember(member.id, {
        invite_status: 'declined',
      });

      toast({
        title: 'Invitación rechazada',
        description: 'Has rechazado la invitación al grupo',
      });

      router.push('/');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo rechazar la invitación',
        variant: 'destructive',
      });
    } finally {
      setDeclining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full border-purple-200">
          <CardContent className="py-12 text-center">
            <X className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Invitación no válida</h3>
            <p className="text-gray-500 mb-6">
              {error || 'Esta invitación no existe o ya fue utilizada.'}
            </p>
            <Button onClick={() => router.push('/')} variant="outline">
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (member.invite_status !== 'pending') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full border-purple-200">
          <CardContent className="py-12 text-center">
            <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Invitación ya procesada</h3>
            <p className="text-gray-500 mb-6">
              Esta invitación ya fue {member.invite_status === 'accepted' ? 'aceptada' : 'rechazada'}.
            </p>
            <Button onClick={() => router.push('/smartpocket')} variant="outline">
              Ir a SmartPocket
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const group = member.split_groups;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full border-purple-200 dark:border-purple-800">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center mx-auto mb-3">
            <Users className="h-8 w-8 text-purple-600 dark:text-purple-400" />
          </div>
          <CardTitle>Invitación a grupo</CardTitle>
          <CardDescription>
            Te han invitado a unirte al grupo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {group.name}
              </h3>
            </div>
            {group.description && (
              <p className="text-sm text-gray-500">{group.description}</p>
            )}
            <Badge variant="outline">{group.currency}</Badge>
          </div>

          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-sm text-center">
            <p className="text-purple-700 dark:text-purple-300">
              Te invitaron como: <strong>{member.display_name}</strong>
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDecline}
              disabled={declining || accepting}
            >
              {declining ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Rechazar
                </>
              )}
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white"
              onClick={handleAccept}
              disabled={accepting || declining}
            >
              {accepting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Aceptar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function InvitePage() {
  return (
    <AuthGuard>
      <InviteContent />
    </AuthGuard>
  );
}
