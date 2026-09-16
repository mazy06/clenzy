-- Baitly : même prestation et mêmes preuves, seule la référence historique change.
-- Tables vérifiées dans 0460 ; ne jamais élargir une catégorie à ses métiers.
INSERT INTO provider_documentary_rules(country,professional_status,service_scope,required_types,regulated,version,reason,actor)
SELECT r.country,r.professional_status,'ITEM:'||a.service_item_code,r.required_types,r.regulated,r.version,r.reason,r.actor
FROM provider_documentary_rules r JOIN service_catalog_legacy_aliases a ON r.service_scope='TYPE:'||a.legacy_type
ON CONFLICT(country,professional_status,service_scope) DO NOTHING;

-- Ne pas remplacer une revue précise existante ni approuver sous une règle différente.
-- Identifiant, auteur, dates, révocation et preuves restent inchangés.
UPDATE provider_documentary_reviews v SET service_scope='ITEM:'||a.service_item_code
FROM service_catalog_legacy_aliases a
WHERE v.service_scope='TYPE:'||a.legacy_type
AND NOT EXISTS (SELECT 1 FROM provider_documentary_reviews precise
    WHERE precise.provider_id=v.provider_id AND precise.country=v.country
    AND precise.service_scope='ITEM:'||a.service_item_code)
AND NOT EXISTS (
    SELECT 1 FROM provider_documentary_rules precise
    LEFT JOIN provider_documentary_rules old ON old.country=precise.country
      AND old.professional_status=precise.professional_status AND old.service_scope=v.service_scope
    WHERE precise.country=v.country AND precise.professional_status=v.professional_status
      AND precise.service_scope='ITEM:'||a.service_item_code
      AND (old.service_scope IS NULL OR precise.version<>old.version
        OR precise.required_types<>old.required_types OR precise.regulated<>old.regulated)
);
