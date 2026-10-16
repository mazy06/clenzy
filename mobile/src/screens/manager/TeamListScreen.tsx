import React, { useState } from 'react';
import { View, RefreshControl, Pressable, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTeams } from '@/hooks/useTeams';
import { BaitlyScreen, BaitlyText, BaitlyField, BaitlyLoading, BaitlyEmpty } from '@/design-system/components';
import { BaitlyHeaderAction } from '@/design-system/BaitlyHeader';
import { useBaitlyTheme } from '@/design-system/theme';
import { canUseBaitlyDemo, useBaitlyDataMode } from '@/config/baitlyDataMode';
import { Reicon } from '@/icons';

export function TeamListScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation('mobileV1');
  const c = useBaitlyTheme();
  const result = useTeams();
  const mode = useBaitlyDataMode(s => s.mode);
  const demo = canUseBaitlyDemo() && mode === 'demo';
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const teams = demo ? [
    { id: -201, name: 'Équipe centre · Démo', coverageZone: 'Marrakech · Médina', members: [{ userName: 'Salma' }, { userName: 'Amine' }] },
    { id: -202, name: 'Équipe villas · Démo', coverageZone: 'Ourika · Palmeraie', members: [{ userName: 'Youssef' }, { userName: 'Nadia' }, { userName: 'Karim' }] },
  ] : Array.isArray(result.data) ? result.data : [];
  const visible = teams.filter(team => `${team.name} ${team.coverageZone || ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <BaitlyScreen scroll={false}>
    <View style={styles.toolbar}><View style={styles.flex}>{searchOpen ? <BaitlyField label={t('adminTeamSearch')} value={search} onChangeText={setSearch} autoFocus /> : <BaitlyText variant="heading">{t('adminTeams')}</BaitlyText>}</View>
      <BaitlyHeaderAction icon="search-outline" label={t('adminTeamSearch')} onPress={() => { setSearchOpen(!searchOpen); setSearch(''); }} /></View>
    {demo ? <BaitlyText muted variant="meta" style={styles.demo}>{t('homeDemo')}</BaitlyText> : null}
    <FlashList data={visible} extraData={expanded} keyExtractor={team => String(team.id)} contentContainerStyle={styles.list}
      renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => demo ? setExpanded(current => current === item.id ? null : item.id) : navigation.navigate('TeamAssignment', { teamId: item.id })}
        style={({ pressed }) => [styles.card, { backgroundColor: pressed ? c.muted : c.surface }]}>
        <View style={styles.top}><Image source={require('../../../assets/baitly/navigation/baitly-network.png')} style={styles.image} contentFit="contain" accessible={false} />
          <View style={styles.flex}><BaitlyText style={styles.name}>{item.name}</BaitlyText><BaitlyText muted variant="meta">{item.coverageZone}</BaitlyText></View><Reicon name="chevron-forward" size={18} color={c.secondary} /></View>
        <BaitlyText variant="meta" muted>{t('adminTeamMembers', { count: 'memberCount' in item&&typeof item.memberCount==='number'?item.memberCount:item.members?.length ?? 0 })}</BaitlyText>
        {item.members?.length ? <BaitlyText variant="meta" numberOfLines={demo && expanded === item.id ? undefined : 1}>{item.members.map(member => member.userName).join(' · ')}</BaitlyText> : null}
      </Pressable>}
      refreshControl={demo ? undefined : <RefreshControl refreshing={result.isRefetching} onRefresh={() => { void result.refetch(); }} />}
      ListEmptyComponent={!demo && result.isLoading ? <BaitlyLoading /> : <BaitlyEmpty title={!demo && result.isError ? t('loadFailed') : t('adminNoTeams')} retry={!demo && result.isError ? () => { void result.refetch(); } : undefined} />} />
  </BaitlyScreen>;
}
const styles = StyleSheet.create({
  flex: { flex: 1 }, toolbar: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }, demo: { paddingHorizontal: 16, paddingBottom: 12 }, list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: { padding: 16, borderRadius: 22, gap: 10, marginBottom: 12 }, top: { flexDirection: 'row', alignItems: 'center', gap: 12 }, image: { width: 45, height: 52 }, name: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
});
