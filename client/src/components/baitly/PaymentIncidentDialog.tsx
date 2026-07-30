import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckIcon, ExternalLinkIcon, TriangleAlertIcon } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
} from '../ui';
import { Money } from '../Money';
import { actionItemsApi } from '../../services/api/actionItemsApi';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Baitly — ce que le fournisseur de paiement nous apprend après coup.
 *
 * <p>Trois situations arrivaient par webhook et repartaient sans laisser de
 * trace : un litige ouvert, un virement échoué après avoir été annoncé payé,
 * un lien de paiement expiré. Elles n'ont pas le même geste de réparation, et
 * aucune ne se règle depuis cet écran — un litige se conteste chez le
 * fournisseur, un virement se réémet depuis les reversements.</p>
 *
 * <p>Cette modale ne prétend donc pas les résoudre : elle dit ce qui s'est
 * passé, ce qu'il reste de temps, où aller, et permet de retirer la ligne de la
 * file une fois le nécessaire fait. C'est ce dernier geste qui manquait — sans
 * lui, un incident traité resterait affiché et la file perdrait son sens.</p>
 */

/** Sous-natures d'incident, telles qu'envoyées par le serveur. */
type IncidentType = 'DISPUTE_OPENED' | 'TRANSFER_FAILED' | 'SESSION_EXPIRED' | (string & {});

export interface PaymentIncidentDialogProps {
  /** Incident à ouvrir. `null` ferme la modale. */
  incidentId: number | null;
  onClose: () => void;
  incident?: {
    type?: IncidentType | null;
    title?: string | null;
    detail?: string | null;
    amount?: number | null;
    /** Échéance restante, déjà formatée par le serveur (« J-3 », « échue »). */
    badge?: string | null;
  };
  /** Clés react-query à invalider après clôture. */
  invalidateKeys?: readonly (readonly unknown[])[];
}

export default function PaymentIncidentDialog({
  incidentId,
  onClose,
  incident,
  invalidateKeys = [],
}: PaymentIncidentDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const resolve = useMutation({
    mutationFn: () => actionItemsApi.resolve(incidentId!),
    onSuccess: async () => {
      await Promise.all(
        invalidateKeys.map((key) => queryClient.invalidateQueries({ queryKey: [...key] })),
      );
      onClose();
    },
  });

  // Sans remise à zéro, l'échec du précédent s'afficherait sur le suivant.
  React.useEffect(() => resolve.reset(), [incidentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const guidance = incidentGuidance(incident?.type, t);

  return (
    <Dialog
      open={incidentId != null}
      onOpenChange={(next) => !next && !resolve.isPending && onClose()}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="pe-8">
            {incident?.title ?? t('dashboard.incidentDialog.title', 'Incident de règlement')}
          </DialogTitle>
          <DialogDescription>{incident?.detail}</DialogDescription>
        </DialogHeader>

        {/* L'échéance décide de tout sur un litige : passée, la somme est perdue. */}
        {incident?.badge && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>
              {t('dashboard.incidentDialog.deadline', 'Délai de réponse : {{delay}}', {
                delay: incident.badge,
              })}
            </AlertTitle>
            <AlertDescription>
              {t(
                'dashboard.incidentDialog.deadlineHelp',
                'Sans réponse dans ce délai, la somme est perdue définitivement.',
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-1 text-sm text-muted-foreground">
          <p>{guidance.what}</p>
          <p className="text-foreground">{guidance.todo}</p>
        </div>

        {incident?.amount != null && (
          <p className="text-lg font-semibold text-foreground tabular-nums">
            <Money value={incident.amount} />
          </p>
        )}

        {resolve.isError && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>
              {t('dashboard.incidentDialog.failed', 'La clôture a échoué. Réessayez.')}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="sm:justify-between">
          {guidance.route && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onClose();
                navigate(guidance.route!);
              }}
            >
              <ExternalLinkIcon />
              {guidance.routeLabel}
            </Button>
          )}

          <Button onClick={() => resolve.mutate()} disabled={resolve.isPending}>
            {resolve.isPending ? <Spinner /> : <CheckIcon />}
            {t('dashboard.incidentDialog.resolve', 'Marquer comme traité')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Ce qui s'est passé, et où le réparer.
 *
 * Chaque incident renvoie vers l'écran qui porte réellement le geste : rien ne
 * se corrige ici, et le prétendre ferait perdre du temps.
 */
function incidentGuidance(
  type: IncidentType | null | undefined,
  t: (key: string, fallback: string) => string,
): { what: string; todo: string; route?: string; routeLabel?: string } {
  if (type === 'DISPUTE_OPENED') {
    return {
      what: t(
        'dashboard.incidentDialog.disputeWhat',
        'Le voyageur a contesté ce paiement auprès de sa banque. La somme est déjà retenue.',
      ),
      todo: t(
        'dashboard.incidentDialog.disputeTodo',
        'Rassemblez les preuves du séjour (contrat, échanges, état des lieux) et répondez depuis votre compte Stripe avant l’échéance.',
      ),
      route: '/billing',
      routeLabel: t('dashboard.incidentDialog.seePayments', 'Voir les paiements'),
    };
  }
  if (type === 'TRANSFER_FAILED') {
    return {
      what: t(
        'dashboard.incidentDialog.transferWhat',
        'Le virement a été refusé après avoir été marqué payé : le bénéficiaire n’a rien reçu.',
      ),
      todo: t(
        'dashboard.incidentDialog.transferTodo',
        'Vérifiez les coordonnées bancaires du bénéficiaire, puis relancez le reversement.',
      ),
      route: '/billing?tab=payouts',
      routeLabel: t('dashboard.incidentDialog.seePayouts', 'Voir les reversements'),
    };
  }
  if (type === 'SESSION_EXPIRED') {
    return {
      what: t(
        'dashboard.incidentDialog.sessionWhat',
        'Le lien de paiement a expiré sans être réglé. La réservation reste en attente.',
      ),
      todo: t(
        'dashboard.incidentDialog.sessionTodo',
        'Renvoyez un lien de paiement au voyageur, ou annulez la réservation.',
      ),
      route: '/reservations',
      routeLabel: t('dashboard.incidentDialog.seeReservations', 'Voir les réservations'),
    };
  }
  return {
    what: t(
      'dashboard.incidentDialog.genericWhat',
      'Le fournisseur de paiement a signalé un événement qui contredit l’état enregistré.',
    ),
    todo: t(
      'dashboard.incidentDialog.genericTodo',
      'Vérifiez la transaction concernée chez le fournisseur.',
    ),
  };
}
