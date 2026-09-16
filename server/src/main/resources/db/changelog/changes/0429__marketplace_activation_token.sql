-- Activation du compte d'un prestataire accepte, sur NOS pages.
--
-- CE QU'ON REMPLACE : l'invitation etait deleguee a Keycloak
-- (`executeActionsEmail`). Elle fonctionne, mais elle depose le prestataire sur
-- un ecran Keycloak — une autre identite visuelle, une autre adresse, au milieu
-- d'un parcours qui s'est fait jusque-la sur le site Baitly. Pour quelqu'un qui
-- vient de candidater, ce saut ressemble a une tentative d'hameconnage.
--
-- CE JETON permet de faire la meme chose sur notre propre formulaire, avec le
-- meme motif que l'inscription client (`pending_inscription`) : un lien envoye
-- par courriel, une page a nous, puis le mot de passe pose dans Keycloak par le
-- serveur.
--
-- EMPREINTE, comme les autres : la colonne est lue par tout ce qui accede a la
-- base, et ce jeton-la ouvre un COMPTE. C'est le plus sensible des trois.
--
-- SEPT JOURS, la ou le depot de pieces en a trente : reunir un Kbis prend des
-- jours, choisir un mot de passe prend une minute. Une fenetre courte reduit
-- d'autant la valeur d'un courriel intercepte.

ALTER TABLE marketplace_providers
    ADD COLUMN IF NOT EXISTS activation_token_hash       VARCHAR(64),
    ADD COLUMN IF NOT EXISTS activation_token_expires_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_provider_activation_token
    ON marketplace_providers (activation_token_hash)
    WHERE activation_token_hash IS NOT NULL;

COMMENT ON COLUMN marketplace_providers.activation_token_hash IS
  'Empreinte SHA-256 du jeton d''activation. Vide une fois le mot de passe defini : il ne sert qu''une fois.';
