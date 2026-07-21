-- Fondations RMS (R1) : horodatage d'annulation des reservations.
-- Permet de reconstruire l'on-the-books a une date passee S (pace / pickup / booking curve) :
-- une reservation compte a S si created_at <= S et (cancelled_at IS NULL OU cancelled_at > S).
ALTER TABLE reservations ADD COLUMN cancelled_at TIMESTAMP;

-- Backfill : pour les reservations deja annulees, updated_at est la meilleure approximation
-- disponible de l'instant d'annulation (le statut est une simple chaine sans horodatage).
-- Approximation assumee : updated_at peut etre posterieur a l'annulation reelle si la ligne
-- a ete retouchee depuis.
UPDATE reservations SET cancelled_at = updated_at
WHERE LOWER(status) = 'cancelled' AND cancelled_at IS NULL;
