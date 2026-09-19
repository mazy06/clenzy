import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
    <div className="shrink-0 bg-[var(--bui-card)] p-[12px 16px] grid grid-cols-[1fr_1fr] gap-1.5" style={{ borderTop: '1px solid var(--bui-border)' }}>
      {canChangeProperty && (
        <Button variant="outline" size="sm" onClick={() => setChangePropertyOpen(true)}>
          <SwapHoriz size={13} strokeWidth={1.75} />
          {t('planning.panel.actions.changeProperty', 'Changer logement')}
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => setGuestCardOpen(true)}>
        <OpenInNew size={13} strokeWidth={1.75} />
        {t('planning.panel.actions.guestCard', 'Fiche client')}
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
        {t('planning.panel.actions.cancel', 'Annuler')}
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
              {t('planning.panel.cancelDialog.title', 'Annuler la réservation')}
            </DialogTitle>
            <DialogDescription>
              {t('planning.panel.cancelDialog.dates', { from: reservation.checkIn, to: reservation.checkOut })}
            </DialogDescription>
          </DialogHeader>

          <p className="cn-text-body2 text-[0.8125rem] mb-1.5">
            {t('planning.panel.cancelDialog.confirmText', {
              guest: reservation.guestName,
              property: reservation.propertyName,
            })}
          </p>
          <Alert variant="warning" className="text-[0.75rem]">
            <TriangleAlert />
            <AlertDescription>{t('planning.panel.cancelDialog.warning')}</AlertDescription>
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
              {t('planning.panel.cancelDialog.back', 'Retour')}
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
              {t('planning.panel.cancelDialog.confirm', "Confirmer l'annulation")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PanelFooterActions;
