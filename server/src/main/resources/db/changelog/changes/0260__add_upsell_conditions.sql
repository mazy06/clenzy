-- Upsells productisés (2.10) : conditionnel + fenêtre horaire.
-- min_nights      : nb de nuits minimal du séjour pour proposer l'offre (NULL = pas de condition).
-- lead_time_hours : délai mini (heures) avant l'arrivée pour pouvoir commander (NULL = aucun).

ALTER TABLE upsell_offers ADD COLUMN IF NOT EXISTS min_nights INTEGER;
ALTER TABLE upsell_offers ADD COLUMN IF NOT EXISTS lead_time_hours INTEGER;
