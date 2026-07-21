import apiClient from '../apiClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export type YieldMode = 'SIMULATION' | 'SUGGEST' | 'AUTO';
export type YieldComparison = 'BELOW' | 'ABOVE';

export interface YieldConfig {
  enabled: boolean;
  mode: YieldMode;
  // Automatisations déterministes R2 (opt-in par org, réversibles).
  orphanGapEnabled: boolean;
  orphanGapMaxNights: number;
  orphanGapDiscountPct: number;
  minStayAutoEnabled: boolean;
  minStayReduceWithinDays: number;
  minStayReducedValue: number;
}

export interface YieldRuleV1 {
  id: number | null;
  propertyId: number | null;
  name: string;
  comparison: YieldComparison;
  occupancyThresholdPct: number;
  windowDaysAhead: number;
  adjustmentPct: number;
  maxDailyChangePct: number;
  active: boolean;
  priority: number;
}

export interface YieldAdjustmentEntry {
  id: number;
  propertyId: number;
  ruleId: number | null;
  targetDate: string | null;
  adjustmentDay: string;
  mode: 'SIMULATED' | 'SUGGESTED' | 'APPLIED';
  priceBefore: number | null;
  priceAfter: number | null;
  occupancyPct: number | null;
  thresholdPct: number | null;
  comparison: string | null;
  reason: string | null;
  suggestionId: number | null;
  skipReason: string | null;
  createdAt: string;
}

export interface YieldJournalPage {
  content: YieldAdjustmentEntry[];
  page: number;
  size: number;
  totalElements: number;
}

export interface YieldPropertyBounds {
  propertyId: number;
  propertyName: string;
  floor: number | null;
  ceiling: number | null;
}

// ─── API ────────────────────────────────────────────────────────────────────

export const yieldRulesApi = {
  getConfig(): Promise<YieldConfig> {
    return apiClient.get<YieldConfig>('/yield/config');
  },

  updateConfig(config: YieldConfig): Promise<YieldConfig> {
    return apiClient.put<YieldConfig>('/yield/config', config);
  },

  listRules(): Promise<YieldRuleV1[]> {
    return apiClient.get<YieldRuleV1[]>('/yield/rules');
  },

  createRule(rule: Omit<YieldRuleV1, 'id'>): Promise<YieldRuleV1> {
    return apiClient.post<YieldRuleV1>('/yield/rules', rule);
  },

  updateRule(id: number, rule: Omit<YieldRuleV1, 'id'>): Promise<YieldRuleV1> {
    return apiClient.put<YieldRuleV1>(`/yield/rules/${id}`, rule);
  },

  deleteRule(id: number): Promise<void> {
    return apiClient.delete(`/yield/rules/${id}`);
  },

  listPropertyBounds(): Promise<YieldPropertyBounds[]> {
    return apiClient.get<YieldPropertyBounds[]>('/yield/property-bounds');
  },

  updatePropertyBounds(
    propertyId: number,
    floor: number | null,
    ceiling: number | null,
  ): Promise<YieldPropertyBounds> {
    return apiClient.put<YieldPropertyBounds>(`/yield/properties/${propertyId}/bounds`, {
      floor,
      ceiling,
    });
  },

  getJournal(params: { propertyId?: number; page?: number; size?: number }): Promise<YieldJournalPage> {
    return apiClient.get<YieldJournalPage>('/yield/journal', {
      params: {
        ...(params.propertyId != null ? { propertyId: params.propertyId } : {}),
        page: params.page ?? 0,
        size: params.size ?? 25,
      },
    });
  },
};

export default yieldRulesApi;
