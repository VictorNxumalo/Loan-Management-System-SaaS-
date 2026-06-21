import {
  Controller,
  Get,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';
import { isSentryConfigured } from './config/sentry';

@Controller()
@SkipThrottle()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('health/ready')
  async getReadiness() {
    const readiness = await this.appService.getReadiness();
    if (readiness.status === 'down') {
      throw new ServiceUnavailableException(readiness);
    }
    return readiness;
  }

  /** Sandbox-only — throws so Sentry can be verified. Hidden on production. */
  @Get('health/sentry-test')
  sentryTest() {
    const environment = process.env.SENTRY_ENVIRONMENT?.trim();
    const debugEnabled = process.env.SENTRY_DEBUG_ENABLED === 'true';
    if (
      !isSentryConfigured() ||
      (environment !== 'sandbox' && !debugEnabled)
    ) {
      throw new NotFoundException();
    }
    throw new Error(
      'LMS Sentry monitoring test — safe to ignore after verification',
    );
  }
}
