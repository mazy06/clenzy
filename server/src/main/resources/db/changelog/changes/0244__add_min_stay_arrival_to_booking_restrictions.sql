-- CLZ Domaine 1 / Item 2 : couverture complete des restrictions de sejour.
-- min_stay_arrival (duree min si l'arrivee tombe ce jour) distincte de min_stay (min_stay_through),
-- pour synchroniser correctement la restriction vers les OTAs via Channex (etait hardcode null).

ALTER TABLE booking_restrictions ADD COLUMN IF NOT EXISTS min_stay_arrival INTEGER;
