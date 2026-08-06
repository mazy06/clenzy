import React from 'react';
import StatusChip from '../../../components/StatusChip';
import { Card, CardContent, Skeleton } from '../../../components/ui';
import EmptyState from '../../../components/EmptyState';
import {
  PriceChange, CalendarMonth, Savings, Warning, Lightbulb,
} from '../../../icons';
import GridSection from './GridSection';
import { useTranslation } from '../../../hooks/useTranslation';
import { Money } from '../../../components/Money';
import type { Recommendation, RecommendationType, RecommendationPriority } from '../../../hooks/useAnalyticsEngine';

// ─── Constants ──────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<RecommendationType, React.ReactNode> = {
  pricing: <PriceChange />,
  calendar: <CalendarMonth />,
  cost: <Savings />,
  risk: <Warning />,
};

/** Pastille de priorité : aplat décoratif → teinte vive (§2.4). */
const PRIORITY_COLORS: Record<RecommendationPriority, string> = {
  high: 'var(--bui-destructive)',
  medium: 'var(--bui-warning)',
  low: 'var(--bui-muted-foreground)',
};

/** Icône du type : teinte vive, sur son fond pastel dérivé en `color-mix`. */
const TYPE_COLORS: Record<RecommendationType, string> = {
  pricing: 'var(--bui-info)',
  calendar: 'var(--bui-success)',
  cost: 'var(--bui-warning)',
  risk: 'var(--bui-destructive)',
};

// La carte du kit se cerne d'un `ring`, pas d'un `border` : le survol teinte
// donc l'anneau, sans quoi la reaction au survol serait invisible.
const CARD_CLASS =
  'w-full transition-[box-shadow] duration-150 ease-out motion-reduce:transition-none ' +
  'hover:ring-muted-foreground [--card-spacing:7.5px]';

interface Props {
  data: Recommendation[] | null;
  loading: boolean;
}

const AnalyticsRecommendations: React.FC<Props> = React.memo(({ data, loading }) => {
  const { t } = useTranslation();

  const recs = data || [];

  return (
    <GridSection
      title={t('dashboard.analytics.recommendations')}
      subtitle={t('dashboard.analytics.recommendationsDesc')}
      badge={recs.length}
    >
      <div className="grid grid-cols-12 gap-[9px]">
        {loading ? (
          // La forme est connue : squelette calqué sur la carte réelle
          // (pastille d'icône + titre, description sur deux lignes, bas de carte).
          Array.from({ length: 3 }).map((_, i) => (
            <div className="col-span-12" key={i}>
              <Card className={CARD_CLASS}>
                <CardContent>
                  <div className="flex items-start gap-1 mb-0.5">
                    <Skeleton className="min-w-[28px] h-[28px] rounded-md" />
                    <Skeleton className="h-[14px] flex-1 mt-[3px]" />
                  </div>
                  <Skeleton className="h-[10px] w-full mb-[3px]" />
                  <Skeleton className="h-[10px] w-3/4 mb-[4.5px]" />
                  <Skeleton className="h-[14px] w-1/3" />
                </CardContent>
              </Card>
            </div>
          ))
        ) : recs.length === 0 ? (
          <div className="col-span-12">
            <EmptyState
              icon={<Lightbulb />}
              title={t('dashboard.analytics.noRecommendations')}
            />
          </div>
        ) : (
          recs.map((rec) => (
            <div className="col-span-12" key={rec.id}>
              <Card className={CARD_CLASS}>
                <CardContent>
                  {/* Header: icon + title */}
                  <div className="flex items-start gap-1 mb-0.5">
                    {/* Le fond pastel se derive de la teinte du type a
                        l'execution : `color-mix` accepte une `var()`, contrairement
                        a l'ancienne concatenation d'alpha hexadecimal. */}
                    <div
                      className="flex items-center justify-center min-w-[28px] h-[28px] rounded-md [&_svg]:size-4"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${TYPE_COLORS[rec.type]} 12%, transparent)`,
                        color: TYPE_COLORS[rec.type],
                      }}
                    >
                      {TYPE_ICONS[rec.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* line-clamp-N porte deja overflow/display/-webkit-box-orient */}
                      <p className="text-xs font-bold text-foreground leading-[1.3] line-clamp-2">
                        {rec.title}
                      </p>
                    </div>
                  </div>

                  {/* Description — l'ecart de 4,5 px est hors echelle Tailwind. */}
                  <p className="text-2xs text-muted-foreground leading-[1.4] mb-[4.5px] line-clamp-3">
                    {rec.description}
                  </p>

                  {/* Bottom row: impact + confidence + priority */}
                  <div className="flex items-center gap-0.5 flex-wrap">
                    <p className="text-[0.6875rem] font-bold text-success-ink tabular-nums">
                      +<Money value={rec.estimatedImpact} from="EUR" decimals={0} />
                    </p>
                    <StatusChip size="sm" tone="neutral" label={`${rec.confidence}%`} className="text-[0.5625rem]" />
                    <div className="w-[6px] h-[6px] rounded-full ms-auto" style={{ backgroundColor: PRIORITY_COLORS[rec.priority] }} title={rec.priority} />
                  </div>
                </CardContent>
              </Card>
            </div>
          ))
        )}
      </div>
    </GridSection>
  );
});

AnalyticsRecommendations.displayName = 'AnalyticsRecommendations';

export default AnalyticsRecommendations;
