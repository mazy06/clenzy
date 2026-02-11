import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  reportsApi,
  InterventionReportData,
  PropertyReportData,
  TeamReportData,
  FinancialReportData,
} from '../../../services/api/reportsApi';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UseReportDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

// ─── Hook: useInterventionReport ────────────────────────────────────────────

export function useInterventionReport(): UseReportDataState<InterventionReportData> {
  const [data, setData] = useState<InterventionReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await reportsApi.getInterventionStats();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement des donnees';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [retryCount]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  const memoizedData = useMemo(() => data, [data]);

  return { data: memoizedData, loading, error, retry };
}

// ─── Hook: usePropertyReport ────────────────────────────────────────────────

export function usePropertyReport(): UseReportDataState<PropertyReportData> {
  const [data, setData] = useState<PropertyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await reportsApi.getPropertyStats();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement des donnees';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [retryCount]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  const memoizedData = useMemo(() => data, [data]);

  return { data: memoizedData, loading, error, retry };
}

// ─── Hook: useTeamReport ────────────────────────────────────────────────────

export function useTeamReport(): UseReportDataState<TeamReportData> {
  const [data, setData] = useState<TeamReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await reportsApi.getTeamStats();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement des donnees';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [retryCount]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  const memoizedData = useMemo(() => data, [data]);

  return { data: memoizedData, loading, error, retry };
}

// ─── Hook: useFinancialReport ───────────────────────────────────────────────

export function useFinancialReport(): UseReportDataState<FinancialReportData> {
  const [data, setData] = useState<FinancialReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await reportsApi.getFinancialStats();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement des donnees';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [retryCount]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  const memoizedData = useMemo(() => data, [data]);

  return { data: memoizedData, loading, error, retry };
}
