import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { randomUUID } from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useTheme } from '@/theme';
import { baitlySubscriptionApi as api } from '@/api/endpoints/baitlySubscriptionApi';
import type { MonthlyContract, MonthlyPlan, SubscriptionChangeProposal } from '@shared/types/baitlySubscription';

export function BaitlySubscriptionChange({ contract }: { contract: MonthlyContract }) {
  const theme = useTheme();const { t, i18n } = useTranslation();const cache = useQueryClient();
  const [plan, setPlan] = useState<MonthlyPlan>(contract.plan);
  const [proposal, setProposal] = useState<SubscriptionChangeProposal | null>(null);
  const [busy, setBusy] = useState(false);const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);const attempt = useRef<{ key: string; id: string } | null>(null);
  const changes = useQuery({ queryKey: ['mobile-monthly-changes', contract.id], queryFn: () => api.changes(contract.id), retry: false });
  const open = changes.data?.find(c => ['PREPARED', 'SCHEDULED'].includes(c.status));
  const terms = open?.terms ?? proposal?.terms;
  async function run(action: () => Promise<void>) {
    if (pending.current) return;pending.current = true;setBusy(true);setError(null);
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : t('monthlySubscription.error')); }
    finally { pending.current = false;setBusy(false); }
  }
  return <View style={styles.section}>
    <Text style={[theme.typography.h3, { color: theme.colors.text.primary }]}>{t('monthlySubscription.change.title')}</Text>
    <Button variant="outlined" title={t('monthlySubscription.change.paymentMethod')} disabled={busy} onPress={() => { void run(async () => {
      const { url } = await api.paymentMethod(contract.id);const target = new URL(url);
      if (target.protocol !== 'https:' || target.hostname !== 'billing.stripe.com' || target.username || target.password) throw new Error(t('monthlySubscription.error'));
      await WebBrowser.openBrowserAsync(url);
    }); }} />
    {error || changes.error ? <Text accessibilityRole="alert" style={{ color: theme.colors.error.main }}>{error ?? changes.error?.message}</Text> : null}
    {!open && changes.isSuccess && contract.status === 'ACTIVE' && !contract.cancelAtPeriodEnd ? <>
      <Select label={t('monthlySubscription.plan')} value={plan} options={[{ value: 'essential', label: 'Baitly Essentiel' }, { value: 'pro', label: 'Baitly Pro' }]} onChange={value => { setPlan(value as MonthlyPlan);setProposal(null); }} />
      <Button variant="outlined" title={t('monthlySubscription.change.preview')} disabled={busy} onPress={() => { void run(async () => { setProposal(null);setProposal(await api.changeProposal(contract.id, plan)); }); }} />
    </> : null}
    {terms ? <>
      <Text style={[theme.typography.body1, styles.number, { color: theme.colors.text.primary }]}>{t('monthlySubscription.change.effective', { amount: new Intl.NumberFormat(i18n.language, { style: 'currency', currency: terms.currency }).format((terms.subscriptionMonth <= 3 ? terms.monthOne : terms.subscriptionMonth <= 6 ? terms.monthFour : terms.subscriptionMonth <= 12 ? terms.monthSeven : terms.monthThirteen) / 100), date: new Date(terms.effectiveAt * 1000).toLocaleDateString(i18n.language) })}</Text>
      <Text style={[theme.typography.body2, { color: theme.colors.text.secondary }]}>{t('monthlySubscription.change.noProration')}</Text>
      {open?.status === 'SCHEDULED' ? <Text style={{ color: theme.colors.text.primary }}>{t('monthlySubscription.change.scheduled')}</Text> : <Button title={t(open ? 'monthlySubscription.resume' : 'monthlySubscription.change.confirm')} disabled={busy} onPress={() => { void run(async () => {
        const key = JSON.stringify(terms);if (attempt.current?.key !== key) attempt.current = { key, id: randomUUID() };
        await api.scheduleChange(contract.id, terms.plan, open?.requestId ?? attempt.current.id, terms);
        setProposal(null);await cache.invalidateQueries({ queryKey: ['mobile-monthly-changes', contract.id] });
      }); }} />}
    </> : null}
  </View>;
}
const styles = StyleSheet.create({ section: { gap: 12 }, number: { fontVariant: ['tabular-nums'] } });
