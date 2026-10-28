import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, AlertAction, AlertDescription, Button, Progress } from './ui';
import { HealthAndSafety, Security, Storage, Memory, Wifi, Speed, Info, Refresh, ExpandMore } from '../icons';
import StatusChip, { type StatusTone } from './StatusChip';
import StatTile from './baitly/StatTile';
import StatTileRow from './baitly/StatTileRow';
import EmptyState from './EmptyState';
import FilterChipRow from './FilterChipRow';
import { useScreenSearch } from './ScreenChrome';
import { monitoringApi } from '../services/api/monitoringApi';
import { useMonitoringHeader } from '../modules/admin/MonitoringPage';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { activeIntlLocale } from '../utils/activeLocale';
import { MonitoringIntro, MonitoringPanel, MonitoringLoading, monitoringNumber, monitoringDate } from './monitoring/MonitoringSurface';

const toneFor = (status: string): StatusTone =>
  status === 'UP' ? 'ok' : status === 'DOWN' ? 'err' : status === 'DEGRADED' ? 'warn' : 'neutral';
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  DATABASE: <Storage size={20} />, CACHE: <Memory size={20} />, STORAGE: <Storage size={20} />,
  AUTHENTICATION: <Security size={20} />, API: <Speed size={20} />, NETWORK: <Wifi size={20} />,
  MONITORING: <HealthAndSafety size={20} />,
};

export default function HealthChecks() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { setHeaderActions, setHeaderLastUpdate } = useMonitoringHeader();
  const [filter, setFilter] = useState<'attention' | ''>('');
  const [search, setSearch] = useState('');
  useScreenSearch(search, setSearch, t('monitoringDesign.searchServices'));
  const { data, error, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['monitoring', 'health', user?.id, user?.organizationId], enabled: !!user, gcTime: 0, queryFn: monitoringApi.getHealth,
    refetchInterval: 30_000, refetchOnWindowFocus: false,
  });
  useEffect(() => {
    setHeaderActions(<Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}>
      <Refresh size={16} />{t('health.refresh')}
    </Button>);
    return () => setHeaderActions(null);
  }, [setHeaderActions, isFetching, refetch, t]);
  useEffect(() => {
    setHeaderLastUpdate(dataUpdatedAt ? new Date(dataUpdatedAt) : null);
  }, [setHeaderLastUpdate, dataUpdatedAt]);

  const checks = data?.services ?? [];
  const up = checks.filter(check => check.status === 'UP').length;
  const attention = checks.filter(check => check.status !== 'UP');
  const criticalIssues = attention.filter(check => check.critical);
  const unknown = checks.filter(check => !['UP', 'DOWN', 'DEGRADED'].includes(check.status)).length;
  const state = !checks.length || error ? 'UNKNOWN' :
    checks.some(check => check.status === 'DOWN') ? 'DOWN' :
    checks.some(check => check.status === 'DEGRADED') ? 'DEGRADED' : unknown ? 'UNKNOWN' : 'UP';
  const statusLabel = (status: string) => t('monitoringDesign.status.' + status, { defaultValue: status });
  const shown = (filter ? attention : checks).filter(check =>
    (check.name + ' ' + check.category).toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .sort((a, b) => {
      const priority = (s: string) => s === 'DOWN' ? 0 : s === 'DEGRADED' ? 1 : s === 'UNKNOWN' ? 2 : 3;
      return priority(a.status) - priority(b.status) || Number(b.critical) - Number(a.critical);
    });
  const metrics = data?.systemMetrics;
  const uptime = metrics && Number.isFinite(metrics.uptimeSeconds) ? [
    { value: Math.floor(metrics.uptimeSeconds / 86400), unit: 'day' },
    { value: Math.floor(metrics.uptimeSeconds % 86400 / 3600), unit: 'hour' },
    { value: Math.floor(metrics.uptimeSeconds % 3600 / 60), unit: 'minute' },
  ].filter(part => part.value > 0 || part.unit === 'minute')
    .map(part => part.value.toLocaleString(activeIntlLocale(), { style: 'unit', unit: part.unit, unitDisplay: 'short' })).join(' ') : '—';

  if (isLoading) return <MonitoringLoading label={t('monitoringDesign.loading')} />;
  return <div className="bui-monitor">
    <MonitoringIntro title={t('monitoringDesign.healthTitle')} description={t('monitoringDesign.healthDescription')}
      status={statusLabel(state)} tone={toneFor(state)} aside={t('monitoringDesign.every30s')} />
    {error && <Alert variant="destructive"><Info /><AlertDescription>
      {t('monitoring.healthFetchError')}{data ? ' ' + t('monitoringDesign.staleValues') : ''}
    </AlertDescription><AlertAction><Button size="sm" variant="outline" disabled={isFetching} onClick={() => void refetch()}>
      {t('common.retry')}</Button></AlertAction></Alert>}
    <StatTileRow compact>
      <StatTile icon={<HealthAndSafety />} label={t('monitoringDesign.availableServices')} value={data ? up + ' / ' + checks.length : '—'} />
      <StatTile icon={<Info />} label={t('monitoringDesign.toInspect')} value={data ? attention.length : '—'} />
      <StatTile icon={<Security />} label={t('monitoringDesign.criticalIssues')} value={data ? criticalIssues.length : '—'} />
      <StatTile icon={<Wifi />} label={t('monitoringDesign.unmeasured')} value={data ? unknown : '—'} />
    </StatTileRow>
    <div className="bui-monitor-columns">
      <MonitoringPanel title={t('monitoringDesign.dependencies')} description={t('monitoringDesign.dependenciesHint')}
        action={<FilterChipRow value={filter} onChange={setFilter} allLabel={t('monitoringDesign.allServices')}
          allCount={checks.length} options={[{ value: 'attention', label: t('monitoringDesign.toInspect'),
            color: 'var(--bui-warning-ink)', count: attention.length }]} />}>
        {shown.length === 0 ? <EmptyState icon={<HealthAndSafety />} variant="transparent" title={t('monitoringDesign.noServiceMatches')}
          description={checks.length ? t('monitoringDesign.changeFilters') : t('monitoringDesign.noHealthData')} /> :
          shown.map(check => <details key={check.name} className="bui-monitor-service" data-state={check.status}>
            <summary>
              <span className="bui-monitor-service__icon">{CATEGORY_ICONS[check.category] ?? <Info size={20} />}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium break-words">{check.name}</span>
                  {check.critical && <StatusChip tone="neutral" label={t('monitoringDesign.criticalService')} />}
                </div>
                <div className="bui-monitor-service__meta">
                  <span>{t('monitoringDesign.categories.' + check.category, { defaultValue: check.category })}</span>
                  <span className="tabular-nums">{check.status === 'UNKNOWN' ? '—' : monitoringNumber(check.responseTimeMs, activeIntlLocale()) + ' ms'}</span>
                </div>
              </div>
              <div className="bui-monitor-service__end">
                <StatusChip dot tone={toneFor(check.status)} label={statusLabel(check.status)} />
                <ExpandMore size={16} className="bui-monitor-service__chevron" />
              </div>
            </summary>
            <div className="bui-monitor-service__detail">
              <p className="font-mono">{check.details || t('monitoringDesign.noDetails')}</p>
              {check.lastCheck && <p className="mt-2 tabular-nums">{t('health.lastCheck')}{' '}
                {monitoringDate(check.lastCheck, activeIntlLocale())}</p>}
            </div>
          </details>)}
      </MonitoringPanel>
      <div className="min-w-0 space-y-4">
        <MonitoringPanel title={t('health.systemMetrics')} description={t('monitoringDesign.resourcesHint')}>
          {metrics ? <>
            {[
              { label: t('monitoringDesign.cpu'), value: metrics.cpuUsage },
              { label: t('monitoringDesign.memory'), value: metrics.memoryUsage,
                hint: monitoringNumber(metrics.heapUsedMb) + ' / ' + monitoringNumber(metrics.heapMaxMb) + ' MB' },
              { label: t('monitoringDesign.disk'), value: metrics.diskUsage },
            ].map(metric => <div key={metric.label} className="bui-monitor-resource"
              data-level={metric.value > 80 ? 'err' : metric.value > 60 ? 'warn' : 'neutral'}>
              <div className="bui-monitor-resource__line">
                <span className="text-muted-foreground">{metric.label}</span>
                <span className="bui-monitor-resource__value">{monitoringNumber(metric.value)} %</span>
              </div>
              {Number.isFinite(metric.value) && <Progress aria-label={metric.label}
                value={Math.max(0, Math.min(100, metric.value))} className="h-1.5" />}
              {metric.hint && <p className="mt-2 text-xs text-muted-foreground tabular-nums">{metric.hint}</p>}
            </div>)}
            <div className="flex justify-between gap-3 py-4 text-sm">
              <span className="text-muted-foreground">{t('monitoringDesign.processUptime')}</span>
              <span className="font-medium tabular-nums">{uptime}</span>
            </div>
          </> : <p className="py-6 text-sm text-muted-foreground">{t('monitoringDesign.noResourceData')}</p>}
        </MonitoringPanel>
        <p className="bui-monitor-muted-note">{t('monitoringDesign.healthReadingHint')}</p>
      </div>
    </div>
  </div>;
}
