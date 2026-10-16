import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from '../../../components/ui';
import { Search, ChevronRight } from '../../../icons/glyphs';
import { useTranslation } from '../../../hooks/useTranslation';
import { providerCatalogApi } from '../../../services/api/providerCatalogApi';
import { validMapDay } from './baitlyMapContext';
import PagePagination from '../../../components/PagePagination';
import ProviderAvatar from '../../marketplace/ProviderAvatar';

/** Recherche sur le catalogue autorisé, avec vérification serveur de la couverture du logement. */
export default function PropertyProviderFinder({ propertyId, initialDate }: { propertyId: number; initialDate?: string }) {
  const { t, isEnglish } = useTranslation();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('all');
  const [day, setDay] = useState(initialDate ?? '');
  const [page, setPage] = useState(0);
  useEffect(() => { setDay(initialDate ?? ''); setPage(0); }, [initialDate]);
  const categories = useQuery({ queryKey: ['provider-catalog', 'categories'], queryFn: providerCatalogApi.getCategories, enabled: open, staleTime: 300_000 });
  const weekday = validMapDay(day) ? new Date(`${day}T12:00:00Z`).getUTCDay() || 7 : undefined;
  const query = useQuery({
    queryKey: ['provider-catalog', 'map-matches', propertyId, category, weekday, page],
    queryFn: () => providerCatalogApi.search({ propertyId, category: category === 'all' ? undefined : [category], availableOnDay: weekday, page, size: 5 }),
    enabled: open && (!day || validMapDay(day)), staleTime: 30_000,
  });
  return <section className="border-t border-border pt-3">
    <Button variant="outline" size="sm" className="w-full" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <Search className="size-4" />{t('mapPilot.findProvider', 'Trouver un intervenant')}
    </Button>
    {open && <div className="mt-3 space-y-3">
      <Select value={category} onValueChange={value => { setCategory(value); setPage(0); }}>
        <SelectTrigger className="w-full" aria-label={t('mapPilot.trade', 'Métier')}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('mapPilot.allTrades', 'Tous les métiers')}</SelectItem>
          {(categories.data ?? []).map(item => <SelectItem key={item.code} value={item.code}>{isEnglish ? item.labelEn : item.labelFr}</SelectItem>)}
        </SelectContent>
      </Select>
      {categories.isError && <p role="alert" className="text-xs text-[var(--bui-destructive-ink)]">
        {t('mapPilot.tradesError', 'Les métiers n’ont pas pu être chargés.')}
        <Button size="sm" variant="ghost" onClick={() => void categories.refetch()}>{t('common.retry', 'Réessayer')}</Button>
      </p>}
      <label className="block space-y-1 text-xs text-muted-foreground">
        <span>{t('mapPilot.declaredAvailability', 'Disponibilité déclarée pour le jour')}</span>
        <Input type="date" value={day} onChange={event => { setDay(event.target.value); setPage(0); }} />
      </label>
      <p className="text-xs text-muted-foreground">{t('mapPilot.availabilityHelp', 'Le filtre utilise les disponibilités hebdomadaires déclarées. Le créneau exact reste à confirmer avec le prestataire.')}</p>
      {query.isLoading && <Skeleton className="h-20" />}
      {query.isError && <p role="alert" className="text-xs text-[var(--bui-destructive-ink)]">
        {t('mapPilot.providersError', 'La recherche n’a pas abouti.')}
        <Button size="sm" variant="ghost" onClick={() => void query.refetch()}>{t('common.retry', 'Réessayer')}</Button>
      </p>}
      {query.data && <>
        <p role="status" className="text-xs tabular-nums text-muted-foreground">{t('mapPilot.providerCount', { count: query.data.totalElements, defaultValue: '{{count}} prestataire(s) couvrant ce logement' })}</p>
        <ul className="m-0 list-none divide-y divide-border p-0">
          {query.data.items.map(provider => <li key={provider.id}>
            <Link to={`/prestataires/${provider.id}?propertyId=${propertyId}`}
              className="flex cursor-pointer items-center gap-3 rounded-md py-2 text-sm text-foreground no-underline hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
              <ProviderAvatar url={provider.avatarUrl} name={provider.displayName} className="size-10 rounded-full" />
              <span className="min-w-0 flex-1"><span className="block font-medium">{provider.displayName}</span>
                {provider.headline && <span className="block text-xs text-muted-foreground">{provider.headline}</span>}
                <span className="block text-xs text-muted-foreground">{t('mapPilot.viewAndRequest', 'Voir les prestations et demander un devis')}</span>
              </span><ChevronRight className="size-4 shrink-0 cn-rtl-flip" />
            </Link>
          </li>)}
        </ul>
        <PagePagination compact hideTotal page={page} onPageChange={setPage} totalPages={query.data.totalPages} />
      </>}
    </div>}
  </section>;
}
