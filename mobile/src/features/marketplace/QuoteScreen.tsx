import * as FileSystem from 'expo-file-system/legacy';
import { API_CONFIG } from '@/config/api';
import { useAuthStore } from '@/store/authStore';
import { apiClient } from '@/api/apiClient';
import { demoQuotePdf } from './quotePdf';
import { decideDemoRequest } from './baitlyDemoRequests';
import { Discussion } from '@/features/messages/Discussion';
import React, { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { BaitlyCard, BaitlyChoices, BaitlyInfoRow, BaitlyPill } from '@/design-system/primitives';
import { civilDateKey } from './requestScheduleModel';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';
import { BaitlyButton, BaitlyEmpty, BaitlyField, BaitlyLoading, BaitlyNotice, BaitlyScreen, BaitlyText } from '@/design-system/components';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useBaitlyScope, useRequest } from './queries';
import { allowedQuoteActions, formatMoney, isCivilDate, normalizeQuoteAmount } from './domain';
import { marketplaceApi, type QuoteAction, type QuoteRequest, type SubmitQuote } from './api';
import { isBaitlyDemoCatalogEnabled } from './baitlyDemoCatalog';

export function QuoteScreen({ route, navigation }: NativeStackScreenProps<BaitlyStackParams, 'Quote'>) {
  const { requestId, side = 'sent' } = route.params;
  const demo = isBaitlyDemoCatalogEnabled() && requestId < 0;
  const { t, i18n } = useTranslation('mobileV1');
  const result = useRequest(requestId);
  const scope = useBaitlyScope();
  const cache = useQueryClient();
  const { isConnected } = useNetworkStatus();
  const [pdfBusy, setPdfBusy] = useState(false);
  const pdfLock = useRef(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('MAD');
  const [message, setMessage] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [teamId, setTeamId] = useState<number | null>();
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const quote = result.data;
  const teams = useQuery({
    queryKey: [...scope, 'teams', requestId],
    queryFn: ({ signal }) => marketplaceApi.teams(requestId, signal),
    enabled: !demo && side === 'received' && quote?.status === 'SENT', retry: false,
  });
  const commercial = useQuery({ queryKey: [...scope, 'quote-commercial', requestId], enabled: !demo && !!quote?.quotedAmount, retry: false, queryFn: () => apiClient.get<{ documentGenerationId?: number; providerEmail?: string; providerPhone?: string; description?: string; depositAmount?: number; depositPercent?: number; lines?: { label: string; quantity: number; unitPrice: number }[] }>(`/quote-requests/${requestId}/commercial`) });
  async function openPdf() {
    if (!quote || pdfLock.current) return;
    pdfLock.current = true; setPdfBusy(true); setError('');
    const uri = `${FileSystem.cacheDirectory}baitly-quote-${demo ? 'demo' : 'live'}-${Math.abs(requestId)}-${Date.now()}.pdf`;
    try {
      if (demo) await FileSystem.writeAsStringAsync(uri, demoQuotePdf(quote));
      else {
        const id = commercial.data?.documentGenerationId;
        if (!id) throw new Error('PDF unavailable');
        const result = await FileSystem.downloadAsync(`${API_CONFIG.BASE_URL}/api/documents/generations/${id}/download`, uri, { headers: { Authorization: `Bearer ${useAuthStore.getState().accessToken}` } });
        if (result.status !== 200) throw new Error('Download failed');
        const signature = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64, length: 5, position: 0 });
        if (!signature.startsWith('JVBERi0')) throw new Error('Invalid PDF');
      }
      navigation.navigate('PdfViewer', { uri, title: quote.title });
    } catch { await FileSystem.deleteAsync(uri, { idempotent: true }); setError(t('loadFailed')); }
    finally { pdfLock.current = false; setPdfBusy(false); }
  }
  const selectedTeamId = teamId === undefined ? teams.data?.selectedTeamId : teamId;
  const update = useMutation({
    mutationFn: (command: { action: QuoteAction } | { body: SubmitQuote }) => 'action' in command
      ? demo ? Promise.resolve(decideDemoRequest(requestId, command.action, side)) : marketplaceApi.decide(requestId, command.action) : marketplaceApi.quote(requestId, command.body),
    retry: false,
    onSuccess: (data: QuoteRequest) => {
      cache.setQueryData([...scope, 'request', requestId], data);
      void cache.invalidateQueries({ queryKey: [...scope, 'requests'] });
      setUncertain(false); setError('');
    },
  });
  async function execute(command: Parameters<typeof update.mutateAsync>[0]) {
    if ((!demo && requestId < 0) || lock.current || uncertain || (!demo && !isConnected) || result.isFetching || result.isError) return;
    lock.current = true; setError('');
    try { await update.mutateAsync(command); }
    catch (failure) {
      const status = (failure as { status?: number }).status;
      setUncertain(!status || status >= 500 || status === 408);
      setError(t(status === 409 ? 'stateChanged' : 'sendFailed'));
      void result.refetch();
    } finally { lock.current = false; }
  }
  async function verify() {
    if (lock.current) return;
    const current = await result.refetch();
    if (current.isError) return;
    setUncertain(false); setError('');
  }
  function sendQuote() {
    const normalized = normalizeQuoteAmount(amount);
    if (!normalized || !/^[A-Z]{3}$/.test(currency) || (validUntil && !isCivilDate(validUntil))) {
      setError(t('invalidQuote')); return;
    }
    if (teams.isPending || teams.isError) return;
    void execute({ body: { amount: normalized, currency, message: message.trim() || undefined,
      validUntil: validUntil || undefined, providerTeamId: selectedTeamId ?? undefined } });
  }
  const actions = quote ? allowedQuoteActions(quote, side) : [];
  const disabled = (!demo && !isConnected) || uncertain || update.isPending || result.isFetching || result.isError;
  const confirm = (action: QuoteAction) => Alert.alert(t(`action.${action}`), t(`confirmAction.${action}`), [
    { text: t('cancel'), style: 'cancel' },
    { text: t('confirm'), style: action === 'accept' ? 'default' : 'destructive', onPress: () => { void execute({ action }); } },
  ]);
  const statusKey = quote ? side === 'received' && quote.status === 'SENT' ? 'toQuote' : side === 'received' && quote.status === 'QUOTED' ? 'quoteSent' : `status.${quote.status}` : '';
  const tone = !quote ? 'neutral' : quote.expired || ['DECLINED', 'TURNED_DOWN', 'WITHDRAWN', 'EXPIRED'].includes(quote.status) ? 'error'
    : quote.status === 'ACCEPTED' ? 'success' : (side === 'sent' && quote.status === 'QUOTED') || (side === 'received' && quote.status === 'SENT') ? 'warning' : 'neutral';
  const money = (value?: number | null) => formatMoney(value, quote?.quotedCurrency, i18n.language);
  const desired = quote?.desiredDate ? [new Date(`${quote.desiredDate}T12:00:00`).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'long' }),
    quote.requestedStartTime].filter(Boolean).join(' · ') : null;
  const validityDays = [7, 15, 30];
  const quoteForm = !demo && side === 'received' && quote?.status === 'SENT';
  const footer = quoteForm ? <View style={{ gap: 4 }}>
    <BaitlyButton title={t('sendQuote')} icon="paper-plane-outline" onPress={sendQuote} disabled={disabled || teams.isPending || teams.isError || !amount.trim()} busy={update.isPending} />
    {actions.includes('turn-down') ? <BaitlyButton variant="ghost" title={t('action.turn-down')} onPress={() => confirm('turn-down')} disabled={disabled} /> : null}
  </View> : actions.length ? <View style={{ gap: 4 }}>
    {actions.map(action => <BaitlyButton key={action} title={t(`action.${action}`)} variant={action === 'accept' ? 'primary' : 'ghost'}
      icon={action === 'accept' ? 'checkmark' : undefined} busy={update.isPending && action === 'accept'} onPress={() => confirm(action)} disabled={disabled} />)}
  </View> : undefined;
  return <BaitlyScreen title={quote?.title ?? t('quote')} subtitle={quote ? (side === 'sent' ? quote.providerName : quote.requesterOrganizationName) ?? undefined : undefined} footer={footer}>
    {result.isPending ? <BaitlyLoading /> : null}
    {result.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void result.refetch(); }} /> : null}
    {!isConnected ? <BaitlyNotice tone="warning">{t('onlineRequired')}</BaitlyNotice> : null}
    {error ? <BaitlyNotice error>{error}</BaitlyNotice> : null}
    {uncertain ? <BaitlyNotice tone="warning">{t('verifyBeforeRetry')}
      <BaitlyButton title={t('verify')} secondary onPress={() => { void verify(); }} busy={result.isFetching} disabled={!isConnected} /></BaitlyNotice> : null}
    {quote && !result.isError ? <>
      <BaitlyPill label={t(statusKey)} tone={tone} />
      {demo ? <BaitlyText muted variant="meta">{t('homeDemo')}</BaitlyText> : null}
      {quote.expired ? <BaitlyNotice error>{t('expiredHelp')}</BaitlyNotice> : null}
      {quote.decisionReason ? <BaitlyNotice>{quote.decisionReason}</BaitlyNotice> : null}
      {quote.quotedAmount != null ? <BaitlyCard title={t('quote')}>
        <BaitlyText variant="title" style={{ fontVariant: ['tabular-nums'] }}>{money(quote.quotedAmount) ?? t('unknownPrice')}</BaitlyText>
        {commercial.data?.lines?.map((line, index) => <BaitlyInfoRow key={index} label={`${line.label} × ${line.quantity}`} value={money(line.unitPrice * line.quantity)} />)}
        <BaitlyInfoRow icon="wallet-outline" label={t('quoteDeposit')} value={commercial.data?.depositAmount != null ? money(commercial.data.depositAmount) : null} />
        <BaitlyInfoRow icon="time-outline" label={t('validUntilLabel')} value={quote.quoteValidUntil ? new Date(`${quote.quoteValidUntil}T12:00:00`).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long' }) : null} last />
        {commercial.data?.description ? <BaitlyText>{commercial.data.description}</BaitlyText> : null}
        {quote.quoteMessage ? <BaitlyText muted>{quote.quoteMessage}</BaitlyText> : null}
        {demo || commercial.data?.documentGenerationId ? <BaitlyButton secondary icon="document-text-outline" title={t('quotePdf')} busy={pdfBusy} onPress={() => { void openPdf(); }} /> : null}
        {!demo && commercial.isSuccess && !commercial.data?.documentGenerationId ? <BaitlyText muted variant="meta">{t('quotePdfUnavailable')}</BaitlyText> : null}
        {!demo && commercial.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void commercial.refetch(); }} /> : null}
      </BaitlyCard> : null}
      <BaitlyCard title={t('requestDetails')}>
        <BaitlyInfoRow icon="calendar-outline" label={t('requestDate')} value={desired ?? t('requestNoDate')} />
        <BaitlyInfoRow icon="time-outline" label={t('requestDuration')} value={quote.requestedDurationMinutes ? t('minutes', { count: quote.requestedDurationMinutes }) : null} last />
        {quote.message ? <BaitlyText>{quote.message}</BaitlyText> : null}
      </BaitlyCard>
      {commercial.data?.providerEmail || commercial.data?.providerPhone ? <BaitlyCard title={t('requestProvider')}>
        <BaitlyInfoRow icon="mail-outline" label={t('accountEmail')} value={commercial.data.providerEmail} />
        <BaitlyInfoRow icon="call-outline" label={t('phone')} value={commercial.data.providerPhone} last />
      </BaitlyCard> : null}
      {quote.interventionId ? <BaitlyButton title={t('viewMission')} icon="briefcase-outline" secondary
        onPress={() => navigation.navigate('Mission', { interventionId: quote.interventionId! })} /> : null}
      {quoteForm ? <BaitlyCard title={t('prepareQuote')}>
        <BaitlyField label={t('amount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" />
        <BaitlyChoices label={t('currencyLabel')} value={currency} onChange={setCurrency} options={['MAD', 'EUR', 'SAR'].map(code => ({ value: code, label: code }))} />
        <BaitlyChoices label={t('validUntilLabel')} value={validUntil} onChange={setValidUntil}
          options={[{ value: '', label: t('noValidity') }, ...validityDays.map(days => ({ value: civilDateKey(new Date(Date.now() + days * 86400000)), label: t('days', { count: days }) }))]} />
        <BaitlyField label={t('conditions')} value={message} onChangeText={setMessage} multiline maxLength={4000} />
        {teams.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void teams.refetch(); }} /> : null}
        {teams.data?.options.length ? <BaitlyChoices layout="list" label={t('team')} value={selectedTeamId ?? 0} onChange={id => setTeamId(id || null)}
          options={[{ value: 0, label: t('individual'), icon: 'person-outline' as const }, ...teams.data.options.map(team => ({ value: team.id, label: team.name, icon: 'people-outline' as const }))]} /> : null}
      </BaitlyCard> : null}
    </> : null}
    {requestId > 0 ? <Discussion kind="quote" id={requestId} /> : null}
  </BaitlyScreen>;
}
