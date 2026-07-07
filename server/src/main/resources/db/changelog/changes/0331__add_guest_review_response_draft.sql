-- Brouillon de réponse d'avis généré par l'IA (REP) : distinct de host_response (publiée).
-- L'agent Réputation propose un brouillon À VALIDER (jamais de publication auto sur un avis
-- négatif) ; l'opérateur le relit/édite avant de publier (respondToReview → host_response).
ALTER TABLE guest_reviews ADD COLUMN IF NOT EXISTS host_response_draft TEXT;
ALTER TABLE guest_reviews ADD COLUMN IF NOT EXISTS host_response_draft_at TIMESTAMP;
