import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Reicon } from '@/icons';
import { interventionsApi, type Intervention } from '@/api/endpoints/interventionsApi';
import { useBaitlyScope } from '@/features/marketplace/queries';
import { canUseBaitlyDemo, useBaitlyDataMode } from '@/config/baitlyDataMode';
import { BaitlyEmpty, BaitlyLoading, BaitlyScreen, BaitlyText, BaitlyButton } from '@/design-system/components';
import { BaitlyHeaderAction } from '@/design-system/BaitlyHeader';
import { useBaitlyTheme } from '@/design-system/theme';
import { planningDateKey, planningDemo, planningHour } from './planningModel';

const filters = ['', 'PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;
export function PlanningDashboardScreen() {
  const { t, i18n } = useTranslation('mobileV1');
  const c = useBaitlyTheme();
  const navigation = useNavigation<any>();
  const scope = useBaitlyScope();
  const mode = useBaitlyDataMode(s => s.mode);
  const demo = canUseBaitlyDemo() && mode === 'demo';
  const [date, setDate] = useState(() => new Date());
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const dateKey = planningDateKey(date);
  const result = useQuery({ queryKey: [...scope, 'planning', dateKey], enabled: !demo,
    queryFn: () => interventionsApi.getAll({ startDate: dateKey, endDate: dateKey, sort: 'startTime,asc', size: 50 }), retry: false });
  const items = useMemo(() => demo ? planningDemo(dateKey) : result.data?.content ?? [], [demo, dateKey, result.data]);
  const visible = items.filter(item => !filter || (filter === 'PENDING' ? ['PENDING', 'SCHEDULED', 'ASSIGNED'].includes(item.status) : item.status === filter));
  const days = Array.from({ length: 7 }, (_, index) => { const d = new Date(date); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + index); return d; });
  const row = { flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' as const : 'row' as const };
  const shiftWeek = (amount: number) => { setDate(current => { const next = new Date(current); next.setDate(next.getDate() + amount); return next; }); setExpanded(null); };
  const render = ({ item }: { item: Intervention }) => {
    const completed = item.status === 'COMPLETED';
    const active = item.status === 'IN_PROGRESS';
    const tone = completed ? c.success : active ? c.warning : c.secondary;
    return <View style={[styles.timeline, row]}>
      <View style={styles.time}><BaitlyText style={styles.hour}>{planningHour(item.startTime, i18n.language)}</BaitlyText>
        <View style={[styles.dot, { backgroundColor: tone }]} /><View style={[styles.line, { backgroundColor: c.border }]} /></View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: demo ? expanded === item.id : undefined }}
        onPress={() => demo ? setExpanded(current => current === item.id ? null : item.id)
          : navigation.navigate('Interventions', { screen: 'InterventionDetail', params: { interventionId: item.id } })}
        style={({ pressed }) => [styles.mission, { backgroundColor: pressed ? c.muted : c.surface }]}>
        <View style={[styles.missionTop, row]}><BaitlyText variant="meta" style={{ color: tone }}>{t(item.status === 'SCHEDULED' || item.status === 'ASSIGNED' ? 'planningScheduled' : `missionStatus.${item.status}`, { defaultValue: item.status })}</BaitlyText>
          {item.isUrgent ? <BaitlyText variant="meta" style={{ color: c.danger }}>{t('planningUrgent')}</BaitlyText> : null}</View>
        <BaitlyText style={styles.missionTitle} numberOfLines={2}>{item.title || item.type}</BaitlyText>
        {item.propertyName ? <View style={[styles.meta, row]}><Reicon name="home-outline" size={15} color={c.secondary} /><BaitlyText muted variant="meta" numberOfLines={1} style={styles.flex}>{item.propertyName}</BaitlyText></View> : null}
        <View style={[styles.missionBottom, row]}><View style={[styles.meta, row, styles.flex]}><Reicon name="person-outline" size={15} color={c.secondary} />
          <BaitlyText muted variant="meta" numberOfLines={1} style={styles.flex}>{item.assignedTechnicianName || item.teamName || t('planningUnassigned')}</BaitlyText></View><Reicon name="chevron-forward" size={17} color={c.secondary} /></View>
        {demo && expanded === item.id ? <BaitlyText variant="meta" style={styles.notes}>{item.description}</BaitlyText> : null}
      </Pressable>
    </View>;
  };
  return <BaitlyScreen scroll={false} actions={<BaitlyHeaderAction icon="add" label={t('planningCreate')}
    onPress={() => navigation.navigate('Interventions', { screen: 'CreateIntervention' })} />}>
    <FlashList data={visible} renderItem={render} keyExtractor={item => String(item.id)} extraData={expanded} contentContainerStyle={styles.content}
      refreshControl={demo ? undefined : <RefreshControl refreshing={result.isRefetching} onRefresh={() => { void result.refetch(); }} tintColor={c.secondary} />}
      ListHeaderComponent={<View style={styles.headerContent}>
        <View style={[row, { gap: 8 }]}>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Interventions')} style={({ pressed }) => ({ flex: 1, minHeight: 48, padding: 10, flexDirection: row.flexDirection, alignItems: 'center', gap: 8, borderRadius: 10, backgroundColor: pressed ? c.muted : c.surface })}><Reicon name="checkmark-circle-outline" size={22} color={c.ink} /><BaitlyText variant="meta">{t('missions')}</BaitlyText></Pressable>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('More', { screen: 'Incidents' })} style={({ pressed }) => ({ flex: 1, minHeight: 48, padding: 10, flexDirection: row.flexDirection, alignItems: 'center', gap: 8, borderRadius: 10, backgroundColor: pressed ? c.muted : c.surface })}><Reicon name="alert-circle-outline" size={22} color={c.ink} /><BaitlyText variant="meta">{t('adminIncidents')}</BaitlyText></Pressable>
        </View>
        <View style={[styles.monthRow, row]}><View style={styles.flex}><BaitlyText style={styles.month}>{date.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })}</BaitlyText>
          {demo ? <BaitlyText muted variant="meta">{t('homeDemo')}</BaitlyText> : null}</View>
          <BaitlyHeaderAction icon="chevron-back" label={t('planningPrevious')} onPress={() => shiftWeek(-7)} />
          <BaitlyHeaderAction icon="chevron-forward" label={t('planningNext')} onPress={() => shiftWeek(7)} /></View>
        <View style={[styles.days, row]}>{days.map(day => { const selected = planningDateKey(day) === dateKey; return <Pressable key={planningDateKey(day)} accessibilityRole="button"
          accessibilityLabel={day.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })} accessibilityState={{ selected }}
          onPress={() => { setDate(day); setExpanded(null); }} style={({ pressed }) => [styles.day, { backgroundColor: selected ? c.primary : pressed ? c.muted : c.surface }]}>
          <BaitlyText variant="meta" style={{ color: selected ? c.onPrimary : c.secondary, fontSize: 12 }}>{day.toLocaleDateString(i18n.language, { weekday: 'short' })}</BaitlyText>
          <BaitlyText style={[styles.dayNumber, { color: selected ? c.onPrimary : c.ink }]}>{day.getDate()}</BaitlyText></Pressable>; })}</View>
        <View style={[styles.dateRow, row]}><BaitlyText variant="heading" style={styles.flex}>{date.toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric' })}</BaitlyText>
          <Pressable accessibilityRole="button" onPress={() => { setDate(new Date()); setExpanded(null); }} style={styles.today}><BaitlyText variant="meta">{t('today')}</BaitlyText></Pressable>
          <BaitlyHeaderAction icon="add" label={t('planningCreate')} onPress={() => navigation.navigate('Interventions', { screen: 'CreateIntervention' })} /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filters, row]}>{filters.map(status => <Pressable key={status} accessibilityRole="button"
          accessibilityState={{ selected: filter === status }} onPress={() => setFilter(status)} style={({ pressed }) => [styles.filter, { backgroundColor: filter === status ? c.muted : pressed ? c.surface : 'transparent' }]}>
          <BaitlyText variant="meta" style={{ fontWeight: filter === status ? '600' : '400' }}>{t(status ? `missionStatus.${status}` : 'planningAll')}
            {!status ? ` · ${items.length}${!demo && (result.data?.totalElements ?? 0) > items.length ? '+' : ''}` : ''}</BaitlyText></Pressable>)}</ScrollView>
      </View>}
      ListEmptyComponent={!demo && result.isPending ? <BaitlyLoading /> : !demo && result.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void result.refetch(); }} />
        : <View style={styles.empty}><Image source={require('../../../assets/baitly/navigation/baitly-today.png')} style={styles.emptyImage} contentFit="contain" accessible={false} />
          <BaitlyText variant="heading">{t('planningEmpty')}</BaitlyText></View>}
      ListFooterComponent={!demo && (result.data?.totalElements ?? 0) > items.length ? <BaitlyButton secondary title={t('planningAllMissions')} onPress={() => navigation.navigate('Interventions', { screen: 'InterventionList' })} /> : null} />
  </BaitlyScreen>;
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32 }, headerContent: { gap: 14, paddingBottom: 20 }, flex: { flex: 1 },
  monthRow: { alignItems: 'center', gap: 2 }, month: { fontSize: 24, lineHeight: 30, fontWeight: '600', textTransform: 'capitalize' },
  days: { gap: 5 }, day: { flex: 1, minHeight: 72, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 6 },
  dayNumber: { fontSize: 20, lineHeight: 25, fontWeight: '600', fontVariant: ['tabular-nums'] }, dateRow: { alignItems: 'center', gap: 8 }, today: { minHeight: 44, justifyContent: 'center' },
  filters: { gap: 4 }, filter: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 12 },
  timeline: { gap: 10 }, time: { width: 45, alignItems: 'center', paddingTop: 14 }, hour: { fontSize: 12, lineHeight: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  dot: { width: 7, height: 7, borderRadius: 4, marginVertical: 8 }, line: { flex: 1, width: 1 },
  mission: { flex: 1, padding: 15, borderRadius: 20, gap: 7, marginBottom: 14 }, missionTop: { justifyContent: 'space-between', gap: 8 }, missionTitle: { fontSize: 17, lineHeight: 23, fontWeight: '600' },
  meta: { alignItems: 'center', gap: 6 }, missionBottom: { alignItems: 'center', gap: 8, paddingTop: 3 }, notes: { paddingTop: 8 },
  empty: { alignItems: 'center', gap: 14, paddingVertical: 32 }, emptyImage: { width: 110, height: 120 },
});
