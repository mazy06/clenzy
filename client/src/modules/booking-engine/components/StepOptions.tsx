import React, { useState } from 'react';
import {
  Box, Typography, IconButton, Switch, Chip,
} from '@mui/material';
import {
  Add, Edit, Delete, ExpandMore, ExpandLess,
} from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  useServiceCategories, useCreateCategory, useUpdateCategory,
  useDeleteCategory, useCreateItem, useUpdateItem, useDeleteItem,
} from '../../../hooks/useBookingServiceOptions';
import type { BookingServiceCategory, BookingServiceItem } from '../../../services/api/bookingServiceOptionsApi';
import CategoryDialog from './CategoryDialog';
import ItemDialog from './ItemDialog';

// ─── Types ──────────────────────────────────────────────────────────────────

interface StepOptionsProps {
  configId: number | null;
}

const PRICING_LABELS: Record<string, string> = {
  PER_BOOKING: 'serviceOptions.pricingMode.perBooking',
  PER_PERSON: 'serviceOptions.pricingMode.perPerson',
  PER_NIGHT: 'serviceOptions.pricingMode.perNight',
};

// ─── Component ──────────────────────────────────────────────────────────────

const StepOptions: React.FC<StepOptionsProps> = ({ configId: _configId }) => {
  const { t } = useTranslation();
  const { data: categories = [] } = useServiceCategories();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const deleteCat = useDeleteCategory();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();

  // Auto-expand all categories by default
  const [expanded, setExpanded] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    categories.forEach(c => { init[c.id] = true; });
    return init;
  });
  const [catDialog, setCatDialog] = useState<{ open: boolean; category?: BookingServiceCategory }>({ open: false });
  const [itemDialog, setItemDialog] = useState<{ open: boolean; categoryId?: number; item?: BookingServiceItem }>({ open: false });

  const toggle = (id: number) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.875rem' }}>
          {t('serviceOptions.title')}
        </Typography>
        <Chip
          icon={<Add size={16} strokeWidth={1.75} />}
          label={t('serviceOptions.addCategory')}
          size="small"
          onClick={() => setCatDialog({ open: true })}
          sx={{ cursor: 'pointer' }}
        />
      </Box>

      {categories.length === 0 && (
        <Typography sx={{ fontSize: 13, color: 'text.secondary', textAlign: 'center', py: 4 }}>
          {t('serviceOptions.empty')}
        </Typography>
      )}

      {categories.map(cat => (
        <Box key={cat.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          {/* Category header */}
          <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, bgcolor: 'action.hover', gap: 1 }}>
            <IconButton size="small" onClick={() => toggle(cat.id)}>
              {expanded[cat.id] ? <ExpandLess size={18} strokeWidth={1.75} /> : <ExpandMore size={18} strokeWidth={1.75} />}
            </IconButton>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{cat.name}</Typography>
              {cat.description && (
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{cat.description}</Typography>
              )}
            </Box>
            <Switch
              size="small" checked={cat.active}
              onChange={(e) => updateCat.mutate({ id: cat.id, data: { name: cat.name, description: cat.description, active: e.target.checked } })}
            />
            <IconButton size="small" onClick={() => setCatDialog({ open: true, category: cat })}>
              <Edit size={16} strokeWidth={1.75} />
            </IconButton>
            <IconButton size="small" onClick={() => { if (confirm(t('serviceOptions.deleteCategoryConfirm'))) deleteCat.mutate(cat.id); }}>
              <Delete size={16} strokeWidth={1.75} />
            </IconButton>
          </Box>

          {/* Items list */}
          {expanded[cat.id] && (
            <Box sx={{ px: 2, py: 1.5 }}>
              {cat.items.map(item => (
                <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', py: 1, gap: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                      {item.name}
                      {item.mandatory && <Typography component="span" sx={{ color: 'error.main', ml: 0.5 }}>*</Typography>}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                      {item.price.toFixed(2)} EUR &middot; {t(PRICING_LABELS[item.pricingMode])} &middot; {item.inputType}
                    </Typography>
                  </Box>
                  <Switch
                    size="small" checked={item.active}
                    onChange={(e) => updateItem.mutate({ id: item.id, data: { ...item, active: e.target.checked } })}
                  />
                  <IconButton size="small" onClick={() => setItemDialog({ open: true, categoryId: cat.id, item })}>
                    <Edit size={16} strokeWidth={1.75} />
                  </IconButton>
                  <IconButton size="small" onClick={() => { if (confirm(t('serviceOptions.deleteItemConfirm'))) deleteItem.mutate(item.id); }}>
                    <Delete size={16} strokeWidth={1.75} />
                  </IconButton>
                </Box>
              ))}
              <Chip
                icon={<Add size={14} strokeWidth={1.75} />}
                label={t('serviceOptions.addItem')}
                size="small" variant="outlined" sx={{ mt: 1.5, cursor: 'pointer' }}
                onClick={() => setItemDialog({ open: true, categoryId: cat.id })}
              />
            </Box>
          )}
        </Box>
      ))}

      {/* Dialogs */}
      <CategoryDialog
        open={catDialog.open}
        category={catDialog.category}
        onClose={() => setCatDialog({ open: false })}
        onSave={(data) => {
          if (catDialog.category) {
            updateCat.mutate({ id: catDialog.category.id, data }, { onSuccess: () => setCatDialog({ open: false }) });
          } else {
            createCat.mutate(data, { onSuccess: () => setCatDialog({ open: false }) });
          }
        }}
      />
      <ItemDialog
        open={itemDialog.open}
        item={itemDialog.item}
        onClose={() => setItemDialog({ open: false })}
        onSave={(data) => {
          if (itemDialog.item) {
            updateItem.mutate({ id: itemDialog.item.id, data }, { onSuccess: () => setItemDialog({ open: false }) });
          } else if (itemDialog.categoryId) {
            createItem.mutate({ categoryId: itemDialog.categoryId, data }, { onSuccess: () => setItemDialog({ open: false }) });
          }
        }}
      />
    </Box>
  );
};

StepOptions.displayName = 'StepOptions';

export default StepOptions;
