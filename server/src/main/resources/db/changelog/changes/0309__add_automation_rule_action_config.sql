-- Campagne Baitly vague 3 (fiche 08) — config JSON d'ACTION des regles d'automatisation,
-- distincte de `conditions` (criteres de matching). Premier usage : REVOKE_ACCESS_CODE
-- avec {"graceHours": 4} (delai de grace apres le check-out avant revocation du code).
-- Nom de table verifie contre @Table(name = "automation_rules") (cf. 0305).
-- Table issue de l'ere Hibernate ddl-auto -> ALTER defensif IF NOT EXISTS.

ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS action_config JSONB;
