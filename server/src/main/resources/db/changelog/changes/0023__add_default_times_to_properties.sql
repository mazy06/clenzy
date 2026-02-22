-- Ajout des heures par defaut check-in/check-out sur les proprietes
ALTER TABLE properties ADD COLUMN IF NOT EXISTS default_check_in_time VARCHAR(5) DEFAULT '15:00';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS default_check_out_time VARCHAR(5) DEFAULT '11:00';
