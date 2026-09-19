import React, { useMemo } from 'react';
import StatTile from '../../components/baitly/StatTile';
import StatTileRow from '../../components/baitly/StatTileRow';
import { Money } from '../../components/Money';
import { Percent, Euro, TrendingUp } from '../../icons';
import type { PropertyListItem } from '../../hooks/usePropertiesList';
import type { PropertyKpiSummary } from '../../services/api/propertyKpiApi';
import { useTranslation } from '../../hooks/useTranslation';

// ─── Tuiles portefeuille (projection Logements) ──────────────────────────────
//
// Le trio de BPropertiesSectionDemo, alimenté par les VRAIS KPI batchés du mois
// courant : l'agrégat portefeuille des trois chiffres que chaque carte affiche
// déjà (occupation / ADR / revenu). Suit les filtres de la liste — l'agrégat se
// recalcule client-side depuis la map, sans refetch. Silencieux tant que le
// backend n'a rien renvoyé (dégradation du hook KPI) : des tuiles à « — »
// feraient plus de bruit que d'information.

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
}

export function computePortfolioAggregates(
  properties: PropertyListItem[],
  kpiMap: Map<number, PropertyKpiSummary>,
): PortfolioAggregates {
  const kpis = properties.flatMap((property) => {
    const kpi = kpiMap.get(Number(property.id));
    return kpi ? [kpi] : [];
  });
  if (kpis.length === 0) return { occupancyPct: null, adr: null, revenue: null, covered: 0 };

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

  return { occupancyPct, adr, revenue, covered: kpis.length };
}

interface PropertiesPortfolioTilesProps {
  /** Logements FILTRÉS de la liste (l'agrégat suit la recherche/les filtres). */
  properties: PropertyListItem[];
  kpiMap: Map<number, PropertyKpiSummary>;
}

const PropertiesPortfolioTiles: React.FC<PropertiesPortfolioTilesProps> = ({
  properties,
  kpiMap,
}) => {
  const { t } = useTranslation();
  const aggregates = useMemo(
    () => computePortfolioAggregates(properties, kpiMap),
    [properties, kpiMap],
  );

  if (aggregates.covered === 0) return null;

  return (
    <StatTileRow compact className="mb-[9px] shrink-0">
      <StatTile
        icon={<Percent />}
        label={t('properties.tiles.avgOccupancy')}
        value={aggregates.occupancyPct != null ? String(aggregates.occupancyPct) : '—'}
        unit="%"
        hint={t('properties.tiles.coveredHint', { count: aggregates.covered })}
      />
      <StatTile
        icon={<Euro />}
        label={t('properties.tiles.portfolioAdr')}
        value={aggregates.adr != null ? <Money value={aggregates.adr} decimals={0} /> : '—'}
        hint={t('properties.tiles.adrHint')}
      />
      {/* Le moment engagé de cet écran. Un portefeuille se juge à ce qu'il
          rapporte : l'occupation et l'ADR expliquent ce chiffre, elles ne le
          remplacent pas. Une seule tuile portante par écran — deux, et il n'y
          en a plus aucune. */}
      <StatTile
        feature
        icon={<TrendingUp />}
        label={t('properties.tiles.monthRevenue')}
        value={aggregates.revenue != null ? <Money value={aggregates.revenue} decimals={0} /> : '—'}
        hint={t('properties.tiles.monthRevenueHint')}
      />
    </StatTileRow>
  );
};

export default PropertiesPortfolioTiles;
