import { useMemo, useRef, useState, useEffect } from 'react';
import { ArrowLeft, Check, Plus, Search } from 'lucide-react';
import { Button, Input, NativeSelect, NativeSelectOption } from '../../../components/ui';
import PagePagination from '../../../components/PagePagination';
import { useTranslation } from '../../../hooks/useTranslation';
import type { InventoryItemInput, PropertyInventoryItem } from '../../../services/api/propertyInventoryApi';
import { INVENTORY_CATALOG, INVENTORY_FAMILIES, INVENTORY_ROOMS, inventoryName, resolveInventoryCatalog, searchInventoryCatalog, type InventoryCatalogEntry } from './inventoryCatalog';
import { InventoryThumbnail } from './InventoryThumbnail';

export function InventoryRoomSelect({ value, onChange, label, disabled = false, includeAll = false }: {
  value: string; onChange: (value: string) => void; label: string; disabled?: boolean; includeAll?: boolean;
}) {
  const { t } = useTranslation();
  return <NativeSelect aria-label={label} value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>
    {includeAll && <NativeSelectOption value="">{t('inventoryLibrary.allRooms')}</NativeSelectOption>}
    {!includeAll && !value && <NativeSelectOption value="">{t('inventoryLibrary.unassigned')}</NativeSelectOption>}
    {value && !(INVENTORY_ROOMS as readonly string[]).includes(value) && <NativeSelectOption value={value}>{value}</NativeSelectOption>}
    {INVENTORY_ROOMS.map(room => <NativeSelectOption key={room} value={room}>{t(`inventoryLibrary.rooms.${room}`)}</NativeSelectOption>)}
  </NativeSelect>;
}

export function InventoryLibrary({ items, onAdd, onChoose, onClose, onCustom }: {
  items: PropertyInventoryItem[]; onAdd?: (items: InventoryItemInput[]) => Promise<unknown>;
  onChoose?: (entry: InventoryCatalogEntry) => void; onClose: () => void; onCustom?: () => void;
}) {
  const { t, currentLanguage } = useTranslation();
  const [search, setSearch] = useState('');
  const [family, setFamily] = useState('');
  const [page, setPage] = useState(0);
  const [review, setReview] = useState(false);
  const [selection, setSelection] = useState<Record<string, { quantity: string; room: string }>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => { searchRef.current?.focus({ preventScroll: true }); }, []);
  const selectedEntries = INVENTORY_CATALOG.filter(entry => selection[entry.key]);
  const results = useMemo(() => searchInventoryCatalog(search, family), [search, family]);
  const shown = review ? selectedEntries : results;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(shown.length / 24) - 1));
  const existing = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach(item => { const key = resolveInventoryCatalog(item.catalogKey, item.name)?.key; if (key) counts.set(key, (counts.get(key) ?? 0) + item.quantity); });
    return counts;
  }, [items]);
  const toggle = (entry: InventoryCatalogEntry) => {
    if (onChoose) { onChoose(entry); return; }
    setError('');
    if (!selection[entry.key] && selectedEntries.length >= 100) { setError(t('inventoryLibrary.limit')); return; }
    setSelection(current => {
      const next = { ...current };
      if (next[entry.key]) delete next[entry.key]; else next[entry.key] = { quantity: '1', room: entry.room };
      return next;
    });
  };
  const submit = async () => {
    if (saving || !onAdd || !selectedEntries.length) return;
    const invalidIndex = selectedEntries.findIndex(entry => !/^[0-9]+$/.test(selection[entry.key].quantity) || Number(selection[entry.key].quantity) < 1 || Number(selection[entry.key].quantity) > 10000);
    if (invalidIndex !== -1) {
      setReview(true); setPage(Math.floor(invalidIndex / 24)); setError(t('inventoryLibrary.quantityError')); return;
    }
    setSaving(true); setError('');
    try {
      await onAdd(selectedEntries.map(entry => ({ name: inventoryName(entry, currentLanguage), catalogKey: entry.key,
        category: selection[entry.key].room, quantity: Number(selection[entry.key].quantity), photoUrl: null, notes: '' })));
      onClose();
    } catch { setError(t('inventoryLibrary.saveError')); }
    finally { setSaving(false); }
  };
  return <section className="inventory-library" aria-label={t('inventoryLibrary.title')} aria-busy={saving}>
    <header className="inventory-workflow-heading">
      <Button variant="ghost" size="sm" disabled={saving} onClick={onClose}><ArrowLeft size={16} />{t('inventoryLibrary.back')}</Button>
      <div><h3>{t(onChoose ? 'inventoryLibrary.choosePhoto' : review ? 'inventoryLibrary.reviewTitle' : 'inventoryLibrary.title')}</h3>
        <p>{t(onChoose ? 'inventoryLibrary.photoIntro' : review ? 'inventoryLibrary.reviewIntro' : 'inventoryLibrary.intro', { count: INVENTORY_CATALOG.length })}</p></div>
      {onCustom && <Button variant="outline" size="sm" disabled={saving} onClick={onCustom}><Plus size={15} />{t('inventoryLibrary.custom')}</Button>}
    </header>
    {!review && <div className="inventory-library-tools">
      <label><span><Search size={14} aria-hidden />{t('inventoryLibrary.search')}</span>
        <Input ref={searchRef} value={search} disabled={saving || review} placeholder={t('inventoryLibrary.searchHint')}
          onChange={e => { setSearch(e.target.value); setPage(0); }} /></label>
      <label><span>{t('inventoryLibrary.family')}</span>
        <NativeSelect aria-label={t('inventoryLibrary.family')} value={family} disabled={saving || review} onChange={e => { setFamily(e.target.value); setPage(0); }}>
          <NativeSelectOption value="">{t('inventoryLibrary.allFamilies')}</NativeSelectOption>
          {INVENTORY_FAMILIES.map(key => <NativeSelectOption value={key} key={key}>{t(`inventoryLibrary.families.${key}`)}</NativeSelectOption>)}
        </NativeSelect></label>
    </div>}
    <div className="inventory-library-summary"><span role="status">{t('inventoryLibrary.results', { count: shown.length })}</span>
      {!onChoose && <Button variant={review ? 'secondary' : 'ghost'} size="sm" disabled={saving} aria-pressed={review}
        onClick={() => { setReview(!review); setPage(0); }}>{t(review ? 'inventoryLibrary.browseMore' : 'inventoryLibrary.selection', { count: selectedEntries.length })}</Button>}
    </div>
    {!shown.length && <div className="inventory-empty"><p>{t(review ? 'inventoryLibrary.noSelection' : 'inventoryLibrary.noResults')}</p>
      <Button variant="outline" size="sm" onClick={() => { setSearch(''); setFamily(''); setReview(false); setPage(0); }}>{t('inventoryLibrary.reset')}</Button></div>}
    <ul className="inventory-library-list">
      {shown.slice(currentPage * 24, (currentPage + 1) * 24).map(entry => {
        const name = inventoryName(entry, currentLanguage), selected = selection[entry.key];
        return <li key={entry.key} data-selected={!!selected}>
          <button type="button" className="inventory-library-option" aria-label={name} aria-pressed={onChoose ? undefined : !!selected} disabled={saving} onClick={() => toggle(entry)}>
            <InventoryThumbnail name={name} catalogKey={entry.key} size={76} />
            <span><strong>{name}</strong><small>{t(`inventoryLibrary.families.${entry.family}`)}</small>
              {existing.has(entry.key) && <small className="inventory-existing">{t('inventoryLibrary.existing', { count: existing.get(entry.key) })}</small>}</span>
            {!onChoose && <span className="inventory-check" aria-hidden>{selected ? <Check size={15} /> : <Plus size={15} />}</span>}
          </button>
          {selected && <div className="inventory-selection-fields">
            <label><span>{t('inventoryLibrary.quantity')}</span><Input aria-label={t('inventoryLibrary.quantityFor', { name })} type="number" min={1} max={10000} step={1} disabled={saving} value={selected.quantity}
              onChange={e => setSelection(current => ({ ...current, [entry.key]: { ...current[entry.key], quantity: e.target.value } }))} /></label>
            <label><span>{t('inventoryLibrary.room')}</span><InventoryRoomSelect value={selected.room} disabled={saving} label={t('inventoryLibrary.roomFor', { name })}
              onChange={room => setSelection(current => ({ ...current, [entry.key]: { ...current[entry.key], room } }))} /></label>
          </div>}
        </li>;
      })}
    </ul>
    <PagePagination page={currentPage} onPageChange={setPage} count={shown.length} rowsPerPage={24} />
    {!onChoose && <footer className="inventory-library-footer">
      {error && <p role="alert" className="inventory-error">{error}</p>}
      <div><strong>{t('inventoryLibrary.selected', { count: selectedEntries.length })}</strong><p>{t('inventoryLibrary.selectionHint')}</p></div>
      <Button disabled={saving || !selectedEntries.length} onClick={() => void submit()}><Check size={16} />{t(saving ? 'inventoryLibrary.saving' : 'inventoryLibrary.addSelection', { count: selectedEntries.length })}</Button>
    </footer>}
  </section>;
}
