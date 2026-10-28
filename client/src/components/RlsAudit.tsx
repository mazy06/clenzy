import React, { useEffect, useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertTitle,
  Badge,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from './ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, ShieldAlert, Layers, Clock, Check, CheckCheck, Info, TriangleAlert, CircleAlert } from '../icons/glyphs';
import { rlsAuditApi } from '../services/api/rlsAuditApi';
import type { RlsAuditFinding } from '../services/api/rlsAuditApi';
import StatTile from './baitly/StatTile';
import StatTileRow from './baitly/StatTileRow';
import FilterChipRow from './FilterChipRow';
import { useScreenSearch } from './ScreenChrome';
import { useMonitoringHeader } from '../modules/admin/MonitoringPage';
import { MonitoringIntro, MonitoringPanel, MonitoringLoading } from './monitoring/MonitoringSurface';
import StatusChip from './StatusChip';
import EmptyState from './EmptyState';
import { activeIntlLocale } from '../utils/activeLocale';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';

const dateCourte = (iso: string) =>
  new Date(iso).toLocaleDateString(activeIntlLocale(), {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const joursDepuis = (iso: string) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

/**
 * Inventaire des chemins echappant a la Row-Level Security — audit securite 2026-07-26,
 * plan REM-T-01.
 *
 * Remplace un releve manuel qu'il fallait penser a lancer. L'ecran repond a une seule
 * question : peut-on activer la RLS sans vider les ecrans ?
 */
const RlsAudit: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['rls-audit', user?.id, user?.organizationId],
    enabled: !!user, gcTime: 0,
    queryFn: rlsAuditApi.etat,
    refetchInterval: 60_000,
  });

  const marquerTraite = useMutation({
    mutationFn: rlsAuditApi.marquerTraite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rls-audit'] }),
  });

  const marquerTousTraites = useMutation({
    mutationFn: rlsAuditApi.marquerTousTraites,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rls-audit'] }),
  });

  const [confirmerFermetureEnMasse, setConfirmerFermetureEnMasse] = React.useState(false);

  const [view, setView] = useState<'open' | 'resolved' | ''>('');
  const [search, setSearch] = useState('');
  const { setHeaderActions, setHeaderLastUpdate } = useMonitoringHeader();
  useScreenSearch(search, setSearch, t('monitoringDesign.searchPaths'));
  useEffect(() => {
    setHeaderActions(<Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}>
      {t('health.refresh')}</Button>);
    return () => setHeaderActions(null);
  }, [setHeaderActions, isFetching, refetch, t]);
  useEffect(() => { setHeaderLastUpdate(dataUpdatedAt ? new Date(dataUpdatedAt) : null); }, [setHeaderLastUpdate, dataUpdatedAt]);
  if (isLoading) return <MonitoringLoading label={t('monitoringDesign.loading')} />;

  if (error) {
    // Distinguer les causes : un message unique ferait chercher au mauvais endroit.
    // Un 404 signifie que le backend ne connait pas encore cette route — cas frequent en
    // developpement, ou le front recharge a chaud pendant que le serveur tourne un build
    // anterieur.
    const status = (error as { status?: number }).status;
    if (status === 404) {
      return (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>{t('rlsAudit.staleBackend')}</AlertTitle>
          <AlertDescription>
            {t('rlsAudit.unknownEndpoint')} <code>/api/admin/rls-audit</code>.{' '}
            {t('rlsAudit.staleBackendBody')}
          </AlertDescription>
        </Alert>
      );
    }
    if (status === 403) {
      return (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>{t('rlsAudit.accessReserved')}</AlertTitle>
          <AlertDescription>
            {t('rlsAudit.platformOnly')}
          </AlertDescription>
        </Alert>
      );
    }
    return (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>{t('rlsAudit.inventoryUnavailable')}</AlertTitle>
        <AlertDescription>
          {t('common.unexpectedLoadError')}
        </AlertDescription>
      </Alert>
    );
  }

  const enAttente = data?.enAttente ?? 0;
  const ouverts = data?.chemins.filter((c) => !c.resolvedAt) ?? [];
  const traites = data?.chemins.filter((c) => c.resolvedAt) ?? [];
  const plusAncien = ouverts.length
    ? ouverts.reduce((a, b) => (a.firstSeenAt < b.firstSeenAt ? a : b))
    : null;

  const inventoryUsable = !!data?.auditActif && !!data.mesureExploitable && !data.sature;
  const shown = (view === 'open' ? ouverts : view === 'resolved' ? traites : [...ouverts, ...traites])
    .filter(item => (item.origin + ' ' + item.tableName).toLocaleLowerCase().includes(search.toLocaleLowerCase()));

  return (
    <div className="bui-monitor">
      <MonitoringIntro title={t('monitoringDesign.rlsTitle')} description={t('monitoringDesign.rlsDescription')}
        status={t(inventoryUsable ? 'monitoringDesign.inventoryMeasured' : 'monitoringDesign.inventoryToConfirm')}
        tone={inventoryUsable ? 'neutral' : 'warn'} />
      {/* Le drapeau le plus important de l'ecran : sans lui, on lirait un inventaire
          trompeur comme un vrai constat. */}
      {data && data.auditActif && !data.mesureExploitable && (
        <Alert variant="destructive" className="mb-[18px]">
          <CircleAlert />
          <AlertTitle>{t('rlsAudit.worthless')}</AlertTitle>
          <AlertDescription>
            {t('rlsAudit.aspectInactive')}<code>clenzy.security.rls.enabled=false</code>{t('rlsAudit.aspectInactiveTail')}{' '}
            {t('rlsAudit.aspectInactiveBody')} <code>true</code>{t('rlsAudit.aspectInactiveEnd')}
          </AlertDescription>
        </Alert>
      )}

      {data && !data.auditActif && (
        <Alert variant="info" className="mb-[18px]">
          <Info />
          <AlertTitle>{t('rlsAudit.measurementStopped')}</AlertTitle>
          <AlertDescription>
            {t('rlsAudit.disabled')}
          </AlertDescription>
        </Alert>
      )}

      {data?.sature && (
        <Alert variant="warning" className="mb-[18px]">
          <TriangleAlert />
          <AlertTitle>{t('rlsAudit.incompleteInventory')}</AlertTitle>
          <AlertDescription>
            {t('rlsAudit.incompleteInventoryBody')}
          </AlertDescription>
        </Alert>
      )}

      {data?.rlsDejaActive && (
        <Alert variant="warning" className="mb-[18px]">
          <TriangleAlert />
          <AlertTitle>{t('rlsAudit.rlsActive')}</AlertTitle>
          <AlertDescription>
            {t('rlsAudit.rlsActiveHint')} <strong>{t('rlsAudit.already')}</strong>{t('rlsAudit.priority')}
          </AlertDescription>
        </Alert>
      )}

      {enAttente > 0 && (
        <Alert variant="warning" className="mb-[18px]">
          <TriangleAlert />
          <AlertTitle>{t('rlsAudit.pendingWrites', { count: enAttente })}</AlertTitle>
          <AlertDescription>
            {t('rlsAudit.pendingWritesBody')}
          </AlertDescription>
        </Alert>
      )}

      <StatTileRow compact>
        <StatTile icon={<ShieldAlert />} label={t('rlsAudit.pathsToHandle')} value={ouverts.length + enAttente}
          hint={inventoryUsable ? t('rlsAudit.cannotActivate') : t('monitoringDesign.inventoryToConfirm')} />
        <StatTile icon={<Check />} label={t('rlsAudit.pathsHandled')} value={traites.length} />
        <StatTile icon={<Clock />} label={t('rlsAudit.oldestFinding')}
          value={plusAncien ? Math.max(0, joursDepuis(plusAncien.firstSeenAt)).toLocaleString(activeIntlLocale(), { style: 'unit', unit: 'day', unitDisplay: 'short' }) : '—'} />
        <StatTile icon={<Layers />} label={t('rlsAudit.awaitingWrite')} value={enAttente} />
      </StatTileRow>

      <MonitoringPanel title={t('rlsAudit.noContextPaths')} description={t('rlsAudit.noContextPathsBody')}
        action={ouverts.length > 0 ? <Button variant="outline" size="sm" disabled={marquerTousTraites.isPending}
          onClick={() => setConfirmerFermetureEnMasse(true)}><CheckCheck />{t('rlsAudit.markAllHandled')}</Button> : undefined}>
        <div className="py-3">
          <FilterChipRow value={view} onChange={setView} allLabel={t('auditLog.all')} allCount={ouverts.length + traites.length}
            options={[
              { value: 'open', label: t('rlsAudit.pathsToHandle'), count: ouverts.length, color: 'var(--bui-warning-ink)' },
              { value: 'resolved', label: t('rlsAudit.pathsHandled'), count: traites.length, color: 'var(--bui-success-ink)' },
            ]} />
        </div>
        {(marquerTraite.isError || marquerTousTraites.isError) && <Alert variant="destructive" className="mb-3">
          <CircleAlert /><AlertDescription>{t('monitoringDesign.resolveError')}</AlertDescription>
        </Alert>}

          {/* Ce que la fermeture n'a pas couvert. Sans ce rappel, les constats arrives en
              retard reapparaitraient etiquetes « reapparu apres correction » — un faux
              signal de regression. */}
          {marquerTousTraites.isSuccess && marquerTousTraites.data.enAttente > 0 && (
            <Alert variant="warning" className="mb-3">
              <TriangleAlert />
              <AlertTitle>
                {t('rlsAudit.partialClose', {
                  closed: marquerTousTraites.data.traites,
                  pending: marquerTousTraites.data.enAttente,
                })}
              </AlertTitle>
              <AlertDescription>
                {t('rlsAudit.partialCloseBody')}
              </AlertDescription>
            </Alert>
          )}

          {shown.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck />}
              variant="transparent" title={t(ouverts.length + traites.length === 0 ? 'rlsAudit.empty' : 'monitoringDesign.noPathMatches')}
              description={t(ouverts.length + traites.length > 0 ? 'monitoringDesign.changeFilters' : inventoryUsable ? 'rlsAudit.emptyMeaningful' : 'rlsAudit.emptyWorthless')}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('rlsAudit.columns.origin')}</TableHead>
                    <TableHead>{t('rlsAudit.columns.table')}</TableHead>
                    <TableHead className="text-end">{t('rlsAudit.columns.occurrences')}</TableHead>
                    <TableHead>{t('rlsAudit.columns.firstSeen')}</TableHead>
                    <TableHead>{t('rlsAudit.columns.lastSeen')}</TableHead>
                    <TableHead className="text-end">{t('rlsAudit.columns.action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((chemin: RlsAuditFinding) => {
                    const reapparu =
                      chemin.resolvedAt !== null && chemin.lastSeenAt > chemin.resolvedAt;
                    return (
                      <TableRow key={chemin.id}>
                        <TableCell className="font-mono text-[0.8125rem]">
                          {/* Le détail reste accessible au clavier et au toucher. */}
                          {chemin.sqlExcerpt ? <details>
                            <summary className="cursor-pointer break-words rounded-sm focus-visible:outline-2 focus-visible:outline-ring">
                              {chemin.origin}
                            </summary>
                            <code className="mt-2 block max-w-[48ch] whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">
                              {chemin.sqlExcerpt}
                            </code>
                          </details> : <span className="break-words">{chemin.origin}</span>}
                          {reapparu && (
                            <StatusChip tone="warn" label={t('rlsAudit.reappeared')} className="ms-1.5" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{chemin.tableName}</Badge>
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {chemin.occurrences.toLocaleString(activeIntlLocale())}
                        </TableCell>
                        <TableCell className="tabular-nums whitespace-nowrap">
                          {dateCourte(chemin.firstSeenAt)}
                        </TableCell>
                        <TableCell className="tabular-nums whitespace-nowrap">
                          {dateCourte(chemin.lastSeenAt)}
                        </TableCell>
                        <TableCell className="text-end">
                          {chemin.resolvedAt && !reapparu ? (
                            <StatusChip tone="ok" label={t('rlsAudit.handled')} />
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={marquerTraite.isPending}
                              onClick={() => marquerTraite.mutate(chemin.id)}
                            >
                              {t('rlsAudit.markHandled')}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
      </MonitoringPanel>

      <AlertDialog open={confirmerFermetureEnMasse} onOpenChange={setConfirmerFermetureEnMasse}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('rlsAudit.confirmBulkTitle', { count: ouverts.length })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('rlsAudit.confirmBulkBody')}
              {enAttente > 0 && (
                <>
                  {' '}
                  <strong>{t('rlsAudit.confirmBulkPending', { count: enAttente })}</strong>{' '}
                  {t('rlsAudit.confirmBulkFlush')}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => marquerTousTraites.mutate()}>
              {t('rlsAudit.markAllHandled')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RlsAudit;
