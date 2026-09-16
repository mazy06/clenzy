-- Confirmation de l'adresse du candidat (double opt-in).
--
-- LE PROBLEME : le formulaire est public et l'adresse n'est verifiee par rien.
-- N'importe qui peut deposer une candidature au nom d'un tiers — avec son nom,
-- son SIRET et son adresse. Le tiers ne l'apprend jamais, et l'equipe instruit
-- un dossier qui n'appartient a personne. Pire, l'acceptation cree un compte
-- Keycloak sur cette adresse et lui envoie une invitation a definir un mot de
-- passe : une usurpation complete, declenchee par un formulaire anonyme.
--
-- CE QUE CELA CHANGE : une candidature n'est ACCEPTABLE que si son adresse a
-- ete confirmee. Elle reste visible et instruisable avant — refuser un dossier
-- non confirme ferait disparaitre de la file ceux dont le courriel s'est perdu.
-- C'est la creation de compte qui exige la preuve, pas l'examen.
--
-- LE JETON EST STOCKE EN EMPREINTE, comme celui de depot : la colonne est lue
-- par tout ce qui accede a la base, et un jeton en clair y serait de quoi
-- confirmer l'adresse d'autrui.

ALTER TABLE marketplace_providers
    ADD COLUMN IF NOT EXISTS email_confirmed_at        TIMESTAMP,
    ADD COLUMN IF NOT EXISTS email_confirm_token_hash  VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_provider_email_confirm_token
    ON marketplace_providers (email_confirm_token_hash)
    WHERE email_confirm_token_hash IS NOT NULL;

-- Les fiches DEJA ACTIVES sont reputees confirmees : elles viennent d'un import
-- de comptes internes ou d'une acceptation anterieure a cette regle. Les
-- declarer non confirmees les rendrait soudain non modifiables, pour un risque
-- qu'elles n'ont jamais porte.
UPDATE marketplace_providers
   SET email_confirmed_at = COALESCE(activated_at, submitted_at)
 WHERE status = 'ACTIVE' AND email_confirmed_at IS NULL;

COMMENT ON COLUMN marketplace_providers.email_confirmed_at IS
  'Horodatage de la confirmation d''adresse. Vide = adresse non prouvee : la fiche ne peut pas etre acceptee.';
COMMENT ON COLUMN marketplace_providers.email_confirm_token_hash IS
  'Empreinte SHA-256 du jeton de confirmation. Le jeton en clair ne part que dans le courriel envoye a l''adresse a prouver.';
