import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, Button, Card, Field, FieldLabel, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Textarea } from '../../components/ui';
import { serviceReferenceQuery, type ServiceReferenceItem } from '../../components/ServiceItemSelect';
import { propertiesApi } from '../../services/api/propertiesApi';
import { reservationsApi } from '../../services/api/reservationsApi';
import { serviceRequestComposerApi, type RequestDraft, type RequestSelection } from '../../services/api/serviceRequestComposerApi';
import { useTranslation } from '../../hooks/useTranslation';

import { invalidateMissionWorkflow } from '../../hooks/invalidateMissionWorkflow';
import { serviceRequestsListKeys } from '../../hooks/useServiceRequestsList';
import { getErrorMessage } from '../../utils/getErrorMessage';
import ServiceRequestCatalogPicker from './ServiceRequestCatalogPicker';
import './serviceRequestComposer.css';
import { PropertyThumb } from '../notifications/NotificationPropertyPanel';

export interface ComposerProps {
  onClose: () => void;
  onSuccess: () => void;
  setLoading: (loading: boolean) => void;
  submitRef: React.MutableRefObject<(() => void) | null>;
}

export default function ServiceRequestComposer({ onClose, onSuccess, setLoading, submitRef }: ComposerProps) {
  const { t, isEnglish, currentLanguage } = useTranslation();
  const queryClient = useQueryClient();
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [desiredDate, setDesiredDate] = useState('');
  const [priority, setPriority] = useState<RequestDraft['priority']>('NORMAL');
  const [instructions, setInstructions] = useState('');
  const [selections, setSelections] = useState<RequestSelection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const submissionId = useRef(crypto.randomUUID());
  const formRef = useRef<HTMLFormElement>(null);
  const properties = useQuery({ queryKey: ['request-composer-properties'], queryFn: () => propertiesApi.getAll({ size: 1000 }) });
  const catalog = useQuery(serviceReferenceQuery);
  const propertyDetails = useQuery({
    queryKey: ['request-composer-property', propertyId],
    queryFn: () => propertiesApi.getById(propertyId!),
    enabled: propertyId !== null,
  });
  const property = propertyDetails.data ?? properties.data?.find(p => p.id === propertyId);
  const selectedItems = selections.map(s => catalog.data?.find(i => i.code === s.serviceItemCode));
  const requiresProperty = !selections.length || selectedItems.some(i => i?.propertyRequired !== false);
  const canEstimate = selections.length > 0 && (!requiresProperty || !!propertyId);
  const reservations = useQuery({
    queryKey: ['request-composer-reservations', propertyId],
    queryFn: () => reservationsApi.getByProperty(propertyId!),
    enabled: !!propertyId,
  });
  // Notes and duration edits do not refetch the price guide. Its inputs are catalogue,
  // property and date; only the backend computes prices and reference durations.
  const estimateDraft = useMemo<RequestDraft>(() => ({
    propertyId, desiredDate: desiredDate || null, priority: 'NORMAL', instructions: '',
    selections: selections.map(s => ({ serviceItemCode: s.serviceItemCode, instructions: '' })),
  }), [propertyId, desiredDate, selections.map(s => s.serviceItemCode).join('|')]);
  const estimate = useQuery({
    queryKey: ['request-composer-estimate', estimateDraft],
    queryFn: () => serviceRequestComposerApi.estimate(estimateDraft),
    enabled: canEstimate,
    retry: false,
  });
  const label = (item: ServiceReferenceItem | undefined, code: string) => item ? (isEnglish ? item.labelEn : item.labelFr) : code;
  const amounts = canEstimate && !estimate.isError && !estimate.isFetching ? estimate.data ?? [] : [];
  const guides = amounts.filter(e => e.source === 'PLATFORM_GUIDE' && e.min != null && e.max != null);
  const quoteCount = selections.length - guides.length;
  const money = (value: number, currency = 'EUR') => new Intl.NumberFormat(currentLanguage, { style: 'currency', currency }).format(value);
  const today = new Date().toLocaleDateString('en-CA');
  const checkouts = (reservations.data ?? [])
    .filter(r => r.status.toLowerCase() !== 'cancelled' && r.checkOut.slice(0, 10) >= today)
    .sort((a, b) => a.checkOut.localeCompare(b.checkOut));
  const plannedHours = (selection: RequestSelection) => selection.durationHours ??
    Math.max(1, Math.ceil((amounts.find(e => e.serviceItemCode === selection.serviceItemCode)?.durationMinutes ?? 60) / 60));

  function toggle(item: ServiceReferenceItem) {
    setSelections(previous => previous.some(s => s.serviceItemCode === item.code)
      ? previous.filter(s => s.serviceItemCode !== item.code)
      : [...previous, { serviceItemCode: item.code, instructions: '' }]);
    setError(null);
  }
  function update(code: string, patch: Partial<RequestSelection>) {
    setSelections(previous => previous.map(s => s.serviceItemCode === code ? { ...s, ...patch } : s));
  }
  async function submit() {
    if (saving.current) return;
    if (!selections.length) { setError(t('requestComposer.selectAtLeastOne')); return; }
    if (requiresProperty && !propertyId) { setError(t('requestComposer.propertyRequired')); return; }
    if (!formRef.current?.reportValidity()) return;
    saving.current = true; setBusy(true); setLoading(true); setError(null);
    try {
      await serviceRequestComposerApi.create({
        submissionId: submissionId.current, propertyId, desiredDate, priority, instructions,
        selections,
      });
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: serviceRequestsListKeys.all }),
        invalidateMissionWorkflow(queryClient),
      ]);
      onSuccess();
    } catch (failure) {
      setError(getErrorMessage(failure, t('requestComposer.createError')));
    } finally {
      saving.current = false; setBusy(false); setLoading(false);
    }
  }
  useEffect(() => { submitRef.current = () => { void submit(); }; return () => { submitRef.current = null; }; });

  return <form ref={formRef} onSubmit={e => { e.preventDefault(); void submit(); }} className="request-composer w-full min-w-0 p-2" aria-label={t('requestComposer.form')}>
    {error && <Alert variant="destructive" className="mb-5"><AlertDescription>{error}</AlertDescription></Alert>}
    <fieldset disabled={busy} className="composer-columns m-0 grid min-w-0 border-0 p-0 gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card className="composer-services min-w-0 gap-0 p-3 rounded-lg shadow-none">
        <section className="flex items-center gap-3 shrink-0">
          {property && <PropertyThumb key={property.id} property={property} name={property.name} className="h-20 w-24" />}
          {properties.isPending ? <Skeleton className="h-10" /> : properties.isError
            ? <Alert variant="destructive"><AlertDescription>{t('requestComposer.propertiesError')} <Button type="button" variant="outline" onClick={() => properties.refetch()}>{t('common.retry')}</Button></AlertDescription></Alert>
            : <Field className="min-w-0 flex-1 gap-1">
              <FieldLabel htmlFor="composer-property">{t('requestComposer.property')}{requiresProperty ? ' *' : ''}</FieldLabel>
              <Select value={propertyId ? String(propertyId) : 'none'} onValueChange={v => { setPropertyId(v === 'none' ? null : Number(v)); setDesiredDate(''); }}>
                <SelectTrigger id="composer-property" className="w-full min-h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('requestComposer.chooseProperty')}</SelectItem>
                  {(properties.data ?? []).map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name} · {p.city}</SelectItem>)}
                </SelectContent>
              </Select>
              {!requiresProperty && <p className="text-xs text-muted-foreground">{t('requestComposer.optionalProperty')}</p>}
              {property && <div className="min-w-0 text-xs text-muted-foreground">
                <p className="truncate" title={[property.address, property.city].filter(Boolean).join(', ')}>{[property.address, property.postalCode, property.city].filter(Boolean).join(', ')}</p>
                <p className="flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
                  {property.squareMeters > 0 && <span>{property.squareMeters} m²</span>}
                  {property.bedroomCount != null && <span>{t('requestComposer.bedrooms', { count: property.bedroomCount })}</span>}
                  {property.bathroomCount != null && <span>{t('requestComposer.bathrooms', { count: property.bathroomCount })}</span>}
                  {property.maxGuests > 0 && <span>{t('requestComposer.guests', { count: property.maxGuests })}</span>}
                </p>
              </div>}
              {!properties.isError && properties.data?.length === 0 && <p className="text-sm text-muted-foreground">{t('requestComposer.noProperties')}</p>}
            </Field>}
        </section>
        <section className="composer-catalog min-w-0 mt-3 border-t border-border pt-3">
          <h3 className="text-base font-semibold mb-2">{t('requestComposer.services')}</h3>
          <ServiceRequestCatalogPicker selected={selections.map(s => s.serviceItemCode)} onToggle={toggle} disabled={busy} />
        </section>
        {selections.length > 0 && <section aria-label={t('requestComposer.selectedServices')} className="composer-selection mt-3 space-y-2 border-t border-border pt-2">
          <h3 className="text-base font-semibold">{t('requestComposer.selectedServices')} <span className="text-muted-foreground font-normal tabular-nums">({selections.length})</span></h3>
          <div className="divide-y divide-border">
            {selections.map((selection, index) => {
              const item = selectedItems[index];
              const guidance = amounts.find(e => e.serviceItemCode === selection.serviceItemCode);
              return <div key={selection.serviceItemCode} className="py-2">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h4 className="text-sm font-medium">{label(item, selection.serviceItemCode)}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{t('requestComposer.independentRequest')}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="shrink-0 cursor-pointer"
                    aria-label={t('requestComposer.remove', { name: label(item, selection.serviceItemCode) })}
                    onClick={() => setSelections(s => s.filter(entry => entry.serviceItemCode !== selection.serviceItemCode))}><Trash2 className="size-4" /></Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                  <Field><FieldLabel htmlFor={'notes-' + selection.serviceItemCode}>{t('requestComposer.serviceNotes')}</FieldLabel>
                    <Input id={'notes-' + selection.serviceItemCode} value={selection.instructions} maxLength={2000}
                      onChange={e => update(selection.serviceItemCode, { instructions: e.target.value })}
                      placeholder={t('requestComposer.notesExample')} /></Field>
                  <Field><FieldLabel htmlFor={'duration-' + selection.serviceItemCode}>{t('requestComposer.duration')}</FieldLabel>
                    <Input id={'duration-' + selection.serviceItemCode} type="number" min={1} max={168} step={1} required className="tabular-nums"
                      value={plannedHours(selection)} onChange={e => update(selection.serviceItemCode, { durationHours: e.target.valueAsNumber || 1 })} />
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {guidance?.durationMinutes ? t('requestComposer.engineDuration', { minutes: guidance.durationMinutes }) : t('requestComposer.durationHelp')}
                </p>
              </div>;
            })}
          </div>
        </section>}
      </Card>
      <aside className="composer-sidebar min-w-0">
        <Card className="composer-planning gap-0 p-3 rounded-lg shadow-none">
          <h3 className="text-base font-semibold mb-2 flex items-center gap-2"><CalendarDays className="size-4" aria-hidden />{t('requestComposer.schedule')}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Field><FieldLabel htmlFor="composer-date">{t('requestComposer.date')} *</FieldLabel>
              <Input id="composer-date" type="datetime-local" required value={desiredDate} onChange={e => setDesiredDate(e.target.value)} className="w-full min-w-0 tabular-nums" />
            </Field>
            <Field><FieldLabel htmlFor="composer-priority">{t('serviceRequests.fields.priority')}</FieldLabel>
              <Select value={priority} onValueChange={v => setPriority(v as RequestDraft['priority'])}>
                <SelectTrigger id="composer-priority" className="w-full min-h-10"><SelectValue /></SelectTrigger>
                <SelectContent>{(['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const).map(p => <SelectItem key={p} value={p}>{t('serviceRequests.priorities.' + p.toLowerCase())}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          {!!propertyId && <div className="mt-3">
            {reservations.isPending ? <Skeleton className="h-8" /> : reservations.isError
              ? <p className="text-xs text-muted-foreground">{t('requestComposer.reservationsError')}</p>
              : checkouts.length > 0 && <details className="text-sm">
                <summary className="cursor-pointer py-2 text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary">{t('requestComposer.useCheckout')}</summary>
                <div className="max-h-44 overflow-y-auto divide-y divide-border">
                  {checkouts.map(r => {
                    const date = r.checkOut.slice(0, 10) + 'T' + (r.checkOutTime || property?.defaultCheckOutTime || '11:00').slice(0, 5);
                    return <Button key={r.id} type="button" variant="ghost" className="w-full justify-start cursor-pointer tabular-nums" aria-pressed={desiredDate === date}
                      onClick={() => setDesiredDate(date)}>{new Date(date).toLocaleDateString(currentLanguage)} · {date.slice(11)} · {r.guestName}</Button>;
                  })}
                </div>
              </details>}
          </div>}

          <Field className="mt-2"><FieldLabel htmlFor="composer-instructions">{t('requestComposer.sharedNotes')}</FieldLabel>
            <Textarea id="composer-instructions" value={instructions} maxLength={2000} rows={2} className="min-h-14 resize-none"
              onChange={e => setInstructions(e.target.value)} placeholder={t('requestComposer.sharedNotesExample')} />
          </Field>
          <h3 className="mt-3 border-t border-border pt-3 text-base font-semibold">{t('requestComposer.estimate')}</h3>

          <div className="composer-budget my-2" aria-live="polite">
            {!selections.length ? <p className="text-sm text-muted-foreground">{t('requestComposer.emptyEstimate')}</p>
              : !canEstimate ? <p className="text-sm text-muted-foreground">{t('requestComposer.propertyRequired')}</p>
              : estimate.isFetching ? <div className="space-y-3"><Skeleton className="h-5" /><Skeleton className="h-5" /></div>
              : estimate.isError ? <Alert variant="destructive"><AlertDescription>{t('requestComposer.estimateError')} <Button type="button" variant="outline" onClick={() => estimate.refetch()}>{t('common.retry')}</Button></AlertDescription></Alert>
              : <div className="divide-y divide-border">
                {selections.map((s, index) => {
                  const e = amounts.find(row => row.serviceItemCode === s.serviceItemCode);
                  return <div key={s.serviceItemCode} className="py-2 first:pt-0">
                    <p className="text-sm">{label(selectedItems[index], s.serviceItemCode)}</p>
                    <p className="text-sm font-medium tabular-nums mt-1">{e?.min != null && e.max != null && e.currency
                      ? money(e.min, e.currency) + ' – ' + money(e.max, e.currency) : t('requestComposer.onQuote')}</p>

                  </div>;
                })}
                {guides.length > 0 && <div className="pt-4">
                  <p className="text-xs text-muted-foreground">{t(quoteCount ? 'requestComposer.partialTotal' : 'requestComposer.indicativeTotal')}</p>
                  <p className="text-lg font-semibold tabular-nums mt-1">{money(guides.reduce((n, e) => n + e.min!, 0))} – {money(guides.reduce((n, e) => n + e.max!, 0))}</p>
                  {quoteCount > 0 && <p className="text-xs text-muted-foreground mt-1">{t('requestComposer.excludedQuotes', { count: quoteCount })}</p>}
                </div>}
              </div>}
          </div>
          <div className="composer-actions border-t border-border pt-2 space-y-2">
            {selections.length > 0 && <p className="text-xs text-muted-foreground">{t('requestComposer.budgetDisclaimer')}</p>}
            <Button type="submit" className="w-full min-h-11 cursor-pointer" disabled={busy || !selections.length || (requiresProperty && !propertyId) || catalog.isError}>
              <Plus className="size-4" aria-hidden />{busy ? t('serviceRequests.creating') : t(selections.length ? 'requestComposer.create' : 'requestComposer.selectAtLeastOne', { count: selections.length })}
            </Button>
            <Button type="button" variant="ghost" className="w-full cursor-pointer" onClick={onClose}>{t('common.cancel')}</Button>

          </div>
        </Card>
      </aside>
    </fieldset>
  </form>;
}
