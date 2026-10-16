import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Reicon } from '@/icons';
import { useTheme } from '@/theme';
import { sectorMapApi } from '@/api/endpoints/sectorMapApi';
import { BaitlyEmbedMap, type SectorMode } from '@/components/maps/BaitlyEmbedMap';

type SectorMapRoute = RouteProp<{ SectorMap: { scope: 'mine' | 'relevant' } }, 'SectorMap'>;

/**
 * Carte des secteurs d'intervention.
 * - `relevant` (hôtes, conciergeries) : secteurs des prestataires qui couvrent au moins un
 *   logement, épingles couvert / non couvert.
 * - `mine` (intervenants) : le secteur déclaré, pour vérifier où l'on sera trouvé.
 */
export function SectorMapScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { scope } = useRoute<SectorMapRoute>().params;
  const [mode, setMode] = useState<SectorMode>('merged');
  const query = useQuery({
    queryKey: ['sector-map', scope],
    queryFn: () => (scope === 'mine' ? sectorMapApi.mine() : sectorMapApi.relevant()),
  });
  const providers = query.data?.providers ?? [];
  const drawn = providers.filter((p) => p.geometry).length;
  const uncovered = (query.data?.properties ?? []).filter((p) => p.coveredBy.length === 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.SPACING.md, padding: theme.SPACING.lg }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Retour')}>
          <Reicon name="chevron-back" size={24} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, flex: 1 }}>
          {scope === 'mine' ? t('sectorMap.mineTitle') : t('sectorMap.title')}
        </Text>
      </View>

      {drawn > 1 && (
        <View style={{ flexDirection: 'row', marginHorizontal: theme.SPACING.lg, marginBottom: theme.SPACING.sm,
          borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border.light, overflow: 'hidden', alignSelf: 'flex-start' }}>
          {(['merged', 'byProvider'] as const).map((value) => (
            <Pressable key={value} onPress={() => setMode(value)} accessibilityRole="button"
              accessibilityState={{ selected: mode === value }}
              style={{ paddingVertical: 8, paddingHorizontal: 14,
                backgroundColor: mode === value ? theme.colors.background.paper : 'transparent' }}>
              <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary,
                fontWeight: mode === value ? '600' : '400' }}>
                {t(value === 'merged' ? 'sectorMap.merged' : 'sectorMap.byProvider')}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={{ flex: 1 }}>
        <BaitlyEmbedMap map={query.data} mode={drawn > 1 ? mode : 'byProvider'} dark={theme.isDark}
          onPropertyPress={scope === 'relevant'
            ? (propertyId) => navigation.navigate('PropertyDetail', { propertyId })
            : undefined} />
      </View>

      <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ padding: theme.SPACING.lg, gap: theme.SPACING.sm }}>
        {query.isError && (
          <Text style={{ ...theme.typography.body2, color: theme.colors.error.main }}>{t('sectorMap.loadError')}</Text>
        )}
        {query.data && drawn === 0 && (
          <Text style={{ ...theme.typography.body2, color: theme.colors.text.secondary }}>
            {scope === 'mine' ? t('sectorMap.mineEmpty') : t('sectorMap.noneRelevant')}
          </Text>
        )}
        {providers.map((provider) => (
          <View key={provider.providerId ?? 'mine'}>
            <Text style={{ ...theme.typography.body2, fontWeight: '600', color: theme.colors.text.primary }}>
              {provider.name ?? t('sectorMap.mySector')}
            </Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary }}>
              {provider.zones.map((zone) => zone.name).join(', ') || t('sectorMap.noZone')}
            </Text>
          </View>
        ))}
        {scope === 'relevant' && uncovered.length > 0 && drawn > 0 && (
          <Text style={{ ...theme.typography.caption, color: theme.colors.warning.main }}>
            {t('sectorMap.uncovered', { count: uncovered.length, names: uncovered.slice(0, 5).map((p) => p.name).join(', ') })}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
