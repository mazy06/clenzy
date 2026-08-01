import React from 'react';
import { cn } from '../../../utils/cn';
import { Card, Skeleton } from '../../../components/ui';
import StatTile from '../../../components/baitly/StatTile';
import {
  Euro, Hotel, TrendingUp as TrendIcon, Percent,
  CalendarMonth, ShowChart, AccountBalance, Home,
  Assignment, Build,
  TrendingUp, TrendingDown, Remove,
} from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { Money } from '../../../components/Money';
import type { GlobalKPIs } from '../../../hooks/useAnalyticsEngine';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Props {
  data: GlobalKPIs | null;
  loading: boolean;
}

interface KpiItem {
  key: string;
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  trend?: number;
  icon: React.ReactNode;
  iconColor: string;
  tooltip?: string;
}

// ─── Stable class constants ─────────────────────────────────────────────────

const SECONDARY_CARD_CLASS =
  'gap-0 py-0 p-[9px] transition-[box-shadow] duration-150 hover:ring-[var(--muted)]';

/** mb: 1 = 6 px, theme.spacing vaut 6. */
const SECTION_LABEL_CLASS =
  'cn-text-body1 text-[0.6875rem] font-bold uppercase tracking-[0.05em] text-[var(--faint)] mb-1.5';

// ─── Helpers ────────────────────────────────────────────────────────────────

const TrendBadge: React.FC<{ value: number }> = ({ value }) => {
  const isUp = value > 0;
  const isDown = value < 0;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Remove;
  // Jetons semantiques en classes litterales : Tailwind ne peut pas fabriquer
  // une classe depuis une variable.
  const colorClass = isUp ? 'text-[var(--ok)]' : isDown ? 'text-[var(--err)]' : 'text-[var(--faint)]';

  return (
    <div className="inline-flex items-center gap-0.5 mt-0.5">
      <span className={cn('inline-flex', colorClass)}>
        <Icon size={12} strokeWidth={1.75} />
      </span>
      <p className={cn('cn-text-body1 text-[0.625rem] font-semibold tabular-nums', colorClass)}>
        {isUp ? '+' : ''}{value}%
      </p>
    </div>
  );
};

// ─── Hero — tuiles de la projection ─────────────────────────────────────────

/**
 * Variation vs periode precedente, en gras dans l'indice de la tuile — le
 * dessin de la projection (meme forme que le TrendHint du Dashboard).
 */
const TrendHint: React.FC<{ growth: number; suffix?: string }> = ({ growth, suffix }) => {
  const { t } = useTranslation();
  return (
    <>
      <b>
        {growth > 0 ? '+' : ''}
        {growth} %
      </b>{' '}
      {t('dashboard.analytics.vsPreviousPeriod', 'vs période préc.')}
      {suffix ? ` · ${suffix}` : ''}
    </>
  );
};

// ─── Secondary KPI row item ─────────────────────────────────────────────────

const SecondaryKpiRow: React.FC<{ item: KpiItem; loading: boolean }> = ({ item, loading }) => (
  <div className="flex items-center gap-2 py-1.5 px-0.5">
    <div
      className="flex items-center justify-center w-[28px] h-[28px] rounded-[6px] shrink-0"
      style={{ backgroundColor: `${item.iconColor}10` }}
    >
      {item.icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground font-medium leading-[1.2]">
        {item.title}
      </p>
    </div>
    <div className="text-end shrink-0">
      {loading ? (
        <Skeleton className="h-[18px] w-12" />
      ) : (
        <>
          <p className="cn-text-body1 text-[0.875rem] font-bold leading-[1.2] tabular-nums">
            {item.value}
          </p>
          {item.trend !== undefined && <TrendBadge value={item.trend} />}
        </>
      )}
    </div>
  </div>
);

// ─── Component ──────────────────────────────────────────────────────────────

const AnalyticsGlobalPerformance: React.FC<Props> = React.memo(({ data, loading }) => {
  const { t } = useTranslation();

  // Hero — les tuiles de la projection. La teinte ne porte que sur l'icone,
  // la ou elle dit quelque chose (l'argent en succes) ; les sous-titres
  // migrent en suffixe de l'indice, rien n'est perdu (le `tooltip` des
  // anciennes cartes n'etait rendu nulle part).
  const heroKpis = [
    {
      key: 'revenue',
      label: t('dashboard.analytics.totalRevenue'),
      value: data ? <Money value={data.totalRevenue.value} from="EUR" /> : '-',
      hint: data ? <TrendHint growth={data.totalRevenue.growth} /> : undefined,
      icon: <TrendIcon />,
      iconClassName: 'text-success',
    },
    {
      key: 'occupancy',
      label: t('dashboard.analytics.occupancyRate'),
      value: data ? `${data.occupancyRate.value}%` : '-',
      hint: data ? <TrendHint growth={data.occupancyRate.growth} /> : undefined,
      icon: <Percent />,
      iconClassName: undefined,
    },
    {
      key: 'adr',
      label: 'ADR',
      value: data ? <Money value={data.adr.value} from="EUR" decimals={2} /> : '-',
      hint: data
        ? <TrendHint growth={data.adr.growth} suffix={t('dashboard.analytics.avgDailyRate')} />
        : t('dashboard.analytics.avgDailyRate'),
      icon: <Hotel />,
      iconClassName: undefined,
    },
    {
      key: 'revpan',
      label: 'RevPAN',
      value: data ? <Money value={data.revPAN.value} from="EUR" decimals={2} /> : '-',
      hint: data
        ? <TrendHint growth={data.revPAN.growth} suffix={t('dashboard.analytics.revenuePerNight')} />
        : t('dashboard.analytics.revenuePerNight'),
      icon: <Euro />,
      iconClassName: undefined,
    },
  ];

  // Financial secondary KPIs
  const financialKpis: KpiItem[] = [
    {
      key: 'margin',
      title: t('dashboard.analytics.netMargin'),
      value: data ? `${data.netMargin.value}%` : '-',
      trend: data?.netMargin.growth,
      icon: <AccountBalance />,
      iconColor: data && data.netMargin.value < 50 ? '#C97A7A' : '#4A9B8E',
    },
    {
      key: 'roi',
      title: 'ROI',
      value: data ? `${data.roi.value}%` : '-',
      trend: data?.roi.growth,
      icon: <ShowChart />,
      iconColor: '#6B8A9A',
    },
    {
      key: 'avgStay',
      title: t('dashboard.analytics.avgStay'),
      value: data ? `${data.avgStayDuration.value} ${t('dashboard.analytics.nights')}` : '-',
      trend: data?.avgStayDuration.growth,
      icon: <CalendarMonth />,
      iconColor: '#6B8A9A',
    },
  ];

  // Operational secondary KPIs
  const operationalKpis: KpiItem[] = [
    {
      key: 'properties',
      title: t('dashboard.analytics.activeProperties'),
      value: data ? `${data.activeProperties}` : '-',
      icon: <Home />,
      iconColor: '#6B8A9A',
    },
    {
      key: 'requests',
      title: t('dashboard.analytics.pendingRequests'),
      value: data ? `${data.pendingRequests}` : '-',
      icon: <Assignment />,
      iconColor: '#D4A574',
    },
    {
      key: 'interventions',
      title: t('dashboard.analytics.activeInterventions'),
      value: data ? `${data.activeInterventions}` : '-',
      icon: <Build />,
      iconColor: '#6B8A9A',
    },
  ];

  return (
    <div className="mb-4">
      {/* ─── Hero — les tuiles de la projection ──────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-[15px] lg:grid-cols-4">
        {heroKpis.map((kpi) => (
          <StatTile
            key={kpi.key}
            icon={kpi.icon}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.hint}
            iconClassName={kpi.iconClassName}
            loading={loading}
          />
        ))}
      </div>

      {/* ─── Secondary KPIs (2 grouped cards) ────────────────────── */}
      <div className="grid grid-cols-12 gap-[9px]">
        {/* Financial group */}
        <div className="col-span-12 min-[900px]:col-span-6">
          <Card className={SECONDARY_CARD_CLASS}>
            <p className={SECTION_LABEL_CLASS}>
              {t('dashboard.analytics.financialMetrics', 'Indicateurs financiers')}
            </p>
            {financialKpis.map((kpi, i) => (
              <React.Fragment key={kpi.key}>
                {i > 0 && <div className="border-t border-solid border-[var(--line)]" />}
                <SecondaryKpiRow item={kpi} loading={loading} />
              </React.Fragment>
            ))}
          </Card>
        </div>

        {/* Operational group */}
        <div className="col-span-12 min-[900px]:col-span-6">
          <Card className={SECONDARY_CARD_CLASS}>
            <p className={SECTION_LABEL_CLASS}>
              {t('dashboard.analytics.operationalMetrics', 'Activite operationnelle')}
            </p>
            {operationalKpis.map((kpi, i) => (
              <React.Fragment key={kpi.key}>
                {i > 0 && <div className="border-t border-solid border-[var(--line)]" />}
                <SecondaryKpiRow item={kpi} loading={loading} />
              </React.Fragment>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
});

AnalyticsGlobalPerformance.displayName = 'AnalyticsGlobalPerformance';

export default AnalyticsGlobalPerformance;
