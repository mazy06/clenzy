-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ 0361 — Unicité des références de transaction de paiement                 │
-- │ Audit sécurité 2026-07-26, constat P6-05                                  │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- `payment_transactions` ne portait AUCUNE contrainte d'unicité :
--   * `transaction_ref` (NOT NULL) est la clé de résolution de tous les webhooks
--     PSP. Des doublons rendent `findByTransactionRef` (qui retourne un Optional)
--     jetant `IncorrectResultSizeDataAccessException` — tous les webhooks de cette
--     référence tombent alors en 500.
--   * `idempotency_key` n'avait qu'un index btree NON unique
--     (`idx_payment_tx_idempotency`, baseline). `consumeIdempotentReplay` est donc
--     un check-then-act sans filet : deux POST concurrents portant la même
--     Idempotency-Key créent deux transactions et deux sessions de paiement.
--
-- La contrainte est le filet que le code applicatif ne peut pas fournir seul.
-- À comparer : `pending_inscriptions_stripe_session_id_key` et
-- `uq_ai_usage_ledger_idem` existent déjà — l'absence sur la table centrale du
-- paiement était une incohérence.
--
-- NOTE `idempotency_key` : la colonne est nullable et PostgreSQL autorise
-- plusieurs NULL dans un index unique. Les transactions sans clé d'idempotence
-- (majorité des lignes historiques) ne sont donc pas affectées.

-- ── Garde : refuser d'appliquer si des doublons existent déjà ────────────────
-- Sur des données financières, aucun nettoyage automatique n'est acceptable :
-- on échoue avec un diagnostic exploitable plutôt que de fusionner ou supprimer
-- des lignes. Sans cette garde, le CREATE UNIQUE INDEX échouerait de toute façon,
-- mais avec un message PostgreSQL brut ne nommant pas les références fautives.
DO $$
DECLARE
    duplicate_refs text;
    duplicate_keys text;
BEGIN
    SELECT string_agg(transaction_ref, ', ')
      INTO duplicate_refs
      FROM (SELECT transaction_ref
              FROM payment_transactions
             GROUP BY transaction_ref
            HAVING count(*) > 1
             LIMIT 20) d;

    SELECT string_agg(idempotency_key, ', ')
      INTO duplicate_keys
      FROM (SELECT idempotency_key
              FROM payment_transactions
             WHERE idempotency_key IS NOT NULL
             GROUP BY idempotency_key
            HAVING count(*) > 1
             LIMIT 20) d;

    IF duplicate_refs IS NOT NULL THEN
        RAISE EXCEPTION
            'Changeset 0361 : transaction_ref en doublon dans payment_transactions (%). '
            'Ces doublons cassent deja findByTransactionRef. Les arbitrer manuellement '
            '(conserver la transaction faisant foi cote PSP) avant de rejouer ce changeset.',
            duplicate_refs;
    END IF;

    IF duplicate_keys IS NOT NULL THEN
        RAISE EXCEPTION
            'Changeset 0361 : idempotency_key en doublon dans payment_transactions (%). '
            'Chaque doublon est un double paiement potentiel deja survenu : les auditer '
            'avant de rejouer ce changeset.',
            duplicate_keys;
    END IF;
END $$;

-- ── Contraintes d'unicité ───────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_tx_ref
    ON payment_transactions (transaction_ref);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_tx_idempotency
    ON payment_transactions (idempotency_key);

-- L'index btree non unique du baseline devient redondant : l'index unique
-- ci-dessus le remplace intégralement pour la lecture comme pour l'écriture.
DROP INDEX IF EXISTS idx_payment_tx_idempotency;
