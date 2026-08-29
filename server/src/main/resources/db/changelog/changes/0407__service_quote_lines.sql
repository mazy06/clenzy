-- Detail chiffre d'un devis prestataire.
--
-- Le devis ne portait qu'un total. Les prestations retenues se perdaient dans
-- la description : le proprietaire voyait « 320 € » sans savoir ce que la somme
-- couvre, et rien ne rattachait le montant aux tarifs convenus.
--
-- Meme forme que service_requests.quote_lines : un tableau JSON de
-- {label, quantity, unitPrice, interventionType}.
ALTER TABLE service_quotes ADD COLUMN lines TEXT;
