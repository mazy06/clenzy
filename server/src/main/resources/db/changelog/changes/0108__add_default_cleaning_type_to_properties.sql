-- Type de menage par defaut pour cette propriete (Standard / Express / En profondeur).
-- Sert d'indication aux prestataires lors de la creation d'une demande de service depuis
-- un import iCal ou une integration channel (Airbnb, Booking, etc.).
-- Valeurs possibles : 'CLEANING' (Standard), 'EXPRESS_CLEANING', 'DEEP_CLEANING'
ALTER TABLE properties ADD COLUMN default_cleaning_type VARCHAR(30) NOT NULL DEFAULT 'CLEANING';

ALTER TABLE properties ADD CONSTRAINT properties_default_cleaning_type_check
    CHECK (default_cleaning_type IN ('CLEANING', 'EXPRESS_CLEANING', 'DEEP_CLEANING'));
