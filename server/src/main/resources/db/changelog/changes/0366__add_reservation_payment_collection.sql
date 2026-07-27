-- Regime d'encaissement de la reservation : qui a percu l'argent du sejour.
--
-- Jusqu'ici cette information n'etait stockee nulle part : elle etait REDERIVEE
-- du nom du canal, a cinq endroits, par des listes en dur qui divergeaient.
-- C'est ainsi que les sejours Channex ont ete comptes « reste a payer » alors
-- qu'ils etaient regles : la valeur "channex" n'avait ete ajoutee a aucune des
-- cinq copies. Le canal qui a VENDU et le regime d'ENCAISSEMENT sont deux
-- informations distinctes ; on cesse de deduire la seconde de la premiere.
--
-- Colonne NULLABLE a dessein : le code sait retomber sur l'ancienne deduction
-- tant qu'une ligne n'est pas renseignee (Reservation.isCollectedByChannel).
-- Le comportement est donc strictement inchange, meme si ce changeset n'a pas
-- encore tourne.
ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS payment_collection VARCHAR(20);

-- Backfill : exactement la regle qui etait appliquee a la lecture, gelee ligne
-- par ligne. `channex` y figure — c'est la correction du bug d'origine.
-- `other` couvre les canaux iCal non reconnus (Vrbo, Expedia, Abritel...), qui
-- encaissent eux aussi pour le compte de l'hote.
-- Insensible a la casse : les producteurs n'ont pas tous ete rigoureux.
UPDATE reservations
   SET payment_collection = CASE
           WHEN LOWER(COALESCE(source, '')) IN ('airbnb', 'booking', 'other', 'channex')
               THEN 'CHANNEL'
           ELSE 'PMS'
       END
 WHERE payment_collection IS NULL;

COMMENT ON COLUMN reservations.payment_collection IS
    'PMS = le PMS encaisse ; CHANNEL = le canal a deja encaisse pour le compte de l''hote.';
