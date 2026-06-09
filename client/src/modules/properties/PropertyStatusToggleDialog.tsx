import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, CircularProgress,
} from '@mui/material';
import type { PropertyListItem } from '../../hooks/usePropertiesList';

interface PropertyStatusToggleDialogProps {
  /** Propriété ciblée (null = dialog fermé). */
  property: PropertyListItem | null;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation d'activation / désactivation d'une propriété depuis la liste.
 * Le sens (activer vs désactiver) découle du statut courant de la propriété.
 */
const PropertyStatusToggleDialog: React.FC<PropertyStatusToggleDialogProps> = ({
  property, pending = false, onClose, onConfirm,
}) => {
  const isActive = property?.status === 'active';

  return (
    <Dialog
      open={!!property}
      onClose={pending ? undefined : onClose}
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle sx={{ fontSize: '0.9375rem', fontWeight: 700, pb: 0.5 }}>
        {isActive ? 'Désactiver cette propriété ?' : 'Réactiver cette propriété ?'}
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
          {property && <><strong>{property.name}</strong>{' '}</>}
          {isActive
            ? 'ne sera plus visible dans le planning, les recherches et le booking engine. Tu pourras la réactiver à tout moment.'
            : 'réapparaîtra dans le planning, les recherches et le booking engine.'}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 1.5 }}>
        <Button
          onClick={onClose}
          size="small"
          disabled={pending}
          sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
        >
          Annuler
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          size="small"
          color={isActive ? 'warning' : 'primary'}
          disabled={pending}
          startIcon={pending ? <CircularProgress size={14} color="inherit" /> : undefined}
          sx={{ textTransform: 'none', fontSize: '0.8125rem', fontWeight: 600, height: 28 }}
        >
          {isActive ? 'Désactiver' : 'Réactiver'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PropertyStatusToggleDialog;
