-- Frais OTA perçus sur la réservation (ex. host fee Airbnb), si connus.
-- Base du calcul de commission NET_OF_OTA_FEE ; null = inconnu → commission calculée sur le brut.
ALTER TABLE reservations
    ADD COLUMN IF NOT EXISTS ota_fee_amount NUMERIC(10,2);
