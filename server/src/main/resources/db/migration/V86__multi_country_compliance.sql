-- ============================================================
-- V86 : Conformite reglementaire multi-pays
-- Ajoute country_code aux exigences legales et seed MA/SA
-- ============================================================

-- ─── 1. Ajouter country_code a document_legal_requirements ───

ALTER TABLE document_legal_requirements
    ADD COLUMN IF NOT EXISTS country_code VARCHAR(3) NOT NULL DEFAULT 'FR';

-- Remplacer la contrainte unique (type, key) par (country, type, key)
ALTER TABLE document_legal_requirements
    DROP CONSTRAINT IF EXISTS document_legal_requirements_document_type_requirement_key_key;

ALTER TABLE document_legal_requirements
    ADD CONSTRAINT uq_doc_legal_req_country_type_key
    UNIQUE (country_code, document_type, requirement_key);

-- Index pays + type + active
DROP INDEX IF EXISTS idx_doc_legal_req_type;
CREATE INDEX idx_doc_legal_req_country_type
    ON document_legal_requirements(country_code, document_type, active);

-- ─── 2. Seed exigences Maroc (MA) — DGI ─────────────────────

-- FACTURE MA (8 mentions DGI)
INSERT INTO document_legal_requirements
    (country_code, document_type, requirement_key, label, description, required, default_value, display_order)
VALUES
    ('MA', 'FACTURE', 'numero_facture', 'Numero de facture', 'Numero sequentiel unique (tag: nf.numero_legal)', TRUE, NULL, 1),
    ('MA', 'FACTURE', 'date_emission', 'Date d''emission', 'Date de creation de la facture (tag: nf.date_emission)', TRUE, NULL, 2),
    ('MA', 'FACTURE', 'identite_vendeur', 'Identite du vendeur', 'Nom, adresse, RC, IF de l''entreprise (tags: entreprise.*)', TRUE, NULL, 3),
    ('MA', 'FACTURE', 'identite_acheteur', 'Identite de l''acheteur', 'Nom et adresse du client (tags: client.*)', TRUE, NULL, 4),
    ('MA', 'FACTURE', 'designation_prestations', 'Designation des prestations', 'Description detaillee des services rendus (tags: intervention.*)', TRUE, NULL, 5),
    ('MA', 'FACTURE', 'montant_total', 'Montant total', 'Montant HT, TVA et TTC (tags: paiement.montant)', TRUE, NULL, 6),
    ('MA', 'FACTURE', 'ice_vendeur', 'ICE du vendeur', 'Identifiant Commun de l''Entreprise (tag: entreprise.ice)', TRUE, NULL, 7),
    ('MA', 'FACTURE', 'conditions_paiement', 'Conditions de paiement', 'Delai et modalites de paiement (tag: nf.conditions_paiement)', TRUE,
     'Paiement a 30 jours date de facture. Penalites de retard applicables conformement a la legislation en vigueur.', 8)
ON CONFLICT (country_code, document_type, requirement_key) DO NOTHING;

-- DEVIS MA (5 mentions)
INSERT INTO document_legal_requirements
    (country_code, document_type, requirement_key, label, description, required, default_value, display_order)
VALUES
    ('MA', 'DEVIS', 'numero_devis', 'Numero de devis', 'Numero sequentiel unique (tag: nf.numero_legal)', TRUE, NULL, 1),
    ('MA', 'DEVIS', 'date_emission', 'Date d''emission', 'Date de creation du devis (tag: nf.date_emission)', TRUE, NULL, 2),
    ('MA', 'DEVIS', 'identite_vendeur', 'Identite du prestataire', 'Nom, adresse, ICE de l''entreprise (tags: entreprise.*)', TRUE, NULL, 3),
    ('MA', 'DEVIS', 'designation_prestations', 'Designation des prestations', 'Description detaillee et prix unitaires (tags: intervention.*)', TRUE, NULL, 4),
    ('MA', 'DEVIS', 'duree_validite', 'Duree de validite', 'Duree pendant laquelle le devis est valable (tag: nf.duree_validite)', TRUE,
     'Ce devis est valable 30 jours a compter de sa date d''emission.', 5)
ON CONFLICT (country_code, document_type, requirement_key) DO NOTHING;

-- BON_INTERVENTION MA (3 mentions)
INSERT INTO document_legal_requirements
    (country_code, document_type, requirement_key, label, description, required, default_value, display_order)
VALUES
    ('MA', 'BON_INTERVENTION', 'identite_intervenant', 'Identite de l''intervenant', 'Nom du technicien et de l''entreprise (tags: technicien.*, entreprise.*)', TRUE, NULL, 1),
    ('MA', 'BON_INTERVENTION', 'description_travaux', 'Description des travaux', 'Nature et detail de l''intervention (tags: intervention.*)', TRUE, NULL, 2),
    ('MA', 'BON_INTERVENTION', 'date_intervention', 'Date de l''intervention', 'Date et heure de debut/fin (tags: intervention.date_debut, intervention.date_fin)', TRUE, NULL, 3)
ON CONFLICT (country_code, document_type, requirement_key) DO NOTHING;

-- ─── 3. Seed exigences Arabie Saoudite (SA) — ZATCA Phase 1 ──

-- FACTURE SA (8 mentions ZATCA simplified)
INSERT INTO document_legal_requirements
    (country_code, document_type, requirement_key, label, description, required, default_value, display_order)
VALUES
    ('SA', 'FACTURE', 'numero_facture', 'Invoice number', 'Sequential unique invoice number (tag: nf.numero_legal)', TRUE, NULL, 1),
    ('SA', 'FACTURE', 'date_emission', 'Issue date', 'Invoice issue date and time (tag: nf.date_emission)', TRUE, NULL, 2),
    ('SA', 'FACTURE', 'identite_vendeur', 'Seller identity', 'Seller name, address, VAT registration number (tags: entreprise.*)', TRUE, NULL, 3),
    ('SA', 'FACTURE', 'identite_acheteur', 'Buyer identity', 'Buyer name (required for standard invoices, tags: client.*)', TRUE, NULL, 4),
    ('SA', 'FACTURE', 'designation_prestations', 'Line items', 'Description and quantities of goods/services (tags: intervention.*)', TRUE, NULL, 5),
    ('SA', 'FACTURE', 'montant_total', 'Total amount', 'Total excluding VAT, VAT amount, total including VAT (tags: paiement.montant)', TRUE, NULL, 6),
    ('SA', 'FACTURE', 'vat_number', 'VAT registration number', 'Seller VAT number - 15 digits (tag: entreprise.vat_number)', TRUE, NULL, 7),
    ('SA', 'FACTURE', 'qr_code', 'QR code', 'QR code for simplified invoices - ZATCA Phase 1 (tag: nf.qr_code)', FALSE, NULL, 8)
ON CONFLICT (country_code, document_type, requirement_key) DO NOTHING;

-- DEVIS SA (5 mentions)
INSERT INTO document_legal_requirements
    (country_code, document_type, requirement_key, label, description, required, default_value, display_order)
VALUES
    ('SA', 'DEVIS', 'numero_devis', 'Quotation number', 'Sequential unique quotation number (tag: nf.numero_legal)', TRUE, NULL, 1),
    ('SA', 'DEVIS', 'date_emission', 'Issue date', 'Quotation issue date (tag: nf.date_emission)', TRUE, NULL, 2),
    ('SA', 'DEVIS', 'identite_vendeur', 'Seller identity', 'Seller name, address, VAT number (tags: entreprise.*)', TRUE, NULL, 3),
    ('SA', 'DEVIS', 'designation_prestations', 'Line items', 'Description and unit prices (tags: intervention.*)', TRUE, NULL, 4),
    ('SA', 'DEVIS', 'duree_validite', 'Validity period', 'Period during which the quotation is valid (tag: nf.duree_validite)', TRUE,
     'This quotation is valid for 30 days from the date of issue.', 5)
ON CONFLICT (country_code, document_type, requirement_key) DO NOTHING;

-- ─── 4. Mettre a jour description permission ────────────────

UPDATE permissions
SET description = 'Voir et gerer la conformite reglementaire des documents'
WHERE name = 'documents:compliance';
