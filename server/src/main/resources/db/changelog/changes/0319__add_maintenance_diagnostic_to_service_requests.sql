-- 0319 : Mode de chiffrage maintenance sur les demandes de service.
-- pricing_mode : NULL/'DIRECT' = devis direct ; 'DIAGNOSTIC' = l'artisan facture
-- d'abord un diagnostic (visite sur place) avant d'elaborer le devis.
-- diagnostic_fee : montant du diagnostic (facture en premier). Nullable = optionnel.
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS pricing_mode VARCHAR(20);
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS diagnostic_fee NUMERIC;
