import React from 'react';
import { cn } from '../../../utils/cn';
import { Box, Card, CardContent, Skeleton } from '@mui/material';
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

// ─── Stable sx constants ────────────────────────────────────────────────────

const HERO_CARD_SX = {
  height: '100%',
  transition: 'border-color 0.2s ease, transform 0.2s ease',
  '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' },
} as const;

const SECONDARY_CARD_SX = {
  transition: 'border-color 0.15s ease',
  '&:hover': { borderColor: 'text.secondary' },
} as const;

const SECTION_LABEL_SX = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: 'text.disabled',
  mb: 1,
} as const;

/** Report en classes de `SECTION_LABEL_SX` (mb: 1 = 6 px, theme.spacing vaut 6). */
const SECTION_LABEL_CLASS =
  'cn-text-body1 text-[0.6875rem] font-bold uppercase tracking-[0.05em] text-[var(--faint)] mb-1.5';

// ─── Helpers ────────────────────────────────────────────────────────────────

const TrendBadge: React.FC<{ value: number }> = ({ value }) => {
  const isUp = value > 0;
  const isDown = value < 0;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Remove;
  const color = isUp ? 'success.main' : isDown ? 'error.main' : 'text.disabled';
  // Les jetons du `sx` ci-dessus, ecrits en classes : Tailwind ne peut pas les
  // fabriquer depuis la variable `color`.
  const colorClass = isUp ? 'text-[var(--ok)]' : isDown ? 'text-[var(--err)]' : 'text-[var(--faint)]';

  return (
    <div className="inline-flex items-center gap-0.5 mt-0.5">
      <Box component="span" sx={{ display: 'inline-flex', color }}>
        <Icon size={12} strokeWidth={1.75} />
      </Box>
      <p className={cn('cn-text-body1 text-[0.625rem] font-semibold tabular-nums', colorClass)}>
        {isUp ? '+' : ''}{value}%
      </p>
    </div>
  );
};

// ─── Hero KPI Card ──────────────────────────────────────────────────────────

const HeroKpiCard: React.FC<{ item: KpiItem; loading: boolean }> = ({ item, loading }) => (
  <Card sx={HERO_CARD_SX}>
    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
      {loading ? (
        <div>
          <Skeleton variant="text" width="50%" height={14} />
          <Skeleton variant="text" width="70%" height={28} sx={{ mt: 0.5 }} />
          <Skeleton variant="text" width="40%" height={12} sx={{ mt: 0.5 }} />
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
    </CardContent>
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
        <Skeleton variant="text" width={48} height={18} />
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
          <Card sx={SECONDARY_CARD_SX}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <p className={SECTION_LABEL_CLASS}>
                {t('dashboard.analytics.financialMetrics', 'Indicateurs financiers')}
              </p>
              {financialKpis.map((kpi, i) => (
                <React.Fragment key={kpi.key}>
                  {i > 0 && <div className="border-t border-[var(--line)]" />}
                  <SecondaryKpiRow item={kpi} loading={loading} />
                </React.Fragment>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Operational group */}
        <div className="col-span-12 min-[900px]:col-span-6">
          <Card sx={SECONDARY_CARD_SX}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <p className={SECTION_LABEL_CLASS}>
                {t('dashboard.analytics.operationalMetrics', 'Activite operationnelle')}
              </p>
              {operationalKpis.map((kpi, i) => (
                <React.Fragment key={kpi.key}>
                  {i > 0 && <div className="border-t border-[var(--line)]" />}
                  <SecondaryKpiRow item={kpi} loading={loading} />
                </React.Fragment>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
});

AnalyticsGlobalPerformance.displayName = 'AnalyticsGlobalPerformance';

export default AnalyticsGlobalPerformance;
