-- Purge des clefs de stockage logees dans `avatar_url`.
--
-- CE QUI S'EST PASSE : la premiere version de l'import recopiait
-- `users.profile_picture_url` dans `marketplace_providers.avatar_url`. Or cette
-- colonne source ne contient pas une URL mais une CLEF DE STOCKAGE
-- (`users/3/c52cd983-….jpg`). Servie a une balise <img>, elle se resout contre
-- l'adresse de la PAGE et renvoie 404 : la carte retombait sur les initiales
-- alors que le compte a bien une photo.
--
-- L'import ne recopie plus rien et la photo est desormais resolue A LA LECTURE
-- depuis le compte lie. Les lignes deja ecrites restent pourtant fausses, et
-- l'application ne les regarde plus : c'est exactement le genre de donnee morte
-- qui ressort des mois plus tard. Si l'on detache un professionnel de son
-- compte (`user_id` vide), la resolution repasse sur `avatar_url` et servirait
-- de nouveau cette clef — une image cassee, sans rien pour l'expliquer.
--
-- On vide donc les valeurs qui ne sont PAS des adresses. Le test porte sur la
-- forme et non sur une liste de chemins : une URL commence par un schema
-- (`http`) ou par une barre oblique. Tout le reste est une clef de stockage.
-- Les fiches sans compte — candidatures deposees depuis le site public, qui
-- portent une vraie URL — ne sont pas touchees.
--
-- Rejouable par construction : une seconde execution ne trouve plus rien.

UPDATE marketplace_providers
   SET avatar_url = NULL,
       updated_at = CURRENT_TIMESTAMP
 WHERE avatar_url IS NOT NULL
   AND avatar_url NOT LIKE 'http%'
   AND avatar_url NOT LIKE '/%';

COMMENT ON COLUMN marketplace_providers.avatar_url IS
  'Adresse ABSOLUE ou relative a la racine, reservee aux fiches SANS compte. Une fiche rattachee a un compte emprunte l''URL signee de ce compte, resolue a la lecture.';
