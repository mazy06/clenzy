import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckIcon, ExternalLinkIcon, SendIcon, TriangleAlertIcon } from 'lucide-react';
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
  Separator,
  Spinner,
} from '../ui';
import GuestAvatar from './GuestAvatar';
import { Money } from './Money';
import StatusChip from './StatusChip';
import { reservationsApi } from '../../services/api/reservationsApi';
import { refreshActionQueue } from '../../services/api/actionItemsApi';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Baitly — le séjour en un coup d'œil, et le geste qui va avec, sans quitter
 * l'écran d'où l'on vient.
 *
 * <p>Elle remplace une navigation vers `/reservations/:id` — une route qui
 * n'existe pas : les listes du tableau de bord y envoyaient l'utilisateur sur
 * une page « introuvable ».</p>
 *
 * <p>Le seul geste réellement branché sur le serveur pour un solde impayé est
 * l'envoi du lien de paiement (`POST /reservations/{id}/send-payment-link`).
 * On ne propose donc pas d'« encaisser » ni de « saisir un paiement » : ces
 * écrans existent ailleurs sous forme de maquettes non connectées, et un bouton
 * qui fait semblant est pire que pas de bouton.</p>
 */

export interface ReservationActionDialogProps {
  /** Réservation à ouvrir. `null` ferme la modale. */
  reservationId: number | null;
  onClose: () => void;
  /** En-tête affiché pendant le chargement, depuis la ligne cliquée. */
  preview?: {
    guestName?: string | null;
    propertyName?: string | null;
    amountDue?: number | null;
  };
  /** Clés react-query à invalider après action. */
  invalidateKeys?: readonly (readonly unknown[])[];
}

export default function ReservationActionDialog({
  reservationId,
  onClose,
  preview,
  invalidateKeys = [],
}: ReservationActionDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sent, setSent] = React.useState(false);

  const { data: reservation, isLoading } = useQuery({
    queryKey: ['reservation', reservationId],
    queryFn: () => reservationsApi.getById(reservationId!),
    enabled: reservationId != null,
  });

  // Sans cette remise à zéro, la confirmation d'envoi précédente s'afficherait
  // sur la réservation suivante ouverte.
  React.useEffect(() => setSent(false), [reservationId]);

  const sendLink = useMutation({
    mutationFn: () => reservationsApi.sendPaymentLink(reservationId!),
    onSuccess: async () => {
      setSent(true);
      // La ligne traitée doit disparaître tout de suite : on demande le
      // recalcul de la file avant d'invalider les vues qui la lisent.
      await refreshActionQueue(
        (key) => queryClient.invalidateQueries({ queryKey: key }), invalidateKeys);
    },
  });

  const guestName = reservation?.guestName ?? preview?.guestName ?? null;
  const propertyName = reservation?.propertyName ?? preview?.propertyName ?? null;
  // Le solde restant n'est pas porté par la réservation : il est calculé par
  // le serveur pour la file « à traiter » et transmis par la ligne cliquée.
  const amountDue = preview?.amountDue ?? null;
  const hasBalance = amountDue != null && amountDue > 0;
  // Le voyageur ne reçoit rien sans adresse : mieux vaut le dire avant le clic
  // que d'afficher un succès pour un message parti nulle part.
  const guestEmail = reservation?.guestEmail?.trim() || null;

  return (
    <Dialog
      open={reservationId != null}
      onOpenChange={(next) => !next && !sendLink.isPending && onClose()}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 pe-8">
            {guestName && <GuestAvatar name={guestName} size={32} />}
            <span className="truncate">
              {guestName ?? t('dashboard.reservationDialog.fallback', 'Séjour')}
            </span>
          </DialogTitle>
          {propertyName && <DialogDescription>{propertyName}</DialogDescription>}
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Field label={t('dashboard.upcomingArrivals.checkIn', 'Arrivée')}>
                {formatDate(reservation?.checkIn)}
              </Field>
              <Field label={t('dashboard.reservationDialog.checkOut', 'Départ')}>
                {formatDate(reservation?.checkOut)}
              </Field>
              <Field label={t('dashboard.upcomingArrivals.status', 'Statut')}>
                {reservation?.status ? (
                  <StatusChip
                    tone={statusTone(reservation.status)}
                    label={t(`reservations.status.${reservation.status}`, reservation.status)}
                    size="sm"
                  />
                ) : (
                  '—'
                )}
              </Field>
              <Field label={t('dashboard.upcomingArrivals.total', 'Total')}>
                {reservation?.totalPrice != null ? (
                  <Money value={reservation.totalPrice} decimals={0} />
                ) : (
                  '—'
                )}
              </Field>
            </dl>

            {hasBalance && (
              <>
                <Separator />
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    {t('dashboard.upcomingArrivals.balanceDue', 'Solde dû')}
                  </span>
                  <span className="text-lg font-semibold text-foreground tabular-nums">
                    <Money value={amountDue} decimals={0} />
                  </span>
                </div>
              </>
            )}

            {hasBalance && !guestEmail && (
              <Alert>
                <TriangleAlertIcon />
                <AlertDescription>
                  {t(
                    'dashboard.reservationDialog.noEmail',
                    'Aucune adresse e-mail sur ce séjour : le lien de paiement ne peut pas être envoyé.',
                  )}
                </AlertDescription>
              </Alert>
            )}

            {sent && (
              <Alert>
                <CheckIcon />
                <AlertDescription>
                  {t('dashboard.reservationDialog.linkSent', 'Lien de paiement envoyé au voyageur.')}
                </AlertDescription>
              </Alert>
            )}

            {sendLink.isError && (
              <Alert variant="destructive">
                <TriangleAlertIcon />
                <AlertDescription>
                  {t('dashboard.reservationDialog.linkFailed', 'L’envoi a échoué. Réessayez.')}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          {/* La sortie vers l'écran complet est proposée, jamais imposée. */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onClose();
              navigate('/reservations');
            }}
          >
            <ExternalLinkIcon />
            {t('dashboard.reservationDialog.openList', 'Voir les réservations')}
          </Button>

          {hasBalance && (
            <Button
              onClick={() => sendLink.mutate()}
              disabled={sendLink.isPending || sent || !guestEmail}
            >
              {sendLink.isPending ? <Spinner /> : <SendIcon />}
              {t('dashboard.reservationDialog.sendLink', 'Envoyer le lien de paiement')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Un statut de séjour, ramené aux tons de la bibliothèque. */
function statusTone(status: string): 'ok' | 'warn' | 'err' | 'neutral' {
  if (status === 'confirmed' || status === 'CONFIRMED') return 'ok';
  if (status === 'cancelled' || status === 'CANCELLED') return 'err';
  if (status === 'pending' || status === 'PENDING') return 'warn';
  return 'neutral';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="m-0 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
