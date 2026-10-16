import { ConciergeBusinessSummary } from './ConciergeBusinessSummary';
import { MissionsScreen } from '@/features/missions/MissionsScreen';
import { useUnreadConversationCount } from '@/hooks/useConversations';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { BaitlyScreen, BaitlyText } from '@/design-system/components';
import { BaitlyHeader, BaitlyHeaderAction } from '@/design-system/BaitlyHeader';
import { useBaitlyTheme } from '@/design-system/theme';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';
import { useBaitlyUser } from '@/config/baitlyDemoProfiles';

export function OwnerHomeScreen() {
  const { t, i18n } = useTranslation('mobileV1');
  const c = useBaitlyTheme();
  const [section, setSection] = useState<'indicators' | 'activity'>('activity');
  const user = useBaitlyUser();
  const navigation = useNavigation<NativeStackNavigationProp<BaitlyStackParams>>();
  const unread = useUnreadConversationCount();
  const admin = user?.roles.some(role => ['SUPER_ADMIN', 'SUPER_MANAGER', 'ADMIN'].includes(role));
  const concierge = !admin && user?.organizationType === 'CONCIERGE';
  const row = { flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' as const : 'row' as const };
  return <BaitlyScreen scroll={false} header={<BaitlyHeader start={<BaitlyHeaderAction icon="notifications-outline" label={t('notifications')} onPress={() => navigation.navigate('Alerts')} />} end={<View><BaitlyHeaderAction icon="chatbubble-ellipses-outline" label={unread.data?.count ? `${t('messagesTab')}, ${unread.data.count}` : t('messagesTab')} onPress={() => navigation.navigate('Messages')} />{unread.data?.count ? <View pointerEvents="none" style={[styles.badge, { backgroundColor: c.danger, borderColor: c.background }]}><BaitlyText style={[styles.badgeText, { color: c.onPrimary }]}>{unread.data.count > 99 ? '99+' : unread.data.count}</BaitlyText></View> : null}</View>} />}>
    {concierge ? <View style={[styles.homeTabs, row]}>
      {(['activity', 'indicators'] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: section === value }} onPress={() => setSection(value)} style={({ pressed }) => [styles.homeTab, row, { backgroundColor: pressed || section === value ? c.muted : 'transparent', borderColor: section === value ? c.border : 'transparent' }]}>
        <Image source={value === 'indicators' ? require('../../../assets/baitly/sectors/sector-accounting.webp') : require('../../../assets/baitly/navigation/baitly-missions.png')} style={styles.tabImage} contentFit="contain" enforceEarlyResizing accessible={false} />
        <BaitlyText variant="meta" style={{ fontWeight: section === value ? '600' : '400' }}>{t(`homeSection.${value}`)}</BaitlyText>
      </Pressable>)}
    </View> : null}
    {concierge && section === 'indicators' ? <ScrollView contentContainerStyle={styles.indicators} showsVerticalScrollIndicator={false}><ConciergeBusinessSummary /></ScrollView> : <MissionsScreen owner embedded listHeader={<View style={styles.headerContent}>
        <View style={[styles.shortcuts, row]}>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate(admin || concierge ? 'Network' : 'DiscoverConciergeries')}
            style={({ pressed }) => [styles.shortcut, row, { backgroundColor: pressed ? c.muted : c.surface }]}>
            <Image source={require('../../../assets/baitly/navigation/baitly-network.png')} style={styles.shortcutImage} contentFit="contain" enforceEarlyResizing accessible={false} />
            <BaitlyText style={styles.shortcutLabel}>{t(admin || concierge ? 'homeNetwork' : 'findManagement')}</BaitlyText></Pressable>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('SentRequests')} style={({ pressed }) => [styles.shortcut, row, { backgroundColor: pressed ? c.muted : c.surface }]}><Image source={require('../../../assets/baitly/navigation/baitly-tracking.png')} style={styles.shortcutImage} contentFit="contain" enforceEarlyResizing accessible={false} /><BaitlyText style={styles.shortcutLabel}>{t('tracking')}</BaitlyText></Pressable>
        </View>
      </View>} />}
  </BaitlyScreen>;
}
const styles = StyleSheet.create({
  badge: { position: 'absolute', top: 2, end: 0, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, lineHeight: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  homeTabs: { paddingHorizontal: 16, gap: 8, paddingBottom: 6 }, homeTab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 10 }, tabImage: { width: 28, height: 30 }, indicators: { paddingHorizontal: 16, paddingBottom: 32 },
  content: { paddingHorizontal: 16, paddingBottom: 32 }, headerContent: { gap: 12 },
  shortcuts: { gap: 10 },
  shortcut: { flex: 1, minHeight: 82, borderRadius: 14, alignItems: 'center', padding: 10, gap: 6 },
  shortcutImage: { width: 45, height: 52 }, shortcutLabel: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  section: { alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, paddingBottom: 2 }, number: { fontVariant: ['tabular-nums'] },
  task: { alignItems: 'center', gap: 12, borderRadius: 18, padding: 16, marginBottom: 8 }, taskText: { flex: 1, gap: 3 }, taskTitle: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  calm: { gap: 10, alignItems: 'center', paddingVertical: 8 }, empty: { gap: 14, alignItems: 'center', padding: 18, borderRadius: 22 }, emptyImage: { width: 65, height: 80 },
});
