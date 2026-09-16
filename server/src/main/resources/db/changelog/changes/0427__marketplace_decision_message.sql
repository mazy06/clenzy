-- Reponse faite au candidat, distincte de la note interne.
--
-- LE PROBLEME : `review_note` sert deja de motif de refus ET de note d'equipe.
-- Un seul champ pour deux lecteurs, c'est soit une note franche qu'on n'ose pas
-- envoyer, soit un message diplomatique qui ne dit rien a l'equipe. Les
-- moderateurs finissent par n'ecrire ni l'un ni l'autre.
--
-- DEUX CHAMPS, DEUX LECTEURS : `review_note` reste interne et n'est jamais
-- envoyee. `decision_message` est ecrite POUR le candidat et part dans le
-- courriel de decision. Plus long que la note interne (2000) : expliquer un
-- refus et dire quoi corriger prend des phrases.
--
-- `decision_sent_at` dit si la reponse est DEJA PARTIE. Sans elle, un second
-- changement d'etat renverrait un courriel pour une decision deja annoncee.

ALTER TABLE marketplace_providers
    ADD COLUMN IF NOT EXISTS decision_message VARCHAR(2000),
    ADD COLUMN IF NOT EXISTS decision_sent_at TIMESTAMP;

COMMENT ON COLUMN marketplace_providers.decision_message IS
  'Message ecrit pour le candidat et envoye par courriel. Distinct de review_note, qui reste interne.';
COMMENT ON COLUMN marketplace_providers.decision_sent_at IS
  'Horodatage de l''envoi de la reponse. Vide tant qu''aucune decision n''a ete annoncee.';
