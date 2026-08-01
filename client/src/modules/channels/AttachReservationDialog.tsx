import React, { useState, useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Button,
  Spinner,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  InputGroupAddon,
} from '../../components/ui';
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

const reservationLabel = (r: Reservation) =>
  `${r.propertyName} · ${fmtDate(r.checkIn)} → ${fmtDate(r.checkOut)} · ${r.guestName}`;

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
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-[1rem] font-semibold">Rattacher à une réservation</DialogTitle>
          <DialogDescription className="text-[0.8125rem]">
            Reliez le numéro {phone ? <strong>{phone}</strong> : 'de ce contact'} à sa réservation.
            Le numéro sera mémorisé sur le guest : ses prochains messages WhatsApp seront reconnus automatiquement.
          </DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="attach-reservation-search">Réservation</FieldLabel>
          {/* `filter={null}` : la liste vient deja filtree du serveur (recherche
              debouncee), on ne veut pas d'un second filtrage local — equivalent
              du `filterOptions={(x) => x}` de l'Autocomplete. */}
          <Combobox
            items={options}
            filter={null}
            itemToStringLabel={reservationLabel}
            itemToStringValue={(r: Reservation) => String(r.id)}
            isItemEqualToValue={(a: Reservation, b: Reservation) => a.id === b.id}
            value={selected}
            onValueChange={(next: Reservation | null | undefined) => setSelected(next ?? null)}
            onInputValueChange={(value: string) => setInput(value)}
          >
            <ComboboxInput
              id="attach-reservation-search"
              autoFocus
              placeholder="Nom du guest ou du logement…"
            >
              {loading ? (
                <InputGroupAddon align="inline-end">
                  <Spinner className="size-4" />
                </InputGroupAddon>
              ) : null}
            </ComboboxInput>
            {/* Le popup est porte hors du DialogContent, ou Radix coupe les
                pointer-events du reste du document : sans `pointer-events-auto`
                les options ne seraient pas cliquables. */}
            <ComboboxContent className="pointer-events-auto">
              <ComboboxEmpty>
                {input.trim().length < 2 ? 'Tapez au moins 2 caractères' : 'Aucune réservation'}
              </ComboboxEmpty>
              <ComboboxList>
                {(r: Reservation) => (
                  <ComboboxItem key={r.id} value={r}>
                    {reservationLabel(r)}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </Field>

        {attachMutation.isError && (
          <Alert variant="destructive" className="text-[0.8125rem]">
            <TriangleAlert />
            <AlertDescription>Le rattachement a échoué. Réessayez.</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleAttach}
            disabled={!selected || attachMutation.isPending}
          >
            {attachMutation.isPending ? 'Rattachement…' : 'Rattacher'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
