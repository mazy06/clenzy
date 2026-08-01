import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, Button } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete, TextField } from '@mui/material';
import { reservationsApi, type Reservation } from '../../services/api/reservationsApi';
import { useAttachToReservation } from '../../hooks/useConversations';
import { formatPhoneNumber } from '../../utils/formatPhone';
import type { ConversationDto } from '../../services/api/conversationApi';

interface AttachReservationDialogProps {
  open: boolean;
  conversation: ConversationDto;
  onClose: () => void;
  /** Appelé après un rattachement réussi (refetch + désélection côté parent). */
  onAttached: () => void;
}

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '';

/**
 * Dialog de rattachement d'une conversation orpheline (« à trier ») à une
 * réservation : recherche debouncée (nom guest / logement), puis appel
 * {@code PUT /conversations/:id/attach}. Le numéro WhatsApp est mémorisé sur le
 * guest pour l'auto-rattachement des futurs messages.
 */
export default function AttachReservationDialog({
  open,
  conversation,
  onClose,
  onAttached,
}: AttachReservationDialogProps) {
  const [input, setInput] = useState('');
  const [options, setOptions] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Reservation | null>(null);
  const attachMutation = useAttachToReservation();

  // Reset à chaque ouverture.
  useEffect(() => {
    if (open) {
      setInput('');
      setOptions([]);
      setSelected(null);
    }
  }, [open]);

  // Recherche debouncée (300 ms, min 2 caractères).
  useEffect(() => {
    const q = input.trim();
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    setLoading(true);
    const handle = window.setTimeout(() => {
      reservationsApi
        .search(q)
        .then(setOptions)
        .catch(() => setOptions([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [input]);

  const handleAttach = () => {
    if (!selected) return;
    attachMutation.mutate(
      { conversationId: conversation.id, reservationId: selected.id, memorizePhone: true },
      { onSuccess: onAttached },
    );
  };

  const phone = formatPhoneNumber(conversation.externalConversationId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600 }}>Rattacher à une réservation</DialogTitle>
      <DialogContent>
        <p className="cn-text-body1 text-[0.8125rem] text-muted-foreground mb-3">
          Reliez le numéro {phone ? <strong>{phone}</strong> : 'de ce contact'} à sa réservation.
          Le numéro sera mémorisé sur le guest : ses prochains messages WhatsApp seront reconnus automatiquement.
        </p>
        <Autocomplete<Reservation>
          options={options}
          loading={loading}
          value={selected}
          onChange={(_, v) => setSelected(v)}
          inputValue={input}
          onInputChange={(_, v) => setInput(v)}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          getOptionLabel={(r) => `${r.propertyName} · ${fmtDate(r.checkIn)} → ${fmtDate(r.checkOut)} · ${r.guestName}`}
          filterOptions={(x) => x}
          noOptionsText={input.trim().length < 2 ? 'Tapez au moins 2 caractères' : 'Aucune réservation'}
          renderInput={(params) => (
            <TextField
              {...params}
              autoFocus
              label="Réservation"
              placeholder="Nom du guest ou du logement…"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading ? <Spinner className="size-4" /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
        {attachMutation.isError && (
          <Alert variant="destructive" className="mt-3 text-[0.8125rem]">
            <TriangleAlert />
            <AlertDescription>Le rattachement a échoué. Réessayez.</AlertDescription>
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outline" onClick={onClose}>
          Annuler
        </Button>
        <Button
          onClick={handleAttach}
          disabled={!selected || attachMutation.isPending}
        >
          {attachMutation.isPending ? 'Rattachement…' : 'Rattacher'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
