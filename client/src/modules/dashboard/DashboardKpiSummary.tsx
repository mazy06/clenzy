import { useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { FinancialKpis } from '../../hooks/useDashboardOverview';
import type { DashboardFinancialContext } from '../../services/api/dashboardOverviewApi';
import StatTileRow from '../../components/baitly/StatTileRow';
import { Money } from '../../components/baitly/Money';
import type { DashboardPeriod } from './DashboardDateFilter';
import DashboardKpiDetail from './DashboardKpiDetail';
import { assessDashboardKpi, hasKpiBaseline, kpiTrend, KPI_KEYS, KPI_LEVELS, KPI_THRESHOLDS,
  type DashboardKpiKey } from './dashboardKpiInsights';
import './dashboardKpis.css';

interface Props {
  kpis?: FinancialKpis | null;
  context?: DashboardFinancialContext;
  activeProperties?: number;
  period: DashboardPeriod;
  loading?: boolean;
}

/** Only the six figures remain in the page flow; their reading opens on demand, without another fetch. */
export default function DashboardKpiSummary({ kpis, context, activeProperties, period, loading }: Props) {
  const { t, currentLanguage } = useTranslation();
  const [selected, setSelected] = useState<DashboardKpiKey | null>(null);
  const number = (value: number, decimals = 0) => value.toLocaleString(currentLanguage, {
    maximumFractionDigits: decimals, numberingSystem: currentLanguage.startsWith('ar') ? 'arab' : undefined,
  });
  const days = { week: 7, month: 30, quarter: 90, year: 365 }[period];
  const money = (value: number) => <Money value={value} from={context?.currency ?? 'EUR'} decimals={0} symbolSize={14} />;
  const value = (key: DashboardKpiKey) => {
    if (!kpis) return '—';
    if (key === 'rating') return kpis.guestRating.count > 0 && Number.isFinite(kpis.guestRating.average)
      && kpis.guestRating.average > 0 && kpis.guestRating.average <= 5 ? number(kpis.guestRating.average, 1) : '—';
    const metric = kpiTrend(key, kpis)!;
    if (!Number.isFinite(metric.value)) return '—';
    return key === 'occupancy' ? number(metric.value, 1) : key === 'bookings' ? number(metric.value) : money(metric.value);
  };
  const hint = (key: DashboardKpiKey) => {
    if (key === 'occupancy' && context?.availableNights != null && context.occupiedNights != null)
      return t('dashboardKpis.nights', { sold: number(context.occupiedNights), available: number(context.availableNights) });
    if (key === 'rating' && kpis) return t('dashboardKpis.reviews', { count: kpis.guestRating.count, formatted: number(kpis.guestRating.count) });
    return t(`dashboardKpis.hints.${key}`);
  };

  return <section className="db-kpis" aria-label={t('dashboardKpis.title')} aria-busy={loading || undefined}>
    <StatTileRow presentation="overview">
      {KPI_KEYS.map((key) => {
        const assessment = assessDashboardKpi(key, kpis, context, activeProperties);
        const trend = kpis ? kpiTrend(key, kpis) : undefined;
        // Occupancy changes are points, all other comparable changes are relative percentages.
        const change = hasKpiBaseline(trend) ? key === 'occupancy' ? trend!.value - trend!.previousValue! : trend!.growth : null;
        const thresholdType = key === 'occupancy' ? 'occupancy' : key === 'rating' ? 'rating' : 'trend';
        const thresholds = KPI_THRESHOLDS[thresholdType];
        const adviceKey = assessment.reason === 'level'
          ? `advice.${key}.${assessment.level}` : `reasons.${assessment.reason}`;
        const confidence = assessment.level === 'unrated' ? 'insufficient'
          : assessment.reason === 'priceBalance' ? 'crossCheck' : 'indicative';
        return <DashboardKpiDetail key={key} artwork={`/images/dashboard-kpis/${key}.webp`}
          label={t(`dashboardKpis.labels.${key}`)} value={value(key)}
          shortLabel={key === 'adr' ? 'ADR' : key === 'revpan' ? 'RevPAN' : undefined}
          unit={key === 'occupancy' ? '%' : key === 'rating' ? `/${number(5)}` : undefined}
          loading={loading} open={selected === key} onOpenChange={(open) => setSelected((current) => open ? key : current === key ? null : current)}>
          <p className="db-kpis__period">{t('dashboardKpis.period', { days: number(days) })}
            {activeProperties != null && <> · {t('dashboardKpis.properties', { count: activeProperties, formatted: number(activeProperties) })}</>}
          </p>
          <div className="db-kpis__reading">
            <span className={`db-kpi-status db-kpi-status--${assessment.level}`}>{t(`dashboardKpis.levels.${assessment.level}`)}</span>
            {change != null && <span className="db-kpis__change">
              <bdi dir="ltr">{change > 0 ? '+' : ''}{number(change, 1)} {key === 'occupancy' ? t('dashboardKpis.points') : '%'}</bdi>
              {' '}{t('dashboardKpis.comparison')}
            </span>}
          </div>
          <p className="db-kpis__hint">{hint(key)}</p>
          <div className="db-kpis__confidence">
            <span>{t('dashboardKpis.confidence.label')}</span>
            <strong>{t(`dashboardKpis.confidence.${confidence}`)}</strong>
          </div>
          <div className="db-kpis__advice">
            <h4>{t('dashboardKpis.recommendation')}</h4>
            <p>{t(`dashboardKpis.${adviceKey}`)}</p>
          </div>
          <details className="db-kpis__thresholds">
            <summary>{t('dashboardKpis.thresholds')}<ChevronDownIcon size={16} aria-hidden="true" /></summary>
            <p>{t(`dashboardKpis.basis.${thresholdType}`)}</p>
            <dl>{KPI_LEVELS.map((level, index) => <div key={level}>
              <dt className={`db-kpi-status db-kpi-status--${level}`}>{t(`dashboardKpis.levels.${level}`)}</dt>
              <dd><bdi dir="ltr">{index === 0 ? `≥ ${number(thresholds[0], 1)}` : index === 4
                ? `< ${number(thresholds[3], 1)}` : `${number(thresholds[index], 1)} ≤ x < ${number(thresholds[index - 1], 1)}`}
                {thresholdType === 'rating' ? ` / ${number(5)}` : ' %'}</bdi></dd>
            </div>)}</dl>
            <p>{t('dashboardKpis.caveat')}</p>
            <p>{t('dashboardKpis.sampleRule')}</p>
          </details>
        </DashboardKpiDetail>;
      })}
    </StatTileRow>
  </section>;
}
