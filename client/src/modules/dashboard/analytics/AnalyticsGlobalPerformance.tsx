import React from 'react';
import { cn } from '../../../utils/cn';
import {
  Card,
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
  Skeleton,
} from '../../../components/ui';
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
  /**
   * Classes de la pastille d'icone — couple `-soft` (fond) / teinte vive
   * (icone), ecrites en toutes lettres : Tailwind ne fabrique pas une classe
   * depuis une valeur calculee a l'execution.
   */
  iconClassName: string;
  tooltip?: string;
}

// ─── Stable class constants ─────────────────────────────────────────────────

const SECONDARY_CARD_CLASS =
  'gap-0 py-0 p-[9px] transition-[box-shadow] duration-150 hover:ring-border';

/** Intitule de section — recette d'overline Baitly UI (§3 du contrat). */
const SECTION_LABEL_CLASS =
  'text-2xs font-semibold uppercase tracking-wide text-faint mb-1.5';

// ─── Helpers ────────────────────────────────────────────────────────────────

const TrendBadge: React.FC<{ value: number }> = ({ value }) => {
  const isUp = value > 0;
  const isDown = value < 0;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Remove;
  // Encre `-ink` : la variation est du TEXTE, et la teinte vive n'y passe pas
  // AA en clair (§2.4). La fleche partage l'encre pour rester solidaire du
  // chiffre qu'elle qualifie.
  const colorClass = isUp ? 'text-success-ink' : isDown ? 'text-destructive-ink' : 'text-faint';

  return (
    <div className="inline-flex items-center gap-0.5 mt-0.5">
      <span className={cn('inline-flex', colorClass)}>
        <Icon size={12} strokeWidth={1.75} />
      </span>
      <p className={cn('text-2xs font-semibold tabular-nums', colorClass)}>
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
  <Item size="xs" className="px-0.5 py-1.5">
    <ItemMedia variant="icon" className={cn('size-7 rounded-md', item.iconClassName)}>
      {item.icon}
    </ItemMedia>
    <ItemContent>
      <ItemTitle className="text-[0.6875rem] font-medium leading-[1.2] text-muted-foreground">
        {item.title}
      </ItemTitle>
    </ItemContent>
    <ItemActions className="flex-col items-end gap-0">
      {loading ? (
        <Skeleton className="h-[18px] w-12" />
      ) : (
        <>
          <p className="text-sm font-bold leading-[1.2] tabular-nums text-foreground">
            {item.value}
          </p>
          {item.trend !== undefined && <TrendBadge value={item.trend} />}
        </>
      )}
    </ItemActions>
  </Item>
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
      iconClassName: data && data.netMargin.value < 50
        ? 'bg-destructive-soft text-destructive'
        : 'bg-success-soft text-success',
    },
    {
      key: 'roi',
      title: 'ROI',
      value: data ? `${data.roi.value}%` : '-',
      trend: data?.roi.growth,
      icon: <ShowChart />,
      iconClassName: 'bg-primary-soft text-primary',
    },
    {
      key: 'avgStay',
      title: t('dashboard.analytics.avgStay'),
      value: data ? `${data.avgStayDuration.value} ${t('dashboard.analytics.nights')}` : '-',
      trend: data?.avgStayDuration.growth,
      icon: <CalendarMonth />,
      iconClassName: 'bg-primary-soft text-primary',
    },
  ];

  // Operational secondary KPIs
  const operationalKpis: KpiItem[] = [
    {
      key: 'properties',
      title: t('dashboard.analytics.activeProperties'),
      value: data ? `${data.activeProperties}` : '-',
      icon: <Home />,
      iconClassName: 'bg-primary-soft text-primary',
    },
    {
      key: 'requests',
      title: t('dashboard.analytics.pendingRequests'),
      value: data ? `${data.pendingRequests}` : '-',
      icon: <Assignment />,
      iconClassName: 'bg-warning-soft text-warning',
    },
    {
      key: 'interventions',
      title: t('dashboard.analytics.activeInterventions'),
      value: data ? `${data.activeInterventions}` : '-',
      icon: <Build />,
      iconClassName: 'bg-primary-soft text-primary',
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

      {/* ─── Secondary KPIs (2 grouped cards) ──────────────────────
          `@container` declare ici et non dans GridSection : ce bloc est le seul
          des huit a ne pas passer par ce wrapper. */}
      <div className="@container grid grid-cols-12 gap-[9px]">
        {/* Financial group */}
        <div className="col-span-12 @[900px]:col-span-6">
          <Card className={SECONDARY_CARD_CLASS}>
            <p className={SECTION_LABEL_CLASS}>
              {t('dashboard.analytics.financialMetrics', 'Indicateurs financiers')}
            </p>
            <ItemGroup>
              {financialKpis.map((kpi, i) => (
                <React.Fragment key={kpi.key}>
                  {i > 0 && <ItemSeparator />}
                  <SecondaryKpiRow item={kpi} loading={loading} />
                </React.Fragment>
              ))}
            </ItemGroup>
          </Card>
        </div>

        {/* Operational group */}
        <div className="col-span-12 @[900px]:col-span-6">
          <Card className={SECONDARY_CARD_CLASS}>
            <p className={SECTION_LABEL_CLASS}>
              {t('dashboard.analytics.operationalMetrics', 'Activite operationnelle')}
            </p>
            <ItemGroup>
              {operationalKpis.map((kpi, i) => (
                <React.Fragment key={kpi.key}>
                  {i > 0 && <ItemSeparator />}
                  <SecondaryKpiRow item={kpi} loading={loading} />
                </React.Fragment>
              ))}
            </ItemGroup>
          </Card>
        </div>
      </div>
    </div>
  );
});

AnalyticsGlobalPerformance.displayName = 'AnalyticsGlobalPerformance';

export default AnalyticsGlobalPerformance;
