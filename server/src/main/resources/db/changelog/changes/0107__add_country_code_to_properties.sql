-- Ajout du code ISO pays (FR, MA, DZ, SA, etc.) aux proprietes
-- Permet de router le geocodage vers le bon service (BAN pour FR, Nominatim pour les autres)
ALTER TABLE properties ADD COLUMN country_code VARCHAR(2);

-- Backfill des proprietes existantes avec country_code = 'FR' quand country = 'France'
UPDATE properties SET country_code = 'FR' WHERE LOWER(country) IN ('france', 'fr');
UPDATE properties SET country_code = 'MA' WHERE LOWER(country) IN ('maroc', 'ma', 'morocco');
UPDATE properties SET country_code = 'DZ' WHERE LOWER(country) IN ('algerie', 'algérie', 'dz', 'algeria');
UPDATE properties SET country_code = 'SA' WHERE LOWER(country) IN ('arabie saoudite', 'sa', 'saudi arabia');

CREATE INDEX idx_properties_country_code ON properties(country_code);
