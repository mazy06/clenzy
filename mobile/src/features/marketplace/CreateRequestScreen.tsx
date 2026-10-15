import React, { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { BaitlyStackParams } from '@/navigation/BaitlyNavigator';
import { BaitlyButton, BaitlyEmpty, BaitlyField, BaitlyLoading, BaitlyNotice, BaitlyScreen, BaitlyText } from '@/design-system/components';
import { useBaitlyProperties, useBaitlyScope, useCategories, useProvider } from './queries';
import { marketplaceApi } from './api';
import { formatMoney, validateRequestContext } from './domain';
import { BaitlyCard, BaitlyChoices, BaitlyInfoRow } from '@/design-system/primitives';
import { baitlySectorImage } from './baitlySectorImages';
import { REQUEST_DURATIONS, REQUEST_TIME_SLOTS, durationLabel, upcomingDays } from './requestScheduleModel';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function CreateRequestScreen({ route, navigation }: NativeStackScreenProps<BaitlyStackParams, 'CreateRequest'>) {
  const { t, i18n } = useTranslation('mobileV1');
  const provider = useProvider(route.params.providerId);
  const categories = useCategories();
  const properties = useBaitlyProperties();
  const scope = useBaitlyScope();
  const cache = useQueryClient();
  const { isConnected } = useNetworkStatus();
  const [offerId, setOfferId] = useState<number>();
  const [propertyId, setPropertyId] = useState<number>();
  const management = route.params.purpose === 'management';
  const [title, setTitle] = useState(() => management ? t('managementRequestTitle') : '');
  const [message, setMessage] = useState(() => management ? t('managementRequestMessage') : '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('');
  const [review, setReview] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [validation, setValidation] = useState('');
  const lock = useRef(false);
  const mutation = useMutation({ mutationFn: marketplaceApi.create, retry: false });
  const selected = provider.data?.offers.find(o => o.id === offerId && o.active);
  const item = categories.data?.flatMap(c => c.items).find(i => i.code === selected?.serviceItemCode);
  const property = properties.data?.pages.flatMap(p => p.content).find(p => p.id === propertyId);
  useEffect(() => {
    if (mutation.isSuccess && mutation.data) navigation.replace('Quote', { requestId: mutation.data.id, side: 'sent' });
  }, [mutation.isSuccess, mutation.data, navigation]);
  usePreventRemove(!mutation.isSuccess && Boolean(title || message || offerId), ({ data }) => {
    if (lock.current) return;
    Alert.alert(t('leaveDraft'), t('leaveDraftHelp'), [
      { text: t('stay'), style: 'cancel' },
      { text: t('leave'), style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  function validate() {
    if (!selected || !title.trim()) { setValidation(t('requestRequired')); return; }
    const error = validateRequestContext(item, { propertyId, date, time, duration });
    if (error) { setValidation(t(`validation.${error}`)); return; }
    setValidation(''); setReview(true);
  }
  async function send() {
    if (lock.current || uncertain || !isConnected || !selected || !title.trim()) return;
    lock.current = true;
    try {
      await mutation.mutateAsync({
        providerId: route.params.providerId, title: title.trim(), message: message.trim() || undefined,
        categoryCode: selected.categoryCode, serviceItemCode: selected.serviceItemCode ?? undefined,
        propertyId, desiredDate: date || undefined, requestedStartTime: time || undefined,
        requestedDurationMinutes: duration ? Number(duration) : undefined,
      });
      void cache.invalidateQueries({ queryKey: [...scope, 'requests', 'sent'] });
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (!status || status >= 500 || status === 408) setUncertain(true);
    } finally { lock.current = false; }
  }
  const dates = upcomingDays(new Date());
  const units = { hour: t('durationHour'), minute: t('durationMinute'), day: t('durationDay') };
  const dayLabel = (offset: number, day: Date) => offset === 0 ? t('today') : offset === 1 ? t('tomorrow') : day.toLocaleDateString(i18n.language, { weekday: 'short' });
  const chosenDay = dates.find(day => day.key === date);
  const whenLabel = date ? [chosenDay ? `${dayLabel(chosenDay.offset, chosenDay.date)} ${chosenDay.date.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })}` : date,
    time, duration ? durationLabel(Number(duration), units) : ''].filter(Boolean).join(' · ') : t('requestNoDate');
  const ready = !!provider.data && !!categories.data && !provider.isError && !categories.isError;
  const footer = !ready ? undefined : review ? <View style={{ gap: 4 }}>
    <BaitlyButton title={t('sendRequest')} icon="paper-plane-outline" onPress={() => { void send(); }} busy={mutation.isPending} disabled={uncertain || !isConnected} />
    <BaitlyButton variant="ghost" title={t('edit')} onPress={() => setReview(false)} disabled={mutation.isPending || uncertain} />
  </View> : <BaitlyButton title={selected ? t('reviewRequest') : t('requestMissing')} onPress={validate} disabled={!selected || !title.trim()} />;
  return <BaitlyScreen title={t('requestQuote')} subtitle={provider.data?.displayName} footer={footer}>
    {management ? <BaitlyNotice>{t('managementConsentHelp')}</BaitlyNotice> : null}
    {provider.isPending || categories.isPending ? <BaitlyLoading /> : null}
    {provider.isError || categories.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => {
      void provider.refetch(); void categories.refetch();
    }} /> : null}
    {validation ? <BaitlyNotice error>{validation}</BaitlyNotice> : null}
    {mutation.isError ? <BaitlyNotice error>{uncertain ? t('uncertainSend') : t('sendFailed')}</BaitlyNotice> : null}
    {uncertain ? <><BaitlyNotice tone="warning">{t('checkSentHelp')}</BaitlyNotice>
      <BaitlyButton secondary title={t('checkSent')} onPress={() => navigation.navigate('SentRequests')} /></> : null}
    {!isConnected ? <BaitlyNotice tone="warning">{t('onlineRequired')}</BaitlyNotice> : null}
    {!review && ready && provider.data ? <>
      <BaitlyChoices layout="list" label={t('requestWhatService')} value={offerId} onChange={id => {
        const offer = provider.data!.offers.find(o => o.id === id);
        setOfferId(id); setValidation('');
        if (offer && (!title.trim() || provider.data!.offers.some(o => o.label === title))) setTitle(offer.label);
      }} options={provider.data.offers.filter(o => o.active).map(o => ({ value: o.id, label: o.label, image: baitlySectorImage(o.categoryCode),
        detail: o.pricingModel === 'ON_QUOTE' || o.amount == null ? t('onQuote')
          : [formatMoney(o.amount, o.currency, i18n.language), o.unitLabel].filter(Boolean).join(' · ') }))} />
      {properties.isError ? <BaitlyEmpty title={t('loadFailed')} retry={() => { void properties.refetch(); }} /> : null}
      <BaitlyChoices layout="list" label={t('requestWhichHome')} value={propertyId ?? 0} onChange={id => setPropertyId(id || undefined)}
        options={[...properties.data?.pages.flatMap(p => p.content).map(p => ({ value: p.id, label: p.name, detail: p.city ?? undefined, icon: 'home-outline' as const })) ?? [],
          ...(item?.propertyRequired ? [] : [{ value: 0, label: t('noProperty'), icon: 'remove-circle-outline' as const }])]} />
      {properties.hasNextPage ? <BaitlyButton variant="ghost" title={t('loadMore')} busy={properties.isFetchingNextPage}
        onPress={() => { void properties.fetchNextPage(); }} /> : null}
      <View style={{ gap: 14 }}>
        <BaitlyText style={{ fontWeight: '600' }}>{t('requestWhen')}</BaitlyText>
        <BaitlyChoices value={date} onChange={value => { setDate(value); if (!value) { setTime(''); setDuration(''); } }}
          options={[...(item?.slotRequired ? [] : [{ value: '', label: t('requestNoDate') }]),
            ...dates.map(day => ({ value: day.key, label: dayLabel(day.offset, day.date), detail: day.date.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }) }))]} />
        {date ? <>
          <BaitlyChoices label={t('requestArrival')} value={time} onChange={setTime} options={REQUEST_TIME_SLOTS.map(slot => ({ value: slot, label: slot }))} />
          <BaitlyChoices label={t('requestDuration')} value={duration ? Number(duration) : undefined} onChange={value => setDuration(String(value))}
            options={REQUEST_DURATIONS.map(minutes => ({ value: minutes, label: durationLabel(minutes, units) }))} />
        </> : null}
      </View>
      <View style={{ gap: 12 }}>
        <BaitlyText style={{ fontWeight: '600' }}>{t('requestDetails')}</BaitlyText>
        <BaitlyField label={t('requestTitle')} value={title} onChangeText={setTitle} maxLength={150} />
        <BaitlyField label={t('description')} value={message} onChangeText={setMessage} multiline maxLength={4000} />
      </View>
    </> : null}
    {review ? <>
      <BaitlyText variant="heading">{t('requestCheck')}</BaitlyText>
      <BaitlyCard>
        <BaitlyInfoRow icon="document-text-outline" label={t('requestTitle')} value={title} />
        <BaitlyInfoRow icon="briefcase-outline" label={t('requestService')} value={selected?.label} />
        <BaitlyInfoRow icon="person-outline" label={t('requestProvider')} value={provider.data?.displayName} />
        <BaitlyInfoRow icon="home-outline" label={t('requestHome')} value={property?.name ?? t('noProperty')} />
        <BaitlyInfoRow icon="calendar-outline" label={t('requestDate')} value={whenLabel} last={!message} />
        {message ? <BaitlyText muted>{message}</BaitlyText> : null}
      </BaitlyCard>
      <BaitlyNotice>{t('quoteBeforePrice')}</BaitlyNotice>
    </> : null}
  </BaitlyScreen>;
}
