import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, ImagePlus, Plus, Search } from 'lucide-react';
import { Alert, AlertDescription, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, FieldLabel, Input, NativeSelect, NativeSelectOption, Spinner } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import type { PropertyStockItemRequest } from '../../services/api/propertyStockApi';
import { CUSTOM_STOCK_KEY, STOCK_CATEGORIES, STOCK_FAMILIES, STOCK_FAMILY_CATEGORIES, resolveStockCatalog, searchStockCatalog, stockCatalogName, type StockCategory, type StockCatalogEntry, type StockFamily, type StockUse } from './stockCatalog';
import { StockThumbnail } from './StockThumbnail';
import { InvalidStockPhoto, prepareStockPhoto } from './stockPhoto';

interface Props {
  value: PropertyStockItemRequest;
  saving: boolean;
  error: string | null;
  onChange: (value: PropertyStockItemRequest) => void;
  onSave: () => void;
  onClose: () => void;
}

export function StockItemEditor({ value, saving, error, onChange, onSave, onClose }: Props) {
  const { t, currentLanguage } = useTranslation();
  const [choosing, setChoosing] = useState(!value.name);
  const [search, setSearch] = useState('');
  const [family, setFamily] = useState<StockFamily | ''>('');
  const [use, setUse] = useState<StockUse | ''>('');
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLDivElement>(null);
  // Une sélection faite en bas de la bibliothèque doit ouvrir le début de la fiche.
  useLayoutEffect(() => { if (body.current) body.current.scrollTop = 0; }, [choosing, search, family, use]);
  useLayoutEffect(() => { if (choosing) searchInput.current?.focus({ preventScroll: true }); }, [choosing]);
  const busy = saving || uploading;
  const label = (key: string) => t(`properties.stock.library.${key}`);
  const categoryName = (key: StockCategory) => t(`properties.stock.categories.${key.toLowerCase()}`);
  const selectedEntry = resolveStockCatalog(value.catalogKey, value.name);
  const results = useMemo(() => searchStockCatalog(search, undefined, { family: family || undefined, use: use || undefined }), [search, family, use]);
  const field = <K extends keyof PropertyStockItemRequest>(key: K, next: PropertyStockItemRequest[K]) => onChange({ ...value, [key]: next });
  const choose = (entry?: StockCatalogEntry) => {
    onChange({ ...value, catalogKey: entry?.key ?? CUSTOM_STOCK_KEY,
      name: entry ? stockCatalogName(entry, currentLanguage) : '', category: entry?.category ?? (family ? STOCK_FAMILY_CATEGORIES[family] : 'CONSUMABLES'), photoUrl: null });
    setChoosing(false);
    setPhotoError(null);
  };
  const upload = async (file: File) => {
    setUploading(true);
    setPhotoError(null);
    try { field('photoUrl', await prepareStockPhoto(file)); }
    catch (cause) { setPhotoError(label(`photoError.${cause instanceof InvalidStockPhoto ? cause.reason : 'decode'}`)); }
    finally { setUploading(false); }
  };
  const numberField = (key: 'quantity' | 'reorderThreshold' | 'reorderQuantity' | 'consumptionPerStay', translation: string) => <Field>
    <FieldLabel htmlFor={`stock-${key}`}>{t(`properties.stock.${translation}`)}</FieldLabel>
    <Input id={`stock-${key}`} type="number" min={0} max={2147483647} step={1} required className="tabular-nums"
      value={value[key]} onChange={event => field(key, Math.max(0, Math.trunc(Number(event.target.value) || 0)))} />
  </Field>;

  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="baitly-stock-editor" showCloseButton={!busy} onOpenAutoFocus={event => {
      if (choosing) { event.preventDefault(); searchInput.current?.focus(); }
    }}>
      <form onSubmit={event => { event.preventDefault(); if (!choosing && !busy && value.name.trim()) onSave(); }}>
        <DialogHeader>
          <DialogTitle>{choosing ? label('title') : t(value.id == null ? 'properties.stock.addTitle' : 'properties.stock.editTitle')}</DialogTitle>
          <DialogDescription>{choosing ? t('properties.stock.library.intro', { count: searchStockCatalog('').length }) : label('editorIntro')}</DialogDescription>
        </DialogHeader>
        <div ref={body} className="baitly-stock-editor-body">
          {choosing ? <>
            <div className="baitly-stock-picker-controls">
            <div className="baitly-stock-catalog-tools">
              <Field><FieldLabel htmlFor="stock-search"><Search size={14} aria-hidden />{label('search')}</FieldLabel>
                <Input ref={searchInput} id="stock-search" value={search} onChange={event => setSearch(event.target.value)} placeholder={label('searchHint')} />
              </Field>
              <Field><FieldLabel htmlFor="stock-filter">{label('family')}</FieldLabel>
                <NativeSelect id="stock-filter" value={family} onChange={event => setFamily(event.target.value as StockFamily | '')}>
                  <NativeSelectOption value="">{label('allCategories')}</NativeSelectOption>
                  {STOCK_FAMILIES.map(key => <NativeSelectOption value={key} key={key}>{label(`families.${key}`)}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
            </div>
            <div className="baitly-stock-use-filters" role="group" aria-label={label('useFilter')}>
              {(['', 'welcome', 'upsell'] as const).map(key => <Button key={key} type="button" size="sm"
                variant={use === key ? 'default' : 'ghost'} aria-pressed={use === key} onClick={() => setUse(key)}>
                {label(`uses.${key || 'all'}`)}
              </Button>)}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground tabular-nums" role="status">{t('properties.stock.library.results', { count: results.length })}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => choose()}><Plus size={15} />{label('other')}</Button>
            </div>
            </div>
            {results.length ? <ul className="baitly-stock-catalog-results" aria-label={label('title')}>
              {results.map(entry => <li key={entry.key}><button type="button" className="baitly-stock-catalog-option"
                aria-label={stockCatalogName(entry, currentLanguage)} aria-describedby={`stock-family-${entry.key}`} onClick={() => choose(entry)}>
                <StockThumbnail name={stockCatalogName(entry, currentLanguage)} catalogKey={entry.key} size={60} />
                <span>{stockCatalogName(entry, currentLanguage)}<small id={`stock-family-${entry.key}`}>{label(`families.${entry.family}`)}</small></span><ChevronRight size={16} aria-hidden />
              </button></li>)}
            </ul> : <div className="grid gap-3 py-4">
              <p className="text-sm text-muted-foreground m-0">{label('noResults')}</p>
              <Button type="button" variant="outline" className="justify-self-start" onClick={() => { setSearch(''); setFamily(''); setUse(''); }}>{label('resetFilters')}</Button>
            </div>}
          </> : <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{selectedEntry ? label(`families.${selectedEntry.family}`) : label('customItem')}</span>
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setChoosing(true)}><ArrowLeft size={14} />{label('changeItem')}</Button>
            </div>
            <div className="baitly-stock-editor-photo">
              <StockThumbnail {...value} size={96} />
              <div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileInput.current?.click()}>
                    {uploading ? <Spinner className="size-4" /> : <ImagePlus size={15} />}{label(value.photoUrl ? 'replacePhoto' : 'addPhoto')}
                  </Button>
                  {value.photoUrl && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => field('photoUrl', null)}>{label('defaultPhoto')}</Button>}
                </div>
                <p>{label(value.photoUrl ? 'personalPhoto' : 'defaultIncluded')}</p>
                <p id="stock-photo-help">{label('photoHint')}</p>
                <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label={label('addPhoto')} aria-describedby="stock-photo-help"
                  onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file); }} />
              </div>
            </div>
            {photoError && <Alert variant="destructive"><AlertDescription>{photoError}</AlertDescription></Alert>}
            <fieldset disabled={busy} className="m-0 min-w-0 border-0 p-0 grid gap-5">
              <div className="baitly-stock-editor-fields">
                <Field><FieldLabel htmlFor="stock-name">{t('properties.stock.name')}</FieldLabel>
                  <Input id="stock-name" required maxLength={200} autoFocus={value.catalogKey === CUSTOM_STOCK_KEY} value={value.name} onChange={event => field('name', event.target.value)} placeholder={label('customNameHint')} />
                </Field>
                <Field><FieldLabel htmlFor="stock-category">{t('properties.stock.category')}</FieldLabel>
                  <NativeSelect id="stock-category" value={value.category} onChange={event => field('category', event.target.value as StockCategory)}>
                    {STOCK_CATEGORIES.map(key => <NativeSelectOption key={key} value={key}>{categoryName(key)}</NativeSelectOption>)}
                  </NativeSelect>
                </Field>
              </div>
              <section className="baitly-stock-editor-section" aria-labelledby="stock-level-title">
                <h3 id="stock-level-title">{label('levels')}</h3>
                <div className="baitly-stock-editor-fields">
                  {numberField('quantity', 'quantity')}
                  <Field><FieldLabel htmlFor="stock-unit">{t('properties.stock.unit')}</FieldLabel><Input id="stock-unit" maxLength={30} value={value.unit ?? ''} onChange={event => field('unit', event.target.value || null)} placeholder={t('properties.stock.unitHint')} /></Field>
                  {numberField('reorderThreshold', 'threshold')}{numberField('reorderQuantity', 'reorderQty')}
                  {numberField('consumptionPerStay', 'perStay')}
                </div>
              </section>
              <section className="baitly-stock-editor-section" aria-labelledby="stock-supplier-title">
                <h3 id="stock-supplier-title">{t('properties.stock.supplier')}</h3>
                <div className="baitly-stock-editor-fields">
                  <Field><FieldLabel htmlFor="stock-supplier-name">{t('properties.stock.supplierName')}</FieldLabel><Input id="stock-supplier-name" maxLength={200} value={value.supplierName ?? ''} onChange={event => field('supplierName', event.target.value || null)} /></Field>
                  <Field><FieldLabel htmlFor="stock-supplier-email">{t('properties.stock.supplierEmail')}</FieldLabel><Input id="stock-supplier-email" type="email" maxLength={320} value={value.supplierEmail ?? ''} onChange={event => field('supplierEmail', event.target.value || null)} /></Field>
                </div>
                <p className="text-xs text-muted-foreground m-0">{t('properties.stock.supplierHint')}</p>
              </section>
            </fieldset>
          </>}
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t('common.cancel')}</Button>
          {choosing && value.name && <Button type="button" variant="outline" onClick={() => setChoosing(false)}>{label('backToItem')}</Button>}
          {!choosing && <Button type="submit" disabled={busy || !value.name.trim()}>{saving && <Spinner className="size-4" />}{t('common.save')}</Button>}
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
