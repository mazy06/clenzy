-- ============================================================================
-- V48 : Ajout du type SYSTEM pour les organisations
-- ============================================================================
-- Le type SYSTEM permet aux SUPER_ADMIN de creer des organisations internes
-- a la plateforme (non liees a un utilisateur specifique).
-- La contrainte CHECK sur organizations.type a ete auto-generee par Hibernate
-- et ne contient que les 3 types originaux. On la met a jour.
-- ============================================================================

DO $$
BEGIN
    -- Supprimer la contrainte CHECK auto-generee par Hibernate (si elle existe)
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'organizations' AND constraint_name = 'organizations_type_check'
    ) THEN
        ALTER TABLE organizations DROP CONSTRAINT organizations_type_check;
    END IF;

    -- Recreer avec les 4 types incluant SYSTEM
    ALTER TABLE organizations ADD CONSTRAINT organizations_type_check
        CHECK (type IN ('INDIVIDUAL', 'CONCIERGE', 'CLEANING_COMPANY', 'SYSTEM'));
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;
