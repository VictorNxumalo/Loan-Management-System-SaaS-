-- Notification dedup keys + borrower read access via user_id

ALTER TABLE "notifications" ADD COLUMN "dedup_key" TEXT;

CREATE UNIQUE INDEX "notifications_user_id_dedup_key_key"
  ON "notifications"("user_id", "dedup_key")
  WHERE "dedup_key" IS NOT NULL;

DROP POLICY IF EXISTS "notifications_tenant" ON "notifications";

CREATE POLICY "notifications_select" ON "notifications"
  FOR SELECT USING (
    user_id = app_current_user_id()
    OR org_id = app_current_org_id()
  );

CREATE POLICY "notifications_insert" ON "notifications"
  FOR INSERT WITH CHECK (
    current_setting('app.auth_lookup', true) = 'true'
  );

CREATE POLICY "notifications_update" ON "notifications"
  FOR UPDATE USING (user_id = app_current_user_id());
