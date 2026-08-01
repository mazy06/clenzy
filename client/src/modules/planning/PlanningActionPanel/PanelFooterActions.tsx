import React, { useEffect, useState } from 'react';
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
} from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { SwapHoriz, OpenInNew, WhatsApp, Cancel, Warning } from '../../../icons';
import type { PlanningEvent, PlanningProperty } from '../types';
import GuestCardDialog from './GuestCardDialog';
import ChangePropertyDialog from './ChangePropertyDialog';
import SendWhatsAppTemplateDialog from '../../channels/SendWhatsAppTemplateDialog';
import { useSendTemplateForReservation } from '../../../hooks/useConversations';

// ─── Pied sticky du panneau réservation (maquette Signature) ─────────────────
//
// Grille 2×2 de boutons outlined sous hairline : Changer logement / Fiche
// client / WhatsApp / Annuler (rouge --err). Mappe les « Actions rapides »
// historiques de l'onglet Infos — mêmes dialogs, aucune action nouvelle.

type ActionResult = { success: boolean; error: string | null };

interface PanelFooterActionsProps {
  event: PlanningEvent;
  allEvents: PlanningEvent[];
  properties?: PlanningProperty[];
  onChangeProperty?: (reservationId: number, newPropertyId: number, newPropertyName: string) => Promise<ActionResult>;
  onCancelReservation?: (reservationId: number) => Promise<ActionResult>;
  onUpdateGuestInfo?: (reservationId: number, updates: { guestName?: string; guestEmail?: string; guestPhone?: string }) => Promise<ActionResult>;
  /** Signal contrôlé : ouvre la fiche client si l'id correspond à la réservation courante. */
  autoOpenGuestCardForReservationId?: string | number | null;
  /** Appelé une fois le signal consommé (le parent le remet à null → réouverture possible). */
  onGuestCardAutoOpenHandled?: () => void;
}

const PanelFooterActions: React.FC<PanelFooterActionsProps> = ({
  event,
  allEvents,
  properties,
  onChangeProperty,
  onCancelReservation,
  onUpdateGuestInfo,
  autoOpenGuestCardForReservationId,
  onGuestCardAutoOpenHandled,
}) => {
  const reservation = event.reservation;
  const [guestCardOpen, setGuestCardOpen] = useState(false);

  // Ouverture pilotée (carte constellation « email voyageur manquant ») : quand le signal
  // cible la réservation actuellement sélectionnée, on ouvre la fiche client puis on
  // consomme le signal (le parent le remet à null → l'ouverture manuelle et une future
  // réouverture restent possibles).
  useEffect(() => {
    if (
      autoOpenGuestCardForReservationId != null &&
      reservation &&
      String(autoOpenGuestCardForReservationId) === String(reservation.id)
    ) {
      setGuestCardOpen(true);
      onGuestCardAutoOpenHandled?.();
    }
    // Garde stricte + le parent reset autoOpen apres handled : re-runs = no-op.
  }, [autoOpenGuestCardForReservationId, reservation, onGuestCardAutoOpenHandled]);
  const [changePropertyOpen, setChangePropertyOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const sendTemplateForReservation = useSendTemplateForReservation();

  if (!reservation) return null;

  const canChangeProperty = Boolean(properties && onChangeProperty);

  return (
    <div className="shrink-0 bg-[var(--card)] p-[12px 16px] grid grid-cols-[1fr_1fr] gap-1.5" style={{ borderTop: '1px solid var(--line)' }}>
      {canChangeProperty && (
        <Button variant="outline" size="sm" onClick={() => setChangePropertyOpen(true)}>
          <SwapHoriz size={13} strokeWidth={1.75} />
          Changer logement
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => setGuestCardOpen(true)}>
        <OpenInNew size={13} strokeWidth={1.75} />
        Fiche client
      </Button>
      <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)}>
        <WhatsApp size={13} strokeWidth={1.75} />
        WhatsApp
      </Button>
      {/* `destructive` et non `outline` : annuler une reservation est irreversible —
          la teinte --err portait deja cette intention dans l'ancien sx. */}
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setCancelDialogOpen(true)}
        disabled={reservation.status === 'cancelled' || !onCancelReservation}
      >
        <Cancel size={13} strokeWidth={1.75} />
        Annuler
      </Button>

      {/* Fiche client */}
      <GuestCardDialog
        open={guestCardOpen}
        onClose={() => setGuestCardOpen(false)}
        reservation={reservation}
        allEvents={allEvents}
        onUpdateGuestInfo={onUpdateGuestInfo}
      />

      {/* Template WhatsApp */}
      <SendWhatsAppTemplateDialog
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onSend={(key) => sendTemplateForReservation.mutate(
          { reservationId: reservation.id, templateKey: key },
          { onSuccess: () => setTemplateOpen(false) },
        )}
        sending={sendTemplateForReservation.isPending}
        error={sendTemplateForReservation.isError}
      />

      {/* Changer logement */}
      {properties && onChangeProperty && (
        <ChangePropertyDialog
          open={changePropertyOpen}
          onClose={() => setChangePropertyOpen(false)}
          reservation={reservation}
          allEvents={allEvents}
          properties={properties}
          onConfirm={async (targetPropertyId, targetPropertyName) => {
            const result = await onChangeProperty(reservation.id, targetPropertyId, targetPropertyName);
            if (result.success) {
              setChangePropertyOpen(false);
            }
            return result;
          }}
        />
      )}

      {/* Confirmation d'annulation */}
      <Dialog
        open={cancelDialogOpen}
        onOpenChange={(next) => { if (!next) { setCancelDialogOpen(false); setCancelError(null); } }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 pe-8">
              <span className="inline-flex text-[var(--err)]"><Warning size={22} strokeWidth={1.75} /></span>
              Annuler la reservation
            </DialogTitle>
            <DialogDescription>
              Du {reservation.checkIn} au {reservation.checkOut}
            </DialogDescription>
          </DialogHeader>

          <p className="cn-text-body2 text-[0.8125rem] mb-1.5">
            Etes-vous sur de vouloir annuler la reservation de{' '}
            <strong>{reservation.guestName}</strong> au{' '}
            <strong>{reservation.propertyName}</strong> ?
          </p>
          <Alert variant="warning" className="text-[0.75rem]">
            <TriangleAlert />
            <AlertDescription>Les interventions liees (menage) seront egalement annulees. Cette action est irreversible.</AlertDescription>
          </Alert>
          {cancelError && (
            <Alert variant="destructive" className="text-[0.75rem] mt-1.5">
              <TriangleAlert />
              <AlertDescription>{cancelError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setCancelDialogOpen(false); setCancelError(null); }}
            >
              Retour
            </Button>
            <Button
              onClick={async () => {
                if (!onCancelReservation) return;
                setCancelLoading(true);
                setCancelError(null);
                const result = await onCancelReservation(reservation.id);
                setCancelLoading(false);
                if (result.success) {
                  setCancelDialogOpen(false);
                } else {
                  setCancelError(result.error);
                }
              }}
              variant="destructive"
              size="sm"
              disabled={cancelLoading || !onCancelReservation}
            >
              {cancelLoading ? <Spinner className="size-3.5" /> : <Cancel size={16} strokeWidth={1.75} />}
              Confirmer l'annulation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PanelFooterActions;
