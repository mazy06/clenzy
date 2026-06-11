-- 0226 : garde-fous d'unicite sur la numerotation des factures (audit Z3-BUGS-07 / Z3-BUGS-08).
--
-- Contexte : deux flux concurrents (consumer Kafka FACTURE et webhook Stripe) pouvaient
-- creer chacun une facture pour le meme paiement, numerotee par deux sequences
-- independantes, sans aucune contrainte d'unicite sur invoices (table heritee de
-- Hibernate ddl-auto, jamais contrainte par Liquibase).
--
-- Ce changeset est idempotent : les dedoublonnages sont des no-ops une fois appliques,
-- les index utilisent IF NOT EXISTS.

-- ============================================================================
-- 1. invoice_number_sequences : unicite (organization_id, current_year)
--    Requise par l'INSERT ... ON CONFLICT de InvoiceNumberingService.
-- ============================================================================

-- 1a. Dedoublonnage defensif : conserver la ligne au compteur le plus avance
--     (ne jamais re-emettre un numero deja attribue).
DELETE FROM invoice_number_sequences a
USING invoice_number_sequences b
WHERE a.organization_id = b.organization_id
  AND a.current_year = b.current_year
  AND a.id <> b.id
  AND (a.last_number < b.last_number
       OR (a.last_number = b.last_number AND a.id < b.id));

-- 1b. Index unique (no-op si la contrainte generee par Hibernate existe deja
--     sous un autre nom ; un index redondant est sans danger fonctionnel).
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_number_seq_org_year
    ON invoice_number_sequences (organization_id, current_year);

-- ============================================================================
-- 2. invoices : annulation des doublons actifs herites de la double numerotation
--    (deux factures actives pour la meme reference = bug Z3-BUGS-07).
--    On conserve la plus ancienne (id le plus bas), la plus recente est annulee.
-- ============================================================================

UPDATE invoices SET status = 'CANCELLED'
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY reservation_id, invoice_type ORDER BY id
        ) AS rn
        FROM invoices
        WHERE reservation_id IS NOT NULL
          AND duplicate_of_id IS NULL
          AND status NOT IN ('CANCELLED', 'CREDIT_NOTE')
    ) d
    WHERE d.rn > 1
);

UPDATE invoices SET status = 'CANCELLED'
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY intervention_id ORDER BY id
        ) AS rn
        FROM invoices
        WHERE intervention_id IS NOT NULL
          AND duplicate_of_id IS NULL
          AND status NOT IN ('CANCELLED', 'CREDIT_NOTE')
    ) d
    WHERE d.rn > 1
);

-- ============================================================================
-- 3. invoices : suffixer les numeros dupliques residuels (hors brouillons)
--    pour permettre la creation de l'index unique. Une facture annulee garde
--    son numero ; seuls les doublons stricts (meme org, meme numero) sont
--    suffixes '-D{rang}' a partir du 2e exemplaire.
-- ============================================================================

UPDATE invoices i SET invoice_number = i.invoice_number || '-D' || d.rn
FROM (
    SELECT id, ROW_NUMBER() OVER (
        PARTITION BY organization_id, invoice_number ORDER BY id
    ) AS rn
    FROM invoices
    WHERE invoice_number <> 'DRAFT'
) d
WHERE i.id = d.id AND d.rn > 1;

-- ============================================================================
-- 4. Index uniques de garde (fermeture des courses check-then-insert).
-- ============================================================================

-- 4a. Un numero de facture est unique par organisation (les brouillons portent
--     tous le placeholder 'DRAFT' et sont exclus).
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_org_invoice_number
    ON invoices (organization_id, invoice_number)
    WHERE invoice_number <> 'DRAFT';

-- 4b. Une seule facture active par (reservation, nature) : ferme la course
--     consumer Kafka / webhook Stripe sur le meme paiement. Les avoirs,
--     factures annulees et duplicatas sont exclus.
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_reservation_type_active
    ON invoices (reservation_id, invoice_type)
    WHERE reservation_id IS NOT NULL
      AND duplicate_of_id IS NULL
      AND status NOT IN ('CANCELLED', 'CREDIT_NOTE');

-- 4c. Une seule facture active par intervention (meme logique).
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_intervention_active
    ON invoices (intervention_id)
    WHERE intervention_id IS NOT NULL
      AND duplicate_of_id IS NULL
      AND status NOT IN ('CANCELLED', 'CREDIT_NOTE');
