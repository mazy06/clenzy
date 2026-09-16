import { Link, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui';
import StatusChip from '../../components/baitly/StatusChip';
import { LocationOn, Verified } from '../../icons';
import { cn } from '../../utils/cn';
import ProviderAvatar from '../marketplace/ProviderAvatar';
import { categoryIcon, formatMoney } from '../marketplace/providerPresentation';
import type { CatalogProviderDto } from '../../services/api/providerCatalogApi';
import type { ServiceCategoryDto } from '../../services/api/marketplaceProvidersApi';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Un prestataire, vu par une organisation.
 *
 * <p>Volontairement plus pauvre que la carte de la console : pas d'état de
 * modération, pas de coordonnées, pas d'alerte de conformité. Ce sont des
 * données d'instruction — elles restent à la plateforme.</p>
 */
export default function ProviderCatalogCard({ provider, categoryLabels, propertyId }: {
  propertyId?: string;
  provider: CatalogProviderDto;
  categoryLabels: Map<string, ServiceCategoryDto>;
}) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const contextParams = new URLSearchParams();
  if (propertyId) contextParams.set('propertyId', propertyId);
  if (searchParams.get('replaceQuoteId')) contextParams.set('replaceQuoteId', searchParams.get('replaceQuoteId')!);
  const cities = provider.coverageCities.length > 0
    ? provider.coverageCities
    : [];

  return (
    <Card
      className={cn(
        'flex shrink-0 flex-col gap-0 px-0 py-0 transition-colors duration-200',
        'hover:border-primary/40',
        provider.own && 'border-primary/50',
      )}
    >
      <Link
        to={`/prestataires/${provider.id}?${contextParams.toString()}`}
        className="flex cursor-pointer flex-col gap-3 px-4 py-3.5 no-underline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <div className="flex items-start gap-3">
          <ProviderAvatar name={provider.displayName} url={provider.avatarUrl} />
          <div className="min-w-0 flex-1">
            <p className="m-0 flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
              {provider.displayName}
              {provider.verified && (
                <Verified className="size-3.5 shrink-0 text-primary" aria-label="Vérifié par Baitly" />
              )}
            </p>
            {provider.headline && (
              <p className="m-0 mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {provider.headline}
              </p>
            )}
          </div>
          {provider.own && <StatusChip size="sm" tone="accent" label="Votre fiche" />}
        </div>

        {cities.length > 0 && (
          <p className="m-0 flex items-center gap-1 text-xs text-muted-foreground [&>svg]:size-3.5">
            <LocationOn />
            <span className="truncate">
              {cities.slice(0, 3).join(' · ')}
              {cities.length > 3 && ` +${cities.length - 3}`}

            </span>
          </p>
        )}

        {provider.ratingAvg != null && (provider.ratingCount ?? 0) > 0 && <p className="m-0 text-xs tabular-nums text-foreground">
          {provider.ratingAvg.toFixed(1)} / 5 · {provider.ratingCount} {t('quoteReview.reviews', 'avis après mission')}
        </p>}

        {provider.categoryCodes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {provider.categoryCodes.slice(0, 4).map((code) => {
              const category = categoryLabels.get(code);
              return (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground [&>svg]:size-3 [&>svg]:text-primary"
                >
                  {categoryIcon(category?.iconKey)}
                  {category?.labelFr ?? code}
                </span>
              );
            })}
            {provider.categoryCodes.length > 4 && (
              <span className="text-xs text-muted-foreground">
                +{provider.categoryCodes.length - 4}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-border pt-2.5">
          <span className="text-xs text-muted-foreground">
            {provider.offers.length > 0
              ? `${provider.offers.length} prestation${provider.offers.length > 1 ? 's' : ''}`
              : 'Prestations à préciser'}
          </span>
          {/* Un prix absent ne se remplace pas par « 0 € » : tout est peut-être
              sur devis, ce qui est une information, pas un manque. */}
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {provider.priceFrom != null
              ? `dès ${formatMoney(provider.priceFrom, provider.currency ?? 'EUR')}`
              : 'Sur devis'}
          </span>
        </div>
      </Link>
    </Card>
  );
}
