'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import type { Notification } from '@/types/database';
import * as notificationsApi from '@/lib/notifications-api';

const POLL_INTERVAL_MS = 60_000;

export function useNotifications(): {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  refetch: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
} {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef(false);

  const refetch = useCallback(async (): Promise<void> => {
    if (!user || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      setLoading(true);
      const data = await notificationsApi.getNotifications(user.id);
      setNotifications(data);
    } catch (error) {
      // Notifications are non-critical: never block the UI on a failure.
      console.error('Error fetching notifications:', error);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refetch();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      refetch();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, refetch]);

  const markRead = useCallback(async (id: string): Promise<void> => {
    const readAt = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: readAt } : n))
    );
    try {
      await notificationsApi.markNotificationRead(id);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      refetch();
    }
  }, [refetch]);

  const markAllRead = useCallback(async (): Promise<void> => {
    if (!user) return;
    const readAt = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: readAt })));
    try {
      await notificationsApi.markAllNotificationsRead(user.id);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      refetch();
    }
  }, [user, refetch]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read_at).length,
    [notifications]
  );

  return { notifications, unreadCount, loading, refetch, markRead, markAllRead };
}
