-- Conformité France — phase 4 : référentiel officiel des tarifs de taxe de séjour.
--
-- Table PLATEFORME (aucun organization_id, hors filtre tenant) : copie locale, par commune,
-- des délibérations publiées par la DGFiP (jeu DELTA « Tarifs taxe de séjour »,
-- data.economie.gouv.fr). Alimentée à la demande pour la commune d'un logement puis
-- rafraîchie ; sert à pré-remplir le barème, jamais à l'imposer.
CREATE TABLE IF NOT EXISTS fr_tourist_tax_rates (
    id                    BIGSERIAL PRIMARY KEY,
    insee_code            VARCHAR(5)   NOT NULL,
    commune_name          VARCHAR(200),
    effective_year        INT          NOT NULL,
    effective_to          DATE,
    accommodation_label   VARCHAR(300) NOT NULL,
    category              VARCHAR(40)  NOT NULL,
    regime                VARCHAR(20),
    rate                  NUMERIC(10, 4),
    rate_unit             VARCHAR(4),
    departmental_pct      NUMERIC(7, 2),
    other_additional_pct  NUMERIC(7, 2),
    collector_siren       VARCHAR(9),
    fetched_at            TIMESTAMP    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fr_tourist_tax_rates_insee ON fr_tourist_tax_rates (insee_code, effective_year);
