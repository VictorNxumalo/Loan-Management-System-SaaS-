-- Lenders may read the org's borrower connections and the profiles of
-- borrowers connected to their org (needed for platform borrower search
-- and auto-filling new borrower records). Policies are permissive (OR'd),
-- so borrower self-access policies remain unchanged.

CREATE POLICY "borrower_lender_links_org_select" ON "borrower_lender_links"
  FOR SELECT USING (
    org_id = app_current_org_id()
    OR current_setting('app.auth_lookup', true) = 'true'
  );

CREATE POLICY "borrower_accounts_connected_org_select" ON "borrower_accounts"
  FOR SELECT USING (
    current_setting('app.auth_lookup', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM borrower_lender_links bll
      WHERE bll.borrower_user_id = borrower_accounts.user_id
        AND bll.org_id = app_current_org_id()
    )
  );
