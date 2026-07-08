-- Concierge guest (C1) : brouillon de réponse IA attaché à la conversation.
-- Jamais envoyé sans validation opérateur (autonomie SUGGEST).
ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS ai_draft_reply text,
    ADD COLUMN IF NOT EXISTS ai_draft_meta  text;
