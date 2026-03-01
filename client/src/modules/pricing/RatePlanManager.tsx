import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  Divider,
  alpha,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from '../../hooks/useTranslation';
import { getCurrencySymbol } from '../../utils/currencyUtils';
import type { RatePlan, CreateRatePlanData } from '../../services/api/calendarPricingApi';

// ─── Style Constants ────────────────────────────────────────────────────────

const CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
  p: 1.5,
} as const;

const TYPE_COLORS: Record<string, string> = {
  BASE: '#5CB8AA',
  SEASONAL: '#E0B483',
  PROMOTIONAL: '#BA68C8',
  LAST_MINUTE: '#8DB6D4',
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface RatePlanManagerProps {
  ratePlans: RatePlan[];
  loading: boolean;
  onEditPlan: (plan: RatePlan) => void;
  onUpdatePlan: (params: { id: number; data: Partial<CreateRatePlanData> }) => Promise<unknown>;
  onDeletePlan: (id: number) => Promise<unknown>;
  updateLoading: boolean;
  deleteLoading: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

const RatePlanManager: React.FC<RatePlanManagerProps> = ({
  ratePlans,
  loading,
  onEditPlan,
  onUpdatePlan,
  onDeletePlan,
  updateLoading,
  deleteLoading,
}) => {
  const { t } = useTranslation();
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const handleDelete = async () => {
    if (deleteConfirmId !== null) {
      await onDeletePlan(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleToggleActive = async (plan: RatePlan) => {
    await onUpdatePlan({ id: plan.id, data: { isActive: !plan.isActive } });
  };

  const formatDateRange = (plan: RatePlan): string => {
    if (!plan.startDate && !plan.endDate) return '';
    const parts: string[] = [];
    if (plan.startDate) parts.push(plan.startDate);
    if (plan.endDate) parts.push(plan.endDate);
    return parts.join(' → ');
  };

  return (
    <Paper sx={CARD_SX}>
      {/* Header */}
      <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.8125rem', mb: 1 }}>
        {t('dynamicPricing.ratePlan.title')}
      </Typography>

      {/* Loading */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={22} />
        </Box>
      )}

      {/* Empty state */}
      {!loading && ratePlans.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', py: 2, textAlign: 'center' }}>
          {t('dynamicPricing.ratePlan.empty')}
        </Typography>
      )}

      {/* Plan list */}
      {!loading && ratePlans.map((plan, idx) => (
        <React.Fragment key={plan.id}>
          {idx > 0 && <Divider sx={{ my: 0.75 }} />}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              py: 0.75,
              opacity: plan.isActive ? 1 : 0.5,
              transition: 'opacity 0.15s',
            }}
          >
            {/* Type badge */}
            <Chip
              label={t(`dynamicPricing.ratePlan.types.${plan.type}`)}
              size="small"
              sx={{
                bgcolor: (theme) => alpha(TYPE_COLORS[plan.type] ?? '#8BA0B3', 0.15),
                color: TYPE_COLORS[plan.type] ?? '#8BA0B3',
                fontWeight: 700,
                fontSize: '0.625rem',
                height: 22,
                minWidth: 80,
              }}
            />

            {/* Name + date range */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: '0.8125rem' }}>
                {plan.name}
              </Typography>
              {formatDateRange(plan) && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.625rem' }}>
                  {formatDateRange(plan)}
                </Typography>
              )}
            </Box>

            {/* Price */}
            <Typography variant="body2" fontWeight={700} sx={{ minWidth: 60, textAlign: 'right', fontSize: '0.8125rem' }}>
              {plan.nightlyPrice}{getCurrencySymbol(plan.currency || 'EUR')}
            </Typography>

            {/* Active toggle */}
            <Switch
              size="small"
              checked={plan.isActive}
              onChange={() => handleToggleActive(plan)}
              disabled={updateLoading}
            />

            {/* Actions */}
            <IconButton size="small" onClick={() => onEditPlan(plan)} sx={{ p: 0.5 }}>
              <EditIcon sx={{ fontSize: 16 }} />
            </IconButton>
            <IconButton size="small" onClick={() => setDeleteConfirmId(plan.id)} color="error" sx={{ p: 0.5 }}>
              <DeleteIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        </React.Fragment>
      ))}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmId !== null} onClose={() => setDeleteConfirmId(null)}>
        <DialogTitle sx={{ fontSize: '0.9375rem' }}>{t('dynamicPricing.ratePlan.delete')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.8125rem' }}>{t('dynamicPricing.ratePlan.deleteConfirm')}</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button onClick={() => setDeleteConfirmId(null)} disabled={deleteLoading} size="small" sx={{ textTransform: 'none' }}>
            {t('common.cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            size="small"
            onClick={handleDelete}
            disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={14} /> : undefined}
            sx={{ textTransform: 'none' }}
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default RatePlanManager;
