import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { BaitlyButton, BaitlyEmpty, BaitlyLoading, BaitlyNotice, BaitlyScreen, BaitlyText } from '@/design-system/components';
import { BaitlyCard, BaitlyInfoRow, BaitlyPill } from '@/design-system/primitives';
import { useBaitlyTheme } from '@/design-system/theme';
import { Reicon } from '@/icons';
import { paymentsApi } from '@/api/endpoints/paymentsApi';
import { interventionsApi } from '@/api/endpoints/interventionsApi';
import { formatMoney } from '@/features/marketplace/domain';
import { phaseAfterCheck, safeCheckoutUrl, type CheckoutPhase } from '@/features/payments/paymentCheckoutModel';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';

const CHECKS = 8;
const CHECK_INTERVAL_MS = 2500;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Paying an intervention. The server picks the payment provider (Stripe today, regional PSPs
 * later) and returns its secure page; the app opens it, then reads the status the server recorded.
 */
export function PaymentCheckoutScreen() {
  const { t, i18n } = useTranslation('mobileV1');
  const c = useBaitlyTheme();
  const navigation = useNavigation();
  const cache = useQueryClient();
  const { interventionId } = useRoute<RouteProp<BaitlyStackParams, 'PaymentCheckout'>>().params;
  const [phase, setPhase] = useState<CheckoutPhase>('ready');
  const [error, setError] = useState('');
  const session = useRef<string | null>(null);
  const lock = useRef(false);
  const mission = useQuery({ queryKey: ['payment-mission', interventionId], queryFn: () => interventionsApi.getById(interventionId), retry: false });
  const payable = useQuery({ queryKey: ['payment-payable', interventionId], queryFn: () => paymentsApi.getPayable(interventionId), retry: false });
  const amount = payable.data?.amount ?? null;
  const money = amount != null ? formatMoney(amount, payable.data?.currency, i18n.language) : null;

  async function check() {
    if (!session.current) return;
    setPhase('checking');
    for (let attempt = 1; attempt <= CHECKS; attempt++) {
      const status = await paymentsApi.getSessionStatus(session.current).then(r => r.paymentStatus).catch(() => undefined);
      const next = phaseAfterCheck(status, attempt, CHECKS);
      if (next !== 'checking') {
        setPhase(next);
        if (next === 'paid') await Promise.all([cache.invalidateQueries({ queryKey: ['payments'] }), cache.invalidateQueries({ queryKey: ['interventions'] }), payable.refetch()]);
        return;
      }
      await wait(CHECK_INTERVAL_MS);
    }
  }

  async function pay() {
    if (lock.current || amount == null) return;
    lock.current = true; setError(''); setPhase('opening');
    try {
      const created = await paymentsApi.createSession({ interventionId, amount });
      const url = safeCheckoutUrl(created.url);
      if (!url) throw new Error('Invalid checkout URL');
      session.current = created.sessionId;
      await WebBrowser.openBrowserAsync(url, { dismissButtonStyle: 'close', presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN });
      await check();
    } catch {
      setPhase('ready'); setError(t('paymentOpenFailed'));
    } finally { lock.current = false; }
  }

  if (mission.isPending || payable.isPending) return <BaitlyScreen><BaitlyLoading /></BaitlyScreen>;
  if (payable.isError) return <BaitlyScreen><BaitlyEmpty title={t('loadFailed')} retry={() => { void payable.refetch(); void mission.refetch(); }} /></BaitlyScreen>;

  if (phase === 'paid' || payable.data?.paymentStatus === 'PAID') return <BaitlyScreen footer={<BaitlyButton title={t('back')} onPress={() => navigation.goBack()} />}>
    <View style={{ alignItems: 'center', gap: 14, paddingTop: 40 }}>
      <View style={{ width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: c.successSoft }}><Reicon name="checkmark-circle" size={40} color={c.success} /></View>
      <BaitlyText variant="heading" style={{ textAlign: 'center' }}>{t('paymentDone')}</BaitlyText>
      <BaitlyText muted style={{ textAlign: 'center' }}>{t('paymentDoneHelp')}</BaitlyText>
    </View>
  </BaitlyScreen>;

  const busy = phase === 'opening' || phase === 'checking';
  return <BaitlyScreen title={t('paymentTitle')} footer={payable.data?.payable ? <View style={{ gap: 4 }}>
    {phase === 'unfinished' ? <BaitlyButton variant="ghost" title={t('paymentCheckAgain')} onPress={() => { void check(); }} /> : null}
    <BaitlyButton icon="lock-closed-outline" busy={busy} title={busy ? t(phase === 'checking' ? 'paymentChecking' : 'paymentOpening') : t('paymentPay', { amount: money ?? '' })} onPress={() => { void pay(); }} />
  </View> : undefined}>
    {mission.data ? <BaitlyCard>
      <BaitlyText style={{ fontWeight: '600', fontSize: 17 }}>{mission.data.title}</BaitlyText>
      <BaitlyInfoRow icon="home-outline" label={t('requestHome')} value={mission.data.propertyName} />
      <BaitlyInfoRow icon="person-outline" label={t('followUp.assignee')} value={mission.data.assignedTechnicianName ?? mission.data.assignedToName} last />
    </BaitlyCard> : null}
    <BaitlyCard title={t('paymentDue')}>
      <BaitlyText variant="title" style={{ fontVariant: ['tabular-nums'] }}>{money ?? t('unknownPrice')}</BaitlyText>
      {mission.data?.estimatedCost != null && amount != null && amount < mission.data.estimatedCost
        ? <BaitlyText muted variant="meta">{t('paymentDepositDeducted', { total: formatMoney(mission.data.estimatedCost, payable.data?.currency, i18n.language) })}</BaitlyText> : null}
    </BaitlyCard>
    {!payable.data?.payable ? <BaitlyNotice>{t('paymentNothingDue')}</BaitlyNotice> : null}
    {phase === 'unfinished' ? <BaitlyNotice tone="warning">{t('paymentUnfinished')}</BaitlyNotice> : null}
    {phase === 'failed' ? <BaitlyNotice error>{t('paymentFailed')}</BaitlyNotice> : null}
    {error ? <BaitlyNotice error>{error}</BaitlyNotice> : null}
    <View style={{ flexDirection: i18n.dir() === 'rtl' ? 'row-reverse' : 'row', gap: 10, alignItems: 'center' }}>
      <BaitlyPill tone="success" icon="shield-checkmark-outline" label={t('paymentSecure')} />
    </View>
    <BaitlyText muted variant="meta">{t('paymentSecureHelp')}</BaitlyText>
  </BaitlyScreen>;
}
