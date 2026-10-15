import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BaitlyEmpty, BaitlyLoading, BaitlyNotice, BaitlyText } from '@/design-system/components';
import { useBaitlyTheme } from '@/design-system/theme';
import { useBaitlyScope } from '@/features/marketplace/queries';
import { restockApi, type RestockRequest } from './baitlyRestockApi';
import { stockNumber, stockPrice, needsRestock } from './restockModel';
import { StockThumbnail } from './StockThumbnail';
import { QuantityCounter, RestockPricePad } from './RestockControls';

export interface MissionRestockHandle { save: () => Promise<void> }
export const MissionRestock = forwardRef<MissionRestockHandle, { id: number; onReady: (ready: boolean) => void; onDirty: (dirty: boolean) => void }>(function MissionRestock({ id, onReady, onDirty }, ref) {
  const { t, i18n } = useTranslation('mobileV1'); const c = useBaitlyTheme(); const scope = useBaitlyScope();
  const query = useQuery({ queryKey: [...scope, 'mission-stock', id], queryFn: () => restockApi.list(id), retry: false });
  const [values, setValues] = useState<Record<number, { observed: string; added: string; price: string }>>({});
  const [priceItem, setPriceItem] = useState<number | null>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [uncertain, setUncertain] = useState(false);
  const pending = useRef<RestockRequest | undefined>(undefined); const flight = useRef(false);
  const edited = useRef(false);
  useEffect(() => {
    if (!query.data) return;
    setValues(Object.fromEntries(query.data.items.map(item => [item.id, { observed: String(item.quantity), added: '0', price: '' }])));
  }, [query.data, onReady]);
  const money = (amount: number) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: query.data?.currency || 'EUR' }).format(amount);
  const update = (itemId: number, field: 'observed' | 'added' | 'price', value: string) => {
    pending.current = undefined; edited.current = true; onDirty(true); setMessage(''); setValues(previous => ({ ...previous, [itemId]: { ...previous[itemId], [field]: value } }));
  };
  const items = query.data?.items.filter(needsRestock) ?? [];
  const valid = items.every(item => {
    const value = values[item.id]; return value && stockNumber(value.observed) !== null && stockNumber(value.added) !== null
      && (stockNumber(value.added) === 0 || stockPrice(value.price) !== null);
  });
  useEffect(() => { onReady(!!query.data && valid && !busy && !query.isError); }, [query.data, valid, busy, query.isError, onReady]);
  useImperativeHandle(ref, () => ({ save: record }));
  async function record() {
    if (flight.current || !query.data || !valid) throw { status: 400 };
    if (!items.length || (query.data.history.length > 0 && !edited.current)) { onDirty(false); return; }
    flight.current = true; setBusy(true); setMessage('');
    pending.current ??= { requestKey: Crypto.randomUUID(), lines: items.map(item => ({ itemId: item.id, expected: item.quantity,
      observed: stockNumber(values[item.id].observed)!, added: stockNumber(values[item.id].added)!, unitPrice: stockPrice(values[item.id].price) ?? 0 })) };
    try { await restockApi.record(id, pending.current); setUncertain(false); pending.current = undefined; edited.current = false; await query.refetch(); onDirty(false); setMessage(t('restockSaved')); }
    catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 409) { pending.current = undefined; await query.refetch(); }
      else setUncertain(!status || status >= 500);
      onReady(false); setMessage(t(status === 409 ? 'restockChanged' : 'restockFailed'));
      throw error;
    } finally { flight.current = false; setBusy(false); }
  }
  if (query.isPending) return <BaitlyLoading />;
  if (query.isError) return <BaitlyEmpty title={t('loadFailed')} retry={() => { void query.refetch(); }} />;
  const stock = query.data!;
  return <View style={{ gap: 14 }}>
    {items.map(item => { const value = values[item.id]; if (!value) return null;
      const observed = stockNumber(value.observed); const added = stockNumber(value.added); const price = stockPrice(value.price);
      return <View key={item.id} style={{ padding: 14, borderRadius: 18, backgroundColor: c.surface, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><StockThumbnail name={item.name} catalogKey={item.catalogKey} photoUrl={item.photoUrl} />
          <View style={{ flex: 1 }}><BaitlyText style={{ fontWeight: '600' }}>{item.name}</BaitlyText><BaitlyText muted variant="meta">{item.unit}</BaitlyText></View>
          <BaitlyText variant="meta" style={{ fontVariant: ['tabular-nums'] }}>{observed !== null && added !== null ? `= ${observed + added}` : '···'}</BaitlyText></View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <QuantityCounter label={t('restockAvailable')} value={value.observed} disabled={busy || uncertain} onChange={text => update(item.id, 'observed', text)} />
          <QuantityCounter label={t('restockAdded')} value={value.added} disabled={busy || uncertain} onChange={text => update(item.id, 'added', text)} />
        </View>
        {added !== null && added > 0 ? <><Pressable accessibilityRole="button" accessibilityLabel={t('restockUnitPrice')} disabled={busy || uncertain} onPress={() => setPriceItem(item.id)} style={{ minHeight: 48, padding: 12, borderRadius: 14, backgroundColor: c.muted }}>
          <BaitlyText variant="meta">{t('restockUnitPrice')} · {price === null ? '···' : money(price)}</BaitlyText></Pressable>
          {price !== null ? <BaitlyText style={{ textAlign: 'right', fontVariant: ['tabular-nums'] }}>{money(Math.round(price * 100) * added / 100)}</BaitlyText> : null}</> : null}
      </View>;
    })}
    {!items.length ? <BaitlyText muted>{t('restockHealthy')}</BaitlyText> : null}
    <RestockPricePad visible={priceItem !== null} value={priceItem !== null ? values[priceItem]?.price ?? '' : ''} currency={stock.currency}
      onClose={() => setPriceItem(null)} onConfirm={price => { if (priceItem !== null) update(priceItem, 'price', price); setPriceItem(null); }} />
    {message ? <BaitlyNotice>{message}</BaitlyNotice> : null}
    {stock.history.flatMap(receipt => receipt.entries.filter(entry => entry.added > 0).map(entry => <View key={`${receipt.requestKey}:${entry.itemId}`} style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>
      <BaitlyText variant="meta">{entry.name} · +{entry.added}</BaitlyText><BaitlyText variant="meta">{money(entry.amount)}</BaitlyText>
    </View>))}
  </View>;
});
