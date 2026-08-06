import React from 'react';
import { Card, Progress, Skeleton } from '../../../components/ui';
import { useQuery } from '@tanstack/react-query';
import EmptyState from '../../../components/EmptyState';
import GridSection from './GridSection';
import { HomeWork } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { Money } from '../../../components/Money';
import { propertiesApi } from '../../../services/api/propertiesApi';
import { periodToDays } from '../../../hooks/analyticsUtils';
import type { DashboardPeriod } from '../DashboardDateFilter';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Teinte de la jauge de score : aplat décoratif → teinte vive (§2.4). */
function getScoreColor(score: number): string {
  if (score >= 80) return 'var(--bui-success)';
  if (score >= 50) return 'var(--bui-warning)';
  return 'var(--bui-destructive)';
}

/** Encre du score : c'est du TEXTE, donc la variante `-ink` (§2.4). */
function getScoreInk(score: number): string {
  if (score >= 80) return 'var(--bui-success-ink)';
  if (score >= 50) return 'var(--bui-warning-ink)';
  return 'var(--bui-destructive-ink)';
}

/**
 * Gabarit de carte : pleine largeur, liseré qui se révèle au survol.
 * Le liseré de la carte du kit est un `ring`, pas un `border` — d'où
 * `hover:ring-*`.
 */
const CARD_CLASS =
  'gap-0 py-0 p-[7.5px] w-full transition-[box-shadow] duration-150 ease-out ' +
  'motion-reduce:transition-none hover:ring-muted-foreground';

const LABEL_CLASS = 'text-[0.5625rem] text-muted-foreground leading-[1.2]';

const VALUE_CLASS = 'text-[0.6875rem] font-bold text-foreground tabular-nums text-end';

interface Props {
  /** Fenêtre d'analyse dérivée de la période sélectionnée (défaut « mois »). */
  period?: DashboardPeriod;
}

const AnalyticsPropertyPerformance: React.FC<Props> = React.memo(({ period = 'month' }) => {
  const { t } = useTranslation();

  // Source de vérité serveur (occupation plafonnée, marge avec coûts réels) —
  // remplace le calcul front (interventions=[] → marge 100 %, occupation > 100 %).
  const days = periodToDays(period);
  const { data, isLoading: loading } = useQuery({
    queryKey: ['property-performance-summaries', days],
    queryFn: () => propertiesApi.getPerformanceSummaries(days),
    staleTime: 60_000,
  });

  const items = data || [];

  return (
    <GridSection
      title={t('dashboard.analytics.propertyPerformance')}
      subtitle={t('dashboard.analytics.propertyPerformanceDesc')}
    >
      <div className="grid grid-cols-12 gap-[9px]">
        {loading ? (
          // La forme est connue : squelette calqué sur la carte réelle
          // (rang + nom, jauge de score, quatre lignes de métriques).
          Array.from({ length: 3 }).map((_, i) => (
            <div className="col-span-12 @[600px]:col-span-6 @[900px]:col-span-4" key={i}>
              <Card className={CARD_CLASS}>
                <div className="flex items-center gap-1 mb-1">
                  <Skeleton className="min-w-[22px] h-[22px] rounded-full" />
                  <Skeleton className="h-[14px] flex-1" />
                </div>
                <Skeleton className="h-1 w-full rounded-[8px] mb-1" />
                <div className="flex flex-col gap-0.5">
                  {Array.from({ length: 4 }).map((__, j) => (
                    <Skeleton className="h-[11px] w-full" key={j} />
                  ))}
                </div>
              </Card>
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="col-span-12">
            <EmptyState
              icon={<HomeWork />}
              title={t('dashboard.analytics.noProperties')}
            />
          </div>
        ) : (
          items.map((prop, index) => (
            <div className="col-span-12 @[600px]:col-span-6 @[900px]:col-span-4" key={prop.propertyId}>
              <Card className={CARD_CLASS}>
                {/* Rank + Name */}
                  <div className="flex items-center gap-1 mb-1">
                    {/* Teintes du podium calculees a l'execution → style inline.
                        Le fond est un pastel (`color-mix`), l'encre la variante
                        `-ink` : sur le podium comme hors podium, du texte. */}
                    <div
                      className="flex items-center justify-center min-w-[22px] h-[22px] rounded-full text-[0.625rem] font-bold tabular-nums"
                      style={{
                        backgroundColor: index < 3
                          ? `color-mix(in srgb, ${getScoreColor(prop.score)} 12%, transparent)`
                          : 'var(--bui-muted)',
                        color: index < 3 ? getScoreInk(prop.score) : 'var(--bui-faint)',
                      }}
                    >
                      #{index + 1}
                    </div>
                    <p className="text-xs font-bold text-foreground truncate flex-1">
                      {prop.name}
                    </p>
                  </div>

                  {/* Score bar */}
                  <div className="mb-1">
                    <div className="flex justify-between mb-0.5">
                      <p className="text-[0.5625rem] text-faint">Score</p>
                      <p className="text-2xs font-bold tabular-nums" style={{ color: getScoreInk(prop.score) }}>
                        {prop.score}/100
                      </p>
                    </div>
                    {/* La teinte de la barre depend du score : variable CSS posee
                        inline, relue par la classe du remplissage. */}
                    <Progress
                      value={prop.score}
                      style={{ '--bar': getScoreColor(prop.score) } as React.CSSProperties}
                      className="h-1 rounded-[8px] bg-muted [&_[data-slot=progress-indicator]]:bg-[var(--bar)] [&_[data-slot=progress-indicator]]:rounded-[8px]"
                    />
                  </div>

                  {/* Metrics grid */}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between">
                      <p className={LABEL_CLASS}>RevPAN</p>
                      <p className={VALUE_CLASS}><Money value={prop.revPan} from="EUR" decimals={2} /></p>
                    </div>
                    <div className="flex justify-between">
                      <p className={LABEL_CLASS}>{t('dashboard.analytics.occupancyRate')}</p>
                      <p className={VALUE_CLASS}>{Math.round(prop.occupancyRate)}%</p>
                    </div>
                    <div className="flex justify-between">
                      <p className={LABEL_CLASS}>{t('dashboard.analytics.totalRevenue')}</p>
                      <p className={VALUE_CLASS}><Money value={prop.revenue} from="EUR" decimals={0} /></p>
                    </div>
                    <div className="flex justify-between">
                      <p className={LABEL_CLASS}>{t('dashboard.analytics.netMargin')}</p>
                      {/* Couleur decidee a l'execution selon la marge : elle ne peut pas naitre
                          d'une classe Tailwind, d'ou le style inline (qui prime sur la classe).
                          Encre `-ink` : c'est du texte (§2.4). */}
                      <p
                        className={VALUE_CLASS}
                        style={{ color: prop.netMargin >= 60 ? 'var(--bui-success-ink)' : prop.netMargin >= 40 ? 'var(--bui-warning-ink)' : 'var(--bui-destructive-ink)' }}
                      >
                        {Math.round(prop.netMargin)}%
                      </p>
                    </div>
                  </div>
              </Card>
            </div>
          ))
        )}
      </div>
    </GridSection>
  );
});

AnalyticsPropertyPerformance.displayName = 'AnalyticsPropertyPerformance';

export default AnalyticsPropertyPerformance;
