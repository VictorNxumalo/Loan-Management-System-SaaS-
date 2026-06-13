-- Allow connected borrowers to read/update lender org wallets during in-app repayments
-- (org context must be set to the lender org via app.current_org_id)

CREATE POLICY "wallets_borrower_repay_lender_select" ON "wallets"
  FOR SELECT USING (
    owner_type = 'ORGANISATION'
    AND owner_org_id = app_current_org_id()
    AND EXISTS (
      SELECT 1 FROM "borrower_lender_links" bll
      WHERE bll.borrower_user_id = app_current_user_id()
        AND bll.org_id = "wallets"."owner_org_id"
    )
  );

CREATE POLICY "wallets_borrower_repay_lender_update" ON "wallets"
  FOR UPDATE USING (
    owner_type = 'ORGANISATION'
    AND owner_org_id = app_current_org_id()
    AND EXISTS (
      SELECT 1 FROM "borrower_lender_links" bll
      WHERE bll.borrower_user_id = app_current_user_id()
        AND bll.org_id = "wallets"."owner_org_id"
    )
  )
  WITH CHECK (
    owner_type = 'ORGANISATION'
    AND owner_org_id = app_current_org_id()
    AND EXISTS (
      SELECT 1 FROM "borrower_lender_links" bll
      WHERE bll.borrower_user_id = app_current_user_id()
        AND bll.org_id = "wallets"."owner_org_id"
    )
  );

-- Borrower-initiated repayment ledger entries on the lender org wallet
CREATE POLICY "wallet_transactions_borrower_repay_lender" ON "wallet_transactions"
  FOR INSERT WITH CHECK (
    org_id = app_current_org_id()
    AND EXISTS (
      SELECT 1 FROM "borrower_lender_links" bll
      WHERE bll.borrower_user_id = app_current_user_id()
        AND bll.org_id = "wallet_transactions"."org_id"
    )
  );
