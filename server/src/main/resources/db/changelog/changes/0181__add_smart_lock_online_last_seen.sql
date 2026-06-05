-- ============================================================================
-- 0181 : Connectivite reelle des serrures connectees (online + last_seen_at)
-- ============================================================================
-- Avant : la carte/KPI deduisaient "en ligne" de status=ACTIVE (cycle de vie,
-- pose a la creation) — incoherent avec l'etat verrou "inconnu". On persiste
-- desormais le vrai flag Tuya "online" (rafraichi par getLockStatus) pour que
-- le read-model GET /api/devices reflete la connectivite reelle.
-- online NULL = jamais synchronise (ni en ligne, ni hors ligne).
-- ============================================================================

ALTER TABLE smart_lock_devices
    ADD COLUMN online BOOLEAN,
    ADD COLUMN last_seen_at TIMESTAMP;
