-- Retire la part conciergerie sur les activites du contrat de gestion.
--
-- Regle metier : sur les activites, la conciergerie ne touche rien. La
-- commission d'affiliation est encaissee par Baitly, qui retient sa part
-- (activity_affiliate_configs.platform_commission_pct, changeset 0376) et
-- reverse le solde au proprietaire.
--
-- La colonne etait par ailleurs deja sans effet : son unique lecteur,
-- ActivityCommissionService.resolveActivityConciergePct, n'etait appele que
-- depuis record(), lui-meme jamais invoque. Elle restait pourtant saisissable
-- dans le formulaire de contrat — un taux qu'on remplit et qui ne s'applique
-- nulle part.
--
-- upsell_commission_rate est CONSERVEE : sur les upsells, la part conciergerie
-- est bien calculee et creditee (cf. UpsellService).

ALTER TABLE management_contracts DROP COLUMN IF EXISTS activity_commission_rate;
