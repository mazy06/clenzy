-- Baitly : connexion d'une organisation a une plateforme de declaration
-- reglementaire. Premier cas, la NTMP saoudienne (ministere du Tourisme).
--
-- DISTINCT d'un canal de vente (`channel_connections`) : un regulateur ne se
-- debranche pas, ne rapporte pas de reservations, et n'a pas sa place dans
-- l'ecran Distribution. Distinct aussi de `compliance_connections`, qui porte
-- la declaration de VOYAGEURS (Shomoos, DGSN) : ici on declare de l'inventaire,
-- des tarifs et des sejours.
--
-- Un identifiant d'agence couvre TOUTE l'organisation : une ligne par
-- organisation suffit, la licence visee etant passee appel par appel depuis le
-- logement concerne (`property_licenses`, type TOURISM_REGISTRATION).
CREATE TABLE IF NOT EXISTS regulatory_connections (
    id                      BIGSERIAL PRIMARY KEY,
    organization_id         BIGINT NOT NULL,
    provider                VARCHAR(30) NOT NULL,
    gateway_url             VARCHAR(500) NOT NULL,
    facility_id             VARCHAR(200) NOT NULL,
    facility_secret_encrypted TEXT NOT NULL,
    -- Mode d'envoi : la passerelle distingue les soumissions de production de
    -- celles de test, et les compte separement.
    sandbox                 BOOLEAN NOT NULL DEFAULT TRUE,
    status                  VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    error_message           TEXT,
    last_tested_at          TIMESTAMP,
    created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Pas de contrainte CHECK sur `provider` ni `status` : les enums geles en base
-- ont produit un bug PROD-ONLY (un statut ajoute cote Java, rejete cote base),
-- et le changeset 0274 en a droppe 175. La validation reste cote domaine.

-- Une seule connexion par organisation et par plateforme.
CREATE UNIQUE INDEX IF NOT EXISTS baitly_regulatory_connections_org_provider
    ON regulatory_connections (organization_id, provider);
