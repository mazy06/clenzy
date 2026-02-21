-- ============================================================================
-- V49 : Creation des tables calendar_days et calendar_commands
-- ============================================================================
-- calendar_days : 1 ligne par propriete par jour (disponibilite, prix, statut)
-- calendar_commands : write-ahead log de toutes les mutations calendrier (audit)
-- + ajout de la colonne version sur reservations (optimistic locking JPA)
-- ============================================================================

-- Table calendar_days : source de verite du calendrier par jour
CREATE TABLE calendar_days (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    property_id     BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'
                    CHECK (status IN ('AVAILABLE','BOOKED','BLOCKED','MAINTENANCE')),
    reservation_id  BIGINT REFERENCES reservations(id) ON DELETE SET NULL,
    nightly_price   DECIMAL(10,2),
    min_stay        INTEGER DEFAULT 1,
    source          VARCHAR(30) DEFAULT 'MANUAL',
    notes           TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_calendar_property_date UNIQUE (property_id, date)
);

-- Index composite pour les requetes de disponibilite (le plus frequent)
CREATE INDEX idx_calendar_days_property_date_status ON calendar_days(property_id, date, status);

-- Index pour les requetes multi-tenant
CREATE INDEX idx_calendar_days_org ON calendar_days(organization_id);

-- Index pour retrouver les jours d'une reservation (annulation, modification)
CREATE INDEX idx_calendar_days_reservation ON calendar_days(reservation_id);


-- Table calendar_commands : write-ahead log / audit trail
CREATE TABLE calendar_commands (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    property_id     BIGINT NOT NULL REFERENCES properties(id),
    command_type    VARCHAR(20) NOT NULL
                    CHECK (command_type IN ('BOOK','CANCEL','BLOCK','UNBLOCK','UPDATE_PRICE')),
    date_from       DATE NOT NULL,
    date_to         DATE NOT NULL,
    source          VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    reservation_id  BIGINT REFERENCES reservations(id),
    actor_id        VARCHAR(255),
    payload         JSONB,
    status          VARCHAR(20) NOT NULL DEFAULT 'EXECUTED'
                    CHECK (status IN ('PENDING','EXECUTED','FAILED','ROLLED_BACK')),
    executed_at     TIMESTAMP NOT NULL DEFAULT now()
);

-- Index pour lister les commandes d'une propriete (tri chrono descendant)
CREATE INDEX idx_calendar_commands_property ON calendar_commands(property_id, executed_at DESC);

-- Index pour les requetes multi-tenant (audit admin)
CREATE INDEX idx_calendar_commands_org ON calendar_commands(organization_id);


-- Ajouter @Version sur reservations pour optimistic locking JPA
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;
