-- Retire les deux taux de commission d'activites de la config de monetisation.
--
-- Ces colonnes n'ont jamais eu d'effet : le seul code qui les lisait etait
-- ActivityCommissionService.record(), qu'aucun controleur ni webhook n'appelait,
-- et qui est supprime dans le meme lot. Les activites fonctionnent par
-- affiliation — le voyageur reserve chez Viator/GetYourGuide/Klook via un lien
-- affilie, aucun montant ne transite par Baitly — il n'y a donc pas de
-- commission a repartir, et un taux affiche laissait croire le contraire.
--
-- Les upsells, eux, conservent leurs deux taux (upsell_platform_fee_pct et
-- upsell_org_commission_pct) : ce flux passe bien par Stripe puis par le ledger.

ALTER TABLE org_monetization_config DROP COLUMN IF EXISTS activity_platform_commission_pct;
ALTER TABLE org_monetization_config DROP COLUMN IF EXISTS activity_org_commission_pct;
