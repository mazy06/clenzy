import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui';
import { Verified, Star } from '../../icons';
import ProviderAvatar from './ProviderAvatar';
import { categoryIcon } from './providerPresentation';
import { useMarketplacePresentation } from './useMarketplacePresentation';
import type { ServiceCategoryDto } from '../../services/api/marketplaceProvidersApi';

interface ProviderIdentity {
  displayName: string; avatarUrl?: string; headline?: string; verified: boolean;
  categoryCodes: string[]; ratingAvg?: number | null; ratingCount?: number;
  priceFrom?: number | null; currency?: string;
}

/** Carte commune ; les adaptateurs transmettent uniquement les données autorisées. */
export default function ProviderDirectoryCard({ provider, categoriesByCode, to, metadata, badges }: {
  provider: ProviderIdentity; categoriesByCode: Map<string, ServiceCategoryDto>;
  to: string; metadata?: ReactNode; badges?: ReactNode;
}) {
  const { t, catalogLabel, formatMoney } = useMarketplacePresentation();
  return <Card className="shrink-0 gap-0 overflow-hidden p-0 transition-colors duration-200 hover:border-primary/40 motion-reduce:transition-none">
    <Link to={to} aria-label={t('marketplaceAdmin.openProfile', { name: provider.displayName })}
      className="flex h-full min-w-0 flex-col cursor-pointer text-start text-foreground no-underline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary">
      <div className="flex flex-wrap items-start gap-3 px-4 pt-4">
        <ProviderAvatar name={provider.displayName} url={provider.avatarUrl} />
        <div className="min-w-0 flex-1">
          <h3 className="m-0 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <span className="truncate">{provider.displayName}</span>
            {provider.verified && <Verified className="size-4 shrink-0 text-success-ink" aria-label={t('marketplaceAdmin.verifiedProvider')} />}
          </h3>
          {provider.headline && <p className="m-0 mt-0.5 line-clamp-2 text-xs text-muted-foreground">{provider.headline}</p>}
        </div>
        {provider.ratingAvg != null && (provider.ratingCount ?? 0) > 0
          ? <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums"><Star className="size-3.5 text-warning-ink" />
              {provider.ratingAvg.toFixed(1)} · {t('marketplaceAdmin.reviews', { count: provider.ratingCount })}</span>
          : <span className="text-xs text-muted-foreground">{t('marketplaceAdmin.unrated')}</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 px-4">
        {provider.categoryCodes.slice(0, 4).map(code => {
          const category = categoriesByCode.get(code);
          return <span key={code} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground [&>svg]:size-3">
            {categoryIcon(category?.iconKey)}{category ? catalogLabel(category) : code}
          </span>;
        })}
        {provider.categoryCodes.length > 4 && <span className="text-xs text-muted-foreground">+{provider.categoryCodes.length - 4}</span>}
        {!provider.categoryCodes.length && <span className="text-xs text-muted-foreground">{t('marketplaceAdmin.noServices')}</span>}
      </div>
      <div className="mt-3 mb-3 flex flex-col gap-1 px-4 text-xs text-muted-foreground">{metadata}</div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">{badges}</div>
        <span className="text-sm font-semibold tabular-nums text-foreground">{provider.priceFrom != null
          ? t('marketplaceAdmin.from') + ' ' + formatMoney(provider.priceFrom, provider.currency ?? 'EUR')
          : t('marketplaceAdmin.onQuote')}</span>
      </div>
    </Link>
  </Card>;
}
