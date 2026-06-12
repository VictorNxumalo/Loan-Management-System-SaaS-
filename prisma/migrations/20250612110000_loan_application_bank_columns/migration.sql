-- Bank details on applications + DRAFT default + borrower update policy

ALTER TABLE "loan_applications"
  ADD COLUMN IF NOT EXISTS "bank_account_holder" TEXT,
  ADD COLUMN IF NOT EXISTS "bank_name" TEXT,
  ADD COLUMN IF NOT EXISTS "bank_branch_code" TEXT,
  ADD COLUMN IF NOT EXISTS "bank_account_number" TEXT;

ALTER TABLE "loan_applications" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

DROP POLICY IF EXISTS "loan_applications_borrower_update" ON "loan_applications";
CREATE POLICY "loan_applications_borrower_update" ON "loan_applications"
  FOR UPDATE USING (
    borrower_user_id = app_current_user_id()
    AND status IN ('DRAFT', 'SUBMITTED')
  );
