import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { NotificationJobData } from '@lms/types';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import { getEnv } from '../config/env';
import { NOTIFICATION_JOB_NAME, QUEUE_NAMES } from './queue.constants';

export type NotificationJobHandler = (data: NotificationJobData) => Promise<void>;

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private connection: IORedis | null = null;
  private notificationsQueue: Queue | null = null;
  private worker: Worker | null = null;
  private jobHandler: NotificationJobHandler | null = null;

  available = false;

  async onModuleInit() {
    const redisUrl = getEnv().REDIS_URL;
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not set — BullMQ job queue disabled');
      return;
    }

    try {
      this.connection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });
      await this.connection.connect();
      await this.connection.ping();

      this.notificationsQueue = new Queue(QUEUE_NAMES.NOTIFICATIONS, {
        connection: this.connection as ConnectionOptions,
      });

      this.available = true;
      this.logger.log('BullMQ connected — notification queue ready');
      if (this.jobHandler) {
        this.startWorker();
      }
    } catch (error) {
      this.logger.warn(
        `Redis unavailable — BullMQ disabled (${error instanceof Error ? error.message : error})`,
      );
      await this.disconnect();
    }
  }

  registerNotificationHandler(handler: NotificationJobHandler) {
    this.jobHandler = handler;
    if (this.available && this.connection && !this.worker) {
      this.startWorker();
    }
  }

  private startWorker() {
    if (!this.connection || !this.jobHandler) {
      return;
    }

    this.worker = new Worker(
      QUEUE_NAMES.NOTIFICATIONS,
      async (job) => {
        await this.jobHandler!(job.data as NotificationJobData);
      },
      { connection: this.connection as ConnectionOptions },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Notification job ${job?.id} failed: ${error.message}`);
    });

    this.logger.log('BullMQ notification worker started');
  }

  async enqueueNotification(data: NotificationJobData): Promise<boolean> {
    if (!this.available || !this.notificationsQueue) {
      this.logger.warn(
        `[queue skip] ${data.eventType} (${data.dedupKey}) — Redis unavailable`,
      );
      return false;
    }

    try {
      await this.notificationsQueue.add(NOTIFICATION_JOB_NAME, data, {
        jobId: data.dedupKey,
        removeOnComplete: 200,
        removeOnFail: 100,
      });
      return true;
    } catch (error) {
      this.logger.warn(
        `[queue skip] ${data.eventType} (${data.dedupKey}) — ${error instanceof Error ? error.message : error}`,
      );
      return false;
    }
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async disconnect() {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    if (this.notificationsQueue) {
      await this.notificationsQueue.close();
      this.notificationsQueue = null;
    }
    if (this.connection) {
      await this.connection.quit();
      this.connection = null;
    }
    this.available = false;
  }
}
