import { describe, expect, it } from 'vitest';
import { AppService } from './app.service';

describe('AppService', () => {
  it('returns health status', () => {
    const service = new AppService();
    const health = service.getHealth();

    expect(health.status).toBe('ok');
    expect(health.service).toBe('lms-api');
    expect(health.timestamp).toBeDefined();
  });
});
