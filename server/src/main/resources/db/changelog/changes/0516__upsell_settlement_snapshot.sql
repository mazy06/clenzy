-- Baitly : noms vérifiés contre UpsellOrder et le changeset 0202.
-- Aucun recalcul rétroactif : les anciennes ventes sans répartition restent à rapprocher.
ALTER TABLE upsell_orders ADD COLUMN IF NOT EXISTS concierge_amount NUMERIC(12,2);
ALTER TABLE upsell_orders ADD COLUMN IF NOT EXISTS beneficiary_owner_id BIGINT;
ALTER TABLE upsell_orders ALTER COLUMN reservation_id DROP NOT NULL;
