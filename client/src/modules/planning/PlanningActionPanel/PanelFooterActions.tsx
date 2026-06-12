import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
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

const FOOTER_BUTTON_SX = {
  textTransform: 'none',
  fontSize: '0.75rem',
  fontWeight: 600,
  borderRadius: 'var(--radius-sm)',
  justifyContent: 'center',
  color: 'var(--ink)',
  borderColor: 'var(--line-2)',
  transition: 'border-color var(--duration-fast) var(--ease-out), background-color var(--duration-fast) var(--ease-out)',
  '&:hover': { borderColor: 'var(--ink)', backgroundColor: 'var(--hover)' },
} as const;

interface PanelFooterActionsProps {
  event: PlanningEvent;
  allEvents: PlanningEvent[];
  properties?: PlanningProperty[];
  onChangeProperty?: (reservationId: number, newPropertyId: number, newPropertyName: string) => Promise<ActionResult>;
  onCancelReservation?: (reservationId: number) => Promise<ActionResult>;
  onUpdateGuestInfo?: (reservationId: number, updates: { guestName?: string; guestEmail?: string; guestPhone?: string }) => Promise<ActionResult>;
}

const PanelFooterActions: React.FC<PanelFooterActionsProps> = ({
  event,
  allEvents,
  properties,
  onChangeProperty,
  onCancelReservation,
  onUpdateGuestInfo,
}) => {
  const reservation = event.reservation;
  const [guestCardOpen, setGuestCardOpen] = useState(false);
  const [changePropertyOpen, setChangePropertyOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const sendTemplateForReservation = useSendTemplateForReservation();

  if (!reservation) return null;

  const canChangeProperty = Boolean(properties && onChangeProperty);

  return (
    <Box
      sx={{
        flexShrink: 0,
        borderTop: '1px solid var(--line)',
        backgroundColor: 'var(--card)',
        p: '12px 16px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 1,
      }}
    >
      {canChangeProperty && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<SwapHoriz size={13} strokeWidth={1.75} />}
          onClick={() => setChangePropertyOpen(true)}
          sx={FOOTER_BUTTON_SX}
        >
          Changer logement
        </Button>
      )}
      <Button
        size="small"
        variant="outlined"
        startIcon={<OpenInNew size={13} strokeWidth={1.75} />}
        onClick={() => setGuestCardOpen(true)}
        sx={FOOTER_BUTTON_SX}
      >
        Fiche client
      </Button>
      <Button
        size="small"
        variant="outlined"
        startIcon={<WhatsApp size={13} strokeWidth={1.75} />}
        onClick={() => setTemplateOpen(true)}
        sx={FOOTER_BUTTON_SX}
      >
        WhatsApp
      </Button>
      <Button
        size="small"
        variant="outlined"
        startIcon={<Cancel size={13} strokeWidth={1.75} />}
        onClick={() => setCancelDialogOpen(true)}
        disabled={reservation.status === 'cancelled' || !onCancelReservation}
        sx={{
          ...FOOTER_BUTTON_SX,
          color: 'var(--err)',
          borderColor: 'var(--err)',
          '&:hover': { borderColor: 'var(--err)', backgroundColor: 'var(--err-soft)' },
          '&.Mui-disabled': { borderColor: 'var(--line)', color: 'var(--faint)' },
        }}
      >
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
        onClose={() => { setCancelDialogOpen(false); setCancelError(null); }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 'var(--radius-lg)' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1, pt: 2, px: 2.5 }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'var(--err)' }}><Warning size={22} strokeWidth={1.75} /></Box>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
            Annuler la reservation
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 1 }}>
          <Typography variant="body2" sx={{ fontSize: '0.8125rem', mb: 1 }}>
            Etes-vous sur de vouloir annuler la reservation de{' '}
            <strong>{reservation.guestName}</strong> au{' '}
            <strong>{reservation.propertyName}</strong> ?
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.8125rem', mb: 1 }}>
            Du <strong>{reservation.checkIn}</strong> au <strong>{reservation.checkOut}</strong>
          </Typography>
          <Alert severity="warning" sx={{ fontSize: '0.75rem' }}>
            Les interventions liees (menage) seront egalement annulees. Cette action est irreversible.
          </Alert>
          {cancelError && (
            <Alert severity="error" sx={{ fontSize: '0.75rem', mt: 1 }}>
              {cancelError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, pt: 1 }}>
          <Button
            onClick={() => { setCancelDialogOpen(false); setCancelError(null); }}
            size="small"
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}
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
            variant="contained"
            color="error"
            size="small"
            disabled={cancelLoading || !onCancelReservation}
            startIcon={cancelLoading ? <CircularProgress size={14} /> : <Cancel size={16} strokeWidth={1.75} />}
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}
          >
            Confirmer l'annulation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PanelFooterActions;
