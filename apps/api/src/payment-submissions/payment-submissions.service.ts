import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ConfirmPaymentSubmissionResultDto,
  CreatePaymentSubmissionInput,
  DocumentDownloadUrlDto,
  DocumentUploadUrlDto,
  PaymentSubmissionDetailDto,
  RejectPaymentSubmissionInput,
  RequestPaymentProofUploadInput,
} from '@lms/types';
import {
  DocumentEntityType,
  LoanStatus,
  PaymentProofDocumentType,
  PaymentSubmissionStatus,
  PAYMENT_SUBMISSION_STATUS_LABELS,
} from '@lms/types';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { formatCents } from '../common/money';
import { LoanBalanceService } from '../loans/loan-balance.service';
import { LoansService } from '../loans/loans.service';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';
import { PrismaService, PrismaTx } from '../prisma/prisma.service';
import { SupabaseStorageService } from '../storage/supabase-storage.service';

@Injectable()
export class PaymentSubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
    private readonly loansService: LoansService,
    private readonly loanBalanceService: LoanBalanceService,
    private readonly auditService: AuditService,
    private readonly notificationDispatch: NotificationDispatchService,
  ) {}

  async createForBorrower(
    borrowerUserId: string,
    loanId: string,
    input: CreatePaymentSubmissionInput,
  ): Promise<PaymentSubmissionDetailDto> {
    const loan = await this.loadBorrowerLoan(borrowerUserId, loanId);
    this.assertLoanAcceptsPayment(loan.status);

    const submission = await this.prisma.withUserContext(
      borrowerUserId,
      loan.orgId,
      async (tx) => {
        const pending = await tx.paymentSubmission.findFirst({
          where: {
            loanId,
            submittedByUserId: borrowerUserId,
            status: {
              in: [
                PaymentSubmissionStatus.AWAITING_PROOF,
                PaymentSubmissionStatus.PENDING,
              ],
            },
          },
        });

        if (pending) {
          throw new BadRequestException(
            'You already have a payment awaiting proof or lender confirmation on this loan',
          );
        }

        return tx.paymentSubmission.create({
          data: {
            orgId: loan.orgId,
            loanId,
            submittedByUserId: borrowerUserId,
            amountCents: input.amountCents,
            paymentDate: input.paymentDate,
            referenceNote: input.referenceNote?.trim() || null,
            status: PaymentSubmissionStatus.AWAITING_PROOF,
          },
        });
      },
    );

    return this.getDetailForBorrower(borrowerUserId, submission.id);
  }

  async requestProofUpload(
    borrowerUserId: string,
    loanId: string,
    submissionId: string,
    input: RequestPaymentProofUploadInput,
  ): Promise<DocumentUploadUrlDto> {
    const submission = await this.loadBorrowerSubmission(
      borrowerUserId,
      loanId,
      submissionId,
    );

    if (submission.status !== PaymentSubmissionStatus.AWAITING_PROOF) {
      throw new BadRequestException('Proof can only be uploaded before submitting to the lender');
    }

    const storagePath = `${submission.orgId}/payment-submissions/${submissionId}/${PaymentProofDocumentType.PROOF_OF_PAYMENT}/${randomUUID()}-${input.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)}`;
    const signed = await this.storage.createSignedUploadUrl(storagePath);

    await this.prisma.withUserContext(borrowerUserId, submission.orgId, async (tx) => {
      await tx.document.updateMany({
        where: {
          orgId: submission.orgId,
          entityType: DocumentEntityType.PAYMENT_SUBMISSION,
          entityId: submissionId,
          documentType: PaymentProofDocumentType.PROOF_OF_PAYMENT,
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });

      await tx.document.create({
        data: {
          orgId: submission.orgId,
          entityType: DocumentEntityType.PAYMENT_SUBMISSION,
          entityId: submissionId,
          documentType: PaymentProofDocumentType.PROOF_OF_PAYMENT,
          storagePath,
          originalFilename: input.filename,
          uploadedByUserId: borrowerUserId,
        },
      });
    });

    return {
      documentId: submissionId,
      uploadUrl: signed.signedUrl,
      token: signed.token,
      storagePath,
      expiresInSeconds: this.storage.expirySeconds,
    };
  }

  async submitToLender(
    borrowerUserId: string,
    loanId: string,
    submissionId: string,
  ): Promise<PaymentSubmissionDetailDto> {
    const submission = await this.loadBorrowerSubmission(
      borrowerUserId,
      loanId,
      submissionId,
    );

    if (submission.status !== PaymentSubmissionStatus.AWAITING_PROOF) {
      throw new BadRequestException('This payment has already been submitted');
    }

    const hasProof = await this.hasProofDocument(submission.orgId, borrowerUserId, submissionId);
    if (!hasProof) {
      throw new BadRequestException('Upload proof of payment before submitting to your lender');
    }

    const updated = await this.prisma.withUserContext(
      borrowerUserId,
      submission.orgId,
      async (tx) =>
        tx.paymentSubmission.update({
          where: { id: submissionId },
          data: {
            status: PaymentSubmissionStatus.PENDING,
            submittedAt: new Date(),
          },
        }),
    );

    const borrower = await this.prisma.withAuthLookup(async (tx) =>
      tx.user.findUnique({ where: { id: borrowerUserId }, select: { name: true } }),
    );

    void this.notificationDispatch.notifyPaymentSubmitted({
      orgId: updated.orgId,
      paymentSubmissionId: updated.id,
      loanId: updated.loanId,
      borrowerName: borrower?.name ?? 'Borrower',
      amountCents: updated.amountCents,
      paymentDate: updated.paymentDate.toISOString().slice(0, 10),
    });

    return this.getDetailForBorrower(borrowerUserId, submissionId);
  }

  async getForBorrower(
    borrowerUserId: string,
    loanId: string,
    submissionId: string,
  ): Promise<PaymentSubmissionDetailDto> {
    await this.loadBorrowerSubmission(borrowerUserId, loanId, submissionId);
    return this.getDetailForBorrower(borrowerUserId, submissionId);
  }

  async getProofDownloadForBorrower(
    borrowerUserId: string,
    loanId: string,
    submissionId: string,
  ): Promise<DocumentDownloadUrlDto> {
    await this.loadBorrowerSubmission(borrowerUserId, loanId, submissionId);
    return this.getProofDownload(submissionId, borrowerUserId);
  }

  async getForLender(
    orgId: string,
    userId: string,
    submissionId: string,
  ): Promise<PaymentSubmissionDetailDto> {
    return this.getDetailForLender(orgId, userId, submissionId);
  }

  async getProofDownloadForLender(
    orgId: string,
    userId: string,
    submissionId: string,
  ): Promise<DocumentDownloadUrlDto> {
    await this.assertLenderSubmission(orgId, userId, submissionId);
    return this.getProofDownload(submissionId, userId, orgId);
  }

  async confirm(
    orgId: string,
    userId: string,
    submissionId: string,
  ): Promise<ConfirmPaymentSubmissionResultDto> {
    const submission = await this.assertLenderSubmission(orgId, userId, submissionId);

    if (submission.status !== PaymentSubmissionStatus.PENDING) {
      throw new BadRequestException('Only pending payments can be recorded');
    }

    const noteParts = [
      'Borrower-reported payment',
      submission.referenceNote,
    ].filter(Boolean);

    const repaymentResult = await this.loansService.recordRepayment(
      orgId,
      userId,
      submission.loanId,
      {
        amountCents: submission.amountCents,
        paymentDate: submission.paymentDate,
        note: noteParts.join(' ù '),
      },
    );

    await this.prisma.withOrgContext(orgId, userId, async (tx) => {
      await tx.paymentSubmission.update({
        where: { id: submissionId },
        data: {
          status: PaymentSubmissionStatus.CONFIRMED,
          repaymentId: repaymentResult.repayment.id,
          reviewedByUserId: userId,
          reviewedAt: new Date(),
        },
      });

      await this.auditService.record(tx, {
        orgId,
        userId,
        action: 'payment_submission.confirmed',
        entityType: 'PAYMENT_SUBMISSION',
        entityId: submissionId,
        after: {
          repaymentId: repaymentResult.repayment.id,
          amountCents: submission.amountCents,
        },
      });
    });

    const org = await this.prisma.withAuthLookup(async (tx) =>
      tx.organisation.findFirst({ where: { id: orgId }, select: { name: true } }),
    );

    void this.notificationDispatch.notifyPaymentConfirmed({
      orgId,
      paymentSubmissionId: submissionId,
      loanId: submission.loanId,
      borrowerUserId: submission.submittedByUserId,
      organisationName: org?.name ?? 'Your lender',
      amountCents: submission.amountCents,
      paymentDate: submission.paymentDate.toISOString().slice(0, 10),
    });

    const detail = await this.getDetailForLender(orgId, userId, submissionId);

    return {
      submission: detail,
      repaymentId: repaymentResult.repayment.id,
    };
  }

  async reject(
    orgId: string,
    userId: string,
    submissionId: string,
    input: RejectPaymentSubmissionInput,
  ): Promise<PaymentSubmissionDetailDto> {
    const submission = await this.assertLenderSubmission(orgId, userId, submissionId);

    if (submission.status !== PaymentSubmissionStatus.PENDING) {
      throw new BadRequestException('Only pending payments can be rejected');
    }

    await this.prisma.withOrgContext(orgId, userId, async (tx) => {
      await tx.paymentSubmission.update({
        where: { id: submissionId },
        data: {
          status: PaymentSubmissionStatus.REJECTED,
          reviewNote: input.reviewNote.trim(),
          reviewedByUserId: userId,
          reviewedAt: new Date(),
        },
      });

      await this.auditService.record(tx, {
        orgId,
        userId,
        action: 'payment_submission.rejected',
        entityType: 'PAYMENT_SUBMISSION',
        entityId: submissionId,
        after: { reviewNote: input.reviewNote.trim() },
      });
    });

    const org = await this.prisma.withAuthLookup(async (tx) =>
      tx.organisation.findFirst({ where: { id: orgId }, select: { name: true } }),
    );

    void this.notificationDispatch.notifyPaymentRejected({
      orgId,
      paymentSubmissionId: submissionId,
      loanId: submission.loanId,
      borrowerUserId: submission.submittedByUserId,
      organisationName: org?.name ?? 'Your lender',
      amountCents: submission.amountCents,
      paymentDate: submission.paymentDate.toISOString().slice(0, 10),
      reviewNote: input.reviewNote.trim(),
    });

    return this.getDetailForLender(orgId, userId, submissionId);
  }

  async listPendingForLoan(
    borrowerUserId: string,
    loanId: string,
  ) {
    await this.loadBorrowerLoan(borrowerUserId, loanId);

    const rows = await this.prisma.withUserContext(borrowerUserId, null, async (tx) =>
      tx.paymentSubmission.findMany({
        where: {
          loanId,
          submittedByUserId: borrowerUserId,
          status: {
            in: [
              PaymentSubmissionStatus.AWAITING_PROOF,
              PaymentSubmissionStatus.PENDING,
              PaymentSubmissionStatus.REJECTED,
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );

    return rows.map((row) => ({
      id: row.id,
      amountFormatted: formatCents(row.amountCents),
      paymentDate: row.paymentDate.toISOString().slice(0, 10),
      status: row.status,
      statusLabel: PAYMENT_SUBMISSION_STATUS_LABELS[row.status] ?? row.status,
      referenceNote: row.referenceNote,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      reviewNote: row.reviewNote,
    }));
  }

  private async getDetailForBorrower(
    borrowerUserId: string,
    submissionId: string,
  ): Promise<PaymentSubmissionDetailDto> {
    const row = await this.prisma.withUserContext(borrowerUserId, null, async (tx) =>
      tx.paymentSubmission.findFirst({
        where: { id: submissionId, submittedByUserId: borrowerUserId },
      }),
    );

    if (!row) {
      throw new NotFoundException('Payment submission not found');
    }

    return this.buildDetail(row, borrowerUserId);
  }

  private async getDetailForLender(
    orgId: string,
    userId: string,
    submissionId: string,
  ): Promise<PaymentSubmissionDetailDto> {
    const row = await this.assertLenderSubmission(orgId, userId, submissionId);
    return this.buildDetail(row, userId, orgId);
  }

  private async buildDetail(
    row: {
      id: string;
      orgId: string;
      loanId: string;
      submittedByUserId: string;
      amountCents: number;
      paymentDate: Date;
      referenceNote: string | null;
      provider: string;
      externalReference: string | null;
      status: string;
      repaymentId: string | null;
      reviewNote: string | null;
      reviewedAt: Date | null;
      submittedAt: Date | null;
      createdAt: Date;
    },
    userId: string,
    orgId?: string,
  ): Promise<PaymentSubmissionDetailDto> {
    const contextOrgId = orgId ?? row.orgId;

    const [loan, org, borrower, hasProof] = await Promise.all([
      this.prisma.withUserContext(userId, contextOrgId, async (tx) =>
        tx.loan.findFirst({
          where: { id: row.loanId, orgId: row.orgId, deletedAt: null },
          include: { repaymentSchedules: true, repayments: true },
        }),
      ),
      this.prisma.withUserContext(userId, contextOrgId, async (tx) =>
        tx.organisation.findFirst({ where: { id: row.orgId } }),
      ),
      this.prisma.withAuthLookup(async (tx) =>
        tx.user.findUnique({ where: { id: row.submittedByUserId }, select: { name: true } }),
      ),
      this.hasProofDocument(contextOrgId, userId, row.id),
    ]);

    const outstanding = loan
      ? formatCents(
          this.loanBalanceService.computeFromData(
            loan.repaymentSchedules,
            loan.repayments,
            loan.status,
          ).outstandingCents,
        )
      : 'ù';

    return {
      id: row.id,
      loanId: row.loanId,
      orgId: row.orgId,
      amountFormatted: formatCents(row.amountCents),
      paymentDate: row.paymentDate.toISOString().slice(0, 10),
      status: row.status,
      referenceNote: row.referenceNote,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      borrowerName: borrower?.name ?? 'Borrower',
      organisationName: org?.name ?? 'Lender',
      loanPrincipalFormatted: loan ? formatCents(loan.principalCents) : 'ù',
      loanOutstandingFormatted: outstanding,
      provider: row.provider,
      externalReference: row.externalReference,
      reviewNote: row.reviewNote,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      repaymentId: row.repaymentId,
      hasProofDocument: hasProof,
    };
  }

  private async getProofDownload(
    submissionId: string,
    userId: string,
    orgId?: string,
  ): Promise<DocumentDownloadUrlDto> {
    const submission = orgId
      ? await this.prisma.withUserContext(userId, orgId, async (tx) =>
          tx.paymentSubmission.findFirst({ where: { id: submissionId, orgId } }),
        )
      : await this.prisma.withUserContext(userId, null, async (tx) =>
          tx.paymentSubmission.findFirst({
            where: { id: submissionId, submittedByUserId: userId },
          }),
        );

    if (!submission) {
      throw new NotFoundException('Payment submission not found');
    }

    const document = await this.prisma.withUserContext(
      userId,
      submission.orgId,
      async (tx) =>
        tx.document.findFirst({
          where: {
            orgId: submission.orgId,
            entityType: DocumentEntityType.PAYMENT_SUBMISSION,
            entityId: submissionId,
            documentType: PaymentProofDocumentType.PROOF_OF_PAYMENT,
            deletedAt: null,
          },
        }),
    );

    if (!document) {
      throw new NotFoundException('Proof of payment not found');
    }

    const downloadUrl = await this.storage.createSignedDownloadUrl(document.storagePath);

    return {
      downloadUrl,
      expiresInSeconds: this.storage.expirySeconds,
      originalFilename: document.originalFilename,
    };
  }

  private async hasProofDocument(
    orgId: string,
    userId: string,
    submissionId: string,
  ): Promise<boolean> {
    const count = await this.prisma.withUserContext(userId, orgId, async (tx) =>
      tx.document.count({
        where: {
          orgId,
          entityType: DocumentEntityType.PAYMENT_SUBMISSION,
          entityId: submissionId,
          documentType: PaymentProofDocumentType.PROOF_OF_PAYMENT,
          deletedAt: null,
        },
      }),
    );
    return count > 0;
  }

  private async loadBorrowerLoan(borrowerUserId: string, loanId: string) {
    const access = await this.prisma.withUserContext(borrowerUserId, null, async (tx) =>
      this.resolveAccessibleLoansFilter(tx, borrowerUserId),
    );

    if (!access) {
      throw new NotFoundException('Loan not found');
    }

    const loan = await this.prisma.withUserContext(borrowerUserId, null, async (tx) =>
      tx.loan.findFirst({
        where: {
          id: loanId,
          orgId: { in: access.orgIds },
          borrowerId: { in: access.borrowerIds },
          deletedAt: null,
        },
      }),
    );

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    return loan;
  }

  private async loadBorrowerSubmission(
    borrowerUserId: string,
    loanId: string,
    submissionId: string,
  ) {
    await this.loadBorrowerLoan(borrowerUserId, loanId);

    const submission = await this.prisma.withUserContext(borrowerUserId, null, async (tx) =>
      tx.paymentSubmission.findFirst({
        where: { id: submissionId, loanId, submittedByUserId: borrowerUserId },
      }),
    );

    if (!submission) {
      throw new NotFoundException('Payment submission not found');
    }

    return submission;
  }

  private async assertLenderSubmission(orgId: string, userId: string, submissionId: string) {
    const submission = await this.prisma.withOrgContext(orgId, userId, async (tx) =>
      tx.paymentSubmission.findFirst({
        where: {
          id: submissionId,
          orgId,
          status: { not: PaymentSubmissionStatus.AWAITING_PROOF },
        },
      }),
    );

    if (!submission) {
      throw new NotFoundException('Payment submission not found');
    }

    return submission;
  }

  private assertLoanAcceptsPayment(status: string) {
    if (status !== LoanStatus.ACTIVE && status !== LoanStatus.IN_ARREARS) {
      throw new BadRequestException('Payments can only be submitted on active or in-arrears loans');
    }
  }

  private async resolveAccessibleLoansFilter(tx: PrismaTx, userId: string) {
    const links = await tx.borrowerLenderLink.findMany({
      where: { borrowerUserId: userId },
    });
    const orgIds = links.map((link) => link.orgId);
    if (orgIds.length === 0) {
      return null;
    }

    const borrowers = await tx.borrower.findMany({
      where: {
        platformUserId: userId,
        orgId: { in: orgIds },
        deletedAt: null,
      },
    });

    const borrowerIds = borrowers.map((borrower) => borrower.id);
    if (borrowerIds.length === 0) {
      return null;
    }

    return { orgIds, borrowerIds };
  }
}
