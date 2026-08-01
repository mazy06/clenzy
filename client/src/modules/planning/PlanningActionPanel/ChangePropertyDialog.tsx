import React, { useMemo, useState } from 'react';
import { cn } from '../../../utils/cn';
import StatusChip from '../../../components/StatusChip';
import { Badge } from '../../../components/ui';
import { Alert, AlertDescription } from '../../../components/ui';
import { Info, TriangleAlert } from 'lucide-react';
import { Spinner } from '../../../components/ui';
import { Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Button, Divider } from '@mui/material';
import {
  Close,
  Home,
  CalendarMonth,
  Person,
  CheckCircle,
  SwapHoriz,
} from '../../../icons';
import type { PlanningEvent, PlanningProperty } from '../types';
import type { Reservation } from '../../../services/api';

interface ChangePropertyDialogProps {
  open: boolean;
  onClose: () => void;
  reservation: Reservation;
  allEvents: PlanningEvent[];
  properties: PlanningProperty[];
  onConfirm: (
    targetPropertyId: number,
    targetPropertyName: string,
  ) => Promise<{ success: boolean; error: string | null }>;
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  STUDIO: 'Studio',
  APARTMENT: 'Appartement',
  LOFT: 'Loft',
  HOUSE: 'Maison',
  VILLA: 'Villa',
  DUPLEX: 'Duplex',
  PENTHOUSE: 'Penthouse',
};

const ChangePropertyDialog: React.FC<ChangePropertyDialogProps> = ({
  open,
  onClose,
  reservation,
  allEvents,
  properties,
  onConfirm,
}) => {
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Find current property
  const currentProperty = useMemo(
    () => properties.find((p) => p.id === reservation.propertyId),
    [properties, reservation.propertyId],
  );

  // Compute compatible properties
  const compatibleProperties = useMemo(() => {
    return properties.filter((p) => {
      // 1. Not the current property
      if (p.id === reservation.propertyId) return false;

      // 2. Same city
      if (currentProperty && p.city !== currentProperty.city) return false;

      // 3. Sufficient capacity
      if (p.maxGuests < reservation.guestCount) return false;

      // 4. No reservation overlap on target property
      const targetReservations = allEvents.filter(
        (e) => e.type === 'reservation' && e.propertyId === p.id,
      );
      const hasOverlap = targetReservations.some(
        (e) => reservation.checkIn < e.endDate && reservation.checkOut > e.startDate,
      );
      if (hasOverlap) return false;

      return true;
    });
  }, [properties, reservation, allEvents, currentProperty]);

  const selectedProperty = compatibleProperties.find((p) => p.id === selectedPropertyId);

  const handleConfirm = async () => {
    if (!selectedProperty) return;
    setLoading(true);
    setError(null);

    const result = await onConfirm(selectedProperty.id, selectedProperty.name);

    setLoading(false);
    if (result.success) {
      setSelectedPropertyId(null);
      setError(null);
    } else {
      setError(result.error);
    }
  };

  const handleClose = () => {
    setSelectedPropertyId(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '80vh',
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
          pt: 2,
          px: 2.5,
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="inline-flex text-[var(--accent)]"><SwapHoriz size={20} strokeWidth={1.75} /></span>
          <h6 className="cn-text-h6 font-bold text-[1rem]">
            Changer de logement
          </h6>
        </div>
        <IconButton size="small" onClick={handleClose}>
          <Close size={18} strokeWidth={1.75} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
        {/* Current reservation summary */}
        <div className="p-2 rounded-[10px] bg-[var(--surface-2)] border border-[var(--line)] mb-3">
          <span className="cn-text-caption font-bold text-[10.5px] uppercase tracking-[0.05em] text-[var(--faint)]">
            Reservation actuelle
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="inline-flex text-[var(--muted)]"><Person size={16} strokeWidth={1.75} /></span>
            <p className="cn-text-body2 font-semibold text-[0.8125rem]">
              {reservation.guestName}
            </p>
            <Badge variant="outline" className="text-[0.625rem] h-[20px]">{`${reservation.guestCount} voyageur${reservation.guestCount > 1 ? 's' : ''}`}</Badge>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="inline-flex text-[var(--muted)]"><Home size={16} strokeWidth={1.75} /></span>
            <p className="cn-text-body2 text-[0.8125rem]">
              {reservation.propertyName}
            </p>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="inline-flex text-[var(--muted)]"><CalendarMonth size={16} strokeWidth={1.75} /></span>
            <p className="cn-text-body2 text-[0.8125rem]">
              {reservation.checkIn} &rarr; {reservation.checkOut}
            </p>
          </div>
        </div>

        <Divider sx={{ mb: 2 }} />

        {/* Available properties */}
        <div className="flex items-center justify-between mb-2">
          <h6 className="cn-text-subtitle2 font-bold text-[0.8125rem]">
            Logements disponibles
          </h6>
          <StatusChip size="sm" tokens={{ color: compatibleProperties.length > 0 ? 'var(--ok)' : 'var(--muted)', bg: compatibleProperties.length > 0 ? 'var(--ok-soft)' : 'var(--hover)' }} label={`${compatibleProperties.length} disponible${compatibleProperties.length > 1 ? 's' : ''}`} className="h-[20px]" />
        </div>

        {compatibleProperties.length === 0 ? (
          <Alert variant="info" className="text-[0.75rem] mb-3">
            <Info />
            <AlertDescription>Aucun logement disponible dans la meme ville avec une capacite suffisante pour ces dates.</AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-1.5 mb-3">
            {compatibleProperties.map((property) => {
              const isSelected = selectedPropertyId === property.id;
              const typeLabel = property.type
                ? PROPERTY_TYPE_LABELS[property.type] || property.type
                : '';

              return (
                <div
                  key={property.id}
                  onClick={() => setSelectedPropertyId(property.id)}
                  className={cn(
                    'p-[9px] rounded-[10px] border border-solid cursor-pointer',
                    'transition-[border-color,background-color] duration-150 ease-[ease] motion-reduce:transition-none',
                    // Selectionne : le survol ne change rien, donc pas de variante hover.
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                      : 'border-[var(--line-2)] bg-[var(--card)] hover:border-[var(--faint)] hover:bg-[var(--hover)]',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('inline-flex', isSelected ? 'text-[var(--accent)]' : 'text-[var(--muted)]')}><Home size={18} strokeWidth={1.75} /></span>
                      <p className="cn-text-body2 font-bold text-[0.8125rem]">
                        {property.name}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="inline-flex text-[var(--accent)]"><CheckCircle size={18} strokeWidth={1.75} /></span>
                    )}
                  </div>
                  <div className="flex gap-1 mt-1 ms-5">
                    <Badge variant="outline" className="text-[0.625rem] h-[20px]">{property.city}</Badge>
                    {typeLabel && (
                      <Badge variant="outline" className="text-[0.625rem] h-[20px]">{typeLabel}</Badge>
                    )}
                    <Badge variant="outline" className="text-[0.625rem] h-[20px]">{`${property.maxGuests} pers. max`}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Confirmation info */}
        {selectedProperty && (
          <Alert variant="info" className="text-[0.75rem] mb-1.5">
            <Info />
            <AlertDescription>La reservation de <strong>{reservation.guestName}</strong>sera deplacee vers{' '}<strong>{selectedProperty.name}</strong>. Les interventions liees (menage) seront
            automatiquement deplacees.</AlertDescription>
          </Alert>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive" className="text-[0.75rem] mb-1.5">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2, pt: 1 }}>
        <Button
          onClick={handleClose}
          size="small"
          sx={{ fontSize: '0.75rem', textTransform: 'none' }}
        >
          Annuler
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          size="small"
          disabled={!selectedProperty || loading}
          startIcon={loading ? <Spinner className="size-3.5" /> : <SwapHoriz size={16} strokeWidth={1.75} />}
          sx={{ fontSize: '0.75rem', textTransform: 'none' }}
        >
          Confirmer le changement
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ChangePropertyDialog;
