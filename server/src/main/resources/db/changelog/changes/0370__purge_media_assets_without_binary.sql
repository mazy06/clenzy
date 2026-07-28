-- 0370 : purge les media_assets dont le binaire n'a jamais ete ecrit.
--
-- CONTEXTE
-- LocalPhotoStorageService.store() retournait le litteral "pending" SANS rien persister.
-- MediaLibraryService.upload enregistrait donc une ligne media_assets pointant vers une cle
-- qui ne designe aucun octet, ni en base ni sur le stockage objet. Toute relecture echouait
-- (NumberFormatException sur Long.parseLong("pending")) : la mediatheque du Studio etait
-- inutilisable.
--
-- Le correctif applicatif (store() ecrit desormais dans binary_asset sous une cle org-scopee
-- "org/{orgId}/photos/{uuid}") repare les uploads a venir mais ne rattrape rien : ces octets
-- n'ont jamais existe.
--
-- EFFET
-- Suppression des lignes irrecuperables. Ce ne sont pas des donnees perdues par cette
-- migration : elles etaient deja vides. Les conserver ne laisse que des vignettes cassees
-- dans le Studio et fausse les compteurs de la mediatheque.
--
-- PERIMETRE : uniquement storage_key = 'pending'. Les cles org-scopees et toute autre valeur
-- sont preservees.

DELETE FROM media_assets
WHERE storage_key = 'pending';
