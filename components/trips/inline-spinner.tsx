import { Loader2 } from 'lucide-react';

export function InlineSpinner(): React.JSX.Element {
  return (
    <div className='flex items-center justify-center py-12' role='status' aria-label='Cargando'>
      <Loader2 className='h-8 w-8 animate-spin text-emerald-600' aria-hidden='true' />
    </div>
  );
}
