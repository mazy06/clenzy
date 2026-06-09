import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography,
} from '@mui/material';
import { useTranslation } from '../../hooks/useTranslation';

interface PropertyDeleteDialogProps {
  open: boolean;
  propertyName?: string;
  onClose: () => void;
  onConfirm: () => void;
}

/** Confirmation de suppression d'une propriété. */
const PropertyDeleteDialog: React.FC<PropertyDeleteDialogProps> = ({
  open, propertyName, onClose, onConfirm,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ fontSize: '0.875rem', fontWeight: 600, pb: 0.5 }}>
        {t('properties.confirmDelete')}
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: '0.8125rem' }}>
          {t('properties.confirmDeleteMessage', { name: propertyName })}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 1.5 }}>
        <Button onClick={onClose} size="small" sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={onConfirm}
          color="error"
          variant="contained"
          size="small"
          sx={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'none', height: 28 }}
        >
          {t('properties.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PropertyDeleteDialog;
