-- ============================================================================
-- 0212 : Commissions upsells & activités au niveau du contrat de gestion
-- ============================================================================
-- Permet à un contrat de gestion (par logement) de porter sa propre part
-- conciergerie sur les SERVICES PAYANTS (upsells) et le MARKETPLACE (activités),
-- en plus de la commission de réservation existante (commission_rate).
--   - Taux = part conciergerie (fraction, ex 0.1700) appliquée APRÈS la commission
--     plateforme (fixée par la plateforme) ; le propriétaire reçoit le solde.
--   - NULL = pas de taux spécifique au contrat → on retombe sur le défaut de l'org
--     (OrgMonetizationConfig « Ma part », onglet Services payants).
-- Colonnes nullables (NUMERIC(5,4), comme commission_rate). Idempotent.
-- ============================================================================

ALTER TABLE management_contracts ADD COLUMN IF NOT EXISTS upsell_commission_rate NUMERIC(5,4);
ALTER TABLE management_contracts ADD COLUMN IF NOT EXISTS activity_commission_rate NUMERIC(5,4);
