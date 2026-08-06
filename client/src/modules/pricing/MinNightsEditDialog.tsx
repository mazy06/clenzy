import React, { useState } from 'react';
import { Button, Spinner, Field, FieldLabel, FieldDescription, FieldError, Input } from '../../components/ui';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui';
import { NightsStay } from '../../icons';

// ─── Types ──────────────────────────────────────────────────────────────────

interface MinNightsEditDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (minNights: number) => Promise<void>;
  selectedDates: string[];
  loading: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateRange(dates: string[]): string {
  if (dates.length === 0) return '';
  if (dates.length === 1) return dates[0];
  const sorted = [...dates].sort();
  return `${sorted[0]} → ${sorted[sorted.length - 1]}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

const MinNightsEditDialog: React.FC<MinNightsEditDialogProps> = ({
  open,
  onClose,
  onApply,
  selectedDates,
  loading,
}) => {
  const [minNights, setMinNights] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleApply = async () => {
    const n = parseInt(minNights, 10);
    if (Number.isNaN(n) || n < 1 || n > 365) {
      setError('Valeur entre 1 et 365');
      return;
    }
    setError('');
    await onApply(n);
    setMinNights('');
    onClose();
  };

  const handleClose = () => {
    setMinNights('');
    setError('');
    onClose();
  };

  return (
    // maxWidth="xs" + fullWidth MUI = pleine largeur plafonnee a 444 px.
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent className="w-full sm:max-w-[444px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5 pe-8">
            <NightsStay size={18} strokeWidth={1.75} />
            Définir le minimum de nuits
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatDateRange(selectedDates)}
            {selectedDates.length > 1 && (
              <span className="text-xs text-muted-foreground ms-1.5">
                ({selectedDates.length} dates)
              </span>
            )}
          </p>

          <Field>
            <FieldLabel htmlFor="min-nights">Minimum de nuits</FieldLabel>
            <Input
              id="min-nights"
              type="number"
              value={minNights}
              onChange={(e) => setMinNights(e.target.value)}
              aria-invalid={!!error}
              autoFocus
              min={1}
              max={365}
              step={1}
            />
            {error ? (
              <FieldError>{error}</FieldError>
            ) : (
              <FieldDescription>Surcharge le défaut de la propriété pour ces dates</FieldDescription>
            )}
          </Field>

          <span className="text-xs text-muted-foreground">
            Les réservations dont la date d'arrivée tombe sur l'une de ces dates devront
            respecter ce minimum. Le défaut de la propriété est remplacé uniquement sur
            les dates sélectionnées.
          </span>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Annuler
          </Button>
          <Button
            onClick={handleApply}
            disabled={loading || !minNights}
          >
            {loading && <Spinner className="size-4" />}
            Appliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MinNightsEditDialog;
