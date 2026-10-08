import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import {
  Spinner,
  Button,
  Card,
  Switch,
  Separator,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import EmptyState from '../../components/EmptyState';
import { Add as AddIcon } from '../../icons';
import { Edit as EditIcon } from '../../icons';
import { Delete as DeleteIcon } from '../../icons';
import { LocalOffer as TagIcon } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { Money } from '../../components/Money';
import type { RatePlan, CreateRatePlanData } from '../../services/api/calendarPricingApi';

// ─── Style Constants ────────────────────────────────────────────────────────

/** Densité de la carte : la surface vient de `Card`, le rythme d'ici. */
const PANEL_CLASS = 'bp-data-panel gap-0 p-5';

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
    <Card className={PANEL_CLASS}>
      {/* Header — overline de section (pattern pcard) */}
      <p className="text-xs font-semibold tracking-tight text-muted-foreground mb-1.5">
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
        <EmptyState
          icon={<TagIcon />}
          title={t('dynamicPricing.ratePlan.empty')}
          variant="transparent"
        />
      )}

      {/* Plan list */}
      {!loading && ratePlans.map((plan, idx) => (
        <React.Fragment key={plan.id}>
          {idx > 0 && <Separator className="my-[4.5px]" />}
          <div className={cn(
            'bp-plan-row flex items-center gap-3 py-3',
            'transition-opacity duration-150 ease-out-quart motion-reduce:transition-none',
            plan.isActive ? 'opacity-100' : 'text-muted-foreground',
          )}>
            {/* Type badge */}
            <span className="bp-plan-type inline-flex min-w-24 items-center gap-2 text-xs text-foreground">
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: TYPE_COLORS[plan.type] ?? '#8BA0B3' }} />
              {t('dynamicPricing.ratePlan.types.' + plan.type)}
            </span>

            {/* Name + date range */}
            <div className="flex-1 min-w-0">
              <p dir="auto" className="text-sm font-semibold truncate">
                {plan.name}
              </p>
              {formatDateRange(plan) && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatDateRange(plan)}
                </span>
              )}
            </div>

            {/* Price — display tabular-nums */}
            <p className="text-sm font-semibold min-w-[60px] text-end tabular-nums text-foreground">
              <Money value={plan.nightlyPrice} from={plan.currency || 'EUR'} />
            </p>

            {/* Active toggle */}
            <Switch
              size="sm"
              aria-label={plan.name}
              checked={plan.isActive}
              onCheckedChange={() => handleToggleActive(plan)}
              disabled={updateLoading}
            />

            {/* Actions */}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('common.edit')}
              onClick={() => onEditPlan(plan)}
            >
              <EditIcon size={16} strokeWidth={1.75} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('common.delete')}
              onClick={() => setDeleteConfirmId(plan.id)}
              className="text-destructive-ink hover:text-destructive-ink hover:bg-destructive-soft"
            >
              <DeleteIcon size={16} strokeWidth={1.75} />
            </Button>
          </div>
        </React.Fragment>
      ))}

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(next) => { if (!next) setDeleteConfirmId(null); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{t('dynamicPricing.ratePlan.delete')}</DialogTitle>
            <DialogDescription className="text-sm">{t('dynamicPricing.ratePlan.deleteConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)} disabled={deleteLoading}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? <Spinner className="size-3.5" /> : null}
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default RatePlanManager;
