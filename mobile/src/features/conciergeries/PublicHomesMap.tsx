import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { ProviderMap } from '@/features/marketplace/ProviderMap';
import { BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { Reicon } from '@/icons';
import type { PublicClient } from './publicProfiles';
import { publicHomeMapPins, publicMapHomes } from './publicPropertyMap';
import { publicPropertyPhotos } from './publicPropertyPhotos';

export function PublicHomesMap({ clients, onOpen }: { clients: PublicClient[]; onOpen: (profileId: string, propertyId: string) => void }) {
  const { t, i18n } = useTranslation('mobileV1');
  const colors = useBaitlyTheme();
  const homes = useMemo(() => publicMapHomes(clients), [clients]);
  const pins = useMemo(() => publicHomeMapPins(homes), [homes]);
  return <ProviderMap providers={pins} mapLabels={{ map: t('publicHomesMap'), pin: t('publicMapHome') }}
    renderSelection={id => {
      const home = homes.find(item => item.id === id);
      if (!home) return null;
      const { property, client } = home;
      const photo = publicPropertyPhotos(property, client.demo)[0];
      return <Pressable accessibilityRole="button" accessibilityLabel={property.name} onPress={() => onOpen(client.id, property.id)}
        style={({ pressed }) => [styles.card, { backgroundColor: pressed ? colors.muted : colors.surface,
          flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' : 'row' }]}>
        <View style={[styles.photo, { backgroundColor: colors.muted }]}>{photo ? <Image source={photo} style={styles.photo} contentFit="cover" />
          : <Reicon name="home-outline" size={28} color={colors.secondary} />}</View>
        <View style={styles.text}>
          <BaitlyText variant="heading" numberOfLines={1}>{property.name}</BaitlyText>
          <BaitlyText variant="meta" muted numberOfLines={1}>{client.organization ?? client.name}</BaitlyText>
          <BaitlyText variant="meta" numberOfLines={1}>{property.city}</BaitlyText>
          <BaitlyText variant="meta" muted>{t('publicMapApproximate')}</BaitlyText>
          {client.demo ? <BaitlyText variant="meta" muted>{t('directoryDemo')}</BaitlyText> : null}
        </View>
      </Pressable>;
    }} />;
}
const styles = StyleSheet.create({
  card: { padding: 10, borderRadius: 14, gap: 12, alignItems: 'center' },
  photo: { width: 76, height: 82, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, text: { flex: 1, gap: 3 },
});
