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
-- Ce changeset re-applique le seed (15 mentions : FACTURE 7, DEVIS 5, BON_INTERVENTION 3),
-- identique a 0027. Idempotent : ON CONFLICT (document_type, requirement_key) DO NOTHING
-- -> no-op si les lignes existent deja (autres environnements / re-application).
-- ============================================================================

-- FACTURE (7 mentions obligatoires NF)
INSERT INTO document_legal_requirements (document_type, requirement_key, label, description, required, default_value, display_order) VALUES
    ('FACTURE', 'numero_facture', 'Numero de facture', 'Numero sequentiel unique et sans trou (tag: nf.numero_legal)', TRUE, NULL, 1),
    ('FACTURE', 'date_emission', 'Date d''emission', 'Date de creation de la facture (tag: nf.date_emission)', TRUE, NULL, 2),
    ('FACTURE', 'identite_vendeur', 'Identite du vendeur', 'Nom, adresse, SIRET de l''entreprise (tags: entreprise.*)', TRUE, NULL, 3),
    ('FACTURE', 'identite_acheteur', 'Identite de l''acheteur', 'Nom et adresse du client (tags: client.*)', TRUE, NULL, 4),
    ('FACTURE', 'designation_prestations', 'Designation des prestations', 'Description detaillee des services rendus (tags: intervention.*)', TRUE, NULL, 5),
    ('FACTURE', 'montant_total', 'Montant total', 'Montant HT, TVA et TTC (tags: paiement.montant)', TRUE, NULL, 6),
    ('FACTURE', 'conditions_paiement', 'Conditions de paiement', 'Delai de paiement, penalites de retard (tag: nf.conditions_paiement)', TRUE, 'Paiement a reception. Penalites de retard : 3 fois le taux d''interet legal.', 7)
ON CONFLICT (document_type, requirement_key) DO NOTHING;

-- DEVIS (5 mentions obligatoires)
INSERT INTO document_legal_requirements (document_type, requirement_key, label, description, required, default_value, display_order) VALUES
    ('DEVIS', 'numero_devis', 'Numero de devis', 'Numero sequentiel unique (tag: nf.numero_legal)', TRUE, NULL, 1),
    ('DEVIS', 'date_emission', 'Date d''emission', 'Date de creation du devis (tag: nf.date_emission)', TRUE, NULL, 2),
    ('DEVIS', 'identite_vendeur', 'Identite du prestataire', 'Nom, adresse, SIRET de l''entreprise (tags: entreprise.*)', TRUE, NULL, 3),
    ('DEVIS', 'designation_prestations', 'Designation des prestations', 'Description detaillee et prix unitaires (tags: intervention.*)', TRUE, NULL, 4),
    ('DEVIS', 'duree_validite', 'Duree de validite', 'Duree pendant laquelle le devis est valable (tag: nf.duree_validite)', TRUE, 'Ce devis est valable 30 jours a compter de sa date d''emission.', 5)
ON CONFLICT (document_type, requirement_key) DO NOTHING;

-- BON_INTERVENTION (3 mentions obligatoires)
INSERT INTO document_legal_requirements (document_type, requirement_key, label, description, required, default_value, display_order) VALUES
    ('BON_INTERVENTION', 'identite_intervenant', 'Identite de l''intervenant', 'Nom du technicien et de l''entreprise (tags: technicien.*, entreprise.*)', TRUE, NULL, 1),
    ('BON_INTERVENTION', 'description_travaux', 'Description des travaux', 'Nature et detail de l''intervention (tags: intervention.*)', TRUE, NULL, 2),
    ('BON_INTERVENTION', 'date_intervention', 'Date de l''intervention', 'Date et heure de debut/fin (tags: intervention.date_debut, intervention.date_fin)', TRUE, NULL, 3)
ON CONFLICT (document_type, requirement_key) DO NOTHING;
