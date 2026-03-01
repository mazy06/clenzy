import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Chip,
  IconButton,
  Button,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Close,
  Home,
  CalendarMonth,
  Person,
  CheckCircle,
  SwapHoriz,
} from '@mui/icons-material';
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
          borderRadius: 2,
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SwapHoriz sx={{ fontSize: 22, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
            Changer de logement
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleClose}>
          <Close sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 2.5, pt: 1, pb: 0 }}>
        {/* Current reservation summary */}
        <Box
          sx={{
            p: 1.5,
            borderRadius: 1.5,
            backgroundColor: 'action.hover',
            mb: 2,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Reservation actuelle
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Person sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>
              {reservation.guestName}
            </Typography>
            <Chip
              label={`${reservation.guestCount} voyageur${reservation.guestCount > 1 ? 's' : ''}`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.625rem', height: 20 }}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Home sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
              {reservation.propertyName}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <CalendarMonth sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
              {reservation.checkIn} &rarr; {reservation.checkOut}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Available properties */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.8125rem' }}>
            Logements disponibles
          </Typography>
          <Chip
            label={`${compatibleProperties.length} disponible${compatibleProperties.length > 1 ? 's' : ''}`}
            size="small"
            color={compatibleProperties.length > 0 ? 'success' : 'default'}
            sx={{ fontSize: '0.625rem', height: 20 }}
          />
        </Box>

        {compatibleProperties.length === 0 ? (
          <Alert severity="info" sx={{ fontSize: '0.75rem', mb: 2 }}>
            Aucun logement disponible dans la meme ville avec une capacite suffisante pour ces dates.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
            {compatibleProperties.map((property) => {
              const isSelected = selectedPropertyId === property.id;
              const typeLabel = property.type
                ? PROPERTY_TYPE_LABELS[property.type] || property.type
                : '';

              return (
                <Box
                  key={property.id}
                  onClick={() => setSelectedPropertyId(property.id)}
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    border: '2px solid',
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    backgroundColor: isSelected ? 'action.selected' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      borderColor: isSelected ? 'primary.main' : 'primary.light',
                      backgroundColor: isSelected ? 'action.selected' : 'action.hover',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Home sx={{ fontSize: 18, color: isSelected ? 'primary.main' : 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem' }}>
                        {property.name}
                      </Typography>
                    </Box>
                    {isSelected && (
                      <CheckCircle sx={{ fontSize: 18, color: 'primary.main' }} />
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, ml: 3.5 }}>
                    <Chip
                      label={property.city}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.625rem', height: 20 }}
                    />
                    {typeLabel && (
                      <Chip
                        label={typeLabel}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.625rem', height: 20 }}
                      />
                    )}
                    <Chip
                      label={`${property.maxGuests} pers. max`}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.625rem', height: 20 }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}

        {/* Confirmation info */}
        {selectedProperty && (
          <Alert severity="info" sx={{ fontSize: '0.75rem', mb: 1 }}>
            La reservation de <strong>{reservation.guestName}</strong> sera deplacee vers{' '}
            <strong>{selectedProperty.name}</strong>. Les interventions liees (menage) seront
            automatiquement deplacees.
          </Alert>
        )}

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ fontSize: '0.75rem', mb: 1 }}>
            {error}
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
          startIcon={loading ? <CircularProgress size={14} /> : <SwapHoriz sx={{ fontSize: 16 }} />}
          sx={{ fontSize: '0.75rem', textTransform: 'none' }}
        >
          Confirmer le changement
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ChangePropertyDialog;
