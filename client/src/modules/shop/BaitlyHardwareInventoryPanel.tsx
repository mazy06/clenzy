import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { Button, Input, Label, NativeSelect, Skeleton } from '../../components/ui';
import apiClient from '../../services/apiClient';
import { SHOP_PRODUCTS } from './shopProducts';

interface Stock { id: string; country: string; sku: string; available: number; reserved: number }
export default function BaitlyHardwareInventoryPanel() {
  const { t } = useTranslation();const [country, setCountry] = useState('FR');const [sku, setSku] = useState(SHOP_PRODUCTS[0].sku);
  const [delta, setDelta] = useState('');const [proof, setProof] = useState('');const [busy, setBusy] = useState(false);const [error, setError] = useState('');
  const attempt = useRef<{ key: string; id: string } | null>(null);const pending = useRef(false);
  const query = useQuery({ queryKey: ['hardware-inventory', country], queryFn: () => apiClient.get<Stock[]>(`/shop/inventory?country=${country}`), retry: false });
  const row = query.data?.find(item => item.sku === sku);const expected = row?.available || 0;
  async function save() {
    if (!query.data || pending.current) return;pending.current = true;setBusy(true);setError('');
    try {
      const body = { country, sku, expected, delta: Number(delta), proof: proof.trim() };const key = JSON.stringify(body);
      if (attempt.current?.key !== key) attempt.current = { key, id: crypto.randomUUID() };
      await apiClient.post('/shop/inventory', { ...body, requestId: attempt.current.id });await query.refetch();setDelta('');setProof('');
    } catch (e) { setError(e instanceof Error ? e.message : t('common.error')); }
    finally { pending.current = false;setBusy(false); }
  }
  return <section className="space-y-4 p-4">
    <h2 className="text-lg font-semibold">{t('hardwareInventory.title')}</h2>
    <p className="text-sm text-muted-foreground">{t('hardwareInventory.hint')}</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <Label className="grid gap-1.5">{t('hardwareInventory.country')}<NativeSelect value={country} onChange={e => setCountry(e.target.value)} disabled={busy}>{['FR', 'MA', 'SA'].map(value => <option key={value} value={value}>{t(`hardwareInventory.countries.${value}`)}</option>)}</NativeSelect></Label>
      <Label className="grid gap-1.5">{t('hardwareInventory.product')}<NativeSelect value={sku} onChange={e => setSku(e.target.value)} disabled={busy}>{SHOP_PRODUCTS.map(product => <option key={product.sku} value={product.sku}>{t(product.nameKey)}</option>)}</NativeSelect></Label>
    </div>
    {query.isPending && <Skeleton className="h-16 w-full" />}
    {(error || query.error) && <p role="alert" className="text-sm text-destructive-ink">{error || query.error?.message}</p>}
    {query.data && <form onSubmit={e => { e.preventDefault();void save(); }} className="space-y-3">
      <p className="text-sm tabular-nums">{t('hardwareInventory.quantities', { available: expected, reserved: row?.reserved || 0 })}</p>
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Label className="grid gap-1.5">{t('hardwareInventory.delta')}<Input type="number" step="1" min={-expected} max={100000} value={delta} required disabled={busy} onChange={e => setDelta(e.target.value)} /></Label>
        <Label className="grid gap-1.5">{t('hardwareInventory.proof')}<Input required maxLength={255} value={proof} disabled={busy} onChange={e => setProof(e.target.value)} /></Label>
      </div>
      <Button type="submit" variant="outline" disabled={busy || !proof.trim() || !Number.isInteger(Number(delta)) || Number(delta) === 0 || Number(delta) < -expected}>{t('common.save')}</Button>
    </form>}
  </section>;
}
