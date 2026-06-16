-- Borrower consent evidence on loan applications (POPIA / NCA)
ALTER TABLE "loan_applications" ADD COLUMN "consent_record" JSONB;
