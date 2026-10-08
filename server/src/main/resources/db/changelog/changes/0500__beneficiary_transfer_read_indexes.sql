-- Colonnes vérifiées contre PayoutTransfer et les migrations 0494/0496.
-- Baitly : lecture paginée du destinataire, sans élargir les policies RLS.
CREATE INDEX idx_payout_transfers_recipient_user ON payout_transfers(beneficiary_user_id,created_at DESC,id DESC)
    WHERE beneficiary_user_id IS NOT NULL;
CREATE INDEX idx_payout_transfers_recipient_org ON payout_transfers(beneficiary_organization_id,created_at DESC,id DESC)
    WHERE beneficiary_organization_id IS NOT NULL;
