'use client';

import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useCurrency } from '@/hooks/use-currency';

/**
 * Shows the state of a base-currency reconversion: progress while it runs, and a retry action
 * when it failed or was interrupted. Renders nothing when there is no job.
 */
export function ReconversionProgress({ className }: { className?: string }) {
  const { reconversion, reconversionProgress, reconversionRunError, resumeReconversion } = useCurrency();
  if (reconversion.status === 'idle') return null;

  const failed = reconversion.status === 'failed' || reconversionRunError !== null;
  const driving = reconversionProgress !== null && !reconversionRunError;
  const pct =
    reconversionProgress && reconversionProgress.total > 0
      ? Math.round(((reconversionProgress.total - reconversionProgress.remaining) / reconversionProgress.total) * 100)
      : 0;
  const message = reconversionRunError ?? reconversion.error;

  return (
    <div
      className={`min-w-0 space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 ${className ?? ''}`}
      role='status'
      aria-live='polite'
    >
      <div className='flex min-w-0 items-start gap-2'>
        {failed ? (
          <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
        ) : (
          <Loader2 className='mt-0.5 h-4 w-4 shrink-0 animate-spin' aria-hidden='true' />
        )}
        <p className='min-w-0 break-words'>
          {failed
            ? `La reconversión a ${reconversion.pendingBase ?? ''} se interrumpió. Tu historial está parcialmente convertido: los totales no son definitivos hasta completarla.`
            : `Reconvirtiendo tu historial a ${reconversion.pendingBase ?? ''}… Los totales no son definitivos hasta que termine.`}
        </p>
      </div>
      {driving && <Progress value={pct} className='h-2' aria-label='Progreso de la reconversión' />}
      {failed && message && <p className='break-words text-xs opacity-80'>{message}</p>}
      {(failed || !driving) && (
        <Button size='sm' onClick={() => void resumeReconversion()} disabled={driving}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
