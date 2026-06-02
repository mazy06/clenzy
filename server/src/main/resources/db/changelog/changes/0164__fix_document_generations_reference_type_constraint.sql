-- ============================================================================
-- 0164 : Fix document_generations.reference_type CHECK constraint
-- ============================================================================
-- En prod, la table document_generations a ete creee par Hibernate
-- ddl-auto=update (avant l'activation de Liquibase). La contrainte CHECK
-- auto-generee `document_generations_reference_type_check` ne liste que les
-- valeurs ReferenceType qui existaient a l'epoque et REJETTE RECEIVED_FORM
-- (ajoutee plus tard a l'enum). Resultat : toute generation de document depuis
-- un formulaire recu (Contact > Formulaires recus > bouton "Generer PDF")
-- echoue au commit avec :
--   new row for relation "document_generations" violates check constraint
--   "document_generations_reference_type_check"
-- -> HTTP 500 {"error":"Erreur interne"}.
--
-- En dev (ddl-auto=none) la contrainte n'existe pas, donc le bug est prod-only.
-- Ce changeset reconstruit la contrainte avec la liste complete de l'enum
-- com.clenzy.model.ReferenceType (idempotent, meme pattern que 0113).
-- ============================================================================

-- 1. Drop the constraint by name (whatever it allowed before).
ALTER TABLE document_generations DROP CONSTRAINT IF EXISTS document_generations_reference_type_check;

-- 2. Re-create it with the values matching the Java ReferenceType enum.
--    reference_type est nullable -> on autorise explicitement NULL.
ALTER TABLE document_generations
  ADD CONSTRAINT document_generations_reference_type_check
  CHECK (reference_type IS NULL OR reference_type IN (
    'INTERVENTION','SERVICE_REQUEST','PROPERTY','USER','RESERVATION',
    'PROVIDER_EXPENSE','RECEIVED_FORM','MANAGEMENT_CONTRACT'
  ));
