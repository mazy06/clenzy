import { useMarketplacePresentation } from './useMarketplacePresentation';
import React from 'react';
import { Card } from '../../components/ui';
import StatusChip from '../../components/baitly/StatusChip';
import { cn } from '../../utils/cn';
import ProviderAvatar from './ProviderAvatar';
import {
  Verified,
  Business,
  LocationOn,
  Star,
  Timer,
  WarningAmber,
} from '../../icons';
import type {
  ProviderSummaryDto,
  ServiceCategoryDto,
} from '../../services/api/marketplaceProvidersApi';
import {
  categoryIcon,
  ENGAGEMENT_TONES,
  STATUS_TONES,
} from './providerPresentation';

interface MarketplaceProviderCardProps {
  provider: ProviderSummaryDto;
  /** Référentiel indexé par code, pour résoudre libellés et icônes des métiers. */
  categoriesByCode: Map<string, ServiceCategoryDto>;
  onOpen: (id: number) => void;
}

/**
 * Carte d'un professionnel dans le catalogue.
 *
 * Porte de quoi décider sans ouvrir la fiche : qui, quels métiers, où, à partir
 * de combien, dans quel état. Les métiers sont montrés en pastilles — les
 * énumérer prestation par prestation rendrait la grille illisible dès qu'un
 * professionnel en propose une dizaine.
 *
 * La carte entière est un bouton : en faire un lien ne suffirait pas au clavier
 * sur une zone qui contient elle-même des informations cliquables.
 */
export default function MarketplaceProviderCard({
  provider,
  categoriesByCode,
  onOpen,
}: MarketplaceProviderCardProps) {
  const { t, catalogLabel, availabilitySummary, formatMoney, STATUS_LABELS, ENGAGEMENT_LABELS } = useMarketplacePresentation();
  const visibleCategories = provider.categoryCodes.slice(0, 3);
  const overflowCount = provider.categoryCodes.length - visibleCategories.length;

  const location = [provider.baseCity, provider.basePostalCode].filter(Boolean).join(' ');
  const extraCities = provider.coverageCities.filter((city) => city !== provider.baseCity);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpen(provider.id)}
      onKeyDown={(event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(provider.id);
        }
      }}
      aria-label={t("marketplaceAdmin.openProfile", { name: provider.displayName })}
      className={cn(
        'group cursor-pointer gap-0 overflow-hidden py-0 text-start transition-colors duration-200',
        'hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
      )}
    >
      {/* ─── Identité ─────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 px-4 pt-4">
        <ProviderAvatar url={provider.avatarUrl} name={provider.displayName} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="m-0 truncate text-sm font-semibold text-foreground">
              {provider.displayName}
            </h3>
            {provider.verified && (
              <Verified
                className="size-4 shrink-0 text-success"
                aria-label={t('marketplaceAdmin.verifiedProvider')}
              />
            )}
          </div>
          {provider.headline ? (
            <p className="m-0 mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {provider.headline}
            </p>
          ) : provider.legalName ? (
            <p className="m-0 mt-0.5 truncate text-xs text-muted-foreground">
              {provider.legalName}
            </p>
          ) : null}
        </div>

        {/* La note est l'information la plus comparable d'une carte à l'autre :
            elle garde une place fixe en haut à droite pour se lire en balayant
            la colonne, sans la chercher dans le flux de chaque carte. */}
        {provider.ratingAvg != null ? (
          <div className="shrink-0 text-end">
            <span className="flex items-center gap-1 text-sm font-semibold tabular-nums text-foreground">
              <Star className="size-3.5 text-warning" />
              {provider.ratingAvg.toFixed(1)}
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {t("marketplaceAdmin.reviews", { count: provider.ratingCount })}
            </span>
          </div>
        ) : (
          <span className="shrink-0 text-[11px] text-muted-foreground">{t('marketplaceAdmin.unrated')}</span>
        )}
      </div>

      {/* ─── Métiers ──────────────────────────────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 px-4">
        {visibleCategories.map((code) => {
          const category = categoriesByCode.get(code);
          return (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground [&>svg]:size-3"
            >
              {categoryIcon(category?.iconKey)}
              {category ? catalogLabel(category) : code}
            </span>
          );
        })}
        {overflowCount > 0 && (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            +{overflowCount}
          </span>
        )}
        {provider.categoryCodes.length === 0 && (
          <span className="text-[11px] italic text-muted-foreground">{t('marketplaceAdmin.noServices')}</span>
        )}
      </div>

      {/* ─── Localisation et disponibilité ────────────────────────────── */}
      <div className="mt-3 flex flex-col gap-1 px-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <LocationOn className="size-3.5 shrink-0" />
          <span className="truncate">
            {location || t('marketplaceAdmin.unknownLocation')}
            {provider.travelRadiusKm ? ` · ${provider.travelRadiusKm} km` : ''}
            {extraCities.length > 0 ? ` · ${t("marketplaceAdmin.extraZones", { count: extraCities.length })}` : ''}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <Timer className="size-3.5 shrink-0" />
          <span className="truncate">{availabilitySummary(provider.availableDays, provider.weeklyRestricted)}</span>
        </span>
        {provider.homeOrganizationName && (
          <span className="flex items-center gap-1">
            <Business className="size-3.5 shrink-0" />
            <span className="truncate">{provider.homeOrganizationName}</span>
          </span>
        )}
      </div>

      {/* ─── Pied : état et prix ──────────────────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip
            size="sm"
            dot
            tone={STATUS_TONES[provider.status]}
            label={STATUS_LABELS[provider.status]}
          />
          <StatusChip
            size="sm"
            tone={ENGAGEMENT_TONES[provider.engagementMode]}
            label={ENGAGEMENT_LABELS[provider.engagementMode]}
          />
          {provider.complianceAlert && (
            <StatusChip
              size="sm"
              tone="err"
              icon={<WarningAmber />}
              label={t('marketplaceAdmin.renew')}
            />
          )}
        </div>

        {/* Un professionnel dont tout est sur devis n'affiche pas de prix :
            « à partir de 0 € » se lirait comme gratuit. */}
        {provider.priceFrom != null ? (
          <span className="text-xs text-muted-foreground">{t('marketplaceAdmin.from')}{' '}
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {formatMoney(provider.priceFrom, provider.currency)}
            </span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{t('marketplaceAdmin.onQuote')}</span>
        )}
      </div>
    </Card>
  );
}
