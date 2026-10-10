import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DirectoryCard, DirectoryCardContent, DirectoryTag, DIRECTORY_CARD_BODY } from '../../components/catalog/DirectoryCard';
import { Verified, Star } from '../../icons';
import ProviderMedia from './ProviderMedia';
import { categoryIcon } from './providerPresentation';
import { useMarketplacePresentation } from './useMarketplacePresentation';
import type { ServiceCategoryDto } from '../../services/api/marketplaceProvidersApi';

interface ProviderIdentity {
  displayName: string; avatarUrl?: string; headline?: string; verified: boolean;
  categoryCodes: string[]; ratingAvg?: number | null; ratingCount?: number;
  priceFrom?: number | null; currency?: string;
}

/** Carte commune ; les adaptateurs transmettent uniquement les données autorisées. */
export default function ProviderDirectoryCard({ provider, categoriesByCode, to, metadata, badges, actions }: {
  provider: ProviderIdentity; categoriesByCode: Map<string, ServiceCategoryDto>;
  to: string; metadata?: ReactNode; badges?: ReactNode; actions?: ReactNode;
}) {
  const { t, catalogLabel, formatMoney } = useMarketplacePresentation();
  return <DirectoryCard>
    <Link to={to} aria-label={t('marketplaceAdmin.openProfile', { name: provider.displayName })}
      className={`${DIRECTORY_CARD_BODY} baitly-provider-card cursor-pointer no-underline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary`}>
      <DirectoryCardContent
        media={<ProviderMedia name={provider.displayName} url={provider.avatarUrl} categoryCodes={provider.categoryCodes} />}
        title={<>
          <span dir="auto" className="truncate">{provider.displayName}</span>
          {provider.verified && <Verified className="size-4 shrink-0 text-success-ink" aria-label={t('marketplaceAdmin.verifiedProvider')} />}
        </>}
        description={provider.headline}
        trailing={provider.ratingAvg != null && (provider.ratingCount ?? 0) > 0
          ? <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums"><Star className="size-3.5 text-warning-ink" />
              {provider.ratingAvg.toFixed(1)} · {t('marketplaceAdmin.reviews', { count: provider.ratingCount })}</span>
          : <span className="text-xs text-muted-foreground">{t('marketplaceAdmin.unrated')}</span>}
        tags={<>
          {provider.categoryCodes.slice(0, 4).map(code => {
            const category = categoriesByCode.get(code);
            return <DirectoryTag key={code}>{categoryIcon(category?.iconKey)}{category ? catalogLabel(category) : code}</DirectoryTag>;
          })}
          {provider.categoryCodes.length > 4 && <span className="text-xs text-muted-foreground">+{provider.categoryCodes.length - 4}</span>}
          {!provider.categoryCodes.length && <span className="text-xs text-muted-foreground">{t('marketplaceAdmin.noServices')}</span>}
        </>}
        metadata={metadata} metadataPlacement="full" footerLeading={badges}
        footerTrailing={provider.priceFrom != null
          ? t('marketplaceAdmin.from') + ' ' + formatMoney(provider.priceFrom, provider.currency ?? 'EUR')
          : t('marketplaceAdmin.onQuote')}
      />
    </Link>
    {actions && <div className="flex justify-end border-t border-border px-3 py-2">{actions}</div>}
  </DirectoryCard>;
}
