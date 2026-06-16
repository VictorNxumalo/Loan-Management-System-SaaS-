'use client';

import type { NotificationDto, PaginatedNotificationsDto } from '@lms/types';
import { Bell, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { InlineLoading } from '@/components/brand/loading';
import { Button } from '@/components/ui/button';
import { useNotificationStream } from '@/lib/use-notification-stream';
import { useApi } from '@/lib/use-api';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';

function notificationHref(
  notification: NotificationDto,
  accountType?: string,
  isPlatformAdmin?: boolean,
) {
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
    return accountType === 'BORROWER'
      ? '/borrower/loans'
      : `/dashboard/payment-submissions/${notification.relatedEntityId}`;
  }
  if (notification.relatedEntityType === 'PLATFORM_SUPPORT_TICKET') {
    if (isPlatformAdmin) {
      return `/platform/support/${notification.relatedEntityId}`;
    }
    return accountType === 'BORROWER'
      ? `/borrower/support/${notification.relatedEntityId}`
      : `/dashboard/support/${notification.relatedEntityId}`;
  }
  return accountType === 'BORROWER' ? '/borrower' : '/dashboard';
}

const POLL_INTERVAL_MS = 30_000;

export function NotificationBell() {
  const api = useApi();
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

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

  const handleRealtimeEvent = useCallback((event: { notification: NotificationDto; unreadCount: number }) => {
    setUnreadCount(event.unreadCount);
    if (openRef.current) {
      setNotifications((items) => {
        const withoutDuplicate = items.filter((item) => item.id !== event.notification.id);
        return [event.notification, ...withoutDuplicate].slice(0, 10);
      });
    }
  }, []);

  useNotificationStream(
    session?.accessToken,
    status === 'authenticated',
    handleRealtimeEvent,
  );

  useEffect(() => {
    void fetchUnreadCount();
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    const poll = () => {
      if (document.visibilityState === 'visible') {
        void fetchUnreadCount();
      }
    };

    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    window.addEventListener('focus', poll);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', poll);
    };
  }, [fetchUnreadCount, status]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void fetchNotifications();
  }, [open, fetchNotifications]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = '';
      return;
    }

    const isMobile = window.matchMedia('(max-width: 639px)').matches;
    if (isMobile) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = '';
    };
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
        aria-expanded={open}
        aria-haspopup="dialog"
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
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/30 sm:hidden"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />

          <div
            role="dialog"
            aria-label="Notifications"
            className={cn(
              'z-50 flex flex-col overflow-hidden rounded-xl border border-border/80 bg-background shadow-xl',
              'max-sm:fixed max-sm:inset-x-3 max-sm:top-[4.25rem] max-sm:max-h-[min(75vh,28rem)]',
              'sm:absolute sm:right-0 sm:mt-2 sm:w-[min(20rem,calc(100vw-2rem))] sm:max-h-96 sm:bg-background/95 sm:backdrop-blur-md sm:motion-safe:animate-scale-in',
            )}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2.5 sm:px-4">
              <p className="text-sm font-semibold text-brand-navy">Notifications</p>
              <div className="flex items-center gap-2">
                {hasUnread && (
                  <button
                    type="button"
                    className="text-xs font-medium text-brand-green hover:underline"
                    onClick={() => void markAllRead()}
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden"
                  aria-label="Close notifications"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {loading && <InlineLoading label="Loading notifications…" />}
              {!loading && notifications.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No notifications yet
                </p>
              )}
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notificationHref(
                    notification,
                    session?.user?.accountType,
                    session?.user?.isPlatformAdmin,
                  )}
                  className={cn(
                    'block border-b px-3 py-3 text-sm transition-colors hover:bg-accent/60 sm:px-4',
                    !notification.readAt && 'border-l-2 border-l-brand-green bg-brand-green/5',
                    notification.readAt && 'opacity-80',
                  )}
                  onClick={() => {
                    if (!notification.readAt) {
                      void markRead(notification.id);
                    }
                    setOpen(false);
                  }}
                >
                  <p className="font-medium leading-snug text-brand-navy">{notification.title}</p>
                  <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">
                    {notification.body}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
