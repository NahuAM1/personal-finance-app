'use client';

import type { ReactNode } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotifications } from '@/hooks/use-notifications';
import type { Notification } from '@/types/database';
import { cn } from '@/lib/utils';
import { TripInviteActions } from '@/components/trips/trip-invite-actions';

export interface NotificationActionHelpers {
  markRead: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

type NotificationActionRenderer = (
  notification: Notification,
  helpers: NotificationActionHelpers
) => ReactNode;

// Per-type action renderers. Types without an entry render no actions.
const ACTION_RENDERERS: Record<string, NotificationActionRenderer> = {
  trip_invite: (notification, helpers) => (
    <TripInviteActions notification={notification} onAnswered={helpers.refetch} />
  ),
};

function formatRelative(date: string): string {
  try {
    return formatDistanceToNow(parseISO(date), { addSuffix: true, locale: es });
  } catch {
    return '';
  }
}

export function NotificationBell(): React.JSX.Element {
  const { notifications, unreadCount, refetch, markRead, markAllRead } = useNotifications();
  const helpers: NotificationActionHelpers = { markRead, refetch };

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) refetch(); }}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='relative h-10 w-10 rounded-full shrink-0'
          aria-label={unreadCount > 0 ? `Notificaciones (${unreadCount} sin leer)` : 'Notificaciones'}
        >
          <Bell className='h-5 w-5 text-[#466E45]' />
          {unreadCount > 0 && (
            <span className='absolute -top-0.5 -right-0.5 min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums'>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align='end'
        className='w-96 max-w-[calc(100vw-2rem)] p-0'
      >
        <div className='flex items-center justify-between gap-2 px-3 py-2'>
          <DropdownMenuLabel className='p-0 text-sm font-semibold'>Notificaciones</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant='ghost'
              size='sm'
              className='h-7 px-2 text-xs text-emerald-700 dark:text-emerald-300'
              onClick={() => markAllRead()}
            >
              <CheckCheck className='h-3.5 w-3.5 mr-1' />
              Marcar todas como leídas
            </Button>
          )}
        </div>
        <DropdownMenuSeparator className='m-0' />
        {notifications.length === 0 ? (
          <p className='px-3 py-8 text-center text-sm text-muted-foreground'>
            No tenés notificaciones
          </p>
        ) : (
          <ul className='max-h-[60vh] overflow-y-auto divide-y divide-emerald-50 dark:divide-emerald-950'>
            {notifications.map((notification) => {
              const renderActions = ACTION_RENDERERS[notification.type];
              const unread = !notification.read_at;
              return (
                <li
                  key={notification.id}
                  className={cn(
                    'px-3 py-3 text-sm',
                    unread && 'bg-emerald-50/60 dark:bg-emerald-950/30'
                  )}
                  onClick={() => { if (unread && !renderActions) markRead(notification.id); }}
                >
                  <div className='flex items-start gap-2 min-w-0'>
                    {unread && (
                      <span className='mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500' aria-hidden='true' />
                    )}
                    <div className='min-w-0 flex-1'>
                      <p className='font-medium break-words'>{notification.title}</p>
                      {notification.body && (
                        <p className='text-muted-foreground break-words'>{notification.body}</p>
                      )}
                      <p className='text-xs text-muted-foreground mt-1'>
                        {formatRelative(notification.created_at)}
                      </p>
                      {renderActions && (
                        <div className='mt-2'>{renderActions(notification, helpers)}</div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
