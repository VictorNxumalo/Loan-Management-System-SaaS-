CREATE TABLE "payment_submissions" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "submitted_by_user_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "payment_date" DATE NOT NULL,
    "reference_note" TEXT,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
    "external_reference" TEXT,
    "status" "PaymentSubmissionStatus" NOT NULL DEFAULT 'AWAITING_PROOF',
    "repayment_id" UUID,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_submissions_repayment_id_key" ON "payment_submissions"("repayment_id");
CREATE INDEX "payment_submissions_org_id_status_idx" ON "payment_submissions"("org_id", "status");
CREATE INDEX "payment_submissions_loan_id_idx" ON "payment_submissions"("loan_id");
CREATE INDEX "payment_submissions_submitted_by_user_id_idx" ON "payment_submissions"("submitted_by_user_id");

ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_loan_id_fkey"
  FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_submitted_by_user_id_fkey"
  FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_repayment_id_fkey"
  FOREIGN KEY ("repayment_id") REFERENCES "repayments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_submissions" FORCE ROW LEVEL SECURITY;

CREATE POLICY "payment_submissions_borrower_select" ON "payment_submissions"
  FOR SELECT USING (submitted_by_user_id = app_current_user_id());

CREATE POLICY "payment_submissions_borrower_insert" ON "payment_submissions"
  FOR INSERT WITH CHECK (submitted_by_user_id = app_current_user_id());

CREATE POLICY "payment_submissions_borrower_update" ON "payment_submissions"
  FOR UPDATE USING (
    submitted_by_user_id = app_current_user_id()
    AND status = 'AWAITING_PROOF'
  );

CREATE POLICY "payment_submissions_org" ON "payment_submissions"
  USING (org_id = app_current_org_id())
  WITH CHECK (org_id = app_current_org_id());
