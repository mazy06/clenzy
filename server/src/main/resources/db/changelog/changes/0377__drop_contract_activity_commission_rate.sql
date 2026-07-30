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
-- Les valeurs non nulles sont archivees avant suppression. Un DROP COLUMN est
-- irreversible, et la colonne etant saisissable, on ne peut pas affirmer
-- qu'aucune organisation n'y a mis un taux : l'archive tranche la question
-- apres coup plutot que de parier avant.
--
-- upsell_commission_rate est CONSERVEE : sur les upsells, la part conciergerie
-- est bien calculee et creditee (cf. UpsellService).

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'management_contracts'
          AND column_name = 'activity_commission_rate'
    ) THEN
        CREATE TABLE IF NOT EXISTS archived_activity_commission_rates (
            source_table  TEXT        NOT NULL,
            source_id     BIGINT      NOT NULL,
            column_name   TEXT        NOT NULL,
            value         NUMERIC(9,4) NOT NULL,
            archived_at   TIMESTAMP   NOT NULL DEFAULT now()
        );

        INSERT INTO archived_activity_commission_rates (source_table, source_id, column_name, value)
        SELECT 'management_contracts', id, 'activity_commission_rate', activity_commission_rate
        FROM management_contracts
        WHERE activity_commission_rate IS NOT NULL;

        ALTER TABLE management_contracts DROP COLUMN activity_commission_rate;
    END IF;
END
$$;
