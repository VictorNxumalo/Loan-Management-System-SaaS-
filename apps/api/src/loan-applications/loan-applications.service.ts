import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ApplicationCreditCheckDto,
  ApproveLoanApplicationInput,
  ApproveLoanApplicationResultDto,
  ApplicationBankDetailsDto,
  ApplicationConsentRecordDto,
  ApplicationDocumentsSummaryDto,
  ApplicationReviewChecklist,
  CreateLoanApplicationDraftInput,
  ListLoanApplicationsQuery,
  LoanApplicationDetailDto,
  LoanApplicationListItemDto,
  PaginatedLoanApplicationsDto,
  RejectLoanApplicationInput,
  TriggerApplicationCreditCheckInput,
} from '@lms/types';
import {
  applicationReviewChecklistSchema,
  isApplicationReviewChecklistComplete,
  LoanApplicationStatus,
  LoanStatus,
} from '@lms/types';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { formatCents } from '../common/money';
import { assertAnnualRateWithinNcaCap } from '../common/nca-rate.util';
import { BORROWER_CONSENT_POLICY_VERSION } from '@lms/types';
import { BorrowerLendingConstraintsService } from '../borrower-portal/borrower-lending-constraints.service';
import { PrismaService, PrismaTx } from '../prisma/prisma.service';
import { LoansScheduleService } from '../loans/loans-schedule.service';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';
import { ApplicationDocumentsService } from './application-documents.service';
import { CreditDataService } from './credit-data.service';
import {
  buildApplicationReviewChecklistStatus,
  parseApplicationReviewChecklist,
} from './application-review.util';
import {
  buildApplicationConsentRecord,
  parseApplicationConsentRecord,
} from './application-consent.util';

type ApplicationDbRow = {
  id: string;
  orgId: string;
  borrowerUserId: string;
  borrowerId: string | null;
  loanId: string | null;
  principalCents: number;
  interestType: string;
  termPeriods: number;
  frequency: string;
  startDate: Date;
  purpose: string | null;
  status: string;
  bankAccountHolder: string | null;
  bankName: string | null;
  bankBranchCode: string | null;
  bankAccountNumber: string | null;
  lenderNotes: string | null;
  reviewChecklist?: unknown;
  consentRecord?: unknown;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organisation: { name: string };
  borrowerUser?: { name: string } | null;
};

type ApplicationRow = ApplicationDbRow & { borrowerName: string };

@Injectable()
export class LoanApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduleService: LoansScheduleService,
    private readonly notificationDispatch: NotificationDispatchService,
    private readonly auditService: AuditService,
    private readonly applicationDocuments: ApplicationDocumentsService,
    private readonly lendingConstraints: BorrowerLendingConstraintsService,
    private readonly creditData: CreditDataService,
  ) {}

  async createDraft(
    borrowerUserId: string,
    input: CreateLoanApplicationDraftInput,
  ): Promise<LoanApplicationDetailDto> {
    await this.lendingConstraints.assertCanApplyForLoan(borrowerUserId, input.orgId);

    return this.prisma.withUserContext(borrowerUserId, null, async (tx) => {
      const link = await tx.borrowerLenderLink.findUnique({
        where: {
          borrowerUserId_orgId: {
            borrowerUserId,
            orgId: input.orgId,
          },
        },
      });

      if (!link) {
        throw new BadRequestException(
          'Connect with this lender before submitting an application',
        );
      }

      if (input.consent.policyVersion !== BORROWER_CONSENT_POLICY_VERSION) {
        throw new BadRequestException(
          'Consent policy is out of date. Refresh the page and accept the latest consent statements.',
        );
      }

      const open = await tx.loanApplication.findFirst({
        where: {
          orgId: input.orgId,
          borrowerUserId,
          status: { in: [LoanApplicationStatus.DRAFT, LoanApplicationStatus.SUBMITTED] },
        },
      });

      if (open) {
        throw new BadRequestException(
          open.status === LoanApplicationStatus.DRAFT
            ? 'You already have a draft application with this lender. Open it to continue.'
            : 'You already have a pending application with this lender',
        );
      }

      const bankDetails =
        input.bankDetails ??
        (await this.resolveBorrowerProfileBankDetails(tx, borrowerUserId));

      const consentRecord = buildApplicationConsentRecord(input.consent);

      const created = await tx.loanApplication.create({
        data: {
          orgId: input.orgId,
          borrowerUserId,
          principalCents: input.principalCents,
          interestType: input.interestType,
          termPeriods: input.termPeriods,
          frequency: input.frequency,
          startDate: input.startDate,
          purpose: input.purpose?.trim() || null,
          status: LoanApplicationStatus.DRAFT,
          bankAccountHolder: bankDetails.accountHolder,
          bankName: bankDetails.bankName,
          bankBranchCode: bankDetails.branchCode,
          bankAccountNumber: bankDetails.accountNumber,
          consentRecord: consentRecord as unknown as Prisma.InputJsonValue,
        },
        include: {
          organisation: true,
          borrowerUser: true,
        },
      });

      await this.auditService.record(tx, {
        orgId: input.orgId,
        userId: borrowerUserId,
        action: 'application.consent_captured',
        entityType: 'LOAN_APPLICATION',
        entityId: created.id,
        after: consentRecord,
      });

      return this.mapDetail(
        this.toApplicationRow(created),
        await this.applicationDocuments.summarizeForApplication(
          created.orgId,
          borrowerUserId,
          created.id,
        ),
      );
    });
  }

  async finalizeSubmit(
    borrowerUserId: string,
    id: string,
  ): Promise<LoanApplicationDetailDto> {
    const application = await this.prisma.withUserContext(
      borrowerUserId,
      null,
      async (tx) =>
        tx.loanApplication.findFirst({
          where: {
            id,
            borrowerUserId,
            status: LoanApplicationStatus.DRAFT,
          },
          include: { organisation: true, borrowerUser: true },
        }),
    );

    if (!application) {
      throw new NotFoundException('Draft application not found');
    }

    await this.lendingConstraints.assertCanSubmitDraftApplication(borrowerUserId);
    await this.lendingConstraints.assertCanEngageWithLender(
      borrowerUserId,
      application.orgId,
    );

    const documents = await this.applicationDocuments.summarizeForApplication(
      application.orgId,
      borrowerUserId,
      application.id,
    );
    this.applicationDocuments.assertDocumentsComplete(documents);

    const updated = await this.prisma.withUserContext(
      borrowerUserId,
      application.orgId,
      async (tx) =>
        tx.loanApplication.update({
          where: { id },
          data: { status: LoanApplicationStatus.SUBMITTED },
          include: { organisation: true, borrowerUser: true },
        }),
    );

    const detail = this.mapDetail(this.toApplicationRow(updated), documents);

    void this.notificationDispatch.notifyApplicationSubmitted({
      orgId: application.orgId,
      applicationId: application.id,
      borrowerName: detail.borrowerName,
      principalCents: application.principalCents,
    });

    return detail;
  }

  async listForBorrower(
    borrowerUserId: string,
    query: ListLoanApplicationsQuery,
  ): Promise<PaginatedLoanApplicationsDto> {
    const skip = (query.page - 1) * query.limit;

    return this.prisma.withUserContext(borrowerUserId, null, async (tx) => {
      const where = {
        borrowerUserId,
        ...(query.status ? { status: query.status } : {}),
      };

      const [total, rows] = await Promise.all([
        tx.loanApplication.count({ where }),
        tx.loanApplication.findMany({
          where,
          include: { organisation: true, borrowerUser: true },
          orderBy: { createdAt: 'desc' },
          skip,
          take: query.limit,
        }),
      ]);

      return this.paginate(rows.map((row) => this.toApplicationRow(row)), query, total);
    });
  }

  async getForBorrower(
    borrowerUserId: string,
    id: string,
  ): Promise<LoanApplicationDetailDto> {
    return this.prisma.withUserContext(borrowerUserId, null, async (tx) => {
      const row = await tx.loanApplication.findFirst({
        where: { id, borrowerUserId },
        include: { organisation: true, borrowerUser: true },
      });

      if (!row) {
        throw new NotFoundException('Application not found');
      }

      return this.mapDetail(
        this.toApplicationRow(row),
        await this.applicationDocuments.summarizeForApplication(
          row.orgId,
          borrowerUserId,
          row.id,
        ),
      );
    });
  }

  async withdraw(borrowerUserId: string, id: string): Promise<LoanApplicationDetailDto> {
    return this.prisma.withUserContext(borrowerUserId, null, async (tx) => {
      const row = await tx.loanApplication.findFirst({
        where: {
          id,
          borrowerUserId,
          status: { in: [LoanApplicationStatus.DRAFT, LoanApplicationStatus.SUBMITTED] },
        },
        include: { organisation: true, borrowerUser: true },
      });

      if (!row) {
        throw new NotFoundException('Open application not found');
      }

      const updated = await tx.loanApplication.update({
        where: { id },
        data: { status: LoanApplicationStatus.WITHDRAWN },
        include: { organisation: true, borrowerUser: true },
      });

      return this.mapDetail(
        this.toApplicationRow(updated),
        await this.applicationDocuments.summarizeForApplication(
          updated.orgId,
          borrowerUserId,
          updated.id,
        ),
      );
    });
  }

  async listForLender(
    orgId: string,
    userId: string,
    query: ListLoanApplicationsQuery,
  ): Promise<PaginatedLoanApplicationsDto> {
    const skip = (query.page - 1) * query.limit;

    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const where = {
        orgId,
        ...(query.status
          ? { status: query.status }
          : { status: { not: LoanApplicationStatus.DRAFT } }),
      };

      const [total, rows] = await Promise.all([
        tx.loanApplication.count({ where }),
        tx.loanApplication.findMany({
          where,
          include: { organisation: true },
          orderBy: { createdAt: 'desc' },
          skip,
          take: query.limit,
        }),
      ]);

      const borrowerNames = await this.resolveBorrowerNames(
        rows.map((row) => row.borrowerUserId),
      );

      return this.paginate(
        rows.map((row) => this.toApplicationRow(row, borrowerNames)),
        query,
        total,
      );
    });
  }

  async getForLender(
    orgId: string,
    userId: string,
    id: string,
  ): Promise<LoanApplicationDetailDto> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const row = await tx.loanApplication.findFirst({
        where: { id, orgId },
        include: { organisation: true },
      });

      if (!row) {
        throw new NotFoundException('Application not found');
      }

      if (row.status === LoanApplicationStatus.DRAFT) {
        throw new NotFoundException('Application not found');
      }

      const borrowerNames = await this.resolveBorrowerNames([row.borrowerUserId]);
      return this.mapDetail(
        this.toApplicationRow(row, borrowerNames),
        await this.applicationDocuments.summarizeForApplication(orgId, userId, row.id),
      );
    });
  }

  async getLatestCreditCheckForLender(
    orgId: string,
    userId: string,
    id: string,
  ): Promise<ApplicationCreditCheckDto | null> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      await this.assertApplicationVisibleToLender(tx, orgId, id);
      const row = await tx.applicationCreditPull.findFirst({
        where: { orgId, applicationId: id },
        orderBy: { pulledAt: 'desc' },
      });
      return row ? this.mapCreditCheck(row) : null;
    });
  }

  async triggerCreditCheckForLender(
    orgId: string,
    userId: string,
    id: string,
    input: TriggerApplicationCreditCheckInput,
  ): Promise<ApplicationCreditCheckDto> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const application = await tx.loanApplication.findFirst({
        where: {
          id,
          orgId,
          status: { in: [LoanApplicationStatus.SUBMITTED, LoanApplicationStatus.APPROVED] },
        },
        include: { organisation: true, borrowerUser: true },
      });

      if (!application) {
        throw new NotFoundException('Application not found');
      }

      if (!input.forceRefresh) {
        const existing = await tx.applicationCreditPull.findFirst({
          where: { applicationId: id, orgId, status: 'SUCCESS' },
          orderBy: { pulledAt: 'desc' },
        });
        if (existing) {
          return this.mapCreditCheck(existing);
        }
      }

      const borrowerUser = await this.prisma.withAuthLookup(async (authTx) =>
        authTx.user.findUnique({
          where: { id: application.borrowerUserId },
          include: { borrowerAccount: true },
        }),
      );

      if (!borrowerUser) {
        throw new NotFoundException('Borrower account not found');
      }

      const consent = parseApplicationConsentRecord(application.consentRecord);
      if (!consent?.creditChecks) {
        throw new BadRequestException(
          'Cannot pull credit data without explicit borrower credit-check consent',
        );
      }

      const idNumber = borrowerUser.idNumber ?? borrowerUser.borrowerAccount?.idNumber;
      if (!idNumber) {
        throw new BadRequestException('Borrower profile is missing an ID number');
      }

      const pull = await this.creditData.pullReport({
        idNumber,
        fullName: borrowerUser.name,
        purpose: `Loan application ${application.id}`,
        reference: application.id,
      });

      const created = await tx.applicationCreditPull.create({
        data: {
          orgId,
          applicationId: application.id,
          borrowerUserId: application.borrowerUserId,
          provider: pull.provider,
          status: pull.status,
          score: pull.score,
          summary: pull.summary,
          bureauSources: pull.bureauSources as unknown as Prisma.InputJsonValue,
          requestPayload: pull.requestPayload as unknown as Prisma.InputJsonValue,
          rawResponse: pull.rawResponse as unknown as Prisma.InputJsonValue,
          pulledByUserId: userId,
        },
      });

      await this.auditService.record(tx, {
        orgId,
        userId,
        action: 'application.credit_check_pulled',
        entityType: 'LOAN_APPLICATION',
        entityId: id,
        after: {
          provider: created.provider,
          status: created.status,
          score: created.score,
          pulledAt: created.pulledAt.toISOString(),
        },
      });

      return this.mapCreditCheck(created);
    });
  }

  async saveReviewChecklist(
    orgId: string,
    userId: string,
    id: string,
    input: ApplicationReviewChecklist,
  ): Promise<LoanApplicationDetailDto> {
    const parsed = applicationReviewChecklistSchema.parse(input);

    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const row = await tx.loanApplication.findFirst({
        where: { id, orgId, status: LoanApplicationStatus.SUBMITTED },
        include: { organisation: true },
      });

      if (!row) {
        throw new NotFoundException('Pending application not found');
      }

      const updated = await tx.loanApplication.update({
        where: { id },
        data: { reviewChecklist: parsed },
        include: { organisation: true },
      });

      await this.auditService.record(tx, {
        orgId,
        userId,
        action: 'application.review_checklist_updated',
        entityType: 'LOAN_APPLICATION',
        entityId: id,
        after: parsed,
      });

      const borrowerNames = await this.resolveBorrowerNames([updated.borrowerUserId]);
      return this.mapDetail(
        this.toApplicationRow(updated, borrowerNames),
        await this.applicationDocuments.summarizeForApplication(orgId, userId, id),
      );
    });
  }

  async reject(
    orgId: string,
    userId: string,
    id: string,
    input: RejectLoanApplicationInput,
  ): Promise<LoanApplicationDetailDto> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const row = await tx.loanApplication.findFirst({
        where: { id, orgId, status: LoanApplicationStatus.SUBMITTED },
        include: { organisation: true },
      });

      if (!row) {
        throw new NotFoundException('Pending application not found');
      }

      const checklist = parseApplicationReviewChecklist(row.reviewChecklist);
      if (!isApplicationReviewChecklistComplete(checklist)) {
        throw new BadRequestException(
          'Complete the application review checklist before rejecting',
        );
      }

      const updated = await tx.loanApplication.update({
        where: { id },
        data: {
          status: LoanApplicationStatus.REJECTED,
          lenderNotes: input.lenderNotes.trim(),
          reviewedByUserId: userId,
          reviewedAt: new Date(),
        },
        include: { organisation: true },
      });

      await this.auditService.record(tx, {
        orgId,
        userId,
        action: 'application.rejected',
        entityType: 'LOAN_APPLICATION',
        entityId: id,
        before: { status: LoanApplicationStatus.SUBMITTED },
        after: {
          status: LoanApplicationStatus.REJECTED,
          lenderNotes: input.lenderNotes.trim(),
        },
      });

      const borrowerNames = await this.resolveBorrowerNames([updated.borrowerUserId]);
      const detail = this.mapDetail(
        this.toApplicationRow(updated, borrowerNames),
        await this.applicationDocuments.summarizeForApplication(orgId, userId, id),
      );

      void this.notificationDispatch.notifyApplicationRejected({
        orgId,
        applicationId: id,
        borrowerUserId: updated.borrowerUserId,
        organisationName: updated.organisation.name,
        principalCents: updated.principalCents,
        lenderNotes: input.lenderNotes.trim(),
      });

      return detail;
    });
  }

  async approve(
    orgId: string,
    userId: string,
    id: string,
    input: ApproveLoanApplicationInput,
  ): Promise<ApproveLoanApplicationResultDto> {
    assertAnnualRateWithinNcaCap(input.annualRate);

    const platformUser = await this.loadBorrowerPlatformUser(id, orgId, userId);

    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const application = await tx.loanApplication.findFirst({
        where: { id, orgId, status: LoanApplicationStatus.SUBMITTED },
        include: { organisation: true },
      });

      if (!application) {
        throw new NotFoundException('Pending application not found');
      }

      const checklist = parseApplicationReviewChecklist(application.reviewChecklist);
      if (!isApplicationReviewChecklistComplete(checklist)) {
        throw new BadRequestException(
          'Complete the application review checklist before approving',
        );
      }

      const borrowerRecord = await this.ensureBorrowerRecord(
        tx,
        orgId,
        application.borrowerUserId,
        platformUser,
      );

      const loan = await tx.loan.create({
        data: {
          orgId,
          borrowerId: borrowerRecord.id,
          createdByUserId: userId,
          principalCents: application.principalCents,
          interestRate: input.annualRate,
          interestType: application.interestType,
          termPeriods: application.termPeriods,
          frequency: application.frequency,
          startDate: application.startDate,
          status: LoanStatus.DRAFT,
        },
      });

      await this.scheduleService.persistScheduleForLoan(
        loan.id,
        orgId,
        userId,
        {
          principalCents: application.principalCents,
          annualRate: input.annualRate,
          interestType: application.interestType,
          termPeriods: application.termPeriods,
          frequency: application.frequency,
          startDate: application.startDate,
        },
        tx,
      );

      const updated = await tx.loanApplication.update({
        where: { id: application.id },
        data: {
          status: LoanApplicationStatus.APPROVED,
          borrowerId: borrowerRecord.id,
          loanId: loan.id,
          lenderNotes: input.lenderNotes?.trim() || null,
          reviewedByUserId: userId,
          reviewedAt: new Date(),
        },
        include: { organisation: true },
      });

      await this.auditService.record(tx, {
        orgId,
        userId,
        action: 'application.approved',
        entityType: 'LOAN_APPLICATION',
        entityId: application.id,
        before: { status: LoanApplicationStatus.SUBMITTED },
        after: {
          status: LoanApplicationStatus.APPROVED,
          loanId: loan.id,
          borrowerId: borrowerRecord.id,
          annualRate: input.annualRate,
        },
      });

      const borrowerNames = await this.resolveBorrowerNames([updated.borrowerUserId]);
      const detail = this.mapDetail(
        this.toApplicationRow(updated, borrowerNames),
        await this.applicationDocuments.summarizeForApplication(orgId, userId, id),
      );

      void this.notificationDispatch.notifyApplicationApproved({
        orgId,
        applicationId: application.id,
        borrowerUserId: application.borrowerUserId,
        organisationName: application.organisation.name,
        principalCents: application.principalCents,
      });

      return {
        application: detail,
        loanId: loan.id,
        borrowerId: borrowerRecord.id,
      };
    });
  }

  private async loadBorrowerPlatformUser(
    applicationId: string,
    orgId: string,
    userId: string,
  ) {
    const application = await this.prisma.withOrgContext(orgId, userId, async (tx) =>
      tx.loanApplication.findFirst({
        where: { id: applicationId, orgId, status: LoanApplicationStatus.SUBMITTED },
        select: { borrowerUserId: true },
      }),
    );

    if (!application) {
      throw new NotFoundException('Pending application not found');
    }

    return this.prisma.withAuthLookup(async (tx) =>
      tx.user.findUnique({
        where: { id: application.borrowerUserId },
        include: { borrowerAccount: true },
      }),
    );
  }

  private async resolveBorrowerNames(userIds: string[]): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) {
      return new Map();
    }

    const users = await this.prisma.withAuthLookup(async (tx) =>
      tx.user.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true, name: true },
      }),
    );

    return new Map(users.map((user) => [user.id, user.name]));
  }

  private toApplicationRow(
    row: ApplicationDbRow,
    borrowerNames?: Map<string, string>,
  ): ApplicationRow {
    return {
      ...row,
      borrowerName:
        row.borrowerUser?.name ?? borrowerNames?.get(row.borrowerUserId) ?? 'Borrower',
    };
  }

  private async ensureBorrowerRecord(
    tx: PrismaTx,
    orgId: string,
    borrowerUserId: string,
    platformUser: Awaited<ReturnType<LoanApplicationsService['loadBorrowerPlatformUser']>>,
  ) {
    const existing = await tx.borrower.findFirst({
      where: { orgId, platformUserId: borrowerUserId, deletedAt: null },
    });

    if (existing) {
      return existing;
    }

    if (!platformUser?.borrowerAccount) {
      throw new BadRequestException('Borrower profile is incomplete');
    }

    const idNumber =
      platformUser.borrowerAccount.idNumber?.trim() ||
      `PLATFORM-${borrowerUserId.replace(/-/g, '').slice(0, 12).toUpperCase()}`;

    return tx.borrower.create({
      data: {
        orgId,
        platformUserId: borrowerUserId,
        fullName: platformUser.name,
        idNumber,
        phone: platformUser.borrowerAccount.phone,
        email: platformUser.email,
      },
    });
  }

  private paginate(
    rows: ApplicationRow[],
    query: ListLoanApplicationsQuery,
    total: number,
  ): PaginatedLoanApplicationsDto {
    return {
      items: rows.map((row) => this.mapListItem(row)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  private mapListItem(row: ApplicationRow): LoanApplicationListItemDto {
    return {
      id: row.id,
      orgId: row.orgId,
      organisationName: row.organisation.name,
      borrowerUserId: row.borrowerUserId,
      borrowerName: row.borrowerName,
      principalFormatted: formatCents(row.principalCents),
      status: row.status,
      purpose: row.purpose,
      startDate: row.startDate.toISOString().slice(0, 10),
      termPeriods: row.termPeriods,
      frequency: row.frequency,
      interestType: row.interestType,
      loanId: row.loanId,
      submittedAt: row.createdAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
    };
  }

  private async resolveBorrowerProfileBankDetails(
    tx: PrismaTx,
    borrowerUserId: string,
  ): Promise<ApplicationBankDetailsDto> {
    const wallet = await tx.wallet.findFirst({
      where: { ownerUserId: borrowerUserId },
      include: { bankAccount: true },
    });

    const bankAccount = wallet?.bankAccount;
    if (!bankAccount) {
      throw new BadRequestException(
        'Link a bank account in your profile before applying for a loan',
      );
    }

    return {
      accountHolder: bankAccount.accountHolder,
      bankName: bankAccount.bankName,
      branchCode: bankAccount.branchCode,
      accountNumber: bankAccount.accountNumber,
    };
  }

  private mapBankDetails(row: ApplicationRow): ApplicationBankDetailsDto | null {
    if (
      !row.bankAccountHolder ||
      !row.bankName ||
      !row.bankBranchCode ||
      !row.bankAccountNumber
    ) {
      return null;
    }

    return {
      accountHolder: row.bankAccountHolder,
      bankName: row.bankName,
      branchCode: row.bankBranchCode,
      accountNumber: row.bankAccountNumber,
    };
  }

  private mapDetail(
    row: ApplicationRow,
    documents: ApplicationDocumentsSummaryDto,
  ): LoanApplicationDetailDto {
    const checklist = parseApplicationReviewChecklist(row.reviewChecklist);

    return {
      ...this.mapListItem(row),
      lenderNotes: row.lenderNotes,
      borrowerId: row.borrowerId,
      updatedAt: row.updatedAt.toISOString(),
      bankDetails: this.mapBankDetails(row),
      documents,
      reviewChecklist: buildApplicationReviewChecklistStatus(checklist),
      consentRecord: parseApplicationConsentRecord(row.consentRecord),
    };
  }

  private async assertApplicationVisibleToLender(
    tx: PrismaTx,
    orgId: string,
    id: string,
  ): Promise<void> {
    const row = await tx.loanApplication.findFirst({
      where: { id, orgId },
      select: { id: true, status: true },
    });
    if (!row || row.status === LoanApplicationStatus.DRAFT) {
      throw new NotFoundException('Application not found');
    }
  }

  private mapCreditCheck(row: {
    id: string;
    applicationId: string;
    provider: string;
    status: string;
    score: number | null;
    summary: string | null;
    bureauSources: unknown;
    pulledByUserId: string;
    pulledAt: Date;
    createdAt: Date;
  }): ApplicationCreditCheckDto {
    return {
      id: row.id,
      applicationId: row.applicationId,
      provider: row.provider,
      status: row.status,
      score: row.score,
      summary: row.summary,
      bureauSources: Array.isArray(row.bureauSources)
        ? row.bureauSources.filter((s): s is string => typeof s === 'string')
        : [],
      pulledByUserId: row.pulledByUserId,
      pulledAt: row.pulledAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
