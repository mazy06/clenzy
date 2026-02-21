import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { useAuth } from '../../hooks/useAuth';
import { useAnalyticsEngine } from '../../hooks/useAnalyticsEngine';
import DashboardErrorBoundary from './DashboardErrorBoundary';
import {
  AnalyticsGlobalPerformance,
  AnalyticsRevenue,
  AnalyticsOccupancy,
  AnalyticsPricingIntelligence,
  AnalyticsForecasts,
  AnalyticsRecommendations,
  AnalyticsClientAnalysis,
  AnalyticsPropertyPerformance,
  AnalyticsBenchmark,
  AnalyticsSimulator,
  AnalyticsAlerts,
} from './analytics';
import type { DashboardPeriod } from './DashboardDateFilter';

// ─── Props ───────────────────────────────────────────────────────────────────

interface DashboardAnalyticsContentProps {
  period?: DashboardPeriod;
  subTab?: number;
}

const DashboardAnalyticsContent: React.FC<DashboardAnalyticsContentProps> = React.memo(({ period = 'month', subTab = 0 }) => {
  const { user } = useAuth();

  // Roles
  const isAdmin = user?.roles?.includes('SUPER_ADMIN') || false;
  const isManager = user?.roles?.includes('SUPER_MANAGER') || false;
  const isSupervisor = user?.roles?.includes('SUPERVISOR');

  const canViewCharts = isAdmin || isManager || isSupervisor;

  // ─── Analytics engine ───────────────────────────────────────────────────
  const interventions = useMemo(() => {
    return [] as Array<{ estimatedCost?: number; actualCost?: number; type: string; status: string; scheduledDate?: string; createdAt?: string }>;
  }, []);

  const { analytics, loading: analyticsLoading } = useAnalyticsEngine({
    period,
    interventions,
  });

  return (
    <Box
      sx={{
        pt: 0.5,
        pb: 0,
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {canViewCharts && (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {/* Tab panels */}
          <Box sx={{ mt: 0.5 }}>
            {/* ── Tab 0 : Vue d'ensemble ───────────────────────────── */}
            {subTab === 0 && (
              <>
                <DashboardErrorBoundary widgetName="Performance Globale">
                  <AnalyticsGlobalPerformance data={analytics?.global ?? null} loading={analyticsLoading} />
                </DashboardErrorBoundary>

                <DashboardErrorBoundary widgetName="Alertes Business">
                  <AnalyticsAlerts data={analytics?.alerts ?? null} loading={analyticsLoading} />
                </DashboardErrorBoundary>

                <DashboardErrorBoundary widgetName="Recommandations">
                  <AnalyticsRecommendations data={analytics?.recommendations ?? null} loading={analyticsLoading} />
                </DashboardErrorBoundary>
              </>
            )}

            {/* ── Tab 1 : Revenus & Tarifs ─────────────────────────── */}
            {subTab === 1 && (
              <>
                <DashboardErrorBoundary widgetName="Revenus">
                  <AnalyticsRevenue data={analytics?.revenue ?? null} loading={analyticsLoading} />
                </DashboardErrorBoundary>

                <DashboardErrorBoundary widgetName="Pricing Intelligence">
                  <AnalyticsPricingIntelligence data={analytics?.pricing ?? null} loading={analyticsLoading} />
                </DashboardErrorBoundary>

                <DashboardErrorBoundary widgetName="Prévisions">
                  <AnalyticsForecasts data={analytics?.forecast ?? null} loading={analyticsLoading} />
                </DashboardErrorBoundary>
              </>
            )}

            {/* ── Tab 2 : Occupation & Clientèle ───────────────────── */}
            {subTab === 2 && (
              <>
                <DashboardErrorBoundary widgetName="Occupation">
                  <AnalyticsOccupancy data={analytics?.occupancy ?? null} loading={analyticsLoading} />
                </DashboardErrorBoundary>

                <DashboardErrorBoundary widgetName="Analyse Clientèle">
                  <AnalyticsClientAnalysis data={analytics?.clients ?? null} loading={analyticsLoading} />
                </DashboardErrorBoundary>
              </>
            )}

            {/* ── Tab 3 : Performance & Outils ─────────────────────── */}
            {subTab === 3 && (
              <>
                <DashboardErrorBoundary widgetName="Performance par Logement">
                  <AnalyticsPropertyPerformance data={analytics?.properties ?? null} loading={analyticsLoading} />
                </DashboardErrorBoundary>

                <DashboardErrorBoundary widgetName="Benchmark">
                  <AnalyticsBenchmark data={analytics?.benchmark ?? null} loading={analyticsLoading} />
                </DashboardErrorBoundary>

                <DashboardErrorBoundary widgetName="Simulateur">
                  <AnalyticsSimulator data={analytics} />
                </DashboardErrorBoundary>
              </>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
});

DashboardAnalyticsContent.displayName = 'DashboardAnalyticsContent';

export default DashboardAnalyticsContent;
