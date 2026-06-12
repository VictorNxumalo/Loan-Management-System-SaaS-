import { ApplicationDocumentType } from '@lms/types';
import { describe, expect, it } from 'vitest';
import { ApplicationDocumentsService } from './application-documents.service';

describe('ApplicationDocumentsService.buildSummary', () => {
  const service = new ApplicationDocumentsService({} as never, {} as never);

  it('requires ID copy and at least one bank statement', () => {
    const summary = service.buildSummary([
      {
        id: '1',
        orgId: 'org',
        entityType: 'LOAN_APPLICATION',
        entityId: 'app',
        documentType: ApplicationDocumentType.ID_COPY,
        documentTypeLabel: 'SA ID document',
        originalFilename: 'id.pdf',
        uploadedByName: 'Borrower',
        createdAt: new Date().toISOString(),
      },
    ]);

    expect(summary.isComplete).toBe(false);
    expect(summary.requirements.find((r) => r.documentType === 'BANK_STATEMENT')?.met).toBe(
      false,
    );
  });

  it('marks complete when minimum documents are present', () => {
    const summary = service.buildSummary([
      {
        id: '1',
        orgId: 'org',
        entityType: 'LOAN_APPLICATION',
        entityId: 'app',
        documentType: ApplicationDocumentType.ID_COPY,
        documentTypeLabel: 'SA ID document',
        originalFilename: 'id.pdf',
        uploadedByName: 'Borrower',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        orgId: 'org',
        entityType: 'LOAN_APPLICATION',
        entityId: 'app',
        documentType: ApplicationDocumentType.BANK_STATEMENT,
        documentTypeLabel: 'Bank statement',
        originalFilename: 'stmt.pdf',
        uploadedByName: 'Borrower',
        createdAt: new Date().toISOString(),
      },
    ]);

    expect(summary.isComplete).toBe(true);
  });
});
