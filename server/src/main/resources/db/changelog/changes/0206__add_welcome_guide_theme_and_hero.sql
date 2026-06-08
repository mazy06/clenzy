-- ============================================================================
-- 0206 : Theme visuel + photo de couverture du livret (welcome_guides)
-- ============================================================================
-- Le redesign "Baitly welcome book" introduit 7 themes chauds (atelier, noir,
-- jardin, azur, corail, brume, minuit) appliques cote guest via un swap de
-- variables CSS. `theme` pilote l'apparence (supplante `branding_color`, conserve
-- pour retro-compat). `hero_photo_id` reference une property_photos choisie par
-- l'hote comme photo de couverture plein ecran (pas de FK : ref souple, comme les
-- autres refs denormalisees du module). Defauts surs pour l'existant.
-- Idempotent (IF NOT EXISTS) pour cohabiter avec une colonne auto-creee par
-- Hibernate en dev (ddl-auto=update).
-- ============================================================================

ALTER TABLE welcome_guides ADD COLUMN IF NOT EXISTS theme VARCHAR(20) NOT NULL DEFAULT 'atelier';
ALTER TABLE welcome_guides ADD COLUMN IF NOT EXISTS hero_photo_id BIGINT;
