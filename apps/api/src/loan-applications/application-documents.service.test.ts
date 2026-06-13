import { ApplicationDocumentType } from '@lms/types';
import { describe, expect, it } from 'vitest';
import { ApplicationDocumentsService } from './application-documents.service';

describe('ApplicationDocumentsService.buildSummary', () => {
  const service = new ApplicationDocumentsService({} as never, {} as never);

  it('requires profile ID copy linked to the application', () => {
    const summary = service.buildSummary([]);

    expect(summary.isComplete).toBe(false);
    expect(summary.requirements.find((r) => r.documentType === 'ID_COPY')?.met).toBe(false);
  });

  it('marks complete when profile ID is linked', () => {
    const summary = service.buildSummary([
      {
        id: '1',
        orgId: 'org',
        entityType: 'LOAN_APPLICATION',
        entityId: 'app',
        documentType: ApplicationDocumentType.ID_COPY,
        documentTypeLabel: 'SA ID document (from profile)',
        originalFilename: 'id.pdf',
        uploadedByName: 'Borrower',
        createdAt: new Date().toISOString(),
      },
    ]);

    expect(summary.isComplete).toBe(true);
  });
});
