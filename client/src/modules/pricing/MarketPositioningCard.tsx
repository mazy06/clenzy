import React from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Badge } from '../../components/ui';
import { Card } from '../../components/ui';
import { Skeleton, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Remove as Minus, Info } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { marketPositioningApi, type MarketPositioning } from '../../services/api/marketPositioningApi';

/** Chiffres alignes en colonne (KPI, prix). */
const NUM_CLASS = 'tabular-nums';

const SOURCE_LABEL: Record<string, string> = {
  FIRST_PARTY: 'Réseau Baitly',
  OPEN_DATA: 'Open data',
  AIRBTICS: 'Airbtics',
  AIRROI: 'AirROI',
};

/**
 * Carte « double signal » (roadmap market data) : le RÉALISÉ du bien (prix publié
 * moyen, occupation à venir) face au MARCHÉ de sa zone, avec la provenance et la
 * confiance de la source — jamais un chiffre marché présenté comme sûr sans son
 * indice. Lecture seule ; alimente la décision tarifaire sans rien appliquer.
 */
const MarketPositioningCard: React.FC<{ propertyId: number }> = ({ propertyId }) => {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['market-positioning', propertyId],
    queryFn: () => marketPositioningApi.get(propertyId),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <Skeleton className="h-[92px] w-full rounded-[12px]" />;
  }
  if (isError || !data) {
    return null; // signal complémentaire : on ne bloque jamais l'écran de pricing
  }

  const money = (v: number | null) =>
    v == null ? '—' : `${Math.round(v).toLocaleString()} ${data.currency ?? ''}`.trim();
  const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v)} %`);

  const noMarket = data.positioning === 'NO_MARKET_DATA';
  // Encre AA (`-ink`) et non la teinte vive : la meme valeur sert de couleur de
  // TEXTE dans la puce et de base du fond `color-mix` — la teinte vive y serait
  // sous le seuil de contraste.
  const color = noMarket
    ? 'var(--color-muted-foreground)'
    : data.positioning === 'UNDERPRICED'
      ? 'var(--color-success-ink)'
      : data.positioning === 'OVERPRICED'
        ? 'var(--color-warning-ink)'
        : 'var(--color-primary)';
  const Icon = data.positioning === 'UNDERPRICED'
    ? TrendingUp
    : data.positioning === 'OVERPRICED'
      ? TrendingDown
      : Minus;
  const label = noMarket
    ? t('marketPositioning.noData', 'Pas de données marché')
    : data.positioning === 'UNDERPRICED'
      ? t('marketPositioning.underpriced', 'Sous le marché')
      : data.positioning === 'OVERPRICED'
        ? t('marketPositioning.overpriced', 'Au-dessus du marché')
        : t('marketPositioning.aligned', 'Aligné sur le marché');

  return (
    <Card className="gap-0 py-0 p-2.5">
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <h6 className="text-sm font-semibold tracking-tight text-balance">
          {t('marketPositioning.title', 'Positionnement marché')}
          {data.area ? ` — ${data.area}` : ''}
        </h6>
        {/* Teinte plus sourde que la recette `-soft` de la primitive (8 % au lieu
            de 12 %), cernee d'une hairline : la puce est un reperage de lecture,
            pas un statut. `border-solid` est requis, le gabarit posant
            `border-none`. */}
        <StatusChip
          tokens={{ color, bg: `color-mix(in srgb, ${color} 8%, transparent)` }}
          icon={<Icon size={14} />}
          label={label}
          className="border border-solid"
          sx={{ borderColor: `color-mix(in srgb, ${color} 22%, transparent)` }}
        />
        {!noMarket && data.source && (
          <Tooltip>
            {/* `span` intercalaire : le declencheur Radix pose une ref, que la
                primitive Badge (simple fonction) ne transmet pas. */}
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Badge variant="outline" className="text-muted-foreground border-border"><Info size={13} />{`${SOURCE_LABEL[data.source] ?? data.source} · ${
                    data.confidence != null ? `${Math.round(data.confidence * 100)} %` : '—'}`}</Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {t('marketPositioning.sourceHint',
                'Provenance et fiabilité de la donnée marché. Le « réseau Baitly » est votre réalisé, jamais présenté comme le marché entier.')}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Double signal : votre bien vs marché */}
      <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[1fr_1fr] gap-[9px]">
        <SignalBlock
          label={t('marketPositioning.yourProperty', 'Votre logement')}
          adr={money(data.propertyAdr)}
          occ={pct(data.propertyOccupancyPct)}
          adrLabel={t('marketPositioning.adr', 'ADR')}
          occLabel={t('marketPositioning.occupancy', 'Occupation')}
        />
        <SignalBlock
          label={t('marketPositioning.market', 'Marché de la zone')}
          adr={money(data.marketAdr)}
          occ={pct(data.marketOccupancyPct)}
          adrLabel={t('marketPositioning.adr', 'ADR')}
          occLabel={t('marketPositioning.occupancy', 'Occupation')}
          muted
        />
      </div>

      <span className="text-xs text-muted-foreground block mt-1.5">
        {data.headline}
      </span>
    </Card>
  );
};

const SignalBlock: React.FC<{
  label: string;
  adr: string;
  occ: string;
  adrLabel: string;
  occLabel: string;
  muted?: boolean;
}> = ({ label, adr, occ, adrLabel, occLabel, muted }) => (
  <div className={cn('p-[7.5px] rounded-md border border-solid border-border', muted ? 'bg-transparent' : 'bg-primary-soft')}>
    <span className="text-xs text-muted-foreground block mb-0.5">
      {label}
    </span>
    <div className="flex gap-3">
      <div>
        <span className="text-xs text-muted-foreground">{adrLabel}</span>
        <p className={cn(NUM_CLASS, 'text-sm font-semibold')}>{adr}</p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">{occLabel}</span>
        <p className={cn(NUM_CLASS, 'text-sm font-semibold')}>{occ}</p>
      </div>
    </div>
  </div>
);

export default MarketPositioningCard;
