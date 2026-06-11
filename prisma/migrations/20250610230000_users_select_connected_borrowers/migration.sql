-- Lenders can read platform borrower profiles linked via applications or connections

DROP POLICY IF EXISTS "users_select" ON "users";

CREATE POLICY "users_select" ON "users"
  FOR SELECT USING (
    org_id = app_current_org_id()
    OR current_setting('app.auth_lookup', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM loan_applications la
      WHERE la.borrower_user_id = users.id
        AND la.org_id = app_current_org_id()
    )
    OR EXISTS (
      SELECT 1 FROM borrower_lender_links bll
      WHERE bll.borrower_user_id = users.id
        AND bll.org_id = app_current_org_id()
    )
  );
