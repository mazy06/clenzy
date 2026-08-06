import React from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui';
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
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('properties.confirmDelete')}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-foreground">
          {t('properties.confirmDeleteMessage', { name: propertyName })}
        </p>
        <DialogFooter>
          <Button onClick={onClose} variant="ghost" size="sm">
            {t('common.cancel')}
          </Button>
          <Button onClick={onConfirm} variant="destructive" size="sm">
            {t('properties.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PropertyDeleteDialog;
