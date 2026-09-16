-- Preuve d'acceptation des conditions prestataire.
--
-- CE QUI MANQUAIT : le formulaire public envoie `acceptedTerms`, le service le
-- VERIFIE puis le JETTE. Une candidature enregistree ne garde donc aucune trace
-- de ce qui a ete accepte, ni quand, ni depuis ou. En cas de contestation il n'y
-- a rien a produire — et l'article 7 du RGPD demande de pouvoir demontrer le
-- consentement.
--
-- MEME FORME QUE L'EXISTANT : `users` porte deja
-- `provider_terms_version` / `_accepted_at` / `_accepted_ip` et le service
-- `UserService.acceptProviderTerms` les remplit. On reprend les trois memes
-- colonnes plutot que d'inventer une seconde forme de preuve : le jour ou un
-- candidat devient utilisateur, la reprise est une copie.
--
-- LA VERSION EST UNE CHAINE, PAS UNE DATE : c'est l'identifiant du DOCUMENT
-- accepte (« 2026-08 »), pas le moment de l'acceptation. Les deux sont
-- necessaires — savoir quand quelqu'un a accepte ne dit pas ce qu'il a accepte.
--
-- L'IP EST UNE PREUVE, PAS UNE DONNEE D'ECRAN : elle est stockee mais n'est
-- exposee par aucun DTO, exactement comme pour les utilisateurs.

ALTER TABLE marketplace_providers
    ADD COLUMN IF NOT EXISTS terms_version     VARCHAR(20),
    ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS terms_accepted_ip VARCHAR(45);

-- Les 54 fiches existantes viennent d'un import de comptes internes, pas d'une
-- candidature : personne n'a rien accepte pour elles, et leur poser une fausse
-- preuve serait pire que l'absence de preuve. Les colonnes restent donc vides,
-- et c'est cette absence qui est exacte.

COMMENT ON COLUMN marketplace_providers.terms_version IS
  'Identifiant du document accepte (ex. 2026-08), aligne sur UserService.PROVIDER_TERMS_VERSION. Vide pour une fiche reprise d''un compte interne : personne n''a rien accepte.';
COMMENT ON COLUMN marketplace_providers.terms_accepted_ip IS
  'Adresse resolue par ClientIpResolver. Preuve conservee, jamais exposee par un DTO.';
