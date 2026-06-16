CREATE TABLE "application_credit_pulls" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "borrower_user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "score" INTEGER,
    "summary" TEXT,
    "bureau_sources" JSONB,
    "request_payload" JSONB,
    "raw_response" JSONB,
    "pulled_by_user_id" UUID NOT NULL,
    "pulled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_credit_pulls_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "application_credit_pulls_application_id_pulled_at_idx"
  ON "application_credit_pulls"("application_id", "pulled_at");
CREATE INDEX "application_credit_pulls_org_id_status_idx"
  ON "application_credit_pulls"("org_id", "status");

ALTER TABLE "application_credit_pulls" ADD CONSTRAINT "application_credit_pulls_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_credit_pulls" ADD CONSTRAINT "application_credit_pulls_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_credit_pulls" ADD CONSTRAINT "application_credit_pulls_borrower_user_id_fkey"
  FOREIGN KEY ("borrower_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_credit_pulls" ADD CONSTRAINT "application_credit_pulls_pulled_by_user_id_fkey"
  FOREIGN KEY ("pulled_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "application_credit_pulls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "application_credit_pulls" FORCE ROW LEVEL SECURITY;

CREATE POLICY "application_credit_pulls_org" ON "application_credit_pulls"
  USING (org_id = app_current_org_id())
  WITH CHECK (org_id = app_current_org_id());
