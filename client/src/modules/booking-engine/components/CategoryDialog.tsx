import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
} from '@mui/material';
import { useTranslation } from '../../../hooks/useTranslation';
import type { BookingServiceCategory, CreateCategoryPayload } from '../../../services/api/bookingServiceOptionsApi';

interface CategoryDialogProps {
  open: boolean;
  category?: BookingServiceCategory;
  onClose: () => void;
  onSave: (data: CreateCategoryPayload) => void;
}

const CategoryDialog: React.FC<CategoryDialogProps> = ({ open, category, onClose, onSave }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setName(category?.name ?? '');
      setDescription(category?.description ?? '');
    }
  }, [open, category]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim() || null, active: category?.active ?? true });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>
        {category ? t('serviceOptions.editCategory') : t('serviceOptions.addCategory')}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        <TextField
          autoFocus fullWidth size="small"
          label={t('common.name')}
          value={name} onChange={(e) => setName(e.target.value)}
        />
        <TextField
          fullWidth size="small" multiline minRows={2} maxRows={4}
          label={t('common.description')}
          value={description} onChange={(e) => setDescription(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} size="small">{t('common.cancel')}</Button>
        <Button onClick={handleSubmit} variant="contained" size="small" disabled={!name.trim()}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

CategoryDialog.displayName = 'CategoryDialog';

export default CategoryDialog;
