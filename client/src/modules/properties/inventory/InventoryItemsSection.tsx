import { useRef, useState } from 'react';
import { BookOpen, Pencil, Plus, Trash2 } from '../../../icons/glyphs';
import { Button } from '../../../components/ui';
import PagePagination from '../../../components/PagePagination';
import NavCountBadge from '../../../components/NavCountBadge';
import { useScreenSearch } from '../../../components/ScreenChrome';
import { useTranslation } from '../../../hooks/useTranslation';
import type { InventoryItemInput, PropertyInventoryItem } from '../../../services/api/propertyInventoryApi';
import { normalizeInventorySearch } from './inventoryCatalog';
import { InventoryLibrary, InventoryRoomSelect } from './InventoryLibrary';
import { InventoryItemEditor } from './InventoryItemEditor';
import { InventoryThumbnail } from './InventoryThumbnail';
import './inventory-library.css';

interface Props {
  items: PropertyInventoryItem[];
  canEdit: boolean;
  onAdd: (data: InventoryItemInput) => Promise<unknown>;
  onAddMany: (data: InventoryItemInput[]) => Promise<unknown>;
  onUpdate: (data: InventoryItemInput & { id: number }) => Promise<unknown>;
  onDelete: (id: number) => Promise<unknown>;
}

export default function InventoryItemsSection({ items, canEdit, onAdd, onAddMany, onUpdate, onDelete }: Props) {
  const { t, currentLanguage } = useTranslation();
  const [search, setSearch] = useState('');
  const [room, setRoom] = useState('');
  const [page, setPage] = useState(0);
  const [library, setLibrary] = useState(false);
  const [editing, setEditing] = useState<InventoryItemInput | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  useScreenSearch(search, value => { setSearch(value); setPage(0); }, t('inventoryLibrary.screenSearch'));
  const words = normalizeInventorySearch(search).split(' ').filter(Boolean);
  const filtered = items.filter(item => (!room || item.category === room) && words.every(word =>
    normalizeInventorySearch(`${item.name} ${item.category ?? ''} ${item.notes ?? ''}`).includes(word)));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 30) - 1));
  const close = () => { setLibrary(false); setEditing(null); requestAnimationFrame(() => headingRef.current?.focus()); };
  const custom = () => { setLibrary(false); setEditing({ name: '', category: room || 'Autre', quantity: 1, notes: '', catalogKey: 'custom', photoUrl: null }); };
  const save = async (value: InventoryItemInput) => {
    if (value.id != null) await onUpdate({ ...value, id: value.id }); else await onAdd(value);
    setNotice(t('inventoryLibrary.saved'));
  };
  return <section className="inventory-surface" aria-label={t('inventoryLibrary.inventory')}>
    <header className="inventory-heading">
      <InventoryThumbnail name={t('inventoryLibrary.inventory')} catalogKey="sofa-two" size={48} /><div className="flex-1"><h2 ref={headingRef} tabIndex={-1}>{t('inventoryLibrary.inventory')} <NavCountBadge count={items.length} /></h2>
        <p>{t('inventoryLibrary.inventoryIntro', { count: items.reduce((sum, item) => sum + item.quantity, 0) })}</p></div>
      {canEdit && !library && !editing && <div className="inventory-actions">
        <Button variant="outline" size="sm" onClick={custom}><Plus size={16} />{t('inventoryLibrary.custom')}</Button>
        <Button size="sm" onClick={() => { setLibrary(true); setNotice(''); }}><BookOpen size={16} />{t('inventoryLibrary.open')}</Button>
      </div>}
    </header>
    {canEdit && library ? <InventoryLibrary items={items} onClose={close} onCustom={custom} onAdd={async data => {
      await onAddMany(data); setNotice(t('inventoryLibrary.added', { count: data.length }));
    }} /> : canEdit && editing ? <InventoryItemEditor initial={editing} onSave={save} onClose={close} /> : <>
      <div className="inventory-filter-bar"><InventoryRoomSelect value={room} includeAll label={t('inventoryLibrary.filterRoom')} onChange={value => { setRoom(value); setPage(0); }} />
        <span role="status">{notice || t('inventoryLibrary.results', { count: filtered.length })}</span>
      </div>
      {error && <p role="alert" className="inventory-error">{error}</p>}
      {!filtered.length ? <div className="inventory-empty"><InventoryThumbnail name={t('inventoryLibrary.inventory')} catalogKey="sofa-two" size={72} /><h3>{t(items.length ? 'inventoryLibrary.noResults' : 'inventoryLibrary.emptyTitle')}</h3>
        <p>{t(items.length ? 'inventoryLibrary.filterHint' : 'inventoryLibrary.emptyHint')}</p>
        {items.length > 0 ? <Button variant="outline" onClick={() => { setSearch(''); setRoom(''); }}>{t('inventoryLibrary.reset')}</Button>
          : canEdit && <Button onClick={() => setLibrary(true)}><BookOpen size={16} />{t('inventoryLibrary.open')}</Button>}
      </div> : <ul className="inventory-items">
        {filtered.slice(currentPage * 30, (currentPage + 1) * 30).map(item => <li key={item.id}>
          <InventoryThumbnail {...item} />
          <div className="inventory-item-copy"><strong>{item.name}</strong>
            <span>{item.category ? t(`inventoryLibrary.rooms.${item.category}`, item.category) : t('inventoryLibrary.unassigned')}</span>
            {item.notes && <p>{item.notes}</p>}</div>
          <div className="inventory-item-quantity"><strong>{item.quantity.toLocaleString(currentLanguage)}</strong><span>{t('inventoryLibrary.quantity')}</span></div>
          {canEdit && <div className="inventory-item-actions">
            {deleting === item.id ? <div className="inventory-delete-confirm"><span>{t('inventoryLibrary.deleteConfirm', { name: item.name })}</span><div>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setDeleting(null); setError(''); }}>{t('inventoryLibrary.cancel')}</Button>
              <Button size="sm" variant="destructive" disabled={busy} onClick={async () => {
                setBusy(true); setError('');
                try { await onDelete(item.id); setDeleting(null); setNotice(t('inventoryLibrary.deleted')); }
                catch { setError(t('inventoryLibrary.deleteError')); }
                finally { setBusy(false); }
              }}>{t('inventoryLibrary.delete')}</Button></div></div>
              : <><Button variant="ghost" size="icon" aria-label={t('inventoryLibrary.editNamed', { name: item.name })} onClick={() => { setEditing(item); setError(''); setNotice(''); }}><Pencil size={16} /></Button>
                <Button variant="ghost" size="icon" aria-label={t('inventoryLibrary.deleteNamed', { name: item.name })} disabled={busy} onClick={() => setDeleting(item.id)}><Trash2 size={16} /></Button></>}
          </div>}
        </li>)}
      </ul>}
      <PagePagination page={currentPage} onPageChange={setPage} count={filtered.length} rowsPerPage={30} />
    </>}
  </section>;
}
