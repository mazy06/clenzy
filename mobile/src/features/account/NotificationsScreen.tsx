import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Reicon, type IconName } from '@/icons';
import { useBaitlyScope } from '@/features/marketplace/queries';
import { notificationsApi, type Notification } from '@/api/endpoints/notificationsApi';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';
import { BaitlyEmpty, BaitlyLoading, BaitlyNotice, BaitlyScreen, BaitlyText } from '@/design-system/components';
import { BaitlyHeaderAction } from '@/design-system/BaitlyHeader';
import { useBaitlyTheme } from '@/design-system/theme';
import { canUseBaitlyDemo, useBaitlyDataMode } from '@/config/baitlyDataMode';

const categoryIcons: Record<string, IconName> = { QUOTE: 'receipt-outline', NETWORK: 'people-outline', INTERVENTION: 'briefcase-outline', MISSION: 'briefcase-outline',
  PAYMENT: 'card-outline', MESSAGE: 'chatbubble-ellipses-outline', RESERVATION: 'calendar-outline', REVIEW: 'star-outline' };
function notificationIcon(category?: string): IconName { return (category && categoryIcons[category.toUpperCase()]) || 'notifications-outline'; }

export function BaitlyNotificationsScreen() {
  const { t, i18n } = useTranslation('mobileV1');
  const c = useBaitlyTheme();
  const scope = useBaitlyScope();
  const mode = useBaitlyDataMode(s => s.mode);
  const demo = canUseBaitlyDemo() && mode === 'demo';
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const navigation = useNavigation<NativeStackNavigationProp<BaitlyStackParams>>();
  const query = useQuery({ queryKey: [...scope, 'notifications'], queryFn: notificationsApi.getAll, retry: false, enabled: !demo });
  const items: Notification[] = demo ? [
    { id: -401, title: 'Un devis vous attend', message: 'Dar Zellige a répondu à votre demande de ménage.', type: 'INFO', category: 'QUOTE', read: false, createdAt: new Date().toISOString() },
    { id: -402, title: 'Votre réseau évolue', message: 'Un nouveau partenaire a rejoint votre réseau privé.', type: 'INFO', category: 'NETWORK', read: true, createdAt: new Date().toISOString() },
  ] : query.data ?? [];
  function open(url?: string) {
    const mission = url?.match(/^\/interventions\/(\d+)(?:\?|$)/);
    const quote = url?.match(/^\/quote-requests\/(\d+)(?:\?|$)/);
    if (mission) navigation.navigate('Mission', { interventionId: Number(mission[1]) });
    if (quote) navigation.navigate('Quote', { requestId: Number(quote[1]), side: 'sent' });
  }
  async function read(item: Notification) {
    if (demo || busy !== null) return;
    setFailed(false); setBusy(item.id);
    try { if (!item.read) await notificationsApi.markAsRead(item.id); await query.refetch(); open(item.actionUrl); }
    catch { setFailed(true); }
    finally { setBusy(null); }
  }
  const row = i18n.dir() === 'rtl' ? 'row-reverse' as const : 'row' as const;
  function when(value: string) {
    const date = new Date(value);
    const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(value).setHours(0, 0, 0, 0)) / 86400000);
    const time = date.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
    return days === 0 ? `${t('today')} · ${time}` : days === 1 ? `${t('yesterday')} · ${time}` : date.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
  }
  return <BaitlyScreen>
    <View style={styles.heading}><BaitlyText variant="heading">{t('notifications')}</BaitlyText>
      {!demo ? <BaitlyHeaderAction icon="refresh-outline" label={t('verify')} onPress={() => { void query.refetch(); }} /> : null}</View>
    {demo ? <BaitlyText muted variant="meta">{t('homeDemo')}</BaitlyText> : null}
    {failed ? <BaitlyNotice error>{t('sendFailed')}</BaitlyNotice> : null}
    {!demo && query.isPending ? <BaitlyLoading /> : null}
    {!demo && query.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void query.refetch(); }} /> : null}
    {items.map(item => <Pressable key={item.id} accessibilityRole="button" disabled={demo || busy !== null}
      accessibilityLabel={[item.read ? undefined : t('unread'), item.title, item.message].filter(Boolean).join(', ')}
      accessibilityState={{ disabled: demo || busy !== null, busy: busy === item.id }}
      onPress={() => { void read(item); }} style={({ pressed }) => [styles.card, { flexDirection: row, backgroundColor: pressed ? c.muted : item.read ? 'transparent' : c.surface, borderColor: c.border }]}>
      <View style={[styles.icon, { backgroundColor: item.read ? c.muted : c.background }]}><Reicon name={notificationIcon(item.category)} size={20} color={c.ink} /></View>
      <View style={styles.body}>
        <View style={[styles.top, { flexDirection: row }]}>
          <BaitlyText style={[styles.title, { fontWeight: item.read ? '500' : '600' }]}>{item.title}</BaitlyText>
          {!item.read ? <View style={[styles.dot, { backgroundColor: c.danger }]} /> : null}
        </View>
        <BaitlyText muted variant="meta">{item.message}</BaitlyText>
        <BaitlyText muted variant="meta" style={styles.date}>{when(item.createdAt)}</BaitlyText>
      </View>
    </Pressable>)}
    {!demo && !query.isPending && !query.isError && !items.length ? <BaitlyEmpty icon="notifications-outline" title={t('adminNoNotifications')} message={t('noNotificationsHelp')} /> : null}
  </BaitlyScreen>;
}
const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, card: { padding: 14, borderRadius: 18, gap: 12, borderWidth: StyleSheet.hairlineWidth },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, body: { flex: 1, gap: 4 },
  top: { alignItems: 'center', gap: 10 }, title: { flex: 1, fontSize: 16, lineHeight: 22 }, dot: { width: 8, height: 8, borderRadius: 4 }, date: { fontVariant: ['tabular-nums'] },
});
