import { BadRequestException } from '@nestjs/common';
import { WalletOwnerType, WalletTransactionStatus, WalletTransactionType } from '@lms/types';
import { describe, expect, it, vi } from 'vitest';
import { AuditService } from '../audit/audit.service';
import { WalletsService } from './wallets.service';

describe('WalletsService', () => {
  const auditService = {
    record: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  function createWallet(overrides: Partial<{
    id: string;
    availableBalanceCents: number;
    bankAccount: null;
  }> = {}) {
    return {
      id: 'wallet-1',
      availableBalanceCents: 100_000,
      currency: 'ZAR',
      bankAccount: null,
      ...overrides,
    };
  }

  it('records top-up and updates balance atomically', async () => {
    let balance = 0;
    const tx = {
      wallet: {
        findFirst: vi.fn().mockResolvedValue(createWallet({ availableBalanceCents: balance })),
        create: vi.fn(),
        update: vi.fn(async ({ data }: { data: { availableBalanceCents: number } }) => {
          balance = data.availableBalanceCents;
          return createWallet({ availableBalanceCents: balance });
        }),
        findFirstOrThrow: vi.fn(async () =>
          createWallet({ availableBalanceCents: balance }),
        ),
      },
      walletTransaction: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    };

    const prisma = {
      withOrgContext: vi.fn(
        async (_orgId: string, _userId: string, fn: (inner: typeof tx) => Promise<unknown>) =>
          fn(tx),
      ),
    };

    const service = new WalletsService(prisma as never, auditService);
    const result = await service.recordOrgTopUp('org-1', 'user-1', {
      amountCents: 50_000,
    });

    expect(result.availableBalanceCents).toBe(50_000);
    expect(tx.walletTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: WalletTransactionType.TOP_UP,
          status: WalletTransactionStatus.COMPLETED,
          amountCents: 50_000,
          balanceAfterCents: 50_000,
        }),
      }),
    );
  });

  it('rejects withdrawal when balance is insufficient', async () => {
    const tx = {
      wallet: {
        findFirst: vi.fn().mockResolvedValue(createWallet({ availableBalanceCents: 10_000 })),
        update: vi.fn(),
      },
      walletTransaction: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    };

    const prisma = {
      withOrgContext: vi.fn(
        async (_orgId: string, _userId: string, fn: (inner: typeof tx) => Promise<unknown>) =>
          fn(tx),
      ),
    };

    const service = new WalletsService(prisma as never, auditService);

    await expect(
      service.recordOrgWithdrawal('org-1', 'user-1', { amountCents: 20_000 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recordDisbursement is idempotent via idempotency keys', async () => {
    const tx = {
      walletTransaction: {
        findFirst: vi.fn().mockResolvedValue({ id: 'existing-tx' }),
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      wallet: {
        findFirst: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
    };

    const service = new WalletsService({} as never, auditService);

    await service.recordDisbursement(tx as never, {
      orgId: 'org-1',
      userId: 'user-1',
      loanId: 'loan-1',
      borrowerUserId: 'borrower-1',
      amountCents: 100_000,
    });

    expect(tx.wallet.update).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('recordDisbursement rejects insufficient lender funds', async () => {
    const tx = {
      walletTransaction: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      wallet: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(
            createWallet({ id: 'lender-wallet', availableBalanceCents: 5_000 }),
          )
          .mockResolvedValueOnce(
            createWallet({ id: 'borrower-wallet', availableBalanceCents: 0 }),
          ),
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    const service = new WalletsService({} as never, auditService);

    await expect(
      service.recordDisbursement(tx as never, {
        orgId: 'org-1',
        userId: 'user-1',
        loanId: 'loan-1',
        borrowerUserId: 'borrower-1',
        amountCents: 100_000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lazy-creates org wallet on first access', async () => {
    const created = createWallet();
    const tx = {
      wallet: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
    };

    const prisma = {
      withOrgContext: vi.fn(
        async (_orgId: string, _userId: string, fn: (inner: typeof tx) => Promise<unknown>) =>
          fn(tx),
      ),
    };

    const service = new WalletsService(prisma as never, auditService);
    await service.getOrgWallet('org-1', 'user-1');

    expect(tx.wallet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          ownerType: WalletOwnerType.ORGANISATION,
          ownerOrgId: 'org-1',
        },
      }),
    );
  });

  it('credits lender wallet when collecting a repayment', async () => {
    let lenderBalance = 25_000;
    const tx = {
      walletTransaction: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      wallet: {
        findFirst: vi.fn().mockResolvedValue(
          createWallet({ id: 'lender-wallet', availableBalanceCents: lenderBalance }),
        ),
        update: vi.fn(async ({ data }: { data: { availableBalanceCents: number } }) => {
          lenderBalance = data.availableBalanceCents;
          return createWallet({ id: 'lender-wallet', availableBalanceCents: lenderBalance });
        }),
        create: vi.fn(),
      },
    };

    const service = new WalletsService({} as never, auditService);

    await service.creditOrgWalletForRepaymentInTx(tx as never, {
      orgId: 'org-1',
      userId: 'lender-1',
      loanId: 'loan-1',
      repaymentId: 'repayment-1',
      amountCents: 10_000,
    });

    expect(lenderBalance).toBe(35_000);
    expect(tx.walletTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: WalletTransactionType.REPAYMENT,
          amountCents: 10_000,
          balanceAfterCents: 35_000,
        }),
      }),
    );
  });

  it('recordRepayment completes lender credit when borrower leg already exists', async () => {
    let lenderBalance = 0;
    const tx = {
      walletTransaction: {
        findUnique: vi.fn(async ({ where }: { where: { idempotencyKey: string } }) =>
          where.idempotencyKey.endsWith(':borrower') ? { id: 'borrower-tx' } : null,
        ),
        create: vi.fn(),
      },
      wallet: {
        findFirst: vi.fn(async ({ where }: { where: { ownerType?: string; id?: string } }) => {
          if (where.ownerType === WalletOwnerType.BORROWER_USER) {
            return createWallet({ id: 'borrower-wallet', availableBalanceCents: 0 });
          }
          return createWallet({ id: 'lender-wallet', availableBalanceCents: lenderBalance });
        }),
        update: vi.fn(async ({ data }: { data: { availableBalanceCents: number } }) => {
          lenderBalance = data.availableBalanceCents;
          return createWallet({ id: 'lender-wallet', availableBalanceCents: lenderBalance });
        }),
        create: vi.fn(),
      },
    };

    const service = new WalletsService({} as never, auditService);

    await service.recordRepayment(tx as never, {
      orgId: 'org-1',
      userId: 'borrower-1',
      loanId: 'loan-1',
      borrowerUserId: 'borrower-1',
      repaymentId: 'repayment-1',
      amountCents: 5_000,
    });

    expect(lenderBalance).toBe(5_000);
    expect(tx.walletTransaction.create).toHaveBeenCalledTimes(1);
  });
});
