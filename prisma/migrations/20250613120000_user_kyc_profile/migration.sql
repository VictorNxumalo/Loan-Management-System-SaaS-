-- User KYC profile fields and platform ID documents

ALTER TABLE "users" ADD COLUMN "id_number" TEXT;
ALTER TABLE "users" ADD COLUMN "address" TEXT;

CREATE TABLE "user_kyc_documents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "document_type" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_kyc_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_kyc_documents_user_id_document_type_key" ON "user_kyc_documents"("user_id", "document_type");
CREATE INDEX "user_kyc_documents_user_id_idx" ON "user_kyc_documents"("user_id");

ALTER TABLE "user_kyc_documents" ADD CONSTRAINT "user_kyc_documents_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill SA ID from borrower accounts onto platform user record
UPDATE "users" u
SET "id_number" = ba."id_number"
FROM "borrower_accounts" ba
WHERE ba."user_id" = u."id"
  AND ba."id_number" IS NOT NULL
  AND u."id_number" IS NULL;

ALTER TABLE "user_kyc_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_kyc_documents" FORCE ROW LEVEL SECURITY;

CREATE POLICY "user_kyc_documents_owner" ON "user_kyc_documents"
  USING ("user_id" = app_current_user_id())
  WITH CHECK ("user_id" = app_current_user_id());
