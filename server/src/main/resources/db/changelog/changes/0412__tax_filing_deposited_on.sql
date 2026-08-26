-- Date de depot REELLE, distincte de la date de saisie.
--
-- `filed_at` horodate le moment ou l'operateur enregistre le depot dans Baitly.
-- Or on depose a l'administration le mardi et on saisit le jeudi : le registre
-- portait alors une date fausse. Pour un registre de CONFORMITE, la difference
-- n'est pas cosmetique — c'est ce qui lui donne, ou lui retire, sa valeur
-- probante en cas de controle.
--
-- Les deux colonnes coexistent volontairement : `filed_at` reste la trace
-- d'audit (« qui a saisi, quand »), `deposited_on` porte le fait declare.
ALTER TABLE tax_filings
    ADD COLUMN IF NOT EXISTS deposited_on DATE;

COMMENT ON COLUMN tax_filings.deposited_on IS
    'Date du depot effectif aupres de l''administration, declaree par l''operateur. '
    'Distincte de filed_at, qui horodate la saisie dans Baitly.';
