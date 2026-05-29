-- Fix C-NEW-3 (code review pass 2) : ajoute organization_id sur
-- voucher_property_scope pour permettre l'application du Hibernate
-- @Filter("organizationFilter") en defense en profondeur (multi-tenant).
--
-- La table existante (creee par 0157__add_booking_vouchers.sql) ne portait
-- que (voucher_id, property_id), avec la cle composite. L'org_id etait
-- accessible uniquement via JOIN sur booking_voucher. Pour respecter le
-- pattern Clenzy (toutes les entites metier portent organization_id +
-- @Filter), on denormalise.

-- 1. Ajout de la colonne, nullable au depart pour permettre le backfill.
ALTER TABLE voucher_property_scope
    ADD COLUMN organization_id BIGINT;

-- 2. Backfill depuis booking_voucher.
UPDATE voucher_property_scope vps
SET organization_id = bv.organization_id
FROM booking_voucher bv
WHERE bv.id = vps.voucher_id;

-- 3. Verification : aucune row orpheline (defensif, devrait etre 0).
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM voucher_property_scope
    WHERE organization_id IS NULL;
    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'voucher_property_scope: % rows sans organization_id apres backfill', orphan_count;
    END IF;
END $$;

-- 4. NOT NULL constraint maintenant que toutes les rows sont peuplees.
ALTER TABLE voucher_property_scope
    ALTER COLUMN organization_id SET NOT NULL;

-- 5. Index pour le @Filter (queries WHERE organization_id = ?) + integrite.
CREATE INDEX IF NOT EXISTS idx_voucher_property_scope_org
    ON voucher_property_scope(organization_id);

-- Pas de FK vers organization : trop couteux pour une denormalisation
-- de defense en profondeur. La verite reste sur booking_voucher.
