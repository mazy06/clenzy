-- Logo d'entreprise du prestataire, repris dans les documents generes.
--
-- Distinct de `organizations.branding_logo_url`, qui habille la page
-- proprietaire publique de l'ORGANISATION. Ici c'est le logo de l'intervenant
-- lui-meme — un independant facture sous sa propre enseigne.
--
-- La colonne porte un storage_key (meme convention que `profile_picture_url`),
-- pas une URL : le binaire vit dans BinaryAssetStorage.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS company_logo_path VARCHAR(500);
