import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertAction, Button, Progress } from './ui';
import { Group, Wifi, TrendingUp, Security, Refresh, Info, BugReport } from '../icons';
import StatTile from './baitly/StatTile';
import StatTileRow from './baitly/StatTileRow';
import StatusChip, { type StatusTone } from './StatusChip';
import { monitoringApi } from '../services/api/monitoringApi';
import { useMonitoringHeader } from '../modules/admin/MonitoringPage';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { activeIntlLocale } from '../utils/activeLocale';
import { MonitoringIntro, MonitoringPanel, MonitoringValueRow, MonitoringLoading, monitoringNumber, monitoringDate } from './monitoring/MonitoringSurface';

export default function KeycloakMetrics() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { setHeaderActions, setHeaderLastUpdate } = useMonitoringHeader();
  const query = useQuery({ queryKey: ['monitoring', 'keycloak', user?.id, user?.organizationId], enabled: !!user, gcTime: 0, queryFn: monitoringApi.getKeycloakMetrics });
  const coverageQuery = useQuery({ queryKey: ['monitoring', 'coverage', user?.id, user?.organizationId], enabled: !!user, gcTime: 0, queryFn: monitoringApi.getTestCoverage });
  const { data: metrics, dataUpdatedAt, refetch, isFetching } = query;
  const refresh = () => { void refetch(); void coverageQuery.refetch(); };
  useEffect(() => {
    setHeaderActions(<Button variant="outline" size="sm" disabled={isFetching || coverageQuery.isFetching} onClick={refresh}>
      <Refresh size={16} />{t('keycloakMetrics.refresh')}</Button>);
    return () => setHeaderActions(null);
  }, [setHeaderActions, refetch, coverageQuery.refetch, isFetching, coverageQuery.isFetching, t]);
  useEffect(() => {
    setHeaderLastUpdate(dataUpdatedAt ? new Date(dataUpdatedAt) : null);
  }, [setHeaderLastUpdate, dataUpdatedAt]);

  if (query.isLoading) return <MonitoringLoading label={t('monitoringDesign.loading')} />;
  if (!metrics) return <Alert variant="destructive"><Info /><AlertDescription>
    {t('monitoring.metricsFetchError')}</AlertDescription><AlertAction><Button variant="outline" size="sm"
      disabled={isFetching} onClick={refresh}>{t('common.retry')}</Button></AlertAction></Alert>;
  const number = (n: number | undefined) => monitoringNumber(n, activeIntlLocale());
  const coverage = coverageQuery.data;
  const coverageRows = coverage?.available ? [
    { label: t('monitoringDesign.coverageLines'), percent: coverage.linePercent, covered: coverage.lineCovered, total: coverage.lineTotal },
    { label: t('monitoringDesign.coverageBranches'), percent: coverage.branchPercent, covered: coverage.branchCovered, total: coverage.branchTotal },
    { label: t('monitoringDesign.coverageInstructions'), percent: coverage.instructionPercent, covered: coverage.instructionCovered, total: coverage.instructionTotal },
    { label: t('keycloakMetrics.methods'), percent: coverage.methodPercent, covered: coverage.methodCovered, total: coverage.methodTotal },
    { label: t('monitoringDesign.coverageClasses'), percent: coverage.classPercent, covered: coverage.classCovered, total: coverage.classTotal },
    { label: t('keycloakMetrics.complexity'), percent: coverage.complexityPercent, covered: coverage.complexityCovered, total: coverage.complexityTotal },
  ].filter(row => row.percent != null && Number.isFinite(row.percent)) : [];
  const securitySignals = metrics.security.failedLogins + metrics.security.permissionDenied + metrics.security.suspiciousActivity;
  const securityTone: StatusTone = metrics.security.suspiciousActivity > 0 ? 'err' : securitySignals > 0 ? 'warn' : 'neutral';

  return <div className="bui-monitor">
    <MonitoringIntro title={t('monitoringDesign.authTitle')} description={t('monitoringDesign.authDescription')}
      status={query.error ? t('monitoringDesign.staleSnapshot') : t('monitoringDesign.backendSnapshot')} />
    {query.error && <Alert variant="warning"><Info /><AlertDescription>{t('monitoringDesign.staleValues')}</AlertDescription></Alert>}
    <StatTileRow compact>
      <StatTile icon={<Group />} label={t('monitoringDesign.activeAccounts')} value={number(metrics.users.active)} />
      <StatTile icon={<Wifi />} label={t('monitoringDesign.validTokens')} value={number(metrics.sessions.validTokens)} />
      <StatTile icon={<TrendingUp />} label={t('keycloakMetrics.avgResponseTime')} value={number(metrics.performance.avgResponseTimeMs)} unit="ms" />
      <StatTile icon={<Info />} label={t('monitoringDesign.errorRate')} value={number(metrics.performance.errorRate)} unit="%" />
    </StatTileRow>
    <div className="bui-monitor-columns">
      <div className="min-w-0 space-y-4">
        <MonitoringPanel title={t('keycloakMetrics.security7d')} description={t('monitoringDesign.securityHint')}
          action={<StatusChip tone={securityTone} label={securitySignals > 0
            ? t('monitoringDesign.signalsToReview', { count: securitySignals }) : t('monitoringDesign.noSignal')} />}>
          <dl>
            <MonitoringValueRow label={t('keycloakMetrics.loginFailures')} value={number(metrics.security.failedLogins)}
              tone={metrics.security.failedLogins > 0 ? 'warn' : 'neutral'} />
            <MonitoringValueRow label={t('keycloakMetrics.accessDenied')} value={number(metrics.security.permissionDenied)}
              tone={metrics.security.permissionDenied > 0 ? 'warn' : 'neutral'} />
            <MonitoringValueRow label={t('monitoringDesign.suspiciousActivity')} value={number(metrics.security.suspiciousActivity)}
              tone={metrics.security.suspiciousActivity > 0 ? 'err' : 'neutral'} />
          </dl>
          <div className="border-t border-border py-4 text-xs text-muted-foreground">
            {t('monitoringDesign.lastIncident')}{' '}
            <span className="tabular-nums">{metrics.security.lastIncident
              ? monitoringDate(metrics.security.lastIncident, activeIntlLocale()) : t('monitoringDesign.noIncidentRecorded')}</span>
          </div>
        </MonitoringPanel>
        <MonitoringPanel title={t('monitoringDesign.apiPerformance')} description={t('monitoringDesign.performanceHint')}>
          <dl>
            <MonitoringValueRow label={t('monitoringDesign.requestsProcessed')} value={number(metrics.performance.totalRequests)} />
            <MonitoringValueRow label={t('keycloakMetrics.avgResponseTime')} value={number(metrics.performance.avgResponseTimeMs) + ' ms'} />
            <MonitoringValueRow label={t('monitoringDesign.reportedAvailability')} value={number(metrics.performance.uptimePercent) + ' %'} />
            <MonitoringValueRow label={t('monitoringDesign.errorRate')} value={number(metrics.performance.errorRate) + ' %'}
              tone={metrics.performance.errorRate > 0 ? 'warn' : 'neutral'} />
          </dl>
        </MonitoringPanel>
      </div>
      <div className="min-w-0 space-y-4">
        <MonitoringPanel title={t('monitoringDesign.accountInventory')} description={t('monitoringDesign.accountHint')}>
          <dl>
            <MonitoringValueRow label={t('monitoringDesign.totalAccounts')} value={number(metrics.users.total)} />
            <MonitoringValueRow label={t('monitoringDesign.activeAccounts')} value={number(metrics.users.active)} />
            <MonitoringValueRow label={t('monitoringDesign.inactiveAccounts')} value={number(metrics.users.inactive)} />
            <MonitoringValueRow label={t('monitoringDesign.newThisWeek')} value={number(metrics.users.newThisWeek)} />
          </dl>
        </MonitoringPanel>
        <MonitoringPanel title={t('monitoringDesign.jwtInventory')}>
          <dl>
            <MonitoringValueRow label={t('keycloakMetrics.totalProcessed')} value={number(metrics.sessions.totalTokens)} />
            <MonitoringValueRow label={t('monitoringDesign.validTokens')} value={number(metrics.sessions.validTokens)} />
            <MonitoringValueRow label={t('monitoringDesign.revokedTokens')} value={number(metrics.sessions.revokedTokens)} />
            <MonitoringValueRow label={t('monitoringDesign.cacheHits')} value={number(metrics.sessions.cacheHits)} />
          </dl>
        </MonitoringPanel>
      </div>
    </div>
    <MonitoringPanel title={t('monitoringDesign.testCoverage')} description={t('monitoringDesign.coverageHint')}
      action={coverage?.reportDate ? <StatusChip tone="neutral"
        label={new Date(coverage.reportDate).toLocaleDateString(activeIntlLocale())} /> : <BugReport size={18} className="text-muted-foreground" />}>
      {coverageQuery.isLoading ? <p className="py-5 text-sm text-muted-foreground">{t('monitoringDesign.loading')}</p>
        : coverageRows.length > 0 ? <table className="bui-monitor-coverage">
          <thead><tr><th scope="col">{t('monitoringDesign.measure')}</th><th scope="col">{t('monitoringDesign.coveredTotal')}</th>
            <th scope="col">{t('monitoringDesign.coverage')}</th></tr></thead>
          <tbody>{coverageRows.map(row => <tr key={row.label}>
            <td className="font-medium">{row.label}</td>
            <td className="tabular-nums text-muted-foreground">{number(row.covered)} / {number(row.total)}</td>
            <td><div className="flex items-center gap-3">
              <span className="min-w-12 tabular-nums">{number(row.percent)} %</span>
              <Progress aria-label={row.label} value={Math.max(0, Math.min(100, row.percent ?? 0))} className="h-1 flex-1" />
            </div></td>
          </tr>)}</tbody>
        </table> : <div className="flex items-start gap-3 py-5">
          <Info size={18} className="shrink-0 text-muted-foreground" />
          <div><p className="text-sm font-medium">{t('monitoring.coverageUnavailable')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('monitoringDesign.coverageMissingHint')}</p>
            {coverageQuery.error && <Button variant="ghost" size="sm" className="mt-2"
              onClick={() => void coverageQuery.refetch()}>{t('common.retry')}</Button>}</div>
        </div>}
    </MonitoringPanel>
  </div>;
}
