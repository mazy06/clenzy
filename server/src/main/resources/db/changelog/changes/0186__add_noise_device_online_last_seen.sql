-- ============================================================================
-- 0186 : Connectivite reelle des capteurs de bruit (online + last_seen_at)
-- ============================================================================
-- Meme correctif que pour les serrures (0181) : avant, "en ligne / surveillance
-- active" etait deduit de status=ACTIVE (fige a la creation). On persiste
-- desormais le vrai flag Tuya/Minut (rafraichi par getDeviceStatus).
-- online NULL = jamais synchronise.
-- ============================================================================

ALTER TABLE noise_devices
    ADD COLUMN online BOOLEAN,
    ADD COLUMN last_seen_at TIMESTAMP;
