-- Baitly : réparer les tarifs historiques importés sans changer leur prix.
SELECT set_config('baitly.reference_previous_bypass', COALESCE(current_setting('app.bypass_rls', true), ''), true);
SELECT set_config('app.bypass_rls', 'on', true);

-- Cas historique documenté : tarif global de ménage, accroche d'import standard,
-- offre horaire générique. Ni les offres libres ni les autres métiers ne sont déduits.
CREATE TEMP TABLE baitly_cleaning_reference_repairs ON COMMIT DROP AS
SELECT DISTINCT t.id AS tariff_id, i.id AS item_id
FROM marketplace_provider_services s
JOIN marketplace_providers p ON p.id=s.provider_id
JOIN users u ON u.id=p.user_id AND u.role='HOUSEKEEPER'
JOIN marketplace_service_categories c ON c.id=s.category_id AND c.code='CLEANING'
JOIN marketplace_service_items i ON i.category_id=c.id AND i.code='cleaning-turnover' AND i.active
JOIN provider_tariffs t ON t.id=s.tariff_id AND t.user_id=p.user_id
WHERE s.service_item_id IS NULL AND s.label='Prestation à l’heure'
  AND p.headline='Ménage entre deux séjours'
  AND t.service_key='custom:' || c.id::text || ':' || lower(btrim(s.label))
  AND EXISTS (SELECT 1 FROM provider_tariff_migration_archive a
      WHERE a.source_table='housekeeper_rates' AND a.payload->>'user_id'=p.user_id::text
        AND a.payload->>'property_id' IS NULL)
  AND NOT EXISTS (SELECT 1 FROM provider_tariffs precise
      WHERE precise.user_id=t.user_id AND precise.service_key=i.code)
  AND NOT EXISTS (SELECT 1 FROM marketplace_provider_services other
      WHERE other.tariff_id=t.id AND (other.service_item_id IS NOT NULL OR other.category_id<>c.id
        OR other.label<>s.label));

-- Conserver la référence précédente dans l'archive privée de migration.
INSERT INTO provider_tariff_migration_archive(source_table,source_id,payload)
SELECT 'baitly_service_reference_0546',t.id,to_jsonb(t)
FROM provider_tariffs t JOIN baitly_cleaning_reference_repairs r ON r.tariff_id=t.id
ON CONFLICT(source_table,source_id) DO NOTHING;
UPDATE provider_tariffs t SET service_key='cleaning-turnover'
FROM baitly_cleaning_reference_repairs r WHERE r.tariff_id=t.id;
UPDATE marketplace_provider_services s SET service_item_id=r.item_id
FROM baitly_cleaning_reference_repairs r WHERE r.tariff_id=s.tariff_id AND s.service_item_id IS NULL;

-- Une référence tarifaire déjà précise peut également réparer une projection incomplète.
UPDATE marketplace_provider_services s SET service_item_id=i.id
FROM provider_tariffs t, marketplace_service_items i, marketplace_providers p
WHERE s.tariff_id=t.id AND s.provider_id=p.id AND t.user_id=p.user_id
  AND s.service_item_id IS NULL AND t.service_key=i.code AND s.category_id=i.category_id;

SELECT set_config('app.bypass_rls', current_setting('baitly.reference_previous_bypass'), true);
