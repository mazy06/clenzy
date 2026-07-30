-- Part Baitly sur la commission d'affiliation, par marketplace.
--
-- Le compte affilie chez Viator/GetYourGuide/Klook est celui de Baitly : la
-- plateforme encaisse la commission versee par le programme, en retient sa part
-- et reverse le solde a l'hote. Cette part se negocie programme par programme,
-- d'ou une colonne sur activity_affiliate_configs, deja unique par
-- (organization_id, provider) — plutot qu'un taux global, qui ne pouvait pas
-- representer trois accords distincts (c'etait la limite du taux retire au
-- changeset 0375).
--
-- NULL = aucune part retenue : tant qu'aucun accord n'est saisi, l'integralite
-- de la commission revient a l'hote. Un defaut non nul preleverait sur la foi
-- d'une valeur que personne n'a decidee.

ALTER TABLE activity_affiliate_configs
    ADD COLUMN IF NOT EXISTS platform_commission_pct NUMERIC(5,2);

COMMENT ON COLUMN activity_affiliate_configs.platform_commission_pct IS
    'Part Baitly (%) retenue sur la commission d''affiliation versee par ce programme. NULL = rien retenu.';
