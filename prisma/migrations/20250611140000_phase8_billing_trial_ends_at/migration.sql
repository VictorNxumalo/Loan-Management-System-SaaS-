-- Phase 8: billing trial end date on organisations

ALTER TABLE "organisations" ADD COLUMN "trial_ends_at" TIMESTAMP(3);

-- Existing trial orgs: trial ends 14 days after signup
UPDATE "organisations"
SET "trial_ends_at" = "created_at" + INTERVAL '14 days'
WHERE "plan_status" = 'TRIAL' AND "trial_ends_at" IS NULL;
