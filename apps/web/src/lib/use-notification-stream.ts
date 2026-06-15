'use client';

import type { NotificationStreamEvent } from '@lms/types';
import { useEffect, useRef } from 'react';
import { getApiBaseUrl } from './api-url';

function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.split('\n');
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return { event, data: dataLines.join('\n') };
}

export function useNotificationStream(
  accessToken: string | undefined,
  enabled: boolean,
  onEvent: (event: NotificationStreamEvent) => void,
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled || !accessToken) {
      return;
    }

    let cancelled = false;
    let reconnectDelayMs = 1_000;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleReconnect = () => {
      if (cancelled) return;
      reconnectTimer = setTimeout(() => {
        void connect();
      }, reconnectDelayMs);
      reconnectDelayMs = Math.min(reconnectDelayMs * 2, 30_000);
    };

    const connect = async () => {
      if (cancelled) return;

      try {
        const response = await fetch(`${getApiBaseUrl()}/notifications/stream`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'text/event-stream',
          },
          cache: 'no-store',
        });

        if (!response.ok || !response.body) {
          throw new Error(`Notification stream failed (${response.status})`);
        }

        reconnectDelayMs = 1_000;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            if (!part.trim() || part.startsWith(':')) {
              continue;
            }
            const parsed = parseSseBlock(part);
            if (parsed?.event === 'notification') {
              onEventRef.current(JSON.parse(parsed.data) as NotificationStreamEvent);
            }
          }
        }

        if (!cancelled) {
          scheduleReconnect();
        }
      } catch {
        scheduleReconnect();
      }
    };

    void connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [accessToken, enabled]);
}
