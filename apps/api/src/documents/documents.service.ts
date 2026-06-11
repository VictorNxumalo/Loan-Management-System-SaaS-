import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  DocumentDownloadUrlDto,
  DocumentDto,
  DocumentUploadUrlDto,
  ListDocumentsQuery,
  RequestDocumentUploadInput,
} from '@lms/types';
import {
  BORROWER_DOCUMENT_LABELS,
  BORROWER_DOCUMENT_TYPES,
  DocumentEntityType,
  LOAN_DOCUMENT_LABELS,
  LOAN_DOCUMENT_TYPES,
} from '@lms/types';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseStorageService } from '../storage/supabase-storage.service';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
  ) {}

  async list(
    orgId: string,
    userId: string,
    query: ListDocumentsQuery,
  ): Promise<DocumentDto[]> {
    await this.assertEntityAccess(orgId, userId, query.entityType, query.entityId);

    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const rows = await tx.document.findMany({
        where: {
          orgId,
          entityType: query.entityType,
          entityId: query.entityId,
          deletedAt: null,
        },
        include: { uploadedBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      });

      return rows.map((row) => this.mapRow(row));
    });
  }

  async requestUploadUrl(
    orgId: string,
    userId: string,
    input: RequestDocumentUploadInput,
  ): Promise<DocumentUploadUrlDto> {
    this.validateDocumentType(input.entityType, input.documentType);
    await this.assertEntityAccess(orgId, userId, input.entityType, input.entityId);

    const storagePath = this.buildStoragePath(
      orgId,
      input.entityType,
      input.entityId,
      input.documentType,
      input.filename,
    );

    const signed = await this.storage.createSignedUploadUrl(storagePath);

    const document = await this.prisma.withOrgContext(orgId, userId, async (tx) =>
      tx.document.create({
        data: {
          orgId,
          entityType: input.entityType,
          entityId: input.entityId,
          documentType: input.documentType,
          storagePath,
          originalFilename: input.filename,
          uploadedByUserId: userId,
        },
        include: { uploadedBy: { select: { name: true } } },
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

  async getDownloadUrl(
    orgId: string,
    userId: string,
    documentId: string,
  ): Promise<DocumentDownloadUrlDto> {
    const document = await this.prisma.withOrgContext(orgId, userId, async (tx) =>
      tx.document.findFirst({
        where: { id: documentId, orgId, deletedAt: null },
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

  async softDelete(orgId: string, userId: string, documentId: string) {
    const document = await this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const row = await tx.document.findFirst({
        where: { id: documentId, orgId, deletedAt: null },
      });

      if (!row) {
        throw new NotFoundException('Document not found');
      }

      await tx.document.update({
        where: { id: documentId },
        data: { deletedAt: new Date() },
      });

      return row;
    });

    await this.storage.removeObject(document.storagePath);

    return { message: 'Document deleted' };
  }

  private validateDocumentType(entityType: string, documentType: string) {
    if (entityType === DocumentEntityType.BORROWER) {
      if (!(BORROWER_DOCUMENT_TYPES as readonly string[]).includes(documentType)) {
        throw new BadRequestException('Invalid borrower document type');
      }
      return;
    }

    if (entityType === DocumentEntityType.LOAN) {
      if (!(LOAN_DOCUMENT_TYPES as readonly string[]).includes(documentType)) {
        throw new BadRequestException('Invalid loan document type');
      }
      return;
    }

    throw new BadRequestException('Invalid entity type');
  }

  private async assertEntityAccess(
    orgId: string,
    userId: string,
    entityType: string,
    entityId: string,
  ) {
    await this.prisma.withOrgContext(orgId, userId, async (tx) => {
      if (entityType === DocumentEntityType.BORROWER) {
        const borrower = await tx.borrower.findFirst({
          where: { id: entityId, orgId, deletedAt: null },
        });
        if (!borrower) {
          throw new NotFoundException('Borrower not found');
        }
        return;
      }

      if (entityType === DocumentEntityType.LOAN) {
        const loan = await tx.loan.findFirst({
          where: { id: entityId, orgId, deletedAt: null },
        });
        if (!loan) {
          throw new NotFoundException('Loan not found');
        }
        return;
      }

      throw new BadRequestException('Invalid entity type');
    });
  }

  private buildStoragePath(
    orgId: string,
    entityType: string,
    entityId: string,
    documentType: string,
    filename: string,
  ): string {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    const folder =
      entityType === DocumentEntityType.BORROWER
        ? `borrowers/${entityId}`
        : `loans/${entityId}`;

    return `${orgId}/${folder}/${documentType}/${randomUUID()}-${safeName}`;
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
      row.entityType === DocumentEntityType.BORROWER
        ? BORROWER_DOCUMENT_LABELS[
            row.documentType as keyof typeof BORROWER_DOCUMENT_LABELS
          ]
        : LOAN_DOCUMENT_LABELS[row.documentType as keyof typeof LOAN_DOCUMENT_LABELS];

    return {
      id: row.id,
      orgId: row.orgId,
      entityType: row.entityType,
      entityId: row.entityId,
      documentType: row.documentType,
      documentTypeLabel: label ?? row.documentType,
      originalFilename: row.originalFilename,
      uploadedByName: row.uploadedBy.name,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
