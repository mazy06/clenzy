-- Une demande générale porte un devis, sans inventer un logement ni une mission.
ALTER TABLE service_quotes ALTER COLUMN property_id DROP NOT NULL;
