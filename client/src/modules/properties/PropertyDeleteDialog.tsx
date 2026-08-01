import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Button } from '../../components/ui';
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
        <p className="cn-text-body1 text-[13px] text-[var(--body)]">
          {t('properties.confirmDeleteMessage', { name: propertyName })}
        </p>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="ghost" size="sm">
          {t('common.cancel')}
        </Button>
        <Button onClick={onConfirm} variant="destructive" size="sm">
          {t('properties.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PropertyDeleteDialog;
