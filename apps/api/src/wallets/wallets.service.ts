import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ListWalletTransactionsQuery,
  PaginatedWalletTransactionsDto,
  WalletBankAccountInput,
  WalletSummaryDto,
  WalletTopUpInput,
  WalletTransactionDto,
  WalletWithdrawInput,
} from '@lms/types';
import {
  WalletOwnerType,
  WalletTransactionStatus,
  WalletTransactionType,
} from '@lms/types';
import { AuditService } from '../audit/audit.service';
import { formatCents } from '../common/money';
import { PrismaService, type PrismaTx } from '../prisma/prisma.service';
import { maskAccountNumber } from './wallet.util';

interface RecordTransactionInput {
  walletId: string;
  orgId?: string;
  type: (typeof WalletTransactionType)[keyof typeof WalletTransactionType];
  amountCents: number;
  loanId?: string;
  paymentSubmissionId?: string;
  description?: string;
  idempotencyKey?: string;
  createdByUserId?: string;
}

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getOrgWallet(orgId: string, userId: string): Promise<WalletSummaryDto> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const wallet = await this.getOrCreateOrgWallet(tx, orgId);
      return this.mapSummary(wallet);
    });
  }

  async getBorrowerWallet(userId: string): Promise<WalletSummaryDto> {
    return this.prisma.withUserContext(userId, null, async (tx) => {
      const wallet = await this.getOrCreateBorrowerWallet(tx, userId);
      return this.mapSummary(wallet);
    });
  }

  async upsertOrgBankAccount(
    orgId: string,
    userId: string,
    input: WalletBankAccountInput,
  ): Promise<WalletSummaryDto> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const wallet = await this.getOrCreateOrgWallet(tx, orgId);
      await this.upsertOrgBankAccountInTx(tx, orgId, userId, wallet.id, input);

      const refreshed = await tx.wallet.findFirstOrThrow({
        where: { id: wallet.id },
        include: { bankAccount: true },
      });

      return this.mapSummary(refreshed);
    });
  }

  async upsertOrgBankAccountInTx(
    tx: PrismaTx,
    orgId: string,
    userId: string,
    walletId: string,
    input: WalletBankAccountInput,
  ): Promise<void> {
    await tx.walletBankAccount.upsert({
      where: { walletId },
      create: {
        walletId,
        accountHolder: input.accountHolder,
        bankName: input.bankName,
        branchCode: input.branchCode,
        accountNumber: input.accountNumber,
      },
      update: {
        accountHolder: input.accountHolder,
        bankName: input.bankName,
        branchCode: input.branchCode,
        accountNumber: input.accountNumber,
      },
    });

    await this.auditService.record(tx, {
      orgId,
      userId,
      action: 'wallet.bank_account.updated',
      entityType: 'WALLET',
      entityId: walletId,
      after: {
        bankName: input.bankName,
        branchCode: input.branchCode,
        accountNumberMasked: maskAccountNumber(input.accountNumber),
      },
    });
  }

  async upsertBorrowerBankAccount(
    userId: string,
    input: WalletBankAccountInput,
  ): Promise<WalletSummaryDto> {
    return this.prisma.withUserContext(userId, null, async (tx) => {
      const wallet = await this.getOrCreateBorrowerWallet(tx, userId);
      await this.upsertBorrowerBankAccountInTx(tx, wallet.id, input);

      const refreshed = await tx.wallet.findFirstOrThrow({
        where: { id: wallet.id },
        include: { bankAccount: true },
      });

      return this.mapSummary(refreshed);
    });
  }

  async upsertBorrowerBankAccountInTx(
    tx: PrismaTx,
    walletId: string,
    input: WalletBankAccountInput,
  ): Promise<void> {
    await tx.walletBankAccount.upsert({
      where: { walletId },
      create: {
        walletId,
        accountHolder: input.accountHolder,
        bankName: input.bankName,
        branchCode: input.branchCode,
        accountNumber: input.accountNumber,
      },
      update: {
        accountHolder: input.accountHolder,
        bankName: input.bankName,
        branchCode: input.branchCode,
        accountNumber: input.accountNumber,
      },
    });
  }

  async listOrgTransactions(
    orgId: string,
    userId: string,
    query: ListWalletTransactionsQuery,
  ): Promise<PaginatedWalletTransactionsDto> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const wallet = await this.getOrCreateOrgWallet(tx, orgId);
      return this.listTransactions(tx, wallet.id, query);
    });
  }

  async listBorrowerTransactions(
    userId: string,
    query: ListWalletTransactionsQuery,
  ): Promise<PaginatedWalletTransactionsDto> {
    return this.prisma.withUserContext(userId, null, async (tx) => {
      const wallet = await this.getOrCreateBorrowerWallet(tx, userId);
      return this.listTransactions(tx, wallet.id, query);
    });
  }

  async recordOrgTopUp(
    orgId: string,
    userId: string,
    input: WalletTopUpInput,
  ): Promise<WalletSummaryDto> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const wallet = await this.getOrCreateOrgWallet(tx, orgId);

      await this.recordTransaction(tx, {
        walletId: wallet.id,
        orgId,
        type: WalletTransactionType.TOP_UP,
        amountCents: input.amountCents,
        description: input.description ?? 'Manual top-up (demo)',
        createdByUserId: userId,
      });

      await this.auditService.record(tx, {
        orgId,
        userId,
        action: 'wallet.top_up',
        entityType: 'WALLET',
        entityId: wallet.id,
        after: { amountCents: input.amountCents },
      });

      const refreshed = await tx.wallet.findFirstOrThrow({
        where: { id: wallet.id },
        include: { bankAccount: true },
      });

      return this.mapSummary(refreshed);
    });
  }

  async recordOrgWithdrawal(
    orgId: string,
    userId: string,
    input: WalletWithdrawInput,
  ): Promise<WalletSummaryDto> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const wallet = await this.getOrCreateOrgWallet(tx, orgId);

      await this.recordTransaction(tx, {
        walletId: wallet.id,
        orgId,
        type: WalletTransactionType.WITHDRAWAL,
        amountCents: -input.amountCents,
        description: input.description ?? 'Manual withdrawal (demo)',
        createdByUserId: userId,
      });

      await this.auditService.record(tx, {
        orgId,
        userId,
        action: 'wallet.withdrawal',
        entityType: 'WALLET',
        entityId: wallet.id,
        after: { amountCents: input.amountCents },
      });

      const refreshed = await tx.wallet.findFirstOrThrow({
        where: { id: wallet.id },
        include: { bankAccount: true },
      });

      return this.mapSummary(refreshed);
    });
  }

  /**
   * Record loan disbursement: debit lender wallet, credit borrower wallet.
   * Must run inside an existing org-scoped transaction.
   */
  async recordDisbursement(
    tx: PrismaTx,
    params: {
      orgId: string;
      userId: string;
      loanId: string;
      borrowerUserId: string;
      amountCents: number;
    },
  ): Promise<void> {
    const idempotencyBase = `disbursement:${params.loanId}`;

    const existing = await tx.walletTransaction.findFirst({
      where: { idempotencyKey: `${idempotencyBase}:lender` },
    });
    if (existing) {
      return;
    }

    const lenderWallet = await this.getOrCreateOrgWallet(tx, params.orgId);
    const borrowerWallet = await this.getOrCreateBorrowerWallet(
      tx,
      params.borrowerUserId,
    );

    if (lenderWallet.availableBalanceCents < params.amountCents) {
      throw new BadRequestException(
        `Insufficient available funds. Need ${formatCents(params.amountCents)} but wallet has ${formatCents(lenderWallet.availableBalanceCents)}.`,
      );
    }

    await this.recordTransaction(tx, {
      walletId: lenderWallet.id,
      orgId: params.orgId,
      type: WalletTransactionType.DISBURSEMENT,
      amountCents: -params.amountCents,
      loanId: params.loanId,
      description: `Loan disbursement ${params.loanId}`,
      idempotencyKey: `${idempotencyBase}:lender`,
      createdByUserId: params.userId,
    });

    await this.recordTransaction(tx, {
      walletId: borrowerWallet.id,
      orgId: params.orgId,
      type: WalletTransactionType.DISBURSEMENT,
      amountCents: params.amountCents,
      loanId: params.loanId,
      description: `Loan disbursement received ${params.loanId}`,
      idempotencyKey: `${idempotencyBase}:borrower`,
      createdByUserId: params.userId,
    });
  }

  /**
   * Credit the lender org wallet when a repayment is collected (external or in-app).
   * Must run inside an existing transaction.
   */
  async creditOrgWalletForRepaymentInTx(
    tx: PrismaTx,
    params: {
      orgId: string;
      userId: string;
      loanId: string;
      repaymentId: string;
      amountCents: number;
    },
  ): Promise<void> {
    const idempotencyKey = `repayment:${params.repaymentId}:lender`;

    const existing = await tx.walletTransaction.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return;
    }

    const lenderWallet = await this.getOrCreateOrgWallet(tx, params.orgId);

    await this.recordTransaction(tx, {
      walletId: lenderWallet.id,
      orgId: params.orgId,
      type: WalletTransactionType.REPAYMENT,
      amountCents: params.amountCents,
      loanId: params.loanId,
      description: `Loan repayment collected ${params.loanId}`,
      idempotencyKey,
      createdByUserId: params.userId,
    });
  }

  /**
   * Record in-app repayment: debit borrower wallet, credit lender wallet.
   * Must run inside an existing transaction.
   */
  async recordRepayment(
    tx: PrismaTx,
    params: {
      orgId: string;
      userId: string;
      loanId: string;
      borrowerUserId: string;
      repaymentId: string;
      amountCents: number;
    },
  ): Promise<void> {
    const idempotencyBase = `repayment:${params.repaymentId}`;
    const borrowerKey = `${idempotencyBase}:borrower`;
    const lenderKey = `${idempotencyBase}:lender`;

    const [existingBorrowerTx, existingLenderTx] = await Promise.all([
      tx.walletTransaction.findUnique({ where: { idempotencyKey: borrowerKey } }),
      tx.walletTransaction.findUnique({ where: { idempotencyKey: lenderKey } }),
    ]);

    if (existingBorrowerTx && existingLenderTx) {
      return;
    }

    const borrowerWallet = await this.getOrCreateBorrowerWallet(
      tx,
      params.borrowerUserId,
    );

    if (!existingBorrowerTx) {
      if (borrowerWallet.availableBalanceCents < params.amountCents) {
        throw new BadRequestException(
          `Insufficient wallet balance. Need ${formatCents(params.amountCents)} but your wallet has ${formatCents(borrowerWallet.availableBalanceCents)}.`,
        );
      }

      await this.recordTransaction(tx, {
        walletId: borrowerWallet.id,
        orgId: params.orgId,
        type: WalletTransactionType.REPAYMENT,
        amountCents: -params.amountCents,
        loanId: params.loanId,
        description: `Loan repayment ${params.loanId}`,
        idempotencyKey: borrowerKey,
        createdByUserId: params.userId,
      });
    }

    if (!existingLenderTx) {
      await this.creditOrgWalletForRepaymentInTx(tx, {
        orgId: params.orgId,
        userId: params.userId,
        loanId: params.loanId,
        repaymentId: params.repaymentId,
        amountCents: params.amountCents,
      });
    }
  }

  async getOrgAvailableBalanceCents(
    tx: PrismaTx,
    orgId: string,
  ): Promise<{ balanceCents: number; configured: boolean; bankLinked: boolean }> {
    const wallet = await tx.wallet.findFirst({
      where: { ownerType: WalletOwnerType.ORGANISATION, ownerOrgId: orgId },
      include: { bankAccount: true },
    });

    if (!wallet) {
      return { balanceCents: 0, configured: false, bankLinked: false };
    }

    return {
      balanceCents: wallet.availableBalanceCents,
      configured: true,
      bankLinked: wallet.bankAccount !== null,
    };
  }

  async getOrCreateOrgWallet(
    tx: PrismaTx,
    orgId: string,
  ): Promise<{
    id: string;
    availableBalanceCents: number;
    currency: string;
    bankAccount: {
      accountHolder: string;
      bankName: string;
      branchCode: string;
      accountNumber: string;
      verifiedAt: Date | null;
    } | null;
  }> {
    const existing = await tx.wallet.findFirst({
      where: { ownerType: WalletOwnerType.ORGANISATION, ownerOrgId: orgId },
      include: { bankAccount: true },
    });

    if (existing) {
      return existing;
    }

    return tx.wallet.create({
      data: {
        ownerType: WalletOwnerType.ORGANISATION,
        ownerOrgId: orgId,
      },
      include: { bankAccount: true },
    });
  }

  async getOrCreateBorrowerWallet(
    tx: PrismaTx,
    userId: string,
  ): Promise<{
    id: string;
    availableBalanceCents: number;
    currency: string;
    bankAccount: {
      accountHolder: string;
      bankName: string;
      branchCode: string;
      accountNumber: string;
      verifiedAt: Date | null;
    } | null;
  }> {
    const existing = await tx.wallet.findFirst({
      where: { ownerType: WalletOwnerType.BORROWER_USER, ownerUserId: userId },
      include: { bankAccount: true },
    });

    if (existing) {
      return existing;
    }

    return tx.wallet.create({
      data: {
        ownerType: WalletOwnerType.BORROWER_USER,
        ownerUserId: userId,
      },
      include: { bankAccount: true },
    });
  }

  private async recordTransaction(
    tx: PrismaTx,
    input: RecordTransactionInput,
  ): Promise<void> {
    if (input.idempotencyKey) {
      const existing = await tx.walletTransaction.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        return;
      }
    }

    const wallet = await tx.wallet.findFirst({
      where: { id: input.walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const newBalance = wallet.availableBalanceCents + input.amountCents;
    if (newBalance < 0) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { availableBalanceCents: newBalance },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        orgId: input.orgId,
        type: input.type,
        status: WalletTransactionStatus.COMPLETED,
        amountCents: input.amountCents,
        balanceAfterCents: newBalance,
        loanId: input.loanId,
        paymentSubmissionId: input.paymentSubmissionId,
        description: input.description,
        idempotencyKey: input.idempotencyKey,
        createdByUserId: input.createdByUserId,
      },
    });
  }

  private async listTransactions(
    tx: PrismaTx,
    walletId: string,
    query: ListWalletTransactionsQuery,
  ): Promise<PaginatedWalletTransactionsDto> {
    const skip = (query.page - 1) * query.limit;
    const where = { walletId };

    const [total, rows] = await Promise.all([
      tx.walletTransaction.count({ where }),
      tx.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.mapTransaction(row)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  private mapSummary(wallet: {
    id: string;
    availableBalanceCents: number;
    currency: string;
    bankAccount: {
      accountHolder: string;
      bankName: string;
      branchCode: string;
      accountNumber: string;
      verifiedAt: Date | null;
    } | null;
  }): WalletSummaryDto {
    return {
      id: wallet.id,
      availableBalanceCents: wallet.availableBalanceCents,
      availableBalanceFormatted: formatCents(wallet.availableBalanceCents),
      currency: wallet.currency,
      walletConfigured: true,
      walletBankLinked: wallet.bankAccount !== null,
      bankAccount: wallet.bankAccount
        ? {
            accountHolder: wallet.bankAccount.accountHolder,
            bankName: wallet.bankAccount.bankName,
            branchCode: wallet.bankAccount.branchCode,
            accountNumberMasked: maskAccountNumber(wallet.bankAccount.accountNumber),
            verifiedAt: wallet.bankAccount.verifiedAt?.toISOString() ?? null,
          }
        : null,
    };
  }

  private mapTransaction(row: {
    id: string;
    type: string;
    status: string;
    amountCents: number;
    balanceAfterCents: number | null;
    loanId: string | null;
    description: string | null;
    createdAt: Date;
  }): WalletTransactionDto {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      amountCents: row.amountCents,
      amountFormatted: formatCents(Math.abs(row.amountCents)),
      balanceAfterFormatted:
        row.balanceAfterCents === null ? null : formatCents(row.balanceAfterCents),
      loanId: row.loanId,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
