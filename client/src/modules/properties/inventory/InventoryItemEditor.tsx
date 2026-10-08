import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ImagePlus } from '../../../icons/glyphs';
import { Button, Input, Textarea } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import type { InventoryItemInput } from '../../../services/api/propertyInventoryApi';
import { prepareStockPhoto, InvalidStockPhoto } from '../../stock/stockPhoto';
import { inventoryName } from './inventoryCatalog';
import { resolveItemVisual } from '../../stock/itemVisual';
import { InventoryThumbnail } from './InventoryThumbnail';
import { InventoryLibrary, InventoryRoomSelect } from './InventoryLibrary';

export function InventoryItemEditor({ initial, onSave, onClose }: {
  initial: InventoryItemInput; onSave: (item: InventoryItemInput) => Promise<unknown>; onClose: () => void;
}) {
  const { t, currentLanguage } = useTranslation();
  const [value, setValue] = useState(initial);
  const [quantity, setQuantity] = useState(String(initial.quantity ?? 1));
  const [choosing, setChoosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!choosing) nameRef.current?.focus({ preventScroll: true }); }, [choosing]);
  const busy = saving || uploading;
  const entry = resolveItemVisual(value.catalogKey, value.name);
  const upload = async (file: File) => {
    setUploading(true); setError('');
    try { const photo = await prepareStockPhoto(file); setValue(current => ({ ...current, photoUrl: photo, clearPhoto: false })); }
    catch (cause) { setError(t(`properties.stock.library.photoError.${cause instanceof InvalidStockPhoto ? cause.reason : 'decode'}`)); }
    finally { setUploading(false); }
  };
  if (choosing) return <InventoryLibrary items={[]} onClose={() => setChoosing(false)} onChoose={next => {
    setValue(current => ({ ...current, catalogKey: next.key, photoUrl: null, clearPhoto: true,
      name: current.name?.trim() || inventoryName(next, currentLanguage), category: current.category || next.room }));
    setChoosing(false);
  }} />;
  return <form className="inventory-editor" aria-busy={busy} onSubmit={async event => {
    event.preventDefault(); if (busy) return;
    if (!/^[0-9]+$/.test(quantity) || Number(quantity) < 1 || Number(quantity) > 10000) { setError(t('inventoryLibrary.quantityError')); return; }
    setSaving(true); setError('');
    try { await onSave({ ...value, name: value.name?.trim(), quantity: Number(quantity) }); onClose(); }
    catch { setError(t('inventoryLibrary.saveError')); }
    finally { setSaving(false); }
  }}>
    <header className="inventory-workflow-heading"><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onClose}><ArrowLeft size={16} />{t('inventoryLibrary.back')}</Button>
      <div><h3>{t(initial.id ? 'inventoryLibrary.edit' : 'inventoryLibrary.custom')}</h3><p>{t('inventoryLibrary.editorIntro')}</p></div></header>
    <div className="inventory-editor-layout">
      <div className="inventory-editor-photo">
        <InventoryThumbnail name={value.name ?? ''} catalogKey={value.catalogKey} photoUrl={value.photoUrl} size={156} />
        <span>{t(value.photoUrl ? 'inventoryLibrary.personalPhoto' : entry ? 'inventoryLibrary.defaultPhoto' : 'inventoryLibrary.genericPhoto')}</span>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}><ImagePlus size={16} />{t('inventoryLibrary.upload')}</Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setChoosing(true)}>{t('inventoryLibrary.choosePhoto')}</Button>
        {value.photoUrl && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setValue(current => ({ ...current, photoUrl: null, clearPhoto: true }))}>{t('inventoryLibrary.removePhoto')}</Button>}
        <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp" aria-label={t('inventoryLibrary.upload')} onChange={event => {
          const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = '';
        }} /><small>{t('inventoryLibrary.photoHint')}</small>
      </div>
      <fieldset disabled={busy} className="inventory-editor-fields">
        <label className="inventory-field-wide"><span>{t('inventoryLibrary.name')}</span><Input ref={nameRef} required maxLength={255} value={value.name ?? ''} onChange={e => setValue(current => ({ ...current, name: e.target.value }))} /></label>
        <label><span>{t('inventoryLibrary.quantity')}</span><Input type="number" required min={1} max={10000} step={1} value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
        <label><span>{t('inventoryLibrary.room')}</span><InventoryRoomSelect value={value.category ?? ''} label={t('inventoryLibrary.room')} onChange={category => setValue(current => ({ ...current, category }))} /></label>
        <label className="inventory-field-wide"><span>{t('inventoryLibrary.notes')}</span><Textarea rows={3} maxLength={5000} value={value.notes ?? ''} placeholder={t('inventoryLibrary.notesHint')} onChange={e => setValue(current => ({ ...current, notes: e.target.value }))} /></label>
      </fieldset>
    </div>
    {error && <p className="inventory-error" role="alert">{error}</p>}
    <footer className="inventory-editor-footer"><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>{t('inventoryLibrary.cancel')}</Button><Button type="submit" disabled={busy || !value.name?.trim()}>{t(saving ? 'inventoryLibrary.saving' : uploading ? 'inventoryLibrary.uploading' : 'inventoryLibrary.save')}</Button></footer>
  </form>;
}
