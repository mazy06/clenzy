-- Baitly : catalogue visuel facultatif et photo personnalisée des articles de stock.
-- Table vérifiée dans PropertyStockItem et le changeset 0386.
ALTER TABLE property_stock_items ADD COLUMN catalog_key VARCHAR(80);
ALTER TABLE property_stock_items ADD COLUMN photo_url TEXT;
