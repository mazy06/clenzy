-- Chiffrement au repos des donnees de contact de la place de marche.
--
-- CE QUI A ETE MANQUE AU 0418 : `users` chiffre deja `first_name`, `last_name`,
-- `email` et `phone_number` en AES-256 via `EncryptedFieldConverter`, et
-- resout l'unicite par `email_hash`. Reprendre ces comptes dans
-- `marketplace_providers` tel que la table etait definie aurait recopie en
-- CLAIR des donnees que le produit protege a la source : la meme personne
-- chiffree dans une table et lisible dans l'autre. C'est une regression de
-- confidentialite, pas un detail de schema.
--
-- LA LIGNE RETENUE : l'identite COMMERCIALE reste en clair, l'identite
-- PERSONNELLE est chiffree.
--   * `display_name` et `legal_name` restent lisibles : c'est le nom sous lequel
--     le professionnel se publie, et ce sont les deux seules colonnes que
--     l'ecran cherche (`LIKE`) et trie. Les chiffrer aurait casse la recherche
--     et le tri, c'est-a-dire ce pour quoi l'ecran existe.
--   * `email`, `phone`, `contact_first_name`, `contact_last_name` sont chiffres :
--     ce sont les coordonnees d'une personne, pas une enseigne.
--
-- UNICITE : un chiffrement AES a vecteur d'initialisation aleatoire produit un
-- ciphertext different a chaque ecriture. Un index unique sur la colonne
-- chiffree ne detecterait donc AUCUN doublon, et un index sur `LOWER(email)`
-- indexerait du ciphertext. L'unicite passe par `email_hash` (SHA-256 du
-- courriel normalise) — le meme mecanisme que `users.email_hash`.
--
-- Aucune reprise de donnees : la table est vide partout (introduite au 0418,
-- alimentee par l'import et le formulaire public, qui n'ont pas encore tourne).
-- Les colonnes sont simplement elargies pour accueillir le ciphertext.

-- Le ciphertext AES est bien plus long que le texte clair : une colonne restee
-- a sa taille d'origine tronquerait la valeur et rendrait le dechiffrement
-- impossible — une perte silencieuse, detectee seulement a la lecture.
ALTER TABLE marketplace_providers ALTER COLUMN email              TYPE VARCHAR(500);
ALTER TABLE marketplace_providers ALTER COLUMN phone              TYPE VARCHAR(500);
ALTER TABLE marketplace_providers ALTER COLUMN contact_first_name TYPE VARCHAR(500);
ALTER TABLE marketplace_providers ALTER COLUMN contact_last_name  TYPE VARCHAR(500);

ALTER TABLE marketplace_providers ADD COLUMN IF NOT EXISTS email_hash VARCHAR(64);

-- L'ancien index portait sur LOWER(email) : desormais du ciphertext, il
-- n'aurait plus aucun sens et empecherait meme deux fiches legitimes de
-- coexister si le chiffrement redonnait la meme valeur.
DROP INDEX IF EXISTS uq_marketplace_provider_email;

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_provider_email_hash
    ON marketplace_providers (email_hash);

COMMENT ON COLUMN marketplace_providers.email IS
  'Chiffre AES-256 au repos (EncryptedFieldConverter), comme users.email.';
COMMENT ON COLUMN marketplace_providers.email_hash IS
  'SHA-256 du courriel normalise. Porte l''unicite et les recherches exactes : le ciphertext, a vecteur aleatoire, ne peut ni etre indexe ni compare.';
COMMENT ON COLUMN marketplace_providers.display_name IS
  'Nom commercial publie — volontairement EN CLAIR : c''est la seule colonne cherchee et triee par l''ecran.';
