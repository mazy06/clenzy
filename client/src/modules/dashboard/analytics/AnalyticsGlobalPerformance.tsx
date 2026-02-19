import React from 'react';
import { Grid } from '@mui/material';
import { Euro, Hotel, TrendingUp as TrendIcon, Percent, CalendarMonth, ShowChart, AccountBalance, Home, Assignment, Build } from '@mui/icons-material';
import GridSection from './GridSection';
import AnalyticsWidgetCard from './AnalyticsWidgetCard';
import { useTranslation } from '../../../hooks/useTranslation';
import type { GlobalKPIs } from '../../../hooks/useAnalyticsEngine';

interface Props {
  data: GlobalKPIs | null;
  loading: boolean;
}

const AnalyticsGlobalPerformance: React.FC<Props> = React.memo(({ data, loading }) => {
  const { t } = useTranslation();

  return (
    <GridSection
      title={t('dashboard.analytics.globalPerformance')}
      subtitle={t('dashboard.analytics.globalPerformanceDesc')}
    >
      <Grid container spacing={1.5}>
        <Grid item xs={6} sm={4} md={3}>
          <AnalyticsWidgetCard
            title="RevPAN"
            value={data ? `${data.revPAN.value.toFixed(2)} €` : '-'}
            subtitle={t('dashboard.analytics.revenuePerNight')}
            trend={data ? { value: data.revPAN.growth } : undefined}
            icon={<Euro color="primary" />}
            tooltip={t('dashboard.analytics.revPANTooltip')}
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <AnalyticsWidgetCard
            title="ADR"
            value={data ? `${data.adr.value.toFixed(2)} €` : '-'}
            subtitle={t('dashboard.analytics.avgDailyRate')}
            trend={data ? { value: data.adr.growth } : undefined}
            icon={<Hotel color="info" />}
            tooltip={t('dashboard.analytics.adrTooltip')}
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.occupancyRate')}
            value={data ? `${data.occupancyRate.value}%` : '-'}
            trend={data ? { value: data.occupancyRate.growth } : undefined}
            icon={<Percent color="success" />}
            tooltip={t('dashboard.analytics.occupancyTooltip')}
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.totalRevenue')}
            value={data ? `${data.totalRevenue.value.toLocaleString('fr-FR')} €` : '-'}
            trend={data ? { value: data.totalRevenue.growth } : undefined}
            icon={<TrendIcon color="success" />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.netMargin')}
            value={data ? `${data.netMargin.value}%` : '-'}
            trend={data ? { value: data.netMargin.growth } : undefined}
            icon={<AccountBalance color={data && data.netMargin.value < 50 ? 'error' : 'success'} />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <AnalyticsWidgetCard
            title="ROI"
            value={data ? `${data.roi.value}%` : '-'}
            trend={data ? { value: data.roi.growth } : undefined}
            icon={<ShowChart color="primary" />}
            tooltip={t('dashboard.analytics.roiTooltip')}
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.avgStay')}
            value={data ? `${data.avgStayDuration.value} ${t('dashboard.analytics.nights')}` : '-'}
            trend={data ? { value: data.avgStayDuration.growth } : undefined}
            icon={<CalendarMonth color="info" />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.activeProperties')}
            value={data ? `${data.activeProperties}` : '-'}
            subtitle={t('dashboard.analytics.activePropertiesDesc')}
            icon={<Home color="primary" />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.pendingRequests')}
            value={data ? `${data.pendingRequests}` : '-'}
            subtitle={t('dashboard.analytics.pendingRequestsDesc')}
            icon={<Assignment color="warning" />}
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={3}>
          <AnalyticsWidgetCard
            title={t('dashboard.analytics.activeInterventions')}
            value={data ? `${data.activeInterventions}` : '-'}
            subtitle={t('dashboard.analytics.activeInterventionsDesc')}
            icon={<Build color="info" />}
            loading={loading}
          />
        </Grid>
      </Grid>
    </GridSection>
  );
});

AnalyticsGlobalPerformance.displayName = 'AnalyticsGlobalPerformance';

export default AnalyticsGlobalPerformance;
