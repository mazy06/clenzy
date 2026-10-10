import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button, Input, NativeSelect, Skeleton } from '../../components/ui';
import PagePagination from '../../components/PagePagination';
import ServiceItemSelect from '../../components/ServiceItemSelect';
import BaitlyPropertySelect from '../../components/BaitlyPropertySelect';
import ProviderMedia from '../marketplace/ProviderMedia';
import QuoteRequestDialog from '../quotes/QuoteRequestDialog';
import { useMarketplaceProperties } from '../../hooks/useMarketplaceProperties';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../contexts/AuthContext';
import { upsellFulfillmentApi } from '../../services/api/upsellFulfillmentApi';
import type { UpsellOffer } from '../../services/api/upsellApi';
import type { CatalogProviderDto } from '../../services/api/providerCatalogApi';
import { formatOfferPrice } from '../marketplace/providerPresentation';
import './upsellFulfillment.css';

/** Le choix reste une préférence. La demande puis l'accord passent par le parcours de devis. */
export default function UpsellFulfillmentPanel({ offer }: { offer: UpsellOffer }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = ['upsell-fulfillment', user?.id, user?.organizationId, offer.id];
  const config = useQuery({ queryKey: key, queryFn: () => upsellFulfillmentApi.get(offer.id) });
  const propertyQuery = useMarketplaceProperties(true);
  const properties = propertyQuery.data ?? [];
  const [property, setProperty] = useState(offer.propertyId ? String(offer.propertyId) : '');
  const [start, setStart] = useState('');
  const [duration, setDuration] = useState('60');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [language, setLanguage] = useState('');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(0);
  const [request, setRequest] = useState<CatalogProviderDto | null>(null);
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [serviceChoices, setServiceChoices] = useState<Record<number, string>>({});
  const filters = { propertyId: property ? Number(property) : undefined, start: start || undefined,
    durationMinutes: Number(duration), availableOnly: !!start && availableOnly, verifiedOnly,
    urgent, language: language || undefined, sort, page };
  const candidates = useQuery({ queryKey: [...key, 'providers', config.data?.serviceItemCode, filters],
    queryFn: () => upsellFulfillmentApi.providers(offer.id, filters), enabled: !!config.data?.serviceItemCode });
  const related = useQuery({ queryKey: [...key, 'providers', config.data?.serviceItemCode, filters, 'related'],
    queryFn: () => upsellFulfillmentApi.providers(offer.id, { ...filters, related: true }),
    enabled: !!config.data?.serviceItemCode && candidates.isSuccess && candidates.data.page.totalElements === 0 });
  const save = useMutation({
    mutationFn: ({ code, providerId }: { code: string | null; providerId: number | null }) =>
      upsellFulfillmentApi.configure(offer.id, code, providerId, filters.propertyId),
    onSuccess: value => { qc.setQueryData(key, value); void qc.invalidateQueries({ queryKey: [...key, 'providers'] }); },
  });
  const reset = () => setPage(0);
  const configure = (code: string | null, providerId: number | null = null) => save.mutate({ code, providerId });
  if (config.isPending) return <Skeleton className="mb-4 h-48 w-full" />;
  if (config.isError) return <section className="baitly-fulfillment"><p role="alert">{t('upsellFulfillment.loadError')}</p>
    <Button variant="outline" onClick={() => void config.refetch()}>{t('upsellFulfillment.retry')}</Button></section>;
  const selected = config.data.preferredProvider;
  const usingRelated = candidates.isSuccess && candidates.data.page.totalElements === 0;
  const results = usingRelated ? related : candidates;
  return <section className="baitly-fulfillment" aria-label={t('upsellFulfillment.title')}>
    <div className="baitly-fulfillment__heading">
      <div><h3>{t('upsellFulfillment.title')}</h3><p>{t('upsellFulfillment.help')}</p></div>
      <span className="baitly-fulfillment__mode">{t('upsellFulfillment.manual')}</span>
    </div>
    <div className="baitly-fulfillment__filters">
      <ServiceItemSelect value={config.data.serviceItemCode ?? undefined} disabled={save.isPending}
        onChange={item => { reset(); configure(item.code); }}
        labelAction={config.data.overrideCode && <button type="button" className="baitly-fulfillment__reset" disabled={save.isPending}
          title={t('upsellFulfillment.useType')} onClick={() => { reset(); configure(null); }}>
          {t('upsellFulfillment.resetService', 'Réinitialiser')}
        </button>} />
      {config.data.serviceItemCode && <>
        <BaitlyPropertySelect properties={properties} value={property} label={t('upsellFulfillment.property')}
          allPlaces={t('upsellFulfillment.allPlaces')} empty={t('upsellFulfillment.noProperty')}
          loading={propertyQuery.isPending} disabled={offer.propertyId != null || propertyQuery.isError}
          onChange={value => { setProperty(value); setStart(''); reset(); }} />
        <div className="baitly-fulfillment__schedule">
          <label title={t('upsellFulfillment.slot')}>{t('upsellFulfillment.slotShort', 'Créneau')}<Input type="datetime-local" aria-label={t('upsellFulfillment.slot')} value={start} disabled={!property}
            onChange={e => { setStart(e.target.value); reset(); }} /></label>
          <label>{t('upsellFulfillment.durationShort', 'Durée')}<NativeSelect aria-label={t('upsellFulfillment.duration')} value={duration} onChange={e => { setDuration(e.target.value); reset(); }}>
            {[30,60,90,120,180,240,480].map(m => <option key={m} value={m}>{m} min</option>)}
          </NativeSelect></label>
        </div>
      </>}
    </div>
    {save.isError && <p role="alert" className="text-sm text-destructive-ink">{t('upsellFulfillment.saveError')}</p>}
    {!config.data.serviceItemCode ? <p className="text-sm text-muted-foreground">{t('upsellFulfillment.connectHelp')}</p> : <>
      {selected && <div className="baitly-fulfillment__preferred" role="status">
        <div><b>{t('upsellFulfillment.preferred', { name: selected.displayName })}</b><p>{t('upsellFulfillment.preferenceHelp')}</p></div>
        <Button size="sm" variant="ghost" disabled={save.isPending} onClick={() => configure(config.data.overrideCode)}>{t('upsellFulfillment.removePreference')}</Button>
      </div>}
      {config.data.preferredProviderId && !selected && <p role="status" className="text-sm text-warning-ink">{t('upsellFulfillment.hiddenPreferred')}</p>}
      {propertyQuery.isError && <div role="alert" className="text-sm text-destructive-ink"><p>{t('upsellFulfillment.propertiesError')}</p>
        <Button variant="ghost" size="sm" onClick={() => void propertyQuery.refetch()}>{t('upsellFulfillment.retry')}</Button></div>}
      <details className="baitly-fulfillment__advanced" open={criteriaOpen} onToggle={e => setCriteriaOpen(e.currentTarget.open)}>
      <summary>{t('upsellFulfillment.moreCriteria', 'Plus de critères')}{(verifiedOnly || urgent || language || availableOnly) && <span>{t('upsellFulfillment.filtersApplied', 'Filtres actifs')}</span>}</summary>
      <div className="baitly-fulfillment__secondary">
        <label>{t('upsellFulfillment.language')}<NativeSelect value={language} onChange={e => { setLanguage(e.target.value); reset(); }}>
          <option value="">{t('upsellFulfillment.anyLanguage')}</option>
          <option value="fr">Français</option><option value="en">English</option><option value="ar">العربية</option><option value="es">Español</option>
        </NativeSelect></label>
        <label>{t('upsellFulfillment.sort')}<NativeSelect value={sort} onChange={e => { setSort(e.target.value); reset(); }}>
          <option value="name">{t('upsellFulfillment.byName')}</option><option value="rating">{t('upsellFulfillment.byRating')}</option>
          <option value="missions">{t('upsellFulfillment.byMissions')}</option>
        </NativeSelect></label>
      </div>
      <div className="baitly-fulfillment__checks">
        <label><input type="checkbox" disabled={!start} checked={!!start && availableOnly} onChange={e => { setAvailableOnly(e.target.checked); reset(); }} />{t('upsellFulfillment.availableOnly')}</label>
        <label><input type="checkbox" checked={verifiedOnly} onChange={e => { setVerifiedOnly(e.target.checked); reset(); }} />{t('upsellFulfillment.verifiedOnly')}</label>
        <label><input type="checkbox" checked={urgent} onChange={e => { setUrgent(e.target.checked); reset(); }} />{t('upsellFulfillment.urgent')}</label>
      </div>
      </details>
      <p className="baitly-fulfillment__hint">{t(start ? 'upsellFulfillment.calendarHelp' : 'upsellFulfillment.chooseSlot')}</p>
      {results.isPending ? <div className="baitly-fulfillment__results">{[1,2,3].map(i => <Skeleton key={i} className="h-52 w-full" />)}</div>
        : results.isError ? <div role="alert"><p>{t('upsellFulfillment.searchError')}</p><Button variant="outline" onClick={() => void results.refetch()}>{t('upsellFulfillment.retry')}</Button></div>
        : results.data?.page.items.length ? <>
          <p className="text-xs tabular-nums text-muted-foreground" role="status">{t('upsellFulfillment.results', { count: results.data.page.totalElements })}</p>
          <div className="baitly-fulfillment__results" role="region" aria-label={t('upsellFulfillment.title')}>
            {results.data.page.items.map(provider => {
              const matching = provider.offers.filter(o => o.serviceItemCode && (usingRelated
                ? (results.data.serviceCodes ?? []).includes(o.serviceItemCode)
                : o.serviceItemCode === config.data.serviceItemCode));
              const chosenOffer = matching.find(o => o.serviceItemCode === serviceChoices[provider.id]) ?? matching[0];
              const preferred = config.data.preferredProviderId === provider.id;
              const availability = results.data.availability[provider.id];
              return <article className="baitly-fulfillment__candidate" key={provider.id} data-selected={preferred}>
                <ProviderMedia name={provider.displayName} url={provider.avatarUrl} categoryCodes={provider.categoryCodes} />
                <div className="baitly-fulfillment__identity"><h4>{provider.displayName}</h4><p>{provider.coverageCities.join(' · ') || provider.baseCity}</p>
                  <span className="text-xs" data-availability={availability}>{t(`upsellFulfillment.${availability ?? 'NO_SLOT'}`)}</span>
                </div>
                <div className="baitly-fulfillment__offer">
                  {usingRelated && <span className="text-xs text-muted-foreground">{t('upsellFulfillment.alternative', 'Autre prestation proposée')}</span>}
                  {matching.length > 1 ? <label className="text-xs">{t('upsellFulfillment.offeredService', 'Prestation à choisir')}
                    <NativeSelect aria-label={t('upsellFulfillment.offeredService', 'Prestation à choisir')} value={chosenOffer?.serviceItemCode}
                      onChange={e => setServiceChoices(values => ({...values,[provider.id]:e.target.value}))}>
                      {matching.map(o => <option key={o.id} value={o.serviceItemCode}>{o.label}</option>)}
                    </NativeSelect></label> : chosenOffer && <p>{chosenOffer.label}</p>}
                  {chosenOffer && <strong className="text-sm tabular-nums">{formatOfferPrice(chosenOffer.amount,chosenOffer.currency,chosenOffer.pricingModel,chosenOffer.unitLabel)}</strong>}
                  {usingRelated && chosenOffer && <p className="text-xs text-muted-foreground">{t('upsellFulfillment.replacesService', 'Ce choix remplacera la prestation liée au service.')}</p>}
                  {!chosenOffer && <p className="text-xs text-muted-foreground">{t('upsellFulfillment.offersUnavailable', 'Les prestations de ce profil ne sont pas disponibles. Consultez sa fiche ou actualisez les résultats.')}</p>}
                </div>
                <div className="baitly-fulfillment__candidate-actions">
                  <Link className="text-xs underline cursor-pointer focus-visible:outline-2" to={`/prestataires/${provider.id}${property ? `?propertyId=${property}` : ''}`}>{t('upsellFulfillment.profile')}</Link>
                  <Button size="sm" className="baitly-fulfillment__choose" variant={preferred ? 'outline' : 'default'}
                    disabled={save.isPending || preferred || !chosenOffer || availability==='UNAVAILABLE'}
                    onClick={() => { if (chosenOffer?.serviceItemCode) configure(usingRelated ? chosenOffer.serviceItemCode : config.data.overrideCode,provider.id); }}>
                    {t(preferred ? 'upsellFulfillment.selected' : 'upsellFulfillment.select')}
                  </Button>
                  {!usingRelated && !provider.own && <Button size="sm" variant="ghost" className="baitly-fulfillment__request"
                    disabled={!chosenOffer || availability==='UNAVAILABLE'} onClick={() => setRequest(provider)}>{t('upsellFulfillment.prepareRequest')}</Button>}
                </div>
              </article>;
            })}
          </div>
          <PagePagination page={page} onPageChange={setPage} count={results.data.page.totalElements} rowsPerPage={12} />
        </> : <p className="text-sm text-muted-foreground">{t('upsellFulfillment.noMatch')}</p>}
    </>}
    {request && <QuoteRequestDialog key={`${request.id}:${property}:${start}`} provider={request} open onOpenChange={open => !open && setRequest(null)}
      initialPropertyId={property} initialTitle={offer.title} initialServiceItemCode={config.data.serviceItemCode ?? undefined}
      initialDate={start.slice(0,10)} initialStartTime={start.slice(11,16)} initialDurationMinutes={Number(duration)} />}
  </section>;
}
