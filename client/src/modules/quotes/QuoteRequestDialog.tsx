import { useState, type FormEvent } from 'react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Textarea } from '../../components/ui';
import { useCreateQuoteRequest } from '../../hooks/useQuoteRequests';
import { useMarketplaceProperties } from '../../hooks/useMarketplaceProperties';
import { useTranslation } from '../../hooks/useTranslation';
import type { CatalogProviderDto } from '../../services/api/providerCatalogApi';
import type { QuoteReplacementContext } from '../../hooks/useQuoteReplacement';

const fieldClass = 'h-9 min-w-0 rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-primary';

export default function QuoteRequestDialog({ provider, open, onOpenChange, initialPropertyId = '', replacement }: {
  provider: CatalogProviderDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPropertyId?: string;
  replacement?: QuoteReplacementContext;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(replacement?.title ?? '');
  const [message, setMessage] = useState('');
  const [propertyId, setPropertyId] = useState(replacement ? String(replacement.propertyId ?? '') : initialPropertyId);
  const [desiredDate, setDesiredDate] = useState(replacement?.desiredDate ?? '');
  const [offerId, setOfferId] = useState(() => replacement ? String(provider.offers.find(offer =>
    (replacement.serviceItemCode ? offer.serviceItemCode === replacement.serviceItemCode : offer.categoryCode === replacement.categoryCode))?.id ?? '') : '');
  const { data: properties = [], isLoading, isError } = useMarketplaceProperties(open);
  const selectedOffer = provider.offers.find((offer) => String(offer.id) === offerId);
  const createRequest = useCreateQuoteRequest(replacement?.quoteId);
  const validProperty = !propertyId || properties.some((property) => String(property.id) === propertyId);
  const canSubmit = title.trim().length > 0 && !createRequest.isPending && validProperty && !replacement?.activeRequestId
    && (!replacement?.requiresServiceSelection || !!selectedOffer?.serviceItemCode);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    createRequest.mutate({
      providerId: provider.id, title: title.trim(), message: message.trim() || undefined,
      propertyId: propertyId ? Number(propertyId) : null,
      categoryCode: selectedOffer?.categoryCode, serviceItemCode: selectedOffer?.serviceItemCode,
      desiredDate: desiredDate || null,
    }, { onSuccess: () => {
      onOpenChange(false);
      if (!replacement) { setTitle(''); setMessage(''); setPropertyId(initialPropertyId); setDesiredDate(''); setOfferId(''); }
    } });
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!createRequest.isPending) onOpenChange(value); }}>
      <DialogContent className="sm:max-w-[520px]">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t('marketplaceWorkflow.requestTitle', { name: provider.displayName })}</DialogTitle>
            <DialogDescription>{t('marketplaceWorkflow.requestHelp')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            {replacement && <p role="status" className="m-0 text-sm text-muted-foreground">{t('quoteReplacement.help', { id: replacement.quoteId })}</p>}
            {replacement?.startTime && <p className="m-0 text-sm tabular-nums">{t('quoteReplacement.slot', { time: replacement.startTime.slice(0, 5), minutes: replacement.durationMinutes ?? '—' })}</p>}
            <label className="flex flex-col gap-1.5 text-sm">
              {t('marketplaceWorkflow.subject')}
              <input value={title} disabled={!!replacement} onChange={(event) => setTitle(event.target.value)} maxLength={150} required className={fieldClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              {t('marketplaceWorkflow.service')}
              <select aria-label={t('marketplaceWorkflow.service')} value={offerId} disabled={!!replacement && !replacement.requiresServiceSelection} onChange={(event) => setOfferId(event.target.value)} className={fieldClass + ' cursor-pointer'}>
                <option value="">{t('marketplaceWorkflow.generalRequest')}</option>
                {provider.offers.filter((offer) => offer.active).map((offer) => <option key={offer.id} value={offer.id}>{offer.label}</option>)}
              </select>
              {replacement?.requiresServiceSelection && <span className="text-xs text-muted-foreground">{t('quoteReplacement.chooseService')}</span>}
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              {t('marketplaceWorkflow.details')}
              <Textarea value={message} disabled={!!replacement} onChange={(event) => setMessage(event.target.value)} maxLength={4000} rows={4} />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1.5 text-sm">
                {t('marketplaceWorkflow.property')}
                <select aria-label={t('marketplaceWorkflow.property')} value={propertyId} onChange={(event) => setPropertyId(event.target.value)} disabled={isLoading || !!replacement}
                  className={fieldClass + ' cursor-pointer'}>
                  <option value="">{t('marketplaceWorkflow.noProperty')}</option>
                  {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
                </select>
                <span className="text-xs text-muted-foreground">{t('marketplaceWorkflow.noPropertyHelp')}</span>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                {t('marketplaceWorkflow.date')}
                <input type="date" value={desiredDate} onChange={(event) => setDesiredDate(event.target.value)} className={fieldClass} />
              </label>
            </div>
            {(isError || !validProperty) && <p role="alert" className="text-xs text-destructive-ink">{t('marketplaceWorkflow.propertiesFailed')}</p>}
            {createRequest.isError && <p role="alert" className="text-sm text-destructive-ink">
              {(createRequest.error as Error)?.message || t('marketplaceWorkflow.sendFailed')}
            </p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={createRequest.isPending} onClick={() => onOpenChange(false)}>{t('marketplaceWorkflow.cancel')}</Button>
            <Button type="submit" disabled={!canSubmit}>{t(createRequest.isPending ? 'marketplaceWorkflow.sending' : 'marketplaceWorkflow.send')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
