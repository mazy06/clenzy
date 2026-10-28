import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AlertAction, AlertDescription, Avatar, AvatarFallback, AvatarImage, Button } from './ui';
import { Refresh, Delete, CheckCircle, Warning, ContentCopy, Storage, TrendingUp, Info } from '../icons';
import StatusChip, { type StatusTone } from './StatusChip';
import StatTile from './baitly/StatTile';
import StatTileRow from './baitly/StatTileRow';
import TokenService, { type TokenStats, type TokenMetrics } from '../services/TokenService';
import { useMonitoringHeader } from '../modules/admin/MonitoringPage';
import { useAuth } from '../hooks/useAuth';
import { userAvatarSrc } from '../services/api/usersApi';
import { activeIntlLocale } from '../utils/activeLocale';
import { parseApiDate } from '../utils/formatUtils';
import { useTranslation } from '../hooks/useTranslation';
import { MonitoringIntro, MonitoringPanel, MonitoringValueRow, monitoringNumber } from './monitoring/MonitoringSurface';

function duration(seconds: number, expired: string) {
  if (seconds <= 0) return expired;
  const minutes = Math.floor(seconds / 60);
  const unit = (value: number, kind: string) => value.toLocaleString(activeIntlLocale(), { style: 'unit', unit: kind, unitDisplay: 'short' });
  return minutes >= 60 ? unit(Math.floor(minutes / 60), 'hour') + ' ' + unit(minutes % 60, 'minute')
    : unit(minutes, 'minute') + ' ' + unit(seconds % 60, 'second');
}

export default function TokenMonitoring() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [stats, setStats] = useState<TokenStats | null>(null);
  const [metrics, setMetrics] = useState<TokenMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [, tick] = useState(0);
  const service = TokenService.getInstance();
  const { setHeaderActions, setHeaderLastUpdate } = useMonitoringHeader();
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [nextStats, nextMetrics] = await Promise.all([service.getBackendTokenStats(), service.getBackendTokenMetrics()]);
      if (nextStats) setStats(nextStats);
      if (nextMetrics) setMetrics(nextMetrics);
      if (nextStats && nextMetrics) setHeaderLastUpdate(new Date());
      else setError(t('tokens.statsError'));
    } catch { setError(t('tokens.statsError')); }
    finally { setLoading(false); }
  }, [service, setHeaderLastUpdate, t]);
  const cleanup = useCallback(async () => {
    setLoading(true);
    try {
      const result = await service.cleanupExpiredTokens();
      if (result.success) await load(); else setError(t('tokens.cleanupError'));
    } catch { setError(t('tokens.cleanupError')); }
    finally { setLoading(false); }
  }, [service, load, t]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const id = window.setInterval(() => { if (!document.hidden) tick(value => value + 1); }, 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    setHeaderActions(<div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}><Refresh size={16} />{t('health.refresh')}</Button>
      <Button size="sm" variant="ghost" className="text-warning-ink hover:bg-warning-soft"
        disabled={loading} onClick={() => void cleanup()}><Delete size={16} />{t('tokenMonitoring.cleanExpired')}</Button>
    </div>);
    return () => setHeaderActions(null);
  }, [setHeaderActions, load, cleanup, loading, t]);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(id);
  }, [copied]);

  const current = service.getCurrentTokenInfo();
  const seconds = current.timeUntilExpiry ?? 0;
  const tone: StatusTone = !current.isAuthenticated ? 'neutral' : seconds <= 0 ? 'err' : seconds < 300 ? 'warn' : 'ok';
  const label = !current.isAuthenticated ? t('tokens.notAuthenticated') : seconds <= 0 ? t('tokens.expired')
    : seconds < 300 ? t('tokens.expiringSoon') : t('tokens.authenticated');
  const initials = (current.username || current.email || '?').split(/[\s.]+/).filter(Boolean)
    .map(word => word[0]).slice(0, 2).join('').toUpperCase();
  const number = (n: number | null | undefined) => monitoringNumber(n, activeIntlLocale());
  const lastRefresh = metrics?.lastRefresh && metrics.lastRefresh !== 'N/A' ? parseApiDate(metrics.lastRefresh) : null;
  const active = stats?.activeTokens ?? 0;
  const expired = stats?.expiredTokens ?? 0;
  const partitioned = active + expired;
  const copyId = async () => {
    if (!current.userId) return;
    try { await navigator.clipboard.writeText(current.userId); setCopied(true); }
    catch { setError(t('monitoringDesign.copyFailed')); }
  };

  return <div className="bui-monitor">
    <MonitoringIntro title={t('monitoringDesign.tokensTitle')} description={t('monitoringDesign.tokensDescription')}
      status={error ? t('monitoringDesign.staleSnapshot') : undefined} />
    {error && <Alert variant="destructive"><Info /><AlertDescription>{error}</AlertDescription>
      <AlertAction><Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>{t('common.retry')}</Button></AlertAction>
    </Alert>}
    <MonitoringPanel title={t('monitoringDesign.currentSession')} action={<StatusChip dot tone={tone} label={label} />}
      contentClassName="!p-0">
      {current.isAuthenticated ? <div className="bui-monitor-session">
        <Avatar className="size-12 rounded-lg"><AvatarImage src={userAvatarSrc(user)} alt={current.username || ''} />
          <AvatarFallback className="rounded-lg bg-muted text-base font-semibold text-foreground">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold break-words">{current.username || t('monitoringDesign.currentAccount')}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{current.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {current.roles?.map(role => <StatusChip key={role} tone="neutral" label={role} />)}
            {current.userId && <Button variant="ghost" size="icon-sm" onClick={() => void copyId()} aria-label={copied ? t('common.copied') : t('tokens.copyFullId')}>
              {copied ? <CheckCircle size={15} /> : <ContentCopy size={15} />}
            </Button>}
          </div>
        </div>
        <div className="bui-monitor-session__expiry">
          <p className="text-xs text-muted-foreground">{t('monitoringDesign.expiresIn')}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums" style={{ color: tone === 'err'
            ? 'var(--bui-destructive-ink)' : tone === 'warn' ? 'var(--bui-warning-ink)' : 'var(--bui-foreground)' }}>
            {duration(seconds, t('tokens.expired'))}
          </p>
          {current.expiresAt && <time dateTime={current.expiresAt} className="mt-1 block text-xs text-muted-foreground tabular-nums">
            {new Date(current.expiresAt).toLocaleString(activeIntlLocale())}</time>}
        </div>
      </div> : <p className="p-5 text-sm text-muted-foreground">{t('tokenMonitoring.noToken')}</p>}
    </MonitoringPanel>
    <StatTileRow compact>
      <StatTile icon={<Storage />} label={t('tokenMonitoring.totalTokens')} value={number(stats?.totalTokens)} loading={loading && !stats} />
      <StatTile icon={<CheckCircle />} label={t('monitoringDesign.activeTokens')} value={number(stats?.activeTokens)} loading={loading && !stats} />
      <StatTile icon={<Warning />} label={t('tokenMonitoring.expiredTokens')} value={number(stats?.expiredTokens)} loading={loading && !stats} />
      <StatTile icon={<TrendingUp />} label={t('tokenMonitoring.successRate')} value={stats?.successRate ?? '—'} loading={loading && !stats} />
    </StatTileRow>
    <div className="bui-monitor-columns">
      <MonitoringPanel title={t('tokenMonitoring.refreshMetrics')} description={t('tokenMonitoring.refreshMetricsHint')}>
        <dl>
          <MonitoringValueRow label={t('tokenMonitoring.refreshes')} value={number(metrics?.refreshCount)} />
          <MonitoringValueRow label={t('monitoringDesign.refreshErrors')} value={number(metrics?.errorCount)}
            tone={metrics && metrics.errorCount > 0 ? 'warn' : 'neutral'} />
          <MonitoringValueRow label={t('monitoringDesign.averageRefresh')} value={metrics ? number(metrics.averageRefreshTime) + ' ms' : '—'} />
          <MonitoringValueRow label={t('monitoringDesign.lastRefresh')} value={lastRefresh && Number.isFinite(lastRefresh.getTime())
            ? lastRefresh.toLocaleString(activeIntlLocale()) : '—'} />
        </dl>
      </MonitoringPanel>
      <MonitoringPanel title={t('tokenMonitoring.distribution')} description={t('monitoringDesign.distributionHint')}>
        {stats && partitioned > 0 ? <div className="py-5">
          <div className="bui-monitor-segment" role="img" aria-label={t('monitoringDesign.tokenDistribution', { active, expired })}>
            <span style={{ width: (active / partitioned * 100) + '%', backgroundColor: 'var(--bui-success)' }} />
            <span style={{ width: (expired / partitioned * 100) + '%', backgroundColor: 'var(--bui-warning)' }} />
          </div>
          <dl className="mt-2">
            <MonitoringValueRow label={t('monitoringDesign.activeTokens')} value={number(active)} />
            <MonitoringValueRow label={t('tokenMonitoring.expiredTokens')} value={number(expired)} tone={expired > 0 ? 'warn' : 'neutral'} />
          </dl>
          <p className="bui-monitor-muted-note mt-2">{t('monitoringDesign.expiredHint')}</p>
        </div> : <p className="py-6 text-sm text-muted-foreground">{loading ? t('monitoringDesign.loading') : t('tokenMonitoring.awaitingData')}</p>}
      </MonitoringPanel>
    </div>
  </div>;
}
