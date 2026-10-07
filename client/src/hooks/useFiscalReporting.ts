import { useQuery } from '@tanstack/react-query';
import { useCommerceScope } from './useCommerceScope';
import { fiscalReportingApi } from '../services/api/fiscalReportingApi';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const fiscalReportingKeys = {
  all: ['fiscal-reporting'] as const,
  vatSummary: (from: string, to: string) => ['fiscal-reporting', 'vat', from, to] as const,
  monthly: (year: number, month: number) => ['fiscal-reporting', 'monthly', year, month] as const,
  quarterly: (year: number, quarter: number) => ['fiscal-reporting', 'quarterly', year, quarter] as const,
  annual: (year: number) => ['fiscal-reporting', 'annual', year] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useMonthlyVatSummary(year: number, month: number, country?: string) {
  const scope = useCommerceScope();
  return useQuery({
    queryKey: [...fiscalReportingKeys.monthly(year, month), country ?? "default", scope],
    queryFn: () => fiscalReportingApi.getMonthlyVatSummary(year, month, country),
    enabled: !!scope && year > 0 && month > 0,
    staleTime: 120_000,
  });
}

export function useQuarterlyVatSummary(year: number, quarter: number, country?: string) {
  const scope = useCommerceScope();
  return useQuery({
    queryKey: [...fiscalReportingKeys.quarterly(year, quarter), country ?? "default", scope],
    queryFn: () => fiscalReportingApi.getQuarterlyVatSummary(year, quarter, country),
    enabled: !!scope && year > 0 && quarter > 0,
    staleTime: 120_000,
  });
}

export function useAnnualVatSummary(year: number, country?: string) {
  const scope = useCommerceScope();
  return useQuery({
    queryKey: [...fiscalReportingKeys.annual(year), country ?? "default", scope],
    queryFn: () => fiscalReportingApi.getAnnualVatSummary(year, country),
    enabled: !!scope && year > 0,
    staleTime: 120_000,
  });
}
