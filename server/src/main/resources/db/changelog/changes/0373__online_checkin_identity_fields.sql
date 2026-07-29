-- Champs d'identité sur le check-in en ligne, pour qu'il produise la fiche
-- voyageur (fiche de police, DGSN selon le pays du logement).
--
-- Les deux collectes vivaient séparément : le check-in demandait de quoi
-- accueillir (qui arrive, quand, avec quelle pièce d'identité), la fiche
-- exigeait de quoi déclarer (naissance, nationalité, résidence). Un voyageur
-- pouvait donc compléter intégralement son check-in sans que la fiche existe,
-- et le tableau de bord lui reprochait ensuite une formalité qu'on ne lui avait
-- jamais présentée.
--
-- Ces colonnes conservent la saisie du voyageur côté check-in. La fiche
-- elle-même reste dans `guest_declarations` : elle porte sa propre durée de
-- rétention réglementaire, et une purge ne doit pas emporter le check-in.

-- Longueur 500 partout : ces colonnes stockent du CHIFFRÉ, comme les autres
-- données personnelles de cette table (nom, email, numéro de pièce d'identité).
-- Date et lieu de naissance, adresse de résidence sont parmi les données les
-- plus sensibles du produit ; les stocker en clair aurait été une régression de
-- confidentialité, et les dimensionner sur le texte clair aurait tronqué le
-- chiffré.

ALTER TABLE online_checkins
    ADD COLUMN IF NOT EXISTS maiden_name       VARCHAR(500),
    ADD COLUMN IF NOT EXISTS birth_date        VARCHAR(500),
    ADD COLUMN IF NOT EXISTS birth_place       VARCHAR(500),
    ADD COLUMN IF NOT EXISTS nationality       VARCHAR(500),
    ADD COLUMN IF NOT EXISTS residence_address VARCHAR(500),
    ADD COLUMN IF NOT EXISTS residence_country VARCHAR(500);
