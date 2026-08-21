-- Contenu structure attache a un message de discussion.
--
-- Un message de fil ne portait que du texte : le recapitulatif d'un devis y
-- etait recopie en toutes lettres, sans moyen d'ouvrir le PDF ni de repondre
-- autrement qu'en ecrivant. Ce payload JSON decrit une carte que l'ecran rend
-- sous le message — l'intervention concernee, son devis, et les gestes qui
-- s'y rattachent.
ALTER TABLE contact_messages ADD COLUMN payload TEXT;
