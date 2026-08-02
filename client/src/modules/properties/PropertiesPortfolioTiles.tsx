import React, { useMemo } from 'react';
import StatTile from '../../components/baitly/StatTile';
import { Money } from '../../components/Money';
import { Percent, Euro, TrendingUp } from '../../icons';
import type { PropertyListItem } from '../../hooks/usePropertiesList';
import type { PropertyKpiSummary } from '../../services/api/propertyKpiApi';

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
  const aggregates = useMemo(
    () => computePortfolioAggregates(properties, kpiMap),
    [properties, kpiMap],
  );

  if (aggregates.covered === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 mb-[9px] shrink-0 min-[600px]:grid-cols-3">
      <StatTile
        icon={<Percent />}
        label="Occupation moyenne"
        value={aggregates.occupancyPct != null ? String(aggregates.occupancyPct) : '—'}
        unit="%"
        hint={`sur ${aggregates.covered} logement${aggregates.covered > 1 ? 's' : ''} ce mois-ci`}
      />
      <StatTile
        icon={<Euro />}
        label="ADR portefeuille"
        value={aggregates.adr != null ? <Money value={aggregates.adr} decimals={0} /> : '—'}
        hint="prix moyen par nuit vendue"
      />
      <StatTile
        icon={<TrendingUp />}
        label="Revenu du mois"
        value={aggregates.revenue != null ? <Money value={aggregates.revenue} decimals={0} /> : '—'}
        hint="alloué au mois courant, au prorata des nuits"
      />
    </div>
  );
};

export default PropertiesPortfolioTiles;
