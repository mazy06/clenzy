import React, { useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { randomUUID } from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useTheme } from '@/theme';
import { baitlySubscriptionApi as api, requireBaitlyStripeCheckout } from '@/api/endpoints/baitlySubscriptionApi';
import type { MonthlyPlan, MonthlyContract } from '@shared/types/baitlySubscription';
import { BAITLY_BILLING_COUNTRIES } from '@shared/types/baitlySubscription';
import { BaitlySubscriptionChange } from './BaitlySubscriptionChange';

type ParamList = { SubscriptionCheckout: { forfait: string } };
const pendingStates = new Set(['PREPARED', 'CHECKOUT_OPEN', 'ACTIVATING']);

/** Le navigateur ne confirme pas un paiement : seul le contrat rechargé depuis Baitly fait foi. */
export function SubscriptionCheckoutScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ParamList, 'SubscriptionCheckout'>>();
  const { t, i18n } = useTranslation();
  const user = useAuthStore(s => s.user);
  const loadUser = useAuthStore(s => s.loadUser);
  const cache = useQueryClient();
  const [plan, setPlan] = useState<MonthlyPlan>(() => {
    const requested = route.params?.forfait ?? user?.forfait;
    return requested === 'premium' || requested === 'pro' || requested === 'confort' ? 'pro' : 'essential';
  });
  const [promoInput, setPromoInput] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [countrySelection, setCountrySelection] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const attempt = useRef<{ key: string; id: string } | null>(null);
  const scope = ['mobile-monthly-subscription', user?.id, user?.organizationId];
  const contracts = useQuery({ queryKey: [...scope, 'contracts'], queryFn: api.contracts, enabled: Boolean(user) });
  const billing = useQuery({ queryKey: [...scope, 'billing-country'], queryFn: api.billingCountry, enabled: Boolean(user) });
  const country = countrySelection ?? billing.data?.billingCountry ?? '';
  const countryReady = !billing.isPending && !billing.isError && Boolean(country) && country === billing.data?.billingCountry;
  const countryLocked = contracts.isPending || contracts.isError || Boolean(contracts.data?.some(contract => !['EXPIRED', 'CANCELLED'].includes(contract.status)));
  const countryOptions = useMemo(() => {
    const names = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames([i18n.language], { type: 'region' }) : null;
    return BAITLY_BILLING_COUNTRIES.map(code => ({ value: code, label: names?.of(code) ?? code }));
  }, [i18n.language]);
  const proposal = useQuery({ queryKey: [...scope, 'proposal', billing.data?.billingCountry, plan, promoCode], queryFn: () => api.proposal(plan, promoCode), enabled: Boolean(user) && countryReady });
  const pending = contracts.data?.find(contract => pendingStates.has(contract.status));
  const current = contracts.data?.find(contract => ['ACTIVE', 'PAST_DUE', 'SUSPENDED'].includes(contract.status));
  const quote = proposal.data;
  const money = (cents: number, currency: string) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency }).format(cents / 100);
  const message = (failure: unknown) => (failure as { message?: string })?.message || t('monthlySubscription.error');
  const reload = async () => { await cache.invalidateQueries({ queryKey: scope }); await loadUser(); };
  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null);
    try { await action(); } catch (failure) { setError(message(failure)); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const refresh = (contract: MonthlyContract) => run(async () => { await api.refresh(contract.id); await reload(); });
  const saveCountry = () => run(async () => {
    if (countryLocked || !country) return;
    const saved = await api.updateBillingCountry(country);
    cache.setQueryData([...scope, 'billing-country'], saved);
    setCountrySelection(null); attempt.current = null;
    await cache.invalidateQueries({ queryKey: scope });
  });
  const pay = () => run(async () => {
    if (!countryReady) { setError(t('monthlySubscription.saveCountryFirst')); return; }
    const selectedPlan = pending?.plan ?? plan;
    const selectedPromo = pending?.promoCode ?? (pending ? null : promoCode || null);
    const key = `${user?.id}:${user?.organizationId}:${country}:${selectedPlan}:${selectedPromo ?? ''}`;
    if (attempt.current?.key !== key) attempt.current = { key, id: randomUUID() };
    const requestId = pending?.requestId ?? attempt.current.id;
    const checkout = await api.checkout(selectedPlan, requestId, selectedPromo);
    await contracts.refetch();
    await WebBrowser.openBrowserAsync(requireBaitlyStripeCheckout(checkout.checkoutUrl), { dismissButtonStyle: 'close' });
    const saved = (await api.contracts()).find(contract => contract.requestId === requestId);
    if (saved && saved.status !== 'PREPARED') await api.refresh(saved.id);
    await reload();
  });
  const text = { color: theme.colors.text.primary };
  const muted = { color: theme.colors.text.secondary };
  const surface = { backgroundColor: theme.colors.background.paper, borderColor: theme.colors.border.main };
  const cannotPay = busy || !countryReady || contracts.isPending || contracts.isError || proposal.isFetching || !quote || Boolean(pending) || promoInput.trim().toUpperCase() !== promoCode;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background.default }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('monthlySubscription.back')} onPress={() => navigation.goBack()} hitSlop={12} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={[theme.typography.h3, text]}>{t('monthlySubscription.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[theme.typography.body2, muted]}>{t('monthlySubscription.intro')}</Text>
        {error || contracts.error ? <Text accessibilityRole="alert" style={{ color: theme.colors.error.main }}>{error || message(contracts.error)}</Text> : null}
        {contracts.isError ? <Button variant="outlined" title={t('monthlySubscription.retry')} onPress={() => { void contracts.refetch(); }} /> : null}
        <View style={styles.billingCountry}>
          {countryLocked || busy || billing.isPending || billing.isError ? <>
            <Text style={[theme.typography.body2, muted]}>{t('monthlySubscription.billingCountry')}</Text>
            <Text style={[theme.typography.body1, text]}>{countryOptions.find(option => option.value === country)?.label ?? t('monthlySubscription.chooseCountry')}</Text>
          </> : <Select label={t('monthlySubscription.billingCountry')} placeholder={t('monthlySubscription.chooseCountry')} value={country} options={countryOptions} onChange={setCountrySelection} />}
          <Text style={[theme.typography.caption, muted]}>{t('monthlySubscription.countryScope')}</Text>
          {countryLocked ? <Text style={[theme.typography.caption, muted]}>{t('monthlySubscription.countryLocked')}</Text> : null}
          {!countryLocked ? <Button variant="outlined" title={t('monthlySubscription.saveCountry')} disabled={busy || billing.isPending || billing.isError || !country || country === billing.data?.billingCountry} onPress={() => { void saveCountry(); }} /> : null}
          {billing.error ? <Text accessibilityRole="alert" style={{ color: theme.colors.error.main }}>{message(billing.error)}</Text> : null}
          {billing.isError ? <Button variant="text" title={t('monthlySubscription.retry')} onPress={() => { void billing.refetch(); }} /> : null}
        </View>
        {pending ? (
          <View style={[styles.section, surface]}>
            <Text style={[theme.typography.h3, text]}>{t('monthlySubscription.pending')}</Text>
            <Text style={[theme.typography.body2, muted]}>{t('monthlySubscription.awaiting')}</Text>
            <Text style={[theme.typography.h3, text, styles.number]}>{money(pending.firstInvoiceExcludingTaxCents, pending.currency)} {t('monthlySubscription.net')}</Text>
            {pending.status !== 'ACTIVATING' ? <Button title={t('monthlySubscription.resume')} onPress={() => { void pay(); }} loading={busy} disabled={!countryReady} /> : null}
            {pending.status !== 'PREPARED' ? <Button variant="outlined" title={t('monthlySubscription.verify')} onPress={() => { void refresh(pending); }} disabled={busy} /> : null}
            {pending.status !== 'ACTIVATING' ? <Button variant="text" title={t('monthlySubscription.abandon')} disabled={busy} onPress={() => { void run(async () => { await api.abandon(pending.id); attempt.current = null; await reload(); }); }} /> : null}
          </View>
        ) : current ? <BaitlySubscriptionChange contract={current} /> : (
          <>
            <View style={styles.plans}>
              {(['essential', 'pro'] as const).map(value => <Button key={value} title={value === 'pro' ? 'Baitly Pro' : 'Baitly Essentiel'} variant={value === plan ? 'contained' : 'outlined'} disabled={busy} style={styles.plan} onPress={() => setPlan(value)} />)}
            </View>
            <View style={[styles.section, surface]}>
              {proposal.isFetching ? <ActivityIndicator accessibilityLabel={t('monthlySubscription.loading')} color={theme.colors.primary.main} /> : null}
              {proposal.error ? <Text accessibilityRole="alert" style={{ color: theme.colors.error.main }}>{message(proposal.error)}</Text> : null}
              {quote ? <>
                <Text style={[theme.typography.body2, muted]}>{t('monthlySubscription.properties', { count: Math.max(1, quote.propertyCount) })}</Text>
                <Text style={[theme.typography.h2, text, styles.number]}>{money(quote.firstInvoiceExcludingTaxCents, quote.phases[0].currency)} {t('monthlySubscription.net')}</Text>
                <Text style={[theme.typography.body2, muted]}>{t('monthlySubscription.taxes')}</Text>
                {quote.phases.map(phase => <View key={phase.subscriptionMonth} style={styles.row}>
                  <Text style={[theme.typography.body2, muted]}>{t('monthlySubscription.fromMonth', { month: phase.subscriptionMonth })}</Text>
                  <Text style={[theme.typography.body2, text, styles.number]}>{money(phase.totalCents, phase.currency)} {t('monthlySubscription.net')}</Text>
                </View>)}
              </> : null}
              <Text style={[theme.typography.body2, text]}>{t('monthlySubscription.promo')}</Text>
              <TextInput accessibilityLabel={t('monthlySubscription.promo')} value={promoInput} onChangeText={setPromoInput} autoCapitalize="characters" autoCorrect={false} editable={!busy} style={[styles.input, text, { borderColor: theme.colors.border.main }]} />
              <Button variant="outlined" title={t('monthlySubscription.apply')} disabled={busy} onPress={() => setPromoCode(promoInput.trim().toUpperCase())} />
              <Button title={t('monthlySubscription.continue')} disabled={cannotPay} loading={busy} onPress={() => { void pay(); }} />
            </View>
          </>
        )}
        {contracts.data?.filter(contract => !pendingStates.has(contract.status)).map(contract => <View key={contract.id} style={[styles.section, surface]}>
          <View style={styles.row}>
            <Text style={[theme.typography.h3, text]}>{contract.plan === 'pro' ? 'Baitly Pro' : 'Baitly Essentiel'}</Text>
            <Text style={[theme.typography.caption, muted]}>{t(`monthlySubscription.status.${contract.status}`, { defaultValue: t('monthlySubscription.review') })}</Text>
          </View>
          {contract.paidUntil ? <Text style={[theme.typography.body2, muted]}>{t('monthlySubscription.paidUntil', { date: new Date(contract.paidUntil).toLocaleDateString(i18n.language) })}</Text> : null}
          <Button title={t('monthlySubscription.verify')} variant="text" disabled={busy} onPress={() => { void refresh(contract); }} />
        </View>)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { padding: 8 }, content: { padding: 20, gap: 20, paddingBottom: 32 },
  section: { padding: 20, borderWidth: 1, borderRadius: 18, gap: 14 },
  billingCountry: { gap: 10 },
  plans: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, plan: { flex: 1, minWidth: 125 },
  row: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 48 },
  number: { fontVariant: ['tabular-nums'] },
});
