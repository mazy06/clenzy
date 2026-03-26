-- Inventaire des objets dans les logements
CREATE TABLE IF NOT EXISTS property_inventory_items (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    property_id     BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    category        VARCHAR(100),
    quantity        INTEGER NOT NULL DEFAULT 1,
    notes           TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prop_inv_items_property ON property_inventory_items(property_id);
CREATE INDEX IF NOT EXISTS idx_prop_inv_items_org ON property_inventory_items(organization_id);

-- Articles de linge a laver apres chaque sejour (lie au catalogue blanchisserie)
CREATE TABLE IF NOT EXISTS property_laundry_items (
    id                  BIGSERIAL PRIMARY KEY,
    organization_id     BIGINT NOT NULL,
    property_id         BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    item_key            VARCHAR(100) NOT NULL,
    label               VARCHAR(255) NOT NULL,
    quantity_per_stay   INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_prop_laundry_item UNIQUE (property_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_prop_laundry_items_property ON property_laundry_items(property_id);
CREATE INDEX IF NOT EXISTS idx_prop_laundry_items_org ON property_laundry_items(organization_id);

-- Devis / factures blanchisserie (snapshot des prix au moment de la generation)
CREATE TABLE IF NOT EXISTS laundry_quotes (
    id              BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    property_id     BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    reservation_id  BIGINT REFERENCES reservations(id) ON DELETE SET NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN ('DRAFT', 'CONFIRMED', 'INVOICED')),
    lines           TEXT NOT NULL,
    total_ht        DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency        VARCHAR(3) NOT NULL DEFAULT 'EUR',
    generated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    confirmed_at    TIMESTAMP,
    notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_laundry_quotes_property ON laundry_quotes(property_id);
CREATE INDEX IF NOT EXISTS idx_laundry_quotes_org ON laundry_quotes(organization_id);
CREATE INDEX IF NOT EXISTS idx_laundry_quotes_reservation ON laundry_quotes(reservation_id);
