import apiClient from '../apiClient';

/**
 * Agrégats de PARC du tableau de bord.
 *
 * <p>Le stock et le positionnement tarifaire ne s'interrogeaient que logement
 * par logement : une tuile de parc aurait déclenché un appel par bien. Le
 * serveur les rassemble en une requête (`PortfolioPulseController`).</p>
 */

export interface ReorderItem {
  id: number;
  propertyId: number;
  propertyName: string | null;
  name: string;
  category: string | null;
  unit: string | null;
  quantity: number;
  reorderThreshold: number;
  reorderQuantity: number;
  supplierName: string | null;
  /** Un fournisseur ET une quantité de réappro : « Commander » a un sens. */
  orderable: boolean;
}

export type PositioningVerdict = 'UNDERPRICED' | 'ALIGNED' | 'OVERPRICED' | 'NO_MARKET_DATA';

export interface PropertyPositioning {
  propertyId: number;
  propertyName: string | null;
  positioning: {
    area: string | null;
    propertyAdr: number | null;
    propertyOccupancyPct: number | null;
    marketAdr: number | null;
    marketOccupancyPct: number | null;
    currency: string | null;
    deltaPct: number | null;
    positioning: PositioningVerdict;
    source: string | null;
    confidence: number | null;
    headline: string;
  };
}

export const portfolioPulseApi = {
  stockToReorder: (): Promise<ReorderItem[]> =>
    apiClient.get<ReorderItem[]>('/portfolio-pulse/stock-reorder'),

  positioning: (): Promise<PropertyPositioning[]> =>
    apiClient.get<PropertyPositioning[]>('/portfolio-pulse/positioning'),
};
