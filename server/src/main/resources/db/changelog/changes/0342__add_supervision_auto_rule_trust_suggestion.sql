-- Autonomie constellation (Vague 3) — Règles de Confiance étendues aux CARTES.
--
-- L'évaluateur quotidien détecte les types d'action approuvés N fois de suite
-- par un HUMAIN (applied_by 'user:%', un rejet remet à zéro) et SUGGÈRE alors
-- d'automatiser le type (suggested_at + notification). L'humain décide :
-- Activer (toggle ON, suggested_at effacé) ou Ignorer (suggestion_dismissed_at,
-- cooldown de re-suggestion 30 j). Aucune activation automatique.
ALTER TABLE supervision_auto_rules ADD COLUMN IF NOT EXISTS suggested_at TIMESTAMP;
ALTER TABLE supervision_auto_rules ADD COLUMN IF NOT EXISTS suggestion_dismissed_at TIMESTAMP;

COMMENT ON COLUMN supervision_auto_rules.suggested_at IS
    'Suggestion active « automatiser ce type ? » posee par l''evaluateur de confiance (NULL = aucune). Effacee a l''activation ou au rejet.';
COMMENT ON COLUMN supervision_auto_rules.suggestion_dismissed_at IS
    'Derniere suggestion ecartee par l''humain — cooldown de re-suggestion 30 j.';
