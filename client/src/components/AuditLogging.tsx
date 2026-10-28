import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertAction, Button, Field, FieldLabel, NativeSelect, NativeSelectOption } from './ui';
import { Info, Security, Lock, Refresh, Clear, CheckCircle, Warning, Visibility, AdminPanelSettings, VpnKey } from '../icons';
import StatusChip, { type StatusTone } from './StatusChip';
import StatTile from './baitly/StatTile';
import StatTileRow from './baitly/StatTileRow';
import PagePagination from './PagePagination';
import EmptyState from './EmptyState';
import { useScreenSearch } from './ScreenChrome';
import { useMonitoringHeader } from '../modules/admin/MonitoringPage';
import { monitoringApi } from '../services/api/monitoringApi';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { activeIntlLocale } from '../utils/activeLocale';
import { MonitoringIntro, MonitoringPanel, MonitoringLoading, monitoringDate } from './monitoring/MonitoringSurface';

const PAGE_SIZE = 15;
const EVENT_KEYS: Record<string, string> = {
  LOGIN_SUCCESS: 'auditLog.loginSuccess', LOGIN_FAILURE: 'auditLog.loginFailure',
  PERMISSION_DENIED: 'auditLog.accessDenied', DATA_ACCESS: 'auditLog.dataAccess',
  ADMIN_ACTION: 'monitoringDesign.adminAction', SECRET_ROTATION: 'auditLog.secretRotation',
  SUSPICIOUS_ACTIVITY: 'auditLog.suspicious',
};
const EVENT_ICONS: Record<string, React.ReactNode> = {
  LOGIN_SUCCESS: <CheckCircle size={18} />, LOGIN_FAILURE: <Warning size={18} />,
  PERMISSION_DENIED: <Lock size={18} />, DATA_ACCESS: <Visibility size={18} />,
  ADMIN_ACTION: <AdminPanelSettings size={18} />, SECRET_ROTATION: <VpnKey size={18} />,
};
const resultTone = (result: string): StatusTone =>
  ['DENIED', 'ERROR'].includes(result.toUpperCase()) ? 'err' : result.toUpperCase() === 'SUCCESS' ? 'ok' : 'neutral';

export default function AuditLogging() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [eventType, setEventType] = useState('');
  const [result, setResult] = useState('');
  const [actorId, setActorId] = useState('');
  const [page, setPage] = useState(0);
  const { setHeaderActions, setHeaderLastUpdate } = useMonitoringHeader();
  useScreenSearch(actorId, value => { setActorId(value); setPage(0); }, t('monitoringDesign.searchActor'));
  const query = useQuery({
    queryKey: ['monitoring', 'audit', user?.id, user?.organizationId, page, eventType, result, actorId],
    enabled: !!user, gcTime: 0,
    queryFn: () => monitoringApi.getAuditLogs({ page, size: PAGE_SIZE, sort: 'createdAt,desc',
      ...(eventType ? { eventType } : {}), ...(result ? { result } : {}), ...(actorId ? { actorId } : {}) }),
  });
  const { refetch, isFetching, dataUpdatedAt } = query;
  useEffect(() => {
    setHeaderActions(<Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}>
      <Refresh size={16} />{t('auditLog.refresh')}</Button>);
    return () => setHeaderActions(null);
  }, [setHeaderActions, refetch, isFetching, t]);
  useEffect(() => { setHeaderLastUpdate(dataUpdatedAt ? new Date(dataUpdatedAt) : null); }, [setHeaderLastUpdate, dataUpdatedAt]);
  const reset = () => { setEventType(''); setResult(''); setActorId(''); setPage(0); };
  const logs = query.data?.content ?? [];
  const failures = logs.filter(log => ['ERROR', 'DENIED'].includes(log.result?.toUpperCase())).length;
  const eventLabel = (type: string) => EVENT_KEYS[type] ? t(EVENT_KEYS[type]) : type.replace(/_/g, ' ');

  if (query.isLoading && page === 0 && !eventType && !result && !actorId)
    return <MonitoringLoading label={t('monitoringDesign.loading')} />;
  return <div className="bui-monitor">
    <MonitoringIntro title={t('monitoringDesign.auditTitle')} description={t('monitoringDesign.auditDescription')} />
    {query.error && <Alert variant="destructive"><Info /><AlertDescription>{t('monitoringDesign.auditError')}</AlertDescription>
      <AlertAction><Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}>{t('common.retry')}</Button></AlertAction></Alert>}
    <StatTileRow compact>
      <StatTile icon={<Security />} label={t('monitoringDesign.filteredEvents')} value={query.data?.totalElements ?? '—'} />
      <StatTile icon={<Info />} label={t('monitoringDesign.eventsOnPage')} value={query.data ? logs.length : '—'} />
      <StatTile icon={<Lock />} label={t('monitoringDesign.failuresOnPage')} value={query.data ? failures : '—'} />
    </StatTileRow>
    <MonitoringPanel title={t('monitoringDesign.activityLog')} description={t('monitoringDesign.newestFirst')}>
      <div className="bui-monitor-toolbar">
        <Field className="w-full sm:w-64"><FieldLabel htmlFor="audit-event-type">{t('auditLog.eventType')}</FieldLabel>
          <NativeSelect id="audit-event-type" className="w-full" value={eventType}
            onChange={e => { setEventType(e.target.value); setPage(0); }}>
            <NativeSelectOption value="">{t('auditLog.all')}</NativeSelectOption>
            {Object.keys(EVENT_KEYS).map(type => <NativeSelectOption key={type} value={type}>{eventLabel(type)}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field className="w-full sm:w-48"><FieldLabel htmlFor="audit-result">{t('auditLog.result')}</FieldLabel>
          <NativeSelect id="audit-result" className="w-full" value={result} onChange={e => { setResult(e.target.value); setPage(0); }}>
            <NativeSelectOption value="">{t('auditLog.all')}</NativeSelectOption>
            <NativeSelectOption value="SUCCESS">{t('auditLog.success')}</NativeSelectOption>
            <NativeSelectOption value="DENIED">{t('auditLog.denied')}</NativeSelectOption>
            <NativeSelectOption value="ERROR">{t('auditLog.error')}</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Button variant="ghost" size="sm" disabled={!eventType && !result && !actorId} onClick={reset}>
          <Clear size={16} />{t('monitoringDesign.resetFilters')}</Button>
      </div>
      {query.isLoading ? <p role="status" className="py-8 text-sm text-muted-foreground">{t('monitoringDesign.loading')}</p>
        : !query.error && logs.length === 0 ? <EmptyState icon={<Security />} title={t('auditLog.empty')}
          variant="transparent" description={t('monitoringDesign.noAuditMatches')}
          action={(eventType || result || actorId) ? <Button variant="outline" size="sm" onClick={reset}>{t('monitoringDesign.resetFilters')}</Button> : undefined} />
        : <ol className="bui-monitor-events">{logs.map(log => <li key={log.id} className="bui-monitor-event">
          <span className="bui-monitor-event__icon" style={{ color: resultTone(log.result ?? '') === 'err'
            ? 'var(--bui-destructive-ink)' : 'var(--bui-muted-foreground)' }}>
            {EVENT_ICONS[log.eventType] ?? <Info size={18} />}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 text-sm font-medium break-words">{log.action || eventLabel(log.eventType)}</p>
              <time dateTime={log.timestamp} className="text-xs text-muted-foreground tabular-nums">
                {monitoringDate(log.timestamp, activeIntlLocale())}</time>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusChip tone="neutral" label={eventLabel(log.eventType)} />
              {log.result && <StatusChip tone={resultTone(log.result)}
                label={t('monitoringDesign.results.' + log.result.toUpperCase(), { defaultValue: log.result })} />}
            </div>
            <details className="mt-3">
              <summary className="w-fit cursor-pointer rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                {t('monitoringDesign.eventDetails')}</summary>
              <div className="bui-monitor-event__metadata">
                {log.details && <p className="w-full text-foreground">{log.details}</p>}
                {log.actorEmail && <p><span className="font-medium">{t('monitoringDesign.actor')}{' : '}</span>{log.actorEmail}</p>}
                {log.actorIp && <p className="font-mono">IP : {log.actorIp}</p>}
                {!log.details && !log.actorEmail && !log.actorIp && <p>{t('monitoringDesign.noDetails')}</p>}
              </div>
            </details>
          </div>
        </li>)}</ol>}
      {!!query.data?.totalElements && <div className="border-t border-border py-4">
        <PagePagination count={query.data.totalElements} totalPages={query.data.totalPages}
          page={page} rowsPerPage={PAGE_SIZE} onPageChange={setPage} hideOnSinglePage={false}
          labels={{ previous: t('pagination.previous'), next: t('pagination.next'),
            range: (from, to, count) => t('pagination.range', { from, to, count }) }} />
      </div>}
    </MonitoringPanel>
  </div>;
}
