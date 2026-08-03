-- Modèles métier constellation (vague M-B, M7) — état no-show d'un séjour :
-- marqué par l'opérateur (carte NOSHOW_MARK de l'agent Synchronisation), les
-- nuits restantes sont libérées, la déclaration côté OTA reste manuelle.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS no_show BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS no_show_marked_at TIMESTAMP;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS no_show_marked_by VARCHAR(120);
