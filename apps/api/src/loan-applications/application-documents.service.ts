import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ApplicationDocumentsSummaryDto,
  DocumentDownloadUrlDto,
  DocumentDto,
  DocumentUploadUrlDto,
  RequestApplicationDocumentUploadInput,
} from '@lms/types';
import {
  APPLICATION_DOCUMENT_LABELS,
  APPLICATION_DOCUMENT_REQUIREMENTS,
  APPLICATION_DOCUMENT_TYPES,
  ApplicationDocumentType,
  DocumentEntityType,
  LoanApplicationStatus,
} from '@lms/types';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseStorageService } from '../storage/supabase-storage.service';

@Injectable()
export class ApplicationDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
  ) {}

  async listForBorrower(
    borrowerUserId: string,
    applicationId: string,
  ): Promise<DocumentDto[]> {
    const application = await this.loadBorrowerApplication(
      borrowerUserId,
      applicationId,
    );

    return this.listDocuments(application.orgId, borrowerUserId, applicationId);
  }

  async listForLender(
    orgId: string,
    userId: string,
    applicationId: string,
  ): Promise<DocumentDto[]> {
    await this.assertLenderApplication(orgId, userId, applicationId);
    return this.listDocuments(orgId, userId, applicationId);
  }

  async requestUploadUrlForBorrower(
    borrowerUserId: string,
    applicationId: string,
    input: RequestApplicationDocumentUploadInput,
  ): Promise<DocumentUploadUrlDto> {
    const application = await this.loadBorrowerApplication(
      borrowerUserId,
      applicationId,
    );

    if (application.status !== LoanApplicationStatus.DRAFT) {
      throw new BadRequestException(
        'Documents can only be uploaded while the application is a draft',
      );
    }

    this.validateDocumentType(input.documentType);
    await this.assertDocumentCapacity(
      application.orgId,
      borrowerUserId,
      applicationId,
      input.documentType,
    );

    return this.createUpload(
      application.orgId,
      borrowerUserId,
      applicationId,
      input,
    );
  }

  async deleteForBorrower(
    borrowerUserId: string,
    applicationId: string,
    documentId: string,
  ): Promise<{ message: string }> {
    const application = await this.loadBorrowerApplication(
      borrowerUserId,
      applicationId,
    );

    if (application.status !== LoanApplicationStatus.DRAFT) {
      throw new BadRequestException(
        'Documents can only be removed while the application is a draft',
      );
    }

    const document = await this.prisma.withUserContext(
      borrowerUserId,
      application.orgId,
      async (tx) =>
        tx.document.findFirst({
          where: {
            id: documentId,
            orgId: application.orgId,
            entityType: DocumentEntityType.LOAN_APPLICATION,
            entityId: applicationId,
            deletedAt: null,
          },
        }),
    );

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.prisma.withUserContext(
      borrowerUserId,
      application.orgId,
      async (tx) => {
        await tx.document.update({
          where: { id: documentId },
          data: { deletedAt: new Date() },
        });
      },
    );

    await this.storage.removeObject(document.storagePath);

    return { message: 'Document deleted' };
  }

  async getDownloadUrlForBorrower(
    borrowerUserId: string,
    applicationId: string,
    documentId: string,
  ): Promise<DocumentDownloadUrlDto> {
    const application = await this.loadBorrowerApplication(
      borrowerUserId,
      applicationId,
    );

    return this.getDownloadUrl(
      application.orgId,
      borrowerUserId,
      applicationId,
      documentId,
    );
  }

  async getDownloadUrlForLender(
    orgId: string,
    userId: string,
    applicationId: string,
    documentId: string,
  ): Promise<DocumentDownloadUrlDto> {
    await this.assertLenderApplication(orgId, userId, applicationId);
    return this.getDownloadUrl(orgId, userId, applicationId, documentId);
  }

  async summarizeForApplication(
    orgId: string,
    userId: string,
    applicationId: string,
  ): Promise<ApplicationDocumentsSummaryDto> {
    const documents = await this.listDocuments(orgId, userId, applicationId);
    return this.buildSummary(documents);
  }

  assertDocumentsComplete(summary: ApplicationDocumentsSummaryDto): void {
    if (summary.isComplete) {
      return;
    }

    const missing = summary.requirements
      .filter((item) => !item.met)
      .map((item) => `${item.label} (${item.uploaded}/${item.min})`)
      .join(', ');

    throw new BadRequestException(
      `Upload all required documents before submitting: ${missing}`,
    );
  }

  buildSummary(documents: DocumentDto[]): ApplicationDocumentsSummaryDto {
    const counts = new Map<string, number>();
    for (const doc of documents) {
      counts.set(doc.documentType, (counts.get(doc.documentType) ?? 0) + 1);
    }

    const requirements = APPLICATION_DOCUMENT_TYPES.map((documentType) => {
      const rule = APPLICATION_DOCUMENT_REQUIREMENTS[documentType];
      const uploaded = counts.get(documentType) ?? 0;
      return {
        documentType,
        label: rule.label,
        min: rule.min,
        max: rule.max,
        uploaded,
        met: uploaded >= rule.min,
      };
    });

    return {
      requirements,
      isComplete: requirements.every((item) => item.met),
    };
  }

  private async listDocuments(
    orgId: string,
    userId: string,
    applicationId: string,
  ): Promise<DocumentDto[]> {
    const rows = await this.prisma.withUserContext(userId, orgId, async (tx) =>
      tx.document.findMany({
        where: {
          orgId,
          entityType: DocumentEntityType.LOAN_APPLICATION,
          entityId: applicationId,
          deletedAt: null,
        },
        include: { uploadedBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    );

    return rows.map((row) => this.mapRow(row));
  }

  private async createUpload(
    orgId: string,
    userId: string,
    applicationId: string,
    input: RequestApplicationDocumentUploadInput,
  ): Promise<DocumentUploadUrlDto> {
    const storagePath = this.buildStoragePath(
      orgId,
      applicationId,
      input.documentType,
      input.filename,
    );

    const signed = await this.storage.createSignedUploadUrl(storagePath);

    const document = await this.prisma.withUserContext(userId, orgId, async (tx) =>
      tx.document.create({
        data: {
          orgId,
          entityType: DocumentEntityType.LOAN_APPLICATION,
          entityId: applicationId,
          documentType: input.documentType,
          storagePath,
          originalFilename: input.filename,
          uploadedByUserId: userId,
        },
      }),
    );

    return {
      documentId: document.id,
      uploadUrl: signed.signedUrl,
      token: signed.token,
      storagePath,
      expiresInSeconds: this.storage.expirySeconds,
    };
  }

  private async getDownloadUrl(
    orgId: string,
    userId: string,
    applicationId: string,
    documentId: string,
  ): Promise<DocumentDownloadUrlDto> {
    const document = await this.prisma.withUserContext(userId, orgId, async (tx) =>
      tx.document.findFirst({
        where: {
          id: documentId,
          orgId,
          entityType: DocumentEntityType.LOAN_APPLICATION,
          entityId: applicationId,
          deletedAt: null,
        },
      }),
    );

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const downloadUrl = await this.storage.createSignedDownloadUrl(document.storagePath);

    return {
      downloadUrl,
      expiresInSeconds: this.storage.expirySeconds,
      originalFilename: document.originalFilename,
    };
  }

  private async assertDocumentCapacity(
    orgId: string,
    userId: string,
    applicationId: string,
    documentType: string,
  ) {
    const rule =
      APPLICATION_DOCUMENT_REQUIREMENTS[
        documentType as ApplicationDocumentType
      ];
    if (!rule) {
      return;
    }

    const count = await this.prisma.withUserContext(userId, orgId, async (tx) =>
      tx.document.count({
        where: {
          orgId,
          entityType: DocumentEntityType.LOAN_APPLICATION,
          entityId: applicationId,
          documentType,
          deletedAt: null,
        },
      }),
    );

    if (count >= rule.max) {
      throw new BadRequestException(
        `Maximum ${rule.max} file(s) allowed for ${rule.label}`,
      );
    }
  }

  private validateDocumentType(documentType: string) {
    if (!(APPLICATION_DOCUMENT_TYPES as readonly string[]).includes(documentType)) {
      throw new BadRequestException('Invalid application document type');
    }
  }

  private buildStoragePath(
    orgId: string,
    applicationId: string,
    documentType: string,
    filename: string,
  ): string {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    return `${orgId}/applications/${applicationId}/${documentType}/${randomUUID()}-${safeName}`;
  }

  private mapRow(row: {
    id: string;
    orgId: string;
    entityType: string;
    entityId: string;
    documentType: string;
    originalFilename: string;
    createdAt: Date;
    uploadedBy: { name: string };
  }): DocumentDto {
    const label =
      APPLICATION_DOCUMENT_LABELS[
        row.documentType as ApplicationDocumentType
      ] ?? row.documentType;

    return {
      id: row.id,
      orgId: row.orgId,
      entityType: row.entityType,
      entityId: row.entityId,
      documentType: row.documentType,
      documentTypeLabel: label,
      originalFilename: row.originalFilename,
      uploadedByName: row.uploadedBy.name,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async loadBorrowerApplication(borrowerUserId: string, applicationId: string) {
    const application = await this.prisma.withUserContext(
      borrowerUserId,
      null,
      async (tx) =>
        tx.loanApplication.findFirst({
          where: { id: applicationId, borrowerUserId },
        }),
    );

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return application;
  }

  private async assertLenderApplication(
    orgId: string,
    userId: string,
    applicationId: string,
  ) {
    await this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const application = await tx.loanApplication.findFirst({
        where: {
          id: applicationId,
          orgId,
          status: { not: LoanApplicationStatus.DRAFT },
        },
      });

      if (!application) {
        throw new NotFoundException('Application not found');
      }
    });
  }
}
