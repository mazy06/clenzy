import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckIcon, SendHorizonalIcon, TriangleAlertIcon } from 'lucide-react';
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
import { actionItemsApi, refreshActionQueue } from '../../services/api/actionItemsApi';
import type { DashboardActionItem } from '../../services/api/dashboardOperationsApi';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Baitly — relancer un envoi qui n'est jamais arrivé.
 *
 * <p>Une facture générée mais non délivrée, un message voyageur en échec : le
 * document existe de notre côté, numéroté et archivé, et le destinataire n'a
 * rien reçu. On ne l'apprend d'ordinaire qu'au moment où il le réclame.</p>
 *
 * <p>Un seul geste est attendu — réessayer — et il se fait ici. L'envoyer
 * chercher l'écran des documents supposait qu'il sache déjà lequel a échoué,
 * c'est-à-dire qu'il sache déjà ce que cette carte lui apprend.</p>
 *
 * <p>Le succès n'est pas annoncé à la légère : on affiche que l'envoi est
 * reparti, pas qu'il est arrivé. La ligne disparaîtra d'elle-même si la
 * livraison aboutit — et restera s'il échoue encore, ce qui est l'information
 * utile.</p>
 */

export interface RetryDeliveryDialogProps {
  /** Action à relancer. `null` ferme la modale. */
  item: DashboardActionItem | null;
  onClose: () => void;
  /** Clés react-query à invalider après relance. */
  invalidateKeys?: readonly (readonly unknown[])[];
}

export default function RetryDeliveryDialog({
  item,
  onClose,
  invalidateKeys = [],
}: RetryDeliveryDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const retry = useMutation({
    mutationFn: () => actionItemsApi.retry(item!.actionItemId!),
    onSuccess: () =>
      refreshActionQueue(
        (key) => queryClient.invalidateQueries({ queryKey: key }), invalidateKeys),
  });

  // Sans remise à zéro, le résultat du précédent s'afficherait sur le suivant.
  React.useEffect(() => retry.reset(), [item?.actionItemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isMessage = item?.kind === 'GUEST_MESSAGE_FAILED';

  return (
    <Dialog
      open={item != null}
      onOpenChange={(next) => !next && !retry.isPending && onClose()}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="pe-8">{item?.title}</DialogTitle>
          <DialogDescription>
            {item?.detail ??
              t('dashboard.retryDialog.noRecipient', 'Destinataire inconnu')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            {isMessage
              ? t(
                  'dashboard.retryDialog.messageWhat',
                  'Ce message n’a pas pu être délivré au voyageur.',
                )
              : t(
                  'dashboard.retryDialog.documentWhat',
                  'Ce document a bien été produit, mais son envoi a échoué : le destinataire ne l’a jamais reçu.',
                )}
          </p>
          <p className="text-foreground">
            {isMessage
              ? t(
                  'dashboard.retryDialog.messageTodo',
                  'La relance repart sur le même canal que l’envoi d’origine.',
                )
              : t(
                  'dashboard.retryDialog.documentTodo',
                  'La relance régénère le document et le renvoie à la même adresse.',
                )}
          </p>
        </div>

        {retry.isSuccess && (
          <Alert>
            <CheckIcon />
            <AlertDescription>
              {/* « Reparti », pas « arrivé » : nous ne savons pas encore. */}
              {t('dashboard.retryDialog.sent', 'L’envoi est reparti.')}
            </AlertDescription>
          </Alert>
        )}

        {retry.isError && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>
              {t(
                'dashboard.retryDialog.failed',
                'La relance a échoué à nouveau. La cause est probablement l’adresse ou le numéro du destinataire.',
              )}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            onClick={() => retry.mutate()}
            disabled={retry.isPending || item?.actionItemId == null}
          >
            {retry.isPending ? <Spinner /> : <SendHorizonalIcon />}
            {t('dashboard.retryDialog.retry', 'Relancer l’envoi')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
