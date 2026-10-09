import React, { useMemo } from 'react';
import StatTile from '../../components/baitly/StatTile';
import StatTileRow from '../../components/baitly/StatTileRow';
import { Money } from '../../components/Money';
import { Percent, Euro, TrendingUp } from '../../icons';
import type { PropertyListItem } from '../../hooks/usePropertiesList';
import type { PropertyKpiSummary } from '../../services/api/propertyKpiApi';
import { useTranslation } from '../../hooks/useTranslation';
import { Skeleton } from '../../components/ui';
import './baitlyPortfolioSummary.css';

// ─── Tuiles portefeuille (projection Logements) ──────────────────────────────
//
// Synthèse illustrée des KPI du mois et de l'exploitation actuelle.
// Les agrégats suivent les logements filtrés, sans requête supplémentaire.
// Le périmètre couvert reste visible lorsque certains KPI manquent.
// Sans données, la synthèse reste masquée.

/** Agrégats calculés, `null` quand la donnée ne permet pas le chiffre. */
export interface PortfolioAggregates {
  /** Moyenne simple des taux d'occupation, en % entier. */
  occupancyPct: number | null;
  /** ADR pondéré : Σ revenus / Σ nuits vendues (nuits = revenu / ADR). */
  adr: number | null;
  /** Σ des revenus alloués au mois courant. */
  revenue: number | null;
  /** Nombre de logements couverts par un KPI. */
  covered: number;
  occupied: number;
  interventions: number;
}

export function computePortfolioAggregates(
  properties: PropertyListItem[],
  kpiMap: Map<number, PropertyKpiSummary>,
): PortfolioAggregates {
  const kpis = properties.flatMap((property) => {
    const kpi = kpiMap.get(Number(property.id));
    return kpi ? [kpi] : [];
  });
  if (kpis.length === 0) return { occupancyPct: null, adr: null, revenue: null, covered: 0, occupied: 0, interventions: 0 };

  const occupancyPct = Math.round(
    (kpis.reduce((sum, kpi) => sum + kpi.occupancyRate, 0) / kpis.length) * 100,
  );
  const revenue = kpis.reduce((sum, kpi) => sum + kpi.revenue, 0);
  // ADR portefeuille pondéré par les nuits réellement vendues, reconstruites
  // depuis revenu / ADR par logement (l'API ne renvoie pas les nuits).
  const nights = kpis.reduce(
    (sum, kpi) => sum + (kpi.adr > 0 ? kpi.revenue / kpi.adr : 0),
    0,
  );
  const adr = nights > 0 ? revenue / nights : null;

  return {
    occupancyPct, adr, revenue, covered: kpis.length,
    occupied: kpis.filter(kpi => kpi.operationalStatus === 'occupied').length,
    interventions: kpis.filter(kpi => kpi.activeInterventionType != null).length,
  };
}

interface PropertiesPortfolioTilesProps {
  /** Logements FILTRÉS de la liste (l'agrégat suit la recherche/les filtres). */
  properties: PropertyListItem[];
  kpiMap: Map<number, PropertyKpiSummary>;
  loading?: boolean;
}

const PropertiesPortfolioTiles: React.FC<PropertiesPortfolioTilesProps> = ({
  properties,
  kpiMap,
  loading = false,
}) => {
  const { t } = useTranslation();
  const aggregates = useMemo(
    () => computePortfolioAggregates(properties, kpiMap),
    [properties, kpiMap],
  );

  if (!loading && aggregates.covered === 0) return null;

  return (
    <StatTileRow presentation="overview" className="baitly-portfolio-summary shrink-0"
      footer={<div className="baitly-portfolio-summary-scope">
        {loading ? <Skeleton className="h-[18px] w-[24ch]" /> : <>
          <span>{t('properties.tiles.coveredHint', { count: aggregates.covered })}</span>
          {aggregates.covered < properties.length && <span>{t('properties.tiles.partialCoverage', { count: properties.length - aggregates.covered })}</span>}
        </>}
      </div>}>
      <StatTile
        loading={loading}
        className="bui-stat-overview__item"
        artwork="/images/dashboard-kpis/occupancy.webp"
        icon={<Percent />}
        label={t('properties.tiles.avgOccupancy')}
        value={aggregates.occupancyPct != null ? String(aggregates.occupancyPct) : '—'}
        unit="%"
        hint={t('properties.tiles.coveredHint', { count: aggregates.covered })}
      />
      <StatTile
        loading={loading}
        className="bui-stat-overview__item"
        artwork="/images/dashboard-kpis/adr.webp"
        icon={<Euro />}
        label={t('properties.tiles.portfolioAdr')}
        value={aggregates.adr != null ? <Money value={aggregates.adr} decimals={0} /> : '—'}
        hint={t('properties.tiles.adrHint')}
      />
      <StatTile
        loading={loading}
        className="bui-stat-overview__item baitly-portfolio-summary-revenue"
        artwork="/images/dashboard-kpis/revenue.webp"
        icon={<TrendingUp />}
        label={t('properties.tiles.monthRevenue')}
        value={aggregates.revenue != null ? <Money value={aggregates.revenue} decimals={0} /> : '—'}
        hint={t('properties.tiles.monthRevenueHint')}
      />
      <StatTile loading={loading} className="bui-stat-overview__item" icon={null}
        artwork="/images/dashboard-kpis/bookings.webp"
        label={t('properties.tiles.occupiedToday')} value={aggregates.occupied} />
      <StatTile loading={loading} className="bui-stat-overview__item" icon={null}
        artwork="/images/dashboard-operations/cleanings.webp"
        label={t('properties.tiles.activeInterventions')} value={aggregates.interventions} />
    </StatTileRow>
  );
};

export default PropertiesPortfolioTiles;
