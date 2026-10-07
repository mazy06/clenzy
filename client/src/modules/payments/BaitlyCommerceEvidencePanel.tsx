import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Input, Label, NativeSelect, Skeleton } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { useCommerceScope } from '../../hooks/useCommerceScope';
import apiClient from '../../services/apiClient';

interface Target { kind: string; reference: string; amount: number; currency: string }
interface Evidence extends Target { id: number; number: string; issuer: string; issuerReference: string; sha256: string }
interface Dossier { targets: Target[]; documents: Evidence[] }
export function BaitlyCommerceEvidenceDisclosure(props: { source: 'UPSELL' | 'AFFILIATE'; sourceId: number }) {
  const [open, setOpen] = useState(false);const { t } = useTranslation();
  return <section><Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{t('commerceEvidence.title')}</Button>
    {open && <BaitlyCommerceEvidencePanel {...props} />}</section>;
}
export default function BaitlyCommerceEvidencePanel({ source, sourceId }: { source: 'UPSELL' | 'AFFILIATE'; sourceId: number }) {
  const scope = useCommerceScope();const { t, currentLanguage } = useTranslation();
  const root = `/commerce/evidence?source=${source}&sourceId=${sourceId}`;
  const query = useQuery({ queryKey: ['commerce-evidence', scope, source, sourceId], enabled: !!scope, queryFn: () => apiClient.get<Dossier>(root), retry: false });
  const [selection, setSelection] = useState('');const [number, setNumber] = useState('');const [issuer, setIssuer] = useState('');const [issuerReference, setIssuerReference] = useState('');const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');const [busy, setBusy] = useState(false);const pending = useRef(false);const request = useRef<{ key: string; id: string } | null>(null);const fileInput = useRef<HTMLInputElement>(null);
  const targets = query.data?.targets || [];const chosen = targets.find(x => `${x.kind}:${x.reference}` === selection) || targets[0];
  const money = (x: Target) => new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: x.currency }).format(x.amount);
  async function attach() {
    if (!chosen || !file || pending.current) return;pending.current = true;setBusy(true);setError('');
    try {
      const body = { ...chosen, number: number.trim(), issuer: issuer.trim(), issuerReference: issuerReference.trim() };const key = JSON.stringify({ source, sourceId, ...body });
      if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
      const form = new FormData();form.append('metadata', new Blob([JSON.stringify({ ...body, requestId: request.current.id })], { type: 'application/json' }));form.append('file', file);
      await apiClient.upload(root, form);await query.refetch();setNumber('');setFile(null);if (fileInput.current) fileInput.current.value = '';request.current = null;
    } catch (e) { setError(e instanceof Error ? e.message : t('common.error')); }
    finally { pending.current = false;setBusy(false); }
  }
  async function download(row: Evidence) {
    setError('');try {
      const blob = await apiClient.get<Blob>(`/commerce/evidence/${row.id}/document`, { responseType: 'blob' });
      const url = URL.createObjectURL(blob);const a = document.createElement('a');a.href = url;a.download = `baitly-piece-${row.id}.${blob.type === 'application/pdf' ? 'pdf' : blob.type === 'image/png' ? 'png' : 'jpg'}`;document.body.append(a);a.click();a.remove();setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : t('common.error')); }
  }
  return <div className="space-y-3 border-t border-border py-3">
    <p className="text-xs text-muted-foreground">{t(source === 'AFFILIATE' ? 'commerceEvidence.affiliateHint' : 'commerceEvidence.upsellHint')}</p>
    {query.isPending && <Skeleton className="h-12 w-full" />}
    {(query.error || error) && <p role="alert" className="text-sm text-destructive-ink">{error || query.error?.message}</p>}
    <ul className="divide-y divide-border">{query.data?.documents.map(row => <li key={row.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
      <div><p>{t(`commerceEvidence.kinds.${row.kind}`)} {row.number}</p><p className="text-xs text-muted-foreground">{row.issuer} · <span className="tabular-nums">{money(row)}</span></p></div>
      <Button size="sm" variant="ghost" onClick={() => void download(row)}>{t('commerceEvidence.download')}</Button></li>)}</ul>
    {chosen && <form className="space-y-3" onSubmit={e => { e.preventDefault();void attach(); }}>
      <Label className="grid gap-1.5">{t('commerceEvidence.target')}<NativeSelect disabled={busy} value={`${chosen.kind}:${chosen.reference}`} onChange={e => setSelection(e.target.value)}>{targets.map(x => <option key={`${x.kind}:${x.reference}`} value={`${x.kind}:${x.reference}`}>{t(`commerceEvidence.kinds.${x.kind}`)} · {money(x)} · {x.reference}</option>)}</NativeSelect></Label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1.5">{t('commerceEvidence.number')}<Input required maxLength={100} disabled={busy} value={number} onChange={e => setNumber(e.target.value)} /></Label>
        <Label className="grid gap-1.5">{t('commerceEvidence.issuer')}<Input required maxLength={200} disabled={busy} value={issuer} onChange={e => setIssuer(e.target.value)} /></Label>
      </div>
      <Label className="grid gap-1.5">{t('commerceEvidence.issuerReference')}<Input required maxLength={255} disabled={busy} value={issuerReference} onChange={e => setIssuerReference(e.target.value)} /></Label>
      <Label className="grid gap-1.5">{t('commerceEvidence.file')}<Input ref={fileInput} type="file" required accept="application/pdf,image/png,image/jpeg" disabled={busy} onChange={e => { const next = e.target.files?.[0] || null;request.current = null;if (next && next.size > 5 * 1024 * 1024) { setError(t('commerceEvidence.sizeError'));setFile(null);return; }setError('');setFile(next); }} /></Label>
      <Button type="submit" variant="outline" disabled={busy || !file || !number.trim() || !issuer.trim() || !issuerReference.trim()}>{t('commerceEvidence.attach')}</Button>
    </form>}
  </div>;
}
