-- RMS R2 : automatisations deterministes — parametres org-level sur yield_org_configs.
-- Orphan gap pricing : remise + min-stay abaisse sur les creux courts entre deux
-- reservations (pattern PriceLabs). Min-stay dynamique : reduction last-minute du
-- sejour minimum sur les nuits encore libres a l'approche de la date.
-- Les deux sont OFF par defaut (opt-in par org) et reversibles (overrides sources
-- ORPHAN_GAP / MINSTAY_AUTO, nettoyes automatiquement quand la condition disparait).
ALTER TABLE yield_org_configs
    ADD COLUMN orphan_gap_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN orphan_gap_max_nights INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN orphan_gap_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 15.00,
    ADD COLUMN min_stay_auto_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN min_stay_reduce_within_days INTEGER NOT NULL DEFAULT 14,
    ADD COLUMN min_stay_reduced_value INTEGER NOT NULL DEFAULT 1;
