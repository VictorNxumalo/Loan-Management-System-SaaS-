-- Borrowers can read organisations they are connected to (even if not publicly listed)
DROP POLICY IF EXISTS "organisations_select" ON "organisations";
CREATE POLICY "organisations_select" ON "organisations"
  FOR SELECT USING (
    id = app_current_org_id()
    OR COALESCE((settings->>'publicListing')::boolean, false) = true
    OR EXISTS (
      SELECT 1 FROM borrower_lender_links bll
      WHERE bll.org_id = organisations.id
        AND bll.borrower_user_id = app_current_user_id()
    )
  );
