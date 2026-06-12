'use client';

import type { NotificationDto, PaginatedNotificationsDto } from '@lms/types';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { InlineLoading } from '@/components/brand/loading';
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/use-api';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';

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

  const hasUnread = unreadCount > 0;

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="outline"
        size="sm"
        className={cn(
          'relative px-2.5 transition-colors',
          hasUnread && 'border-brand-green/40 bg-brand-green/5',
        )}
        aria-label={hasUnread ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell
          className={cn('h-4 w-4', hasUnread && 'text-brand-green motion-safe:animate-pulse-dot')}
        />
        {hasUnread && (
          <>
            <span
              className="absolute -right-0.5 -top-0.5 h-3 w-3 motion-safe:animate-pulse-ring rounded-full bg-brand-green/40"
              aria-hidden="true"
            />
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-green px-1 text-[10px] font-bold text-white shadow-sm motion-safe:animate-pulse-dot">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border/80 bg-background/95 shadow-xl backdrop-blur-md motion-safe:animate-scale-in">
          <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2.5">
            <p className="text-sm font-semibold text-brand-navy">Notifications</p>
            {hasUnread && (
              <button
                type="button"
                className="text-xs font-medium text-brand-green hover:underline"
                onClick={() => void markAllRead()}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && <InlineLoading label="Loading notifications…" />}
            {!loading && notifications.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No notifications yet
              </p>
            )}
            {notifications.map((notification) => (
              <Link
                key={notification.id}
                href={notificationHref(notification, session?.user?.accountType)}
                className={cn(
                  'block border-b px-3 py-3 text-sm transition-colors hover:bg-accent/60',
                  !notification.readAt && 'border-l-2 border-l-brand-green bg-brand-green/5',
                  notification.readAt && 'opacity-75',
                )}
                onClick={() => {
                  if (!notification.readAt) {
                    void markRead(notification.id);
                  }
                  setOpen(false);
                }}
              >
                <p className="font-medium text-brand-navy">{notification.title}</p>
                <p className="mt-1 line-clamp-2 text-muted-foreground">{notification.body}</p>
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
