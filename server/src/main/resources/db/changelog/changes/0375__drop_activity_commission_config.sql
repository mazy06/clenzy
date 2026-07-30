-- Retire les deux taux de commission d'activites de la config de monetisation.
--
-- Ces colonnes n'ont jamais eu d'effet : le seul code qui les lisait etait
-- ActivityCommissionService.record(), qu'aucun controleur ni webhook n'appelait,
-- et qui est supprime dans le meme lot. Les activites fonctionnent par
-- affiliation — la commission est encaissee par Baitly, qui retient une part
-- negociee programme par programme (changeset 0376) — un taux global ne pouvait
-- donc pas representer trois accords distincts.
--
-- Les valeurs non nulles sont archivees avant suppression : un DROP COLUMN est
-- irreversible, et ces taux etaient exposes en ecriture par l'API de
-- monetisation. L'archive permet de constater apres coup ce qui existait,
-- plutot que de le supposer avant.
--
-- Les upsells conservent leurs deux taux (upsell_platform_fee_pct et
-- upsell_org_commission_pct) : ce flux passe bien par Stripe puis par le ledger.

DO $$
DECLARE
    target_column TEXT;
BEGIN
    FOREACH target_column IN ARRAY ARRAY['activity_platform_commission_pct', 'activity_org_commission_pct']
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'org_monetization_config'
              AND column_name = target_column
        ) THEN
            CREATE TABLE IF NOT EXISTS archived_activity_commission_rates (
                source_table  TEXT         NOT NULL,
                source_id     BIGINT       NOT NULL,
                column_name   TEXT         NOT NULL,
                value         NUMERIC(9,4) NOT NULL,
                archived_at   TIMESTAMP    NOT NULL DEFAULT now()
            );

            EXECUTE format(
                'INSERT INTO archived_activity_commission_rates '
                || '(source_table, source_id, column_name, value) '
                || 'SELECT ''org_monetization_config'', id, %L, %I '
                || 'FROM org_monetization_config WHERE %I IS NOT NULL',
                target_column, target_column, target_column);

            EXECUTE format('ALTER TABLE org_monetization_config DROP COLUMN %I', target_column);
        END IF;
    END LOOP;
END
$$;
