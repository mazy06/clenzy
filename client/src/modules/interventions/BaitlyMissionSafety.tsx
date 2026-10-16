import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Phone, TriangleAlert, Pause, Play } from '../../icons/glyphs';
import { Button } from '../../components/ui';
import { baitlyMissionSafetyApi } from '../../services/api/baitlyMissionSafetyApi';
import { useTranslation } from '../../hooks/useTranslation';
import { BaitlyIncidentPhotos } from './BaitlyIncidentPhotos';
import { INVENTORY_CATALOG, inventoryName } from '../properties/inventory/inventoryCatalog';
import { InventoryThumbnail } from '../properties/inventory/InventoryThumbnail';
export function BaitlyMissionSafety({ id, rooms, onPause, canEdit }: { id: number; rooms: { id: string; type: string; number: number }[]; onPause: (paused: boolean) => void; canEdit: boolean }) {
  const { t, currentLanguage } = useTranslation();
  const query = useQuery({ queryKey: ['baitly-mission-safety', id], queryFn: () => baitlyMissionSafetyApi.get(id), refetchInterval: 15000 });
  const [open, setOpen] = useState(false); const [cause, setCause] = useState('unknown'); const [room, setRoom] = useState('');
  const [item, setItem] = useState(''); const [detail, setDetail] = useState(''); const [busy, setBusy] = useState(false); const [failed, setFailed] = useState(false);
  useEffect(() => { onPause(query.isPending || query.isError || !!query.data?.pausedAt); }, [query.isPending, query.isError, query.data?.pausedAt, onPause]);
  const label = (key: string) => t(`missionSafety.${key}`);
  async function action(kind: 'pause' | 'resume' | 'damage') {
    if(busy) return; setBusy(true); setFailed(false);
    const selected=INVENTORY_CATALOG.find(value=>item===`catalog:${value.key}`);
    const surface=item.startsWith('surface:')?item.substring(8):undefined;
    const elementCategory=surface?'surface':selected?['large-appliances','small-appliances','laundry-cleaning','climate','coffee-drinks'].includes(selected.family)?'appliance':selected.family==='electronics'?'electronics':'furniture':'other';
    try { await baitlyMissionSafetyApi.action(id, kind, { cause, room, furnitureId: item.startsWith('inventory:') ? Number(item.substring(10)) : undefined, detail,
      elementCategory,elementCode:selected?.key??surface,elementName:selected?inventoryName(selected,currentLanguage):surface?label(surface):undefined }); setOpen(false); }
    catch { setFailed(true); } finally { await query.refetch(); setBusy(false); }
  }
  const input = 'rounded-lg border border-[var(--bui-border)] bg-[var(--bui-background)] text-[var(--bui-foreground)] px-3 py-2 min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bui-primary)]';
  const selectedCatalog=INVENTORY_CATALOG.find(value=>item===`catalog:${value.key}`);
  return <section className="mb-3 space-y-3" aria-label={label('title')}>
    <div className="flex flex-wrap items-center gap-2">
      {canEdit ? <><Button variant="outline" disabled={busy || !query.data} onClick={() => setOpen(!open)}><TriangleAlert size={16} />{label('title')}</Button>
      <Button variant="outline" disabled={busy || !query.data} onClick={() => { void action(query.data?.pausedAt ? 'resume' : 'pause'); }}>{query.data?.pausedAt ? <Play size={16} /> : <Pause size={16} />}{label(query.data?.pausedAt ? 'resume' : 'pause')}</Button></> : null}
      {query.data?.pausedAt ? <span className="text-sm font-medium">{label('paused')}</span> : null}
    </div>
    {query.isError || failed ? <div role="alert" className="text-sm text-[var(--bui-destructive-ink)]">{label('failed')} <Button variant="outline" onClick={() => { void query.refetch(); }}>{label('refresh')}</Button></div> : null}
    {open ? <div className="grid gap-3 sm:grid-cols-3">
      <label className="grid gap-1 text-sm">{label('cause')}<select className={input} value={cause} onChange={e => setCause(e.target.value)} disabled={busy}>{['unknown','wear','breakage','leak','missing'].map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
      <label className="grid gap-1 text-sm">{label('room')}<select className={input} value={room} onChange={e => setRoom(e.target.value)} disabled={busy}><option value="">{label('choose')}</option>{rooms.map(value => <option key={value.id} value={value.id}>{label(value.type)} {['bedroom','bathroom'].includes(value.type) ? value.number : ''}</option>)}</select></label>
      <label className="grid gap-1 text-sm">{label('item')}<select className={input} value={item} onChange={e => setItem(e.target.value)} disabled={busy}><option value="">{label('other')}</option>
        <optgroup label={label('inventory')}>{query.data?.furniture.map(value => <option key={value.id} value={`inventory:${value.id}`}>{value.name}</option>)}</optgroup>
        <optgroup label={label('surfaces')}>{['wall','ceiling','floor'].map(value=><option key={value} value={`surface:${value}`}>{label(value)}</option>)}</optgroup>
        <optgroup label={label('catalog')}>{INVENTORY_CATALOG.map(value=><option key={value.key} value={`catalog:${value.key}`}>{inventoryName(value,currentLanguage)}</option>)}</optgroup>
      </select>{selectedCatalog?<InventoryThumbnail name={inventoryName(selectedCatalog,currentLanguage)} catalogKey={selectedCatalog.key} size={52}/>:item.startsWith('surface:')?<img src={`/images/baitly-mission-safety/${item.substring(8)}.png`} alt="" width={52} height={52}/>:null}</label>
      <label className="grid gap-1 text-sm sm:col-span-3">{label('detail')}<textarea className={input} value={detail} onChange={e => setDetail(e.target.value)} maxLength={1000} disabled={busy} /></label>
      <Button disabled={busy || !room || failed} onClick={() => { void action('damage'); }}>{label('reportPause')}</Button>
    </div> : null}
    {open || query.data?.pausedAt ? <div className="flex flex-wrap gap-2">{query.data?.contacts.map((contact,index) => <a key={index} className={`${input} inline-flex items-center gap-2 cursor-pointer`} href={`tel:${contact.phone?.replace(/[^+0-9]/g,'')}`}><Phone size={16} />{label(contact.role)} · {contact.name}</a>)}{!query.data?.contacts.length ? <span className="text-sm text-[var(--bui-muted-foreground)]">{label('noPhone')}</span> : null}</div> : null}
    {query.data?.incidents.map(incident => <details key={incident.id} className="border-b border-[var(--bui-border)] pb-2"><summary className="cursor-pointer text-sm font-medium">{incident.title} · {incident.status}</summary><p className="whitespace-pre-line text-sm text-[var(--bui-muted-foreground)] mt-2">{incident.description}</p><BaitlyIncidentPhotos id={id} issueId={incident.id}/></details>)}
  </section>;
}
