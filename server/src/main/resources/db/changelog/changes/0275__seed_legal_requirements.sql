-- ============================================================================
-- 0275 : (Re)seed des mentions legales NF (document_legal_requirements)
-- ============================================================================
-- La table `document_legal_requirements` est VIDE en prod (LegalRequirementsInitializer
-- logue "Aucune mention legale trouvee en base" au boot). Cause : lors du bootstrap
-- Liquibase (migration depuis l'ere Hibernate/Flyway), le changeset 0027 a ete
-- changelog-sync (marque applique SANS s'executer, car la table existait deja) -> ses
-- INSERT n'ont jamais tourne en prod. Resultat : table presente mais sans donnees ->
-- mentions legales NF absentes (enjeu conformite : tags nf.* potentiellement vides).
--
-- Ce changeset re-applique le seed (15 mentions : FACTURE 7, DEVIS 5, BON_INTERVENTION 3).
-- Idempotent : ON CONFLICT (document_type, requirement_key) DO NOTHING -> no-op si les
-- lignes existent deja (autres environnements / re-application).
--
-- IMPORTANT (incident 2026-06-19) : la table prod a ete creee par Hibernate (0027 jamais
-- execute), donc `active` est NOT NULL SANS le `DEFAULT TRUE` du CREATE TABLE de 0027.
-- L'INSERT DOIT donc renseigner explicitement `active` (sinon : null -> violation NOT NULL
-- -> Liquibase echoue au boot -> Spring Boot crash-loop). On renseigne aussi `country_code`
-- ('FR') pour que les lignes matchent le filtre applicatif, et `created_at` (NOW()).
-- ============================================================================

-- FACTURE (7 mentions obligatoires NF)
INSERT INTO document_legal_requirements (country_code, document_type, requirement_key, label, description, required, default_value, display_order, active, created_at) VALUES
    ('FR', 'FACTURE', 'numero_facture', 'Numero de facture', 'Numero sequentiel unique et sans trou (tag: nf.numero_legal)', TRUE, NULL, 1, TRUE, NOW()),
    ('FR', 'FACTURE', 'date_emission', 'Date d''emission', 'Date de creation de la facture (tag: nf.date_emission)', TRUE, NULL, 2, TRUE, NOW()),
    ('FR', 'FACTURE', 'identite_vendeur', 'Identite du vendeur', 'Nom, adresse, SIRET de l''entreprise (tags: entreprise.*)', TRUE, NULL, 3, TRUE, NOW()),
    ('FR', 'FACTURE', 'identite_acheteur', 'Identite de l''acheteur', 'Nom et adresse du client (tags: client.*)', TRUE, NULL, 4, TRUE, NOW()),
    ('FR', 'FACTURE', 'designation_prestations', 'Designation des prestations', 'Description detaillee des services rendus (tags: intervention.*)', TRUE, NULL, 5, TRUE, NOW()),
    ('FR', 'FACTURE', 'montant_total', 'Montant total', 'Montant HT, TVA et TTC (tags: paiement.montant)', TRUE, NULL, 6, TRUE, NOW()),
    ('FR', 'FACTURE', 'conditions_paiement', 'Conditions de paiement', 'Delai de paiement, penalites de retard (tag: nf.conditions_paiement)', TRUE, 'Paiement a reception. Penalites de retard : 3 fois le taux d''interet legal.', 7, TRUE, NOW())
ON CONFLICT (document_type, requirement_key) DO NOTHING;

-- DEVIS (5 mentions obligatoires)
INSERT INTO document_legal_requirements (country_code, document_type, requirement_key, label, description, required, default_value, display_order, active, created_at) VALUES
    ('FR', 'DEVIS', 'numero_devis', 'Numero de devis', 'Numero sequentiel unique (tag: nf.numero_legal)', TRUE, NULL, 1, TRUE, NOW()),
    ('FR', 'DEVIS', 'date_emission', 'Date d''emission', 'Date de creation du devis (tag: nf.date_emission)', TRUE, NULL, 2, TRUE, NOW()),
    ('FR', 'DEVIS', 'identite_vendeur', 'Identite du prestataire', 'Nom, adresse, SIRET de l''entreprise (tags: entreprise.*)', TRUE, NULL, 3, TRUE, NOW()),
    ('FR', 'DEVIS', 'designation_prestations', 'Designation des prestations', 'Description detaillee et prix unitaires (tags: intervention.*)', TRUE, NULL, 4, TRUE, NOW()),
    ('FR', 'DEVIS', 'duree_validite', 'Duree de validite', 'Duree pendant laquelle le devis est valable (tag: nf.duree_validite)', TRUE, 'Ce devis est valable 30 jours a compter de sa date d''emission.', 5, TRUE, NOW())
ON CONFLICT (document_type, requirement_key) DO NOTHING;

-- BON_INTERVENTION (3 mentions obligatoires)
INSERT INTO document_legal_requirements (country_code, document_type, requirement_key, label, description, required, default_value, display_order, active, created_at) VALUES
    ('FR', 'BON_INTERVENTION', 'identite_intervenant', 'Identite de l''intervenant', 'Nom du technicien et de l''entreprise (tags: technicien.*, entreprise.*)', TRUE, NULL, 1, TRUE, NOW()),
    ('FR', 'BON_INTERVENTION', 'description_travaux', 'Description des travaux', 'Nature et detail de l''intervention (tags: intervention.*)', TRUE, NULL, 2, TRUE, NOW()),
    ('FR', 'BON_INTERVENTION', 'date_intervention', 'Date de l''intervention', 'Date et heure de debut/fin (tags: intervention.date_debut, intervention.date_fin)', TRUE, NULL, 3, TRUE, NOW())
ON CONFLICT (document_type, requirement_key) DO NOTHING;
