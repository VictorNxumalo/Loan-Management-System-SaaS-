-- Enum values must be committed before use (separate migration from column changes)

ALTER TYPE "LoanApplicationStatus" ADD VALUE IF NOT EXISTS 'DRAFT';

ALTER TYPE "DocumentEntityType" ADD VALUE IF NOT EXISTS 'LOAN_APPLICATION';
