-- Bibliothèque Baitly : références stables et photos personnelles des équipements.
-- Table vérifiée contre PropertyInventoryItem et le changeset 0098.
ALTER TABLE property_inventory_items ADD COLUMN catalog_key VARCHAR(80);
ALTER TABLE property_inventory_items ADD COLUMN photo_url TEXT;
