-- Note interne sur une conversation voyageur.
--
-- Jusqu'ici, rien ne distinguait une note d'équipe d'une réponse au voyageur :
-- tout message OUTBOUND partait sur le canal. Les opérateurs n'avaient donc
-- aucun endroit pour consigner un contexte ("client déjà venu, exigeant sur le
-- bruit") sans le lui envoyer.
--
-- Le drapeau est porté par le MESSAGE et non par la conversation : une même
-- conversation mêle réponses et notes, dans l'ordre chronologique.
--
-- NOT NULL DEFAULT false : tout l'historique existant est, par construction, du
-- message réellement envoyé. Aucune reprise de données n'est nécessaire.
ALTER TABLE conversation_messages
    ADD COLUMN IF NOT EXISTS internal_note BOOLEAN NOT NULL DEFAULT false;

-- Le fil se lit par conversation, dans l'ordre du temps ; l'index existant sur
-- (conversation_id, sent_at) suffit. On n'en ajoute pas pour le drapeau : il
-- n'est jamais un critère de recherche à lui seul, seulement une colonne
-- ramenée avec le message.
COMMENT ON COLUMN conversation_messages.internal_note IS
    'true = note interne visible des seuls opérateurs, jamais transmise au voyageur';
