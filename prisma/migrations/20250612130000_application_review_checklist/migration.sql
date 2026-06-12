-- Lender application review checklist (JSON answers per item)
ALTER TABLE "loan_applications" ADD COLUMN "review_checklist" JSONB;
