import React from 'react';
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
  Card,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, ShieldAlert, Layers, Clock, Check, CheckCheck, Info, TriangleAlert, CircleAlert } from 'lucide-react';
import { rlsAuditApi } from '../services/api/rlsAuditApi';
import type { RlsAuditFinding } from '../services/api/rlsAuditApi';
import StatTile from './baitly/StatTile';
import StatusChip from './StatusChip';
import EmptyState from './EmptyState';
import { activeIntlLocale } from '../utils/activeLocale';
import { useTranslation } from '../hooks/useTranslation';

/** Teintes Baitly UI des icones de tuile (classes utilitaires). */
const VERT = 'text-success';
const AMBRE = 'text-warning';
const ROUGE = 'text-destructive';
const BLEU = 'text-info';

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
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['rls-audit'],
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
          {(error as { message?: string }).message ?? t('common.unexpectedLoadError')}
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

  return (
    <div>
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

      <div className="grid grid-cols-12 gap-3 mb-[18px]">
        <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
          <StatTile
            icon={ouverts.length === 0 ? <ShieldCheck /> : <ShieldAlert />}
            label={t('rlsAudit.pathsToHandle')}
            value={isLoading ? '—' : ouverts.length + enAttente}
            iconClassName={ouverts.length + enAttente === 0 ? VERT : ROUGE}
            loading={isLoading}
            hint={
              ouverts.length + enAttente === 0
                ? t('rlsAudit.activationReady')
                : enAttente > 0 && ouverts.length === 0
                  ? t('rlsAudit.detectedNotWritten', { count: enAttente })
                  : t('rlsAudit.cannotActivate')
            }
          />
        </div>
        <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
          <StatTile
            icon={<Check />}
            label={t('rlsAudit.pathsHandled')}
            value={isLoading ? '—' : traites.length}
            iconClassName={VERT}
            loading={isLoading}
            hint={t('rlsAudit.pathsHandledHint')}
          />
        </div>
        <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
          <StatTile
            icon={<Clock />}
            label={t('rlsAudit.oldestFinding')}
            value={plusAncien ? `${joursDepuis(plusAncien.firstSeenAt)} j` : '—'}
            iconClassName={AMBRE}
            loading={isLoading}
            hint={t('rlsAudit.oldestFindingHint')}
          />
        </div>
        <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3">
          <StatTile
            icon={<Layers />}
            label={t('rlsAudit.awaitingWrite')}
            value={isLoading ? '—' : enAttente}
            iconClassName={BLEU}
            loading={isLoading}
            hint={t('rlsAudit.awaitingWriteHint')}
          />
        </div>
      </div>

      <Card>
        <CardContent>
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h6 className="text-sm font-semibold text-foreground mb-0.5">
                {t('rlsAudit.noContextPaths')}
              </h6>
              <p className="text-xs text-muted-foreground">
                {t('rlsAudit.noContextPathsBody')}
              </p>
            </div>
            {/* Un correctif structurel rend tout l'inventaire caduc d'un coup : le fermer
                ligne a ligne ferait cliquer sans lire. Le bouton n'apparait que s'il y a
                quelque chose a fermer. */}
            {ouverts.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={marquerTousTraites.isPending}
                onClick={() => setConfirmerFermetureEnMasse(true)}
              >
                <CheckCheck />
                {t('rlsAudit.markAllHandled')}
              </Button>
            )}
          </div>

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

          {!isLoading && ouverts.length === 0 && traites.length === 0 && enAttente === 0 ? (
            <EmptyState
              icon={<ShieldCheck />}
              title={t('rlsAudit.empty')}
              description={t(data?.mesureExploitable
                ? 'rlsAudit.emptyMeaningful'
                : 'rlsAudit.emptyWorthless')}
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
                  {[...ouverts, ...traites].map((chemin: RlsAuditFinding) => {
                    const reapparu =
                      chemin.resolvedAt !== null && chemin.lastSeenAt > chemin.resolvedAt;
                    return (
                      <TableRow key={chemin.id}>
                        <TableCell className="font-mono text-[0.8125rem]">
                          {/* Sans extrait SQL il n'y a rien a survoler : le Tooltip du kit
                              afficherait une bulle vide la ou MUI n'en montrait aucune. */}
                          {chemin.sqlExcerpt ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>{chemin.origin}</span>
                              </TooltipTrigger>
                              <TooltipContent side="top" align="start">
                                {chemin.sqlExcerpt}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span>{chemin.origin}</span>
                          )}
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
        </CardContent>
      </Card>

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
