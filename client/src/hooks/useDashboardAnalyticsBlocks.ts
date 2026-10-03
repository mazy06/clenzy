import { useQuery } from '@tanstack/react-query';
import { reportViewsApi } from '../services/api/reportViewsApi';
import { portfolioAnalyticsQuery, type PortfolioAnalytics } from '../services/api/portfolioAnalyticsApi';
import { accountingApi, type PayoutStatus } from '../services/api/accountingApi';
import type { PropertyOccupancy } from '../types/analytics';
import type { DashboardPeriod } from '../modules/dashboard/DashboardDateFilter';

/**
 * Deux blocs du Dashboard alimentés par des endpoints **déjà existants** —
 * aucun code serveur n'a été nécessaire :
 *  - revenus mensuels ventilés direct / OTA → moteur de rapports générique ;
 *  - occupation par logement → analytics du portefeuille.
 */

/**
 * Une barre du graphe : le revenu d'un mois, décomposé en ce qu'il est devenu.
 *
 * Les quatre segments s'additionnent EXACTEMENT au revenu — c'est ce qui rend
 * l'empilement licite. Empiler le revenu et ses sorties dans le même bâton
 * compterait le même argent deux fois et donnerait un total sans signification.
 */
export interface MonthlyRevenueSplit {
  /** Mois ISO (YYYY-MM), traduit au rendu pour suivre la langue sans recharger. */
  month: string;
  /** Total du mois — sert au libellé, pas au tracé. */
  revenue: number;
  /** Commissions prélevées par les canaux. */
  fees: number;
  /** Coûts d'intervention (ménage, maintenance) attribués au mois. */
  interventions: number;
  /** Net reversé aux propriétaires. */
  payout: number;
  /**
   * Ce qui reste après commissions, interventions et reversements. Peut être
   * NÉGATIF quand les reversements d'un mois portent sur des séjours antérieurs :
   * le segment passe alors sous l'axe, ce qui est précisément l'information.
   */
  retained: number;
}

/**
 * Statuts de reversement qui représentent de l'argent réellement engagé.
 * `FAILED` et `CANCELLED` sont exclus — un virement qui n'est pas parti n'est
 * pas sorti de la trésorerie et le compter fausserait la lecture.
 */
const SETTLED_PAYOUT_STATUSES = new Set<PayoutStatus>([
  'APPROVED',
  'PROCESSING',
  'PAID',
]);

/** `2026-03-14` → `2026-03`. Les versements portent une date, pas un bucket. */
function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/**
 * Le revenu des N derniers mois, décomposé en ce qu'il est devenu.
 *
 * Un seul appel au moteur de rapports suffit : il expose REVENUE et FEES, et
 * {@code MARGIN = REVENUE − FEES − coûts d'intervention}. Les coûts
 * d'intervention ne sont pas exposés en propre, mais ils s'en déduisent —
 * {@code interventions = REVENUE − FEES − MARGIN}. Aucun endpoint à créer.
 *
 * <p>Les reversements, eux, n'ont pas de métrique dans ce moteur
 * ({@code ReportFieldCatalog.Metric} ne connaît que REVENUE, ADR, REVPAR,
 * OCCUPANCY, FEES et MARGIN) : ils sont agrégés ici depuis la liste des
 * reversements, comme le fait déjà la carte « Gestion &amp; reversements ».</p>
 *
 * <p>La ventilation direct / OTA a été retirée : la carte « Revenus par canal »,
 * juste à côté, dit déjà cela — et bien mieux.</p>
 */
export function useDashboardRevenueSplit(months = 6, enabled = true) {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth() - (months - 1), 1);
  // Local calendar dates must not move to the previous day through UTC conversion.
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return useQuery<MonthlyRevenueSplit[]>({
    queryKey: ['dashboard', 'revenue-split', months, iso(from), iso(to)],
    queryFn: async () => {
      const [result, payouts] = await Promise.all([
        reportViewsApi.execute({
          dimensions: ['PERIOD'],
          metrics: ['REVENUE', 'FEES', 'MARGIN'],
          granularity: 'MONTH',
          from: iso(from),
          to: iso(to),
        }),
        // A failed payout request is unknown, never a zero financial amount.
        accountingApi.getPayouts(),
      ]);

      const periodIndex = result.dimensions.indexOf('PERIOD');
      if (periodIndex < 0) return [];

      const empty = (bucket: string): MonthlyRevenueSplit => ({
        month: bucket,
        revenue: 0, fees: 0, interventions: 0, payout: 0, retained: 0,
      });

      const byMonth = new Map<string, MonthlyRevenueSplit>();
      for (const row of result.rows) {
        const bucket = row.dimensionValues[periodIndex];
        const revenue = row.metrics.REVENUE ?? 0;
        const fees = row.metrics.FEES ?? 0;
        const margin = row.metrics.MARGIN ?? revenue - fees;

        const entry = byMonth.get(bucket) ?? empty(bucket);
        entry.revenue += revenue;
        entry.fees += fees;
        // Déduit, faute d'être exposé. Borné à zéro : un arrondi entre trois
        // métriques ne doit pas produire un coût négatif, qui n'existe pas.
        entry.interventions += Math.max(0, revenue - fees - margin);
        entry.retained += margin;
        byMonth.set(bucket, entry);
      }

      const fromKey = monthKey(iso(from));
      for (const payout of payouts) {
        if (!SETTLED_PAYOUT_STATUSES.has(payout.status)) continue;
        const bucket = monthKey(payout.periodStart);
        // Hors fenêtre : la liste n'est pas filtrée par date côté serveur.
        if (bucket < fromKey || bucket > monthKey(iso(to))) continue;
        const entry = byMonth.get(bucket) ?? empty(bucket);
        entry.payout += payout.netAmount ?? 0;
        byMonth.set(bucket, entry);
      }

      // Le reversé sort de la marge : sans cette soustraction, les segments
      // dépasseraient le revenu du mois et le bâton mentirait.
      for (const entry of byMonth.values()) {
        entry.retained -= entry.payout;
      }

      // Tri sur la clé brute (`yyyy-MM`), pas sur le libellé traduit.
      return [...byMonth.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, value]) => value);
    },
    staleTime: 10 * 60_000,
    enabled,
  });
}

/** Occupation par logement sur la période — `occupancy.byProperty` du portefeuille. */
export function useDashboardOccupancyByProperty(period: DashboardPeriod, enabled = true) {
  return useQuery({
    ...portfolioAnalyticsQuery(period),
    select: selectOccupancy,
    enabled,
  });
}

const selectOccupancy = (analytics: PortfolioAnalytics): PropertyOccupancy[] =>
  [...(analytics.occupancy?.byProperty ?? [])].sort((a, b) => b.rate - a.rate);
