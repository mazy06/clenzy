-- ============================================================================
-- 0141 : Pieces jointes (images) sur les messages de l'assistant
-- ----------------------------------------------------------------------------
-- Contexte : ajout du vision support — l'user peut uploader des images dans
-- le chat. Les fichiers physiques sont stockes via PhotoStorageService (S3
-- ou BYTEA selon profile). Cette colonne stocke uniquement les references
-- (cle de stockage + media type + url affichable) pour pouvoir re-rendre
-- l'historique cote frontend et re-fournir les bytes a Anthropic au tour
-- suivant si besoin.
--
-- Schema JSONB attendu : [
--   { "storageKey": "...", "mediaType": "image/jpeg", "url": "...", "name": "..." }
-- ]
-- ============================================================================

ALTER TABLE assistant_message
    ADD COLUMN IF NOT EXISTS attachments JSONB;

COMMENT ON COLUMN assistant_message.attachments IS
    'Array JSON de pieces jointes (images uploadees par l''user). Chaque entree
    contient au minimum storageKey + mediaType. Utilise pour re-fournir les
    bytes a Anthropic ou afficher les thumbnails cote frontend.';
