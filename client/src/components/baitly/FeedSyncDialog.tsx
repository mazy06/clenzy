import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckIcon, ExternalLinkIcon, RefreshCwIcon, TriangleAlertIcon } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
} from '../ui';
import { iCalApi } from '../../services/api/iCalApi';
import { refreshActionQueue } from '../../services/api/actionItemsApi';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Baitly — relancer un calendrier muet, depuis la ligne qui le signale.
 *
 * <p>Un flux qui ne se synchronise plus est la première cause de double
 * réservation : le geste utile est de le relancer tout de suite, pas d'aller
 * chercher où il se règle. L'appel existait déjà côté service
 * (`POST /ical/feeds/{id}/sync`) sans qu'aucun écran ne l'expose.</p>
 */

export interface FeedSyncDialogProps {
  /** Flux à ouvrir. `null` ferme la modale. */
  feedId: number | null;
  onClose: () => void;
  feed?: {
    sourceName?: string | null;
    propertyName?: string | null;
    /** Heures depuis la dernière synchro réussie ; `null` = jamais. */
    hoursSinceLastSync?: number | null;
  };
  /** Clés react-query à invalider après relance. */
  invalidateKeys?: readonly (readonly unknown[])[];
}

export default function FeedSyncDialog({
  feedId,
  onClose,
  feed,
  invalidateKeys = [],
}: FeedSyncDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const sync = useMutation({
    mutationFn: () => iCalApi.syncFeed(feedId!),
    onSuccess: async () => {
      // La ligne traitée doit disparaître tout de suite : on demande le
      // recalcul de la file avant d'invalider les vues qui la lisent.
      await refreshActionQueue(
        (key) => queryClient.invalidateQueries({ queryKey: key }), invalidateKeys);
    },
  });

  // Sans remise à zéro, le résultat du flux précédent s'afficherait sur le suivant.
  React.useEffect(() => sync.reset(), [feedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const delay =
    feed?.hoursSinceLastSync == null
      ? t('dashboard.actionItems.neverSynced', 'jamais synchronisé')
      : t('dashboard.actionItems.lastSuccess', {
          hours: feed.hoursSinceLastSync,
          defaultValue: 'dernier succès il y a {{hours}} h',
        });

  return (
    <Dialog open={feedId != null} onOpenChange={(next) => !next && !sync.isPending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="pe-8">
            {feed?.sourceName ?? t('dashboard.actionItems.unnamedFeed', 'Flux sans nom')}
          </DialogTitle>
          <DialogDescription>
            {[feed?.propertyName, delay].filter(Boolean).join(' · ')}
          </DialogDescription>
        </DialogHeader>

        {sync.isSuccess && (
          <Alert>
            <CheckIcon />
            <AlertDescription>
              {t('dashboard.feedDialog.synced', 'Synchronisation relancée.')}
            </AlertDescription>
          </Alert>
        )}

        {sync.isError && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>
              {t(
                'dashboard.feedDialog.failed',
                'La synchronisation a échoué. Le flux est peut-être inaccessible.',
              )}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onClose();
              navigate('/channels');
            }}
          >
            <ExternalLinkIcon />
            {t('dashboard.actionItems.seeChannels', 'Voir les canaux')}
          </Button>

          <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
            {sync.isPending ? <Spinner /> : <RefreshCwIcon />}
            {t('dashboard.feedDialog.retry', 'Relancer la synchronisation')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
