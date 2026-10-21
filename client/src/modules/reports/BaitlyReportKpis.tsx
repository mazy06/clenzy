import { useState } from 'react';
import StatTileRow from '../../components/baitly/StatTileRow';
import type { StatFigure } from '../../components/stats';
import DashboardKpiDetail from '../dashboard/DashboardKpiDetail';
import { useTranslation } from '../../hooks/useTranslation';
import { reportMetric, type BaitlyReportKind } from './baitlyReportMetrics';
import '../dashboard/dashboardKpis.css';

/** Même primitive que le dashboard ; aucune nouvelle requête ni qualification inventée. */
export default function BaitlyReportKpis({ figures, report }: { figures: StatFigure[]; report: BaitlyReportKind }) {
  const { t, currentLanguage } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  if (!figures.length) return null;
  return <section className="db-kpis baitly-report-kpis" data-count={figures.length} aria-label={t('dashboard.imported.kpisTitle', 'Indicateurs clés')}>
    <StatTileRow presentation="overview">
      {figures.map(figure => {
        const metric = reportMetric(report, figure.key, currentLanguage, figure.label);
        const delta = figure.delta != null && Number.isFinite(figure.delta) ? figure.delta : null;
        return <DashboardKpiDetail key={figure.key} artwork={metric.artwork} label={metric.label} value={figure.value}
          open={selected === figure.key} onOpenChange={open => setSelected(previous => open ? figure.key : previous === figure.key ? null : previous)}>
          <div className="baitly-report-kpi-reading"><strong>{figure.value}</strong>
            {delta != null && <span data-report-delta data-neutral={delta === 0 || undefined} data-favorable={(figure.deltaInverted ? delta < 0 : delta > 0) || undefined}>
              {delta > 0 ? '+' : ''}{delta.toLocaleString(currentLanguage, { maximumFractionDigits: 1 })} %
            </span>}
          </div>
          {delta != null && <p className="db-kpis__hint">{t('dashboardKpis.comparison')}</p>}
          <p className="db-kpis__hint">{metric.hint}</p>
        </DashboardKpiDetail>;
      })}
    </StatTileRow>
  </section>;
}
