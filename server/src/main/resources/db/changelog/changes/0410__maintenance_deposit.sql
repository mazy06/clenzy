-- Acompte de maintenance.
--
-- Le menage et la lingerie se paient a la fin du travail. Une intervention de
-- maintenance peut demander un acompte : achat de materiel, immobilisation
-- d'une journee. Le POURCENTAGE est decide par la plateforme, jamais par le
-- prestataire — sinon chacun fixerait le sien.
ALTER TABLE platform_settings
    ADD COLUMN maintenance_deposit_percent NUMERIC(5,2) NOT NULL DEFAULT 30.00;

-- Snapshot sur le devis : le pourcentage peut changer, un devis emis ne
-- change plus.
ALTER TABLE service_quotes ADD COLUMN deposit_percent NUMERIC(5,2);
ALTER TABLE service_quotes ADD COLUMN deposit_amount NUMERIC(12,2);
