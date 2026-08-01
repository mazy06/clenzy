import React from 'react';
import { cn } from '../../../utils/cn';
import { Card, Skeleton } from '../../../components/ui';
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

// Le contour de la Card du kit est un `ring`, pas un `border` : le survol
// teinte donc le ring (et la transition porte sur box-shadow).
// `p: 2` / `p: 1.5` du CardContent MUI = 12 px / 9 px (theme.spacing vaut 6).
const HERO_CARD_CLASS =
  'h-full gap-0 py-0 p-3 transition-[box-shadow,transform] duration-200 hover:ring-[var(--mui-primary)] hover:-translate-y-[2px]';

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

// ─── Hero KPI Card ──────────────────────────────────────────────────────────

const HeroKpiCard: React.FC<{ item: KpiItem; loading: boolean }> = ({ item, loading }) => (
  <Card className={HERO_CARD_CLASS}>
      {loading ? (
        <div>
          <Skeleton className="h-[14px] w-1/2" />
          <Skeleton className="h-[28px] w-[70%] mt-[3px]" />
          <Skeleton className="h-[12px] w-2/5 mt-[3px]" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1 mb-1">
            {/* La regle '& .MuiSvgIcon-root' du sx d'origine ne matchait rien : les icones
                viennent de src/icons (lucide/iconify), pas de @mui/icons-material. Non reportee. */}
            <div
              className="flex items-center justify-center w-[32px] h-[32px] rounded-[8px]"
              style={{ backgroundColor: `${item.iconColor}12` }}
            >
              {item.icon}
            </div>
            <p className="cn-text-body1 text-[0.6875rem] font-semibold text-muted-foreground tracking-[0.02em] uppercase">
              {item.title}
            </p>
          </div>
          <p className="cn-text-body1 text-[1.5rem] font-extrabold leading-[1.1] tracking-[-0.02em] tabular-nums">
            {item.value}
          </p>
          {item.subtitle && (
            <p className="cn-text-body1 text-[0.5625rem] text-muted-foreground opacity-60 mt-0.5 leading-[1.2]">
              {item.subtitle}
            </p>
          )}
          {item.trend !== undefined && <TrendBadge value={item.trend} />}
        </>
      )}
  </Card>
);

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

  // Hero KPIs (4 most important)
  const heroKpis: KpiItem[] = [
    {
      key: 'revenue',
      title: t('dashboard.analytics.totalRevenue'),
      value: data ? <Money value={data.totalRevenue.value} from="EUR" /> : '-',
      trend: data?.totalRevenue.growth,
      icon: <TrendIcon />,
      iconColor: '#4A9B8E',
    },
    {
      key: 'occupancy',
      title: t('dashboard.analytics.occupancyRate'),
      value: data ? `${data.occupancyRate.value}%` : '-',
      trend: data?.occupancyRate.growth,
      icon: <Percent />,
      iconColor: '#4A9B8E',
      tooltip: t('dashboard.analytics.occupancyTooltip'),
    },
    {
      key: 'adr',
      title: 'ADR',
      value: data ? <Money value={data.adr.value} from="EUR" decimals={2} /> : '-',
      subtitle: t('dashboard.analytics.avgDailyRate'),
      trend: data?.adr.growth,
      icon: <Hotel />,
      iconColor: '#6B8A9A',
      tooltip: t('dashboard.analytics.adrTooltip'),
    },
    {
      key: 'revpan',
      title: 'RevPAN',
      value: data ? <Money value={data.revPAN.value} from="EUR" decimals={2} /> : '-',
      subtitle: t('dashboard.analytics.revenuePerNight'),
      trend: data?.revPAN.growth,
      icon: <Euro />,
      iconColor: '#7B68A8',
      tooltip: t('dashboard.analytics.revPANTooltip'),
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
      {/* ─── Hero KPIs ───────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-[9px] mb-[15px]">
        {heroKpis.map((kpi) => (
          <div className="col-span-6 min-[600px]:col-span-3" key={kpi.key}>
            <HeroKpiCard item={kpi} loading={loading} />
          </div>
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
