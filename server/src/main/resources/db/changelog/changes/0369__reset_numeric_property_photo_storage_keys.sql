-- 0369 : remet a NULL les storage_key numeriques de property_photos.
--
-- CONTEXTE
-- PropertyPhotoService.uploadPhoto ecrivait storage_key = String.valueOf(id) apres le save,
-- une cle qui ne designe aucun objet de stockage : les octets ont toujours vecu dans la
-- colonne BYTEA `data`. Tant que le flag clenzy.storage.photos vaut `bytea`, cette cle etait
-- inoffensive (LocalPhotoStorageService la relisait comme un property_photos.id).
--
-- Elle devient bloquante des qu'on bascule clenzy.storage.photos=object :
-- ObjectStoragePhotoService.retrieve("1234") demande au bucket un objet nomme "1234"
-- -> NoSuchKey -> 500 sur toute photo portant une cle numerique.
--
-- EFFET
-- storage_key = NULL retablit le contrat de lecture attendu (identique aux photos
-- d'intervention) : storage_key NULL => octets lus dans `data` ; storage_key non-null =>
-- octets resolus par le backend de stockage actif. Le job de migration
-- (POST /api/admin/storage/migrate-photos) ecrira ensuite la vraie cle org-scopee
-- `org/{orgId}/photos/{uuid}`.
--
-- SANS PERTE : aucune donnee binaire n'est touchee. On efface un pointeur qui n'a jamais
-- designe autre chose que la ligne elle-meme. Les cles deja migrees (prefixe `org/`) sont
-- explicitement preservees par le filtre.

UPDATE property_photos
SET storage_key = NULL
WHERE storage_key ~ '^[0-9]+$';
