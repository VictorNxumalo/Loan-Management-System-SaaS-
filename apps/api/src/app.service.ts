import { Injectable } from '@nestjs/common';
import { getEmailDeliveryStatus } from './config/env';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'lms-api',
      timestamp: new Date().toISOString(),
      email: getEmailDeliveryStatus(),
    };
  }
}
