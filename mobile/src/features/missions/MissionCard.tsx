import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Reicon } from '@/icons';
import { BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { BaitlyPill } from '@/design-system/primitives';

export function MissionCard({ title, property, person, status, date, notes, artwork, onPress,compact=false,paused=false,owner=false }: {
  title: string; property?: string; person?: string; status: string; date?: string; notes?: string; artwork?: number; onPress: () => void;compact?:boolean;paused?:boolean;owner?:boolean;
}) {
  const c = useBaitlyTheme();
  const { t, i18n } = useTranslation('mobileV1');
  const row = { flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' as const : 'row' as const };
  const tone = paused ? 'warning' : status === 'COMPLETED' ? 'success' : status === 'IN_PROGRESS' ? 'warning' : status === 'CANCELLED' ? 'error' : 'neutral';
  const parsed=date?new Date(date):undefined;
  const dateLabel=parsed&&Number.isFinite(parsed.getTime())?`${parsed.toLocaleDateString(i18n.language,{day:'2-digit',month:'short'})} · ${parsed.toLocaleTimeString(i18n.language,{hour:'2-digit',minute:'2-digit'})}`:undefined;
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card,compact?{borderRadius:16,padding:12,borderWidth:1,borderColor:c.border}:undefined, { backgroundColor: pressed ? c.muted : compact?c.background:c.surface }]}>
    <View style={[styles.top, row]}><View style={styles.flex}>
      <BaitlyPill tone={tone} label={t(paused?'missionPaused':['SCHEDULED', 'ASSIGNED'].includes(status) || (owner && status === 'PENDING') ? 'planningScheduled' : `missionStatus.${status}`, { defaultValue: status })} />
      <BaitlyText style={[styles.title,compact?{fontSize:16,lineHeight:22}:undefined]} numberOfLines={2}>{title}</BaitlyText></View>
      <Image source={artwork ?? require('../../../assets/baitly/navigation/baitly-missions.png')} style={[styles.image, compact ? { width: 38, height: 42 } : undefined]} contentFit="contain" enforceEarlyResizing accessible={false} /></View>
    {property ? <View style={[styles.meta, row]}><Reicon name="home-outline" size={16} color={c.secondary} /><BaitlyText muted variant="meta" numberOfLines={1} style={styles.flex}>{property}</BaitlyText></View> : null}
    <View style={[styles.bottom, row, { borderTopColor: c.border }]}><BaitlyText muted variant="meta" style={[styles.flex, styles.number]} numberOfLines={1}>{[dateLabel, person].filter(Boolean).join(' · ') || t('planningUnassigned')}</BaitlyText>
      <Reicon name="chevron-forward" size={18} color={c.secondary} /></View>
    {notes ? <BaitlyText variant="meta">{notes}</BaitlyText> : null}
  </Pressable>;
}
const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 14, gap: 6, marginBottom: 12 }, flex: { flex: 1 }, top: { alignItems: 'center', gap: 8 },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '600', marginTop: 4 }, image: { width: 56, height: 62 },
  meta: { alignItems: 'center', gap: 7 }, bottom: { alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 2 }, number: { fontVariant: ['tabular-nums'] },
});
