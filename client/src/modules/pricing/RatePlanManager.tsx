import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import { Spinner } from '../../components/ui';
import { Paper, Button, IconButton, Switch, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Divider } from '@mui/material';
import StatusChip from '../../components/StatusChip';
import { Add as AddIcon } from '../../icons';
import { Edit as EditIcon } from '../../icons';
import { Delete as DeleteIcon } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { Money } from '../../components/Money';
import type { RatePlan, CreateRatePlanData } from '../../services/api/calendarPricingApi';

// ─── Style Constants ────────────────────────────────────────────────────────

const CARD_SX = {
  border: '1px solid',
  borderColor: 'var(--line)',
  bgcolor: 'var(--card)',
  boxShadow: 'none',
  borderRadius: '14px',
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
      {/* Header — overline de section (pattern pcard) */}
      <p className="cn-text-body1 text-[10.5px] font-bold text-[var(--faint)] uppercase tracking-[0.06em] mb-1.5">
        {t('dynamicPricing.ratePlan.title')}
      </p>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-3">
          <Spinner className="size-[22px]" />
        </div>
      )}

      {/* Empty state */}
      {!loading && ratePlans.length === 0 && (
        <p className="cn-text-body2 text-muted-foreground text-[0.75rem] py-3 text-center">
          {t('dynamicPricing.ratePlan.empty')}
        </p>
      )}

      {/* Plan list */}
      {!loading && ratePlans.map((plan, idx) => (
        <React.Fragment key={plan.id}>
          {idx > 0 && <Divider sx={{ my: 0.75 }} />}
          <div className={cn('flex items-center gap-1.5 py-[4.5px]', plan.isActive ? 'opacity-100' : 'opacity-50')} style={{ transition: 'opacity 0.15s' }}>
            {/* Type badge */}
            {(() => { const c = TYPE_COLORS[plan.type] ?? '#8BA0B3'; return (
            <StatusChip
              color={c}
              label={t(`dynamicPricing.ratePlan.types.${plan.type}`)}
              className="border border-solid font-bold text-[0.625rem] min-w-20"
              sx={{ borderColor: `${c}40` }}
            />
            ); })()}

            {/* Name + date range */}
            <div className="flex-1 min-w-0">
              <p className="cn-text-body2 font-semibold truncate text-[0.8125rem]">
                {plan.name}
              </p>
              {formatDateRange(plan) && (
                <span className="cn-text-caption text-muted-foreground text-[0.625rem]">
                  {formatDateRange(plan)}
                </span>
              )}
            </div>

            {/* Price — display tabular-nums */}
            <p className="cn-text-body2 font-semibold min-w-[60px] text-end text-[0.8125rem] font-[var(--font-display)] tabular-nums text-[var(--ink)]">
              <Money value={plan.nightlyPrice} from={plan.currency || 'EUR'} />
            </p>

            {/* Active toggle */}
            <Switch
              size="small"
              checked={plan.isActive}
              onChange={() => handleToggleActive(plan)}
              disabled={updateLoading}
            />

            {/* Actions */}
            <IconButton size="small" onClick={() => onEditPlan(plan)} sx={{ p: 0.5 }}>
              <EditIcon size={16} strokeWidth={1.75} />
            </IconButton>
            <IconButton size="small" onClick={() => setDeleteConfirmId(plan.id)} color="error" sx={{ p: 0.5 }}>
              <DeleteIcon size={16} strokeWidth={1.75} />
            </IconButton>
          </div>
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
            startIcon={deleteLoading ? <Spinner className="size-3.5" /> : undefined}
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
