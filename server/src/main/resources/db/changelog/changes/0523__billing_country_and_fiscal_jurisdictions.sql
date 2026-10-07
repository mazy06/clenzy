-- Tables vérifiées : Organization, FiscalProfile et BaitlySubscriptionOrder.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_country VARCHAR(2);
UPDATE organizations o SET billing_country = CASE upper(trim(f.country_code))
    WHEN 'FRA' THEN 'FR' WHEN 'MAR' THEN 'MA' WHEN 'SAU' THEN 'SA'
    ELSE upper(trim(f.country_code)) END
FROM fiscal_profiles f WHERE f.organization_id=o.id AND o.billing_country IS NULL
    AND (length(trim(f.country_code))=2 OR upper(trim(f.country_code)) IN ('FRA','MAR','SAU'));

ALTER TABLE baitly_subscription_orders ADD COLUMN IF NOT EXISTS billing_country VARCHAR(2);
ALTER TABLE baitly_subscription_orders ADD COLUMN IF NOT EXISTS seller_country VARCHAR(2);
ALTER TABLE baitly_subscription_orders ADD COLUMN IF NOT EXISTS seller_stripe_account_id VARCHAR(255);
-- Pas de vendeur rétroactif déduit du profil courant pour les contrats déjà engagés.

ALTER TABLE fiscal_profiles ADD COLUMN IF NOT EXISTS primary_profile BOOLEAN NOT NULL DEFAULT true;
UPDATE fiscal_profiles SET country_code=CASE upper(trim(country_code))
    WHEN 'FRA' THEN 'FR' WHEN 'MAR' THEN 'MA' WHEN 'SAU' THEN 'SA' ELSE upper(trim(country_code)) END;
ALTER TABLE fiscal_profiles DROP CONSTRAINT IF EXISTS fiscal_profiles_organization_id_key;
CREATE UNIQUE INDEX uq_baitly_fiscal_country ON fiscal_profiles(organization_id, upper(trim(country_code)));
CREATE UNIQUE INDEX uq_baitly_fiscal_primary ON fiscal_profiles(organization_id) WHERE primary_profile;
