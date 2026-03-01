import { useQuery } from '@tanstack/react-query';
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

export function useVatSummary(from: string, to: string) {
  return useQuery({
    queryKey: fiscalReportingKeys.vatSummary(from, to),
    queryFn: () => fiscalReportingApi.getVatSummary(from, to),
    enabled: !!from && !!to,
    staleTime: 120_000,
  });
}

export function useMonthlyVatSummary(year: number, month: number) {
  return useQuery({
    queryKey: fiscalReportingKeys.monthly(year, month),
    queryFn: () => fiscalReportingApi.getMonthlyVatSummary(year, month),
    enabled: year > 0 && month > 0,
    staleTime: 120_000,
  });
}

export function useQuarterlyVatSummary(year: number, quarter: number) {
  return useQuery({
    queryKey: fiscalReportingKeys.quarterly(year, quarter),
    queryFn: () => fiscalReportingApi.getQuarterlyVatSummary(year, quarter),
    enabled: year > 0 && quarter > 0,
    staleTime: 120_000,
  });
}

export function useAnnualVatSummary(year: number) {
  return useQuery({
    queryKey: fiscalReportingKeys.annual(year),
    queryFn: () => fiscalReportingApi.getAnnualVatSummary(year),
    enabled: year > 0,
    staleTime: 120_000,
  });
}
