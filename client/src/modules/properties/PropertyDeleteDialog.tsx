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
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        {t('properties.confirmDelete')}
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: '13px', color: 'var(--body)' }}>
          {t('properties.confirmDeleteMessage', { name: propertyName })}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} size="small" variant="text">
          {t('common.cancel')}
        </Button>
        <Button onClick={onConfirm} color="error" variant="contained" size="small">
          {t('properties.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PropertyDeleteDialog;
