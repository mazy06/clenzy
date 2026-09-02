-- Photo de profil du voyageur.
--
-- La colonne existait cote client depuis longtemps (`guestAvatarUrl` du DTO
-- reservation, prop `photoUrl` de GuestAvatar) mais rien ne l'alimentait : la
-- brique du planning et la fiche voyageur retombaient toujours sur les
-- initiales.
--
-- Contenu : une CLE DE STOCKAGE opaque `guests/{guestId}/{uuid}.{ext}`, resolue
-- par GuestPhotoStorageService (BYTEA aujourd'hui, S3 demain) et servie par
-- GET /api/guests/{id}/photo. Meme convention que `users.profile_picture_url`.
-- Une URL absolue est toleree pour une photo importee d'un canal : elle est
-- alors renvoyee telle quelle, sans passer par nos routes.
--
-- TEXT et non VARCHAR(n) : une URL externe n'a pas de longueur bornee.
--
-- NON chiffree, a la difference des nom/email/telephone voisins : une cle de
-- stockage n'identifie personne, et les octets ne transitent jamais par cette
-- colonne.
ALTER TABLE guests ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN guests.avatar_url IS
  'Cle de stockage de la photo du voyageur (guests/{id}/{uuid}.ext), ou URL absolue importee. NULL = repli sur les initiales.';
