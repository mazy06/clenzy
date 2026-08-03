-- Modèles métier constellation (vague M-B, M5) — stock CONSOMMABLE d'un logement
-- (linge, produits d'accueil, entretien) : quantité en main + seuil + fournisseur.
-- Distinct de l'inventaire (qui compte des BIENS) et du linge par séjour (config
-- blanchisserie). La consommation par ménage décrémente à la complétion ; sous le
-- seuil, la carte LINEN_STOCK_ORDER propose la commande au fournisseur.
CREATE TABLE IF NOT EXISTS property_stock_items (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    property_id BIGINT NOT NULL,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(30) NOT NULL DEFAULT 'LINEN',
    unit VARCHAR(30),
    quantity INT NOT NULL DEFAULT 0,
    reorder_threshold INT NOT NULL DEFAULT 0,
    reorder_quantity INT NOT NULL DEFAULT 0,
    consumption_per_stay INT NOT NULL DEFAULT 0,
    supplier_name VARCHAR(200),
    supplier_email VARCHAR(320),
    last_restocked_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_property_stock_items_org_prop
    ON property_stock_items (organization_id, property_id);
