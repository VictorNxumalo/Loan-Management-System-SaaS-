import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { getEnv } from '../../config/env';

type LogLevel = 'log' | 'warn' | 'error';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    const path = req.originalUrl ?? req.url ?? '';

    if (path.includes('/health')) {
      return next.handle();
    }

    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<Response>();
          this.writeLog(req, res.statusCode, start);
        },
        error: (error: unknown) => {
          const statusCode =
            typeof error === 'object' &&
            error !== null &&
            'status' in error &&
            typeof (error as { status: unknown }).status === 'number'
              ? (error as { status: number }).status
              : 500;
          this.writeLog(req, statusCode, start, 'error', error);
        },
      }),
    );
  }

  private writeLog(
    req: Request,
    statusCode: number,
    start: number,
    level: LogLevel = statusCode >= 500 ? 'error' : 'log',
    error?: unknown,
  ) {
    const durationMs = Date.now() - start;
    const payload = {
      method: req.method,
      path: req.originalUrl ?? req.url,
      statusCode,
      durationMs,
      requestId: req.headers['x-request-id'],
    };

    if (getEnv().NODE_ENV === 'production') {
      const line = JSON.stringify({
        ...payload,
        level,
        service: 'lms-api',
        timestamp: new Date().toISOString(),
        ...(error instanceof Error
          ? { error: error.message, errorName: error.name }
          : {}),
      });
      if (level === 'error') {
        this.logger.error(line);
      } else if (statusCode >= 400) {
        this.logger.warn(line);
      } else {
        this.logger.log(line);
      }
      return;
    }

    const message = `${req.method} ${payload.path} ${statusCode} ${durationMs}ms`;
    if (level === 'error') {
      this.logger.error(message, error instanceof Error ? error.stack : undefined);
    } else if (statusCode >= 400) {
      this.logger.warn(message);
    } else {
      this.logger.log(message);
    }
  }
}
