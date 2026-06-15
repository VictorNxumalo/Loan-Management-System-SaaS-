import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { NotificationStreamEvent } from '@lms/types';
import type { Request, Response } from 'express';
import IORedis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { getEnv } from '../config/env';

const REDIS_CHANNEL = 'lms:notifications';

@Injectable()
export class NotificationRealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationRealtimeService.name);
  private readonly clients = new Map<string, Map<string, Response>>();
  private pub: IORedis | null = null;
  private sub: IORedis | null = null;

  async onModuleInit() {
    const redisUrl = getEnv().REDIS_URL;
    if (!redisUrl) {
      return;
    }

    try {
      this.pub = new IORedis(redisUrl, { maxRetriesPerRequest: null, lazyConnect: true });
      this.sub = new IORedis(redisUrl, { maxRetriesPerRequest: null, lazyConnect: true });
      await Promise.all([this.pub.connect(), this.sub.connect()]);

      await this.sub.subscribe(REDIS_CHANNEL);
      this.sub.on('message', (_channel, message) => {
        try {
          const parsed = JSON.parse(message) as {
            userId: string;
            event: NotificationStreamEvent;
          };
          if (parsed.userId && parsed.event) {
            this.deliverLocal(parsed.userId, parsed.event);
          }
        } catch {
          // ignore malformed pub/sub payloads
        }
      });

      this.logger.log('Notification realtime pub/sub connected');
    } catch (error) {
      this.logger.warn(
        `Notification pub/sub disabled (${error instanceof Error ? error.message : error})`,
      );
      await this.disconnectRedis();
    }
  }

  async onModuleDestroy() {
    for (const userClients of this.clients.values()) {
      for (const res of userClients.values()) {
        if (!res.writableEnded) {
          res.end();
        }
      }
    }
    this.clients.clear();
    await this.disconnectRedis();
  }

  connect(userId: string, req: Request, res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const clientId = randomUUID();
    const userClients = this.clients.get(userId) ?? new Map<string, Response>();
    userClients.set(clientId, res);
    this.clients.set(userId, userClients);

    res.write(': connected\n\n');

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': heartbeat\n\n');
      }
    }, 25_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      userClients.delete(clientId);
      if (userClients.size === 0) {
        this.clients.delete(userId);
      }
    };

    req.on('close', cleanup);
    req.on('error', cleanup);
  }

  publish(userId: string, event: NotificationStreamEvent): void {
    if (this.pub) {
      void this.pub
        .publish(REDIS_CHANNEL, JSON.stringify({ userId, event }))
        .catch((error) => {
          this.logger.warn(
            `Notification pub/sub publish failed: ${error instanceof Error ? error.message : error}`,
          );
        });
      return;
    }

    this.deliverLocal(userId, event);
  }

  private deliverLocal(userId: string, event: NotificationStreamEvent): void {
    const userClients = this.clients.get(userId);
    if (!userClients?.size) {
      return;
    }

    const payload = `event: notification\ndata: ${JSON.stringify(event)}\n\n`;
    for (const [clientId, res] of userClients) {
      if (res.writableEnded) {
        userClients.delete(clientId);
        continue;
      }
      res.write(payload);
    }
  }

  private async disconnectRedis() {
    if (this.sub) {
      await this.sub.quit().catch(() => undefined);
      this.sub = null;
    }
    if (this.pub) {
      await this.pub.quit().catch(() => undefined);
      this.pub = null;
    }
  }
}
