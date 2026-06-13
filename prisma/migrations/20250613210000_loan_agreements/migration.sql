-- CreateEnum
CREATE TYPE "LoanAgreementStatus" AS ENUM ('PENDING_SIGNATURE', 'SIGNED');

-- CreateTable
CREATE TABLE "loan_agreements" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "status" "LoanAgreementStatus" NOT NULL DEFAULT 'PENDING_SIGNATURE',
    "annual_rate_percent" DECIMAL(8,4) NOT NULL,
    "generated_html" TEXT NOT NULL,
    "signed_html" TEXT,
    "signature" JSONB,
    "generated_by_user_id" UUID NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signed_by_user_id" UUID,
    "signed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loan_agreements_loan_id_key" ON "loan_agreements"("loan_id");

-- CreateIndex
CREATE INDEX "loan_agreements_org_id_idx" ON "loan_agreements"("org_id");

-- CreateIndex
CREATE INDEX "loan_agreements_status_idx" ON "loan_agreements"("status");

-- AddForeignKey
ALTER TABLE "loan_agreements" ADD CONSTRAINT "loan_agreements_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_agreements" ADD CONSTRAINT "loan_agreements_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_agreements" ADD CONSTRAINT "loan_agreements_generated_by_user_id_fkey" FOREIGN KEY ("generated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_agreements" ADD CONSTRAINT "loan_agreements_signed_by_user_id_fkey" FOREIGN KEY ("signed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
