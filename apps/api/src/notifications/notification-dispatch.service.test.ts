import { describe, expect, it, vi } from 'vitest';
import { NotificationType } from '@lms/types';
import { NotificationDispatchService } from './notification-dispatch.service';

describe('NotificationDispatchService', () => {
  it('queues application submitted notifications for lender staff', async () => {
    const queueService = {
      enqueueNotification: vi.fn().mockResolvedValue(true),
      registerNotificationHandler: vi.fn(),
    };
    const notificationsService = {
      createInApp: vi.fn().mockResolvedValue({}),
      appUrl: (path: string) => `http://localhost:3000${path}`,
    };
    const emailService = {
      sendApplicationSubmittedEmail: vi.fn().mockResolvedValue(undefined),
    };
    const smsService = { send: vi.fn() };
    const prisma = {
      withAuthLookup: vi.fn(async (fn: (tx: unknown) => unknown) =>
        fn({
          user: {
            findMany: vi.fn().mockResolvedValue([
              { id: 'lender-1', email: 'lender@example.com' },
            ]),
          },
        }),
      ),
    };

    const service = new NotificationDispatchService(
      queueService as never,
      notificationsService as never,
      emailService as never,
      smsService as never,
      prisma as never,
    );

    await service.processJob({
      eventType: NotificationType.APPLICATION_SUBMITTED,
      dedupKey: 'application-submitted:app-1',
      orgId: 'org-1',
      applicationId: 'app-1',
      borrowerName: 'Jane Borrower',
      principalFormatted: 'R 1,000.00',
    });

    expect(notificationsService.createInApp).toHaveBeenCalled();
    expect(emailService.sendApplicationSubmittedEmail).toHaveBeenCalledWith(
      'lender@example.com',
      'Jane Borrower',
      'R 1,000.00',
      'http://localhost:3000/dashboard/applications/app-1',
    );
  });
});
