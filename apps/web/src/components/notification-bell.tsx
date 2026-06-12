'use client';

import type { NotificationDto, PaginatedNotificationsDto } from '@lms/types';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/use-api';
import { useSession } from 'next-auth/react';

function notificationHref(notification: NotificationDto, accountType?: string) {
  if (notification.relatedEntityType === 'LOAN_APPLICATION') {
    return accountType === 'BORROWER'
      ? `/borrower/applications/${notification.relatedEntityId}`
      : `/dashboard/applications/${notification.relatedEntityId}`;
  }
  if (notification.relatedEntityType === 'LOAN') {
    return accountType === 'BORROWER'
      ? `/borrower/loans/${notification.relatedEntityId}`
      : `/dashboard/loans/${notification.relatedEntityId}`;
  }
  if (notification.relatedEntityType === 'PAYMENT_SUBMISSION') {
    return `/dashboard/payment-submissions/${notification.relatedEntityId}`;
  }
  return accountType === 'BORROWER' ? '/borrower' : '/dashboard';
}

export function NotificationBell() {
  const api = useApi();
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    if (status !== 'authenticated') {
      return;
    }
    try {
      const result = await api<{ unreadCount: number }>('/notifications/unread-count');
      setUnreadCount(result.unreadCount);
    } catch {
      setUnreadCount(0);
    }
  }, [api, status]);

  const fetchNotifications = useCallback(async () => {
    if (status !== 'authenticated') {
      return;
    }
    setLoading(true);
    try {
      const result = await api<PaginatedNotificationsDto>('/notifications?limit=10');
      setNotifications(result.items);
      setUnreadCount(result.unreadCount);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [api, status]);

  useEffect(() => {
    void fetchUnreadCount();
  }, [fetchUnreadCount]);

  useEffect(() => {
    const onFocus = () => {
      void fetchUnreadCount();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void fetchNotifications();
  }, [open, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const markRead = async (id: string) => {
    try {
      await api(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((items) =>
        items.map((item) =>
          item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    try {
      await api('/notifications/read-all', { method: 'PATCH' });
      setNotifications((items) =>
        items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })),
      );
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  if (status !== 'authenticated') {
    return null;
  }

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="outline"
        size="sm"
        className="relative px-2"
        aria-label="Notifications"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => void markAllRead()}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <p className="px-3 py-4 text-sm text-muted-foreground">Loading…</p>
            )}
            {!loading && notifications.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted-foreground">No notifications yet</p>
            )}
            {notifications.map((notification) => (
              <Link
                key={notification.id}
                href={notificationHref(notification, session?.user?.accountType)}
                className={`block border-b px-3 py-3 text-sm hover:bg-muted/50 ${
                  notification.readAt ? 'opacity-70' : ''
                }`}
                onClick={() => {
                  if (!notification.readAt) {
                    void markRead(notification.id);
                  }
                  setOpen(false);
                }}
              >
                <p className="font-medium">{notification.title}</p>
                <p className="mt-1 text-muted-foreground line-clamp-2">{notification.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(notification.createdAt).toLocaleString()}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
