-- Cartes de constellation qui n'appartiennent à AUCUN logement (litige bancaire,
-- demande RGPD, traduction de site, taxe de séjour trimestrielle…). Elles étaient
-- ancrées sur MIN(property.id) de l'organisation faute de mieux : elles
-- n'apparaissaient donc que dans l'accordéon du plus ancien logement — invisibles
-- partout ailleurs, et hors sujet là où elles s'affichaient.
--
-- Le drapeau les rend lisibles depuis N'IMPORTE quel logement (la lecture
-- per-property fait « property_id = ? OR org_level »), sans passer property_id à
-- NULL : la colonne est NOT NULL, la déduplication par (org, property, module,
-- titre) et les agrégats du portefeuille en dépendent. L'ancre reste donc posée,
-- elle ne décide simplement plus de la visibilité.
ALTER TABLE supervision_suggestion
    ADD COLUMN IF NOT EXISTS org_level BOOLEAN NOT NULL DEFAULT false;

-- Lecture per-property : les cartes org-level sont jointes à chaque logement.
CREATE INDEX IF NOT EXISTS idx_supervision_suggestion_org_level
    ON supervision_suggestion (organization_id, org_level, status);
