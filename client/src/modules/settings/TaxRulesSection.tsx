import React, { useState, useMemo } from 'react';
import StatusChip from '../../components/StatusChip';
import { Alert as UiAlert, AlertDescription } from '../../components/ui';
import { Info } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Button, TextField, MenuItem, Alert, Snackbar, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import { Card } from '../../components/ui';
import {
  Add, Edit, Delete, Gavel, Info as InfoIcon,
  Hotel, Percent, CleaningServices, Restaurant,
} from '../../icons';
import type { LucideIcon } from 'lucide-react';
import { useTaxRules, useCreateTaxRule, useUpdateTaxRule, useDeleteTaxRule } from '../../hooks/useTaxRules';
import { useFiscalProfile } from '../../hooks/useFiscalProfile';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { COUNTRY_OPTIONS } from '../../utils/currencyUtils';
import { TAX_CATEGORIES } from '../../services/api/taxRulesApi';
import type { TaxRule, TaxRuleRequest, TaxCategoryType } from '../../services/api/taxRulesApi';

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<TaxCategoryType, string> = {
  ACCOMMODATION: 'Hebergement',
  STANDARD: 'Standard',
  CLEANING: 'Menage',
  FOOD: 'Restauration',
};

const CATEGORY_STYLE: Record<TaxCategoryType, { Icon: LucideIcon; color: string }> = {
  ACCOMMODATION: { Icon: Hotel, color: 'var(--ok)' },
  STANDARD: { Icon: Percent, color: 'var(--accent)' },
  CLEANING: { Icon: CleaningServices, color: 'var(--info)' },
  FOOD: { Icon: Restaurant, color: 'var(--warn)' },
};

const DEFAULT_CATEGORY_STYLE = { Icon: Percent, color: 'var(--muted)' };

const EMPTY_FORM: TaxRuleRequest = {
  countryCode: 'FR',
  taxCategory: 'STANDARD',
  taxRate: 0.20,
  taxName: '',
  effectiveFrom: new Date().toISOString().split('T')[0],
  effectiveTo: null,
  description: null,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Backend stores rate as decimal (0.20), UI shows percentage (20) */
function rateToPercent(rate: number): string {
  return (rate * 100).toFixed(2).replace(/\.?0+$/, '');
}

function percentToRate(percent: string): number {
  const val = parseFloat(percent);
  return isNaN(val) ? 0 : val / 100;
}

// ─── Component ───────────────────────────────────────────────────────────────

const TaxRulesSection: React.FC = () => {
  const { t } = useTranslation();
  // Libellé de catégorie traduit (le label FR statique sert de défaut/fallback).
  const categoryLabel = (cat: string) =>
    t(`fiscal.taxRules.categories.${cat}`, CATEGORY_LABELS[cat as TaxCategoryType] ?? cat);
  const { hasAnyRole } = useAuth();
  const { data: fiscalProfile } = useFiscalProfile();
  const isSuperAdmin = hasAnyRole(['SUPER_ADMIN']);

  // Country filter — default to org's country
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const countryCode = selectedCountry || fiscalProfile?.countryCode || 'FR';

  const { data: rules, isLoading, error, refetch } = useTaxRules(countryCode);
  const createMutation = useCreateTaxRule();
  const updateMutation = useUpdateTaxRule();
  const deleteMutation = useDeleteTaxRule();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TaxRule | null>(null);
  const [form, setForm] = useState<TaxRuleRequest>({ ...EMPTY_FORM });
  const [ratePercent, setRatePercent] = useState('20');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<TaxRule | null>(null);

  // Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  // Sort rules by category
  const sortedRules = useMemo(() => {
    if (!rules) return [];
    const categoryOrder = TAX_CATEGORIES.reduce<Record<string, number>>((acc, cat, i) => {
      acc[cat] = i;
      return acc;
    }, {});
    // TOURIST_TAX exclu de cet écran (géré par tourist_tax_configs) : filtre
    // défensif pour les environnements pas encore migrés par le changeset 0315.
    return [...rules]
      .filter(r => r.taxCategory !== 'TOURIST_TAX')
      .sort((a, b) =>
        (categoryOrder[a.taxCategory] ?? 99) - (categoryOrder[b.taxCategory] ?? 99)
      );
  }, [rules]);

  // ── Dialog handlers ──

  const openCreateDialog = () => {
    setEditingRule(null);
    const defaultRate = '20';
    setForm({ ...EMPTY_FORM, countryCode });
    setRatePercent(defaultRate);
    setDialogOpen(true);
  };

  const openEditDialog = (rule: TaxRule) => {
    setEditingRule(rule);
    setForm({
      countryCode: rule.countryCode,
      taxCategory: rule.taxCategory,
      taxRate: rule.taxRate,
      taxName: rule.taxName,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
      description: rule.description,
    });
    setRatePercent(rateToPercent(rule.taxRate));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingRule(null);
  };

  const handleFormChange = (field: keyof TaxRuleRequest, value: string | null) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleRateChange = (value: string) => {
    setRatePercent(value);
    setForm(prev => ({ ...prev, taxRate: percentToRate(value) }));
  };

  const handleSave = async () => {
    try {
      if (editingRule) {
        await updateMutation.mutateAsync({ id: editingRule.id, data: form });
        setSnackbar({ open: true, message: t('fiscal.taxRules.updated'), severity: 'success' });
      } else {
        await createMutation.mutateAsync(form);
        setSnackbar({ open: true, message: t('fiscal.taxRules.created'), severity: 'success' });
      }
      closeDialog();
    } catch {
      setSnackbar({ open: true, message: t('fiscal.taxRules.error'), severity: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setSnackbar({ open: true, message: t('fiscal.taxRules.deleted'), severity: 'success' });
      setDeleteTarget(null);
    } catch {
      setSnackbar({ open: true, message: t('fiscal.taxRules.error'), severity: 'error' });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner className="size-10" />
      </div>
    );
  }

  // ── Error ──
  if (error && !rules) {
    return (
      <Alert
        severity="warning"
        icon={<InfoIcon />}
        action={
          <Button color="inherit" size="small" onClick={() => refetch()}>
            {t('fiscal.taxRules.retry')}
          </Button>
        }
        sx={{ mb: 2 }}
      >
        {t('fiscal.taxRules.loadError')}
      </Alert>
    );
  }

  return (
    <div>
      <Card className="gap-0 py-0 p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex text-primary"><Gavel size={20} strokeWidth={1.75} /></span>
            <h6 className="cn-text-subtitle1 font-semibold text-[0.95rem]">
              {t('fiscal.taxRules.title')}
            </h6>
          </div>

          <div className="flex items-center gap-2">
            {/* Country selector */}
            <TextField
              select
              value={countryCode}
              onChange={(e) => setSelectedCountry(e.target.value)}
              size="small"
              sx={{ minWidth: 160 }}
            >
              {COUNTRY_OPTIONS.map(c => (
                <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
              ))}
            </TextField>

            {/* Add button (SUPER_ADMIN only) */}
            {isSuperAdmin && (
              <Button
                variant="contained"
                disableElevation
                startIcon={<Add size={14} strokeWidth={2} />}
                onClick={openCreateDialog}
                size="small"
>
                {t('fiscal.taxRules.add')}
              </Button>
            )}
          </div>
        </div>

        {/* Rules table */}
        {sortedRules.length === 0 ? (
          <UiAlert variant="info" className="mt-1.5">
            <Info />
            <AlertDescription>{t('fiscal.taxRules.noRules')}</AlertDescription>
          </UiAlert>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fiscal.taxRules.category')}</TableHead>
                  <TableHead>{t('fiscal.taxRules.taxName')}</TableHead>
                  <TableHead className="text-end">{t('fiscal.taxRules.rate')}</TableHead>
                  <TableHead>{t('fiscal.taxRules.from')}</TableHead>
                  <TableHead>{t('fiscal.taxRules.to')}</TableHead>
                  <TableHead>{t('fiscal.taxRules.description')}</TableHead>
                  {isSuperAdmin && <TableHead className="text-center">{t('fiscal.taxRules.actions')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRules.map(rule => {
                  const catKey = rule.taxCategory as TaxCategoryType;
                  const { Icon: CategoryIcon, color: categoryColor } =
                    CATEGORY_STYLE[catKey] ?? DEFAULT_CATEGORY_STYLE;
                  return (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <StatusChip tokens={{ color: categoryColor, bg: `color-mix(in srgb, ${categoryColor} 8%, transparent)` }} label={categoryLabel(catKey)} icon={<CategoryIcon size={11} strokeWidth={2} />} className="tracking-[0.01em] px-0.5" />
                    </TableCell>
                    <TableCell>{rule.taxName}</TableCell>
                    <TableCell className="text-end font-semibold tabular-nums">
                      {rateToPercent(rule.taxRate)} %
                    </TableCell>
                    <TableCell className="text-[0.8rem] tabular-nums">
                      {rule.effectiveFrom}
                    </TableCell>
                    <TableCell className="text-[0.8rem] text-[var(--muted)] tabular-nums">
                      {rule.effectiveTo ?? '—'}
                    </TableCell>
                    <TableCell className="text-[0.8rem] text-[var(--muted)] max-w-[200px]">
                      {rule.description ?? '—'}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell className="text-center">
                        <div className="inline-flex items-center gap-0.5">
                          <Tooltip title={t('fiscal.taxRules.edit')}>
                            <IconButton
                              size="small"
                              onClick={() => openEditDialog(rule)}
                              aria-label={t('fiscal.taxRules.edit')}
                              sx={{
                                width: 28,
                                height: 28,
                                borderRadius: '6px',
                                color: 'text.secondary',
                                border: '1px solid',
                                borderColor: 'divider',
                                transition: 'border-color 150ms cubic-bezier(0.22, 1, 0.36, 1), background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                                '&:hover': {
                                  color: 'var(--accent)',
                                  borderColor: 'color-mix(in srgb, var(--accent) 40%, transparent)',
                                  backgroundColor: 'var(--accent-soft)',
                                },
                              }}
                            >
                              <Edit size={13} strokeWidth={1.75} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t('fiscal.taxRules.delete')}>
                            <IconButton
                              size="small"
                              onClick={() => setDeleteTarget(rule)}
                              aria-label={t('fiscal.taxRules.delete')}
                              sx={{
                                width: 28,
                                height: 28,
                                borderRadius: '6px',
                                color: 'text.secondary',
                                border: '1px solid',
                                borderColor: 'divider',
                                transition: 'border-color 150ms cubic-bezier(0.22, 1, 0.36, 1), background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), color 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                                '&:hover': {
                                  color: 'var(--err)',
                                  borderColor: 'color-mix(in srgb, var(--err) 40%, transparent)',
                                  backgroundColor: 'var(--err-soft)',
                                },
                              }}
                            >
                              <Delete size={13} strokeWidth={1.75} />
                            </IconButton>
                          </Tooltip>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingRule ? t('fiscal.taxRules.editTitle') : t('fiscal.taxRules.addTitle')}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            select
            label={t('fiscal.taxRules.category')}
            value={form.taxCategory}
            onChange={(e) => handleFormChange('taxCategory', e.target.value)}
            size="small"
            fullWidth
            required
          >
            {TAX_CATEGORIES.map(cat => (
              <MenuItem key={cat} value={cat}>{categoryLabel(cat)}</MenuItem>
            ))}
          </TextField>

          <TextField
            label={t('fiscal.taxRules.taxName')}
            value={form.taxName}
            onChange={(e) => handleFormChange('taxName', e.target.value)}
            size="small"
            fullWidth
            required
            placeholder="Ex: TVA 20%"
          />

          <TextField
            label={t('fiscal.taxRules.ratePercent')}
            value={ratePercent}
            onChange={(e) => handleRateChange(e.target.value)}
            size="small"
            fullWidth
            required
            type="number"
            inputProps={{ min: 0, max: 100, step: 0.01 }}
            helperText={t('fiscal.taxRules.rateHelp')}
          />

          <TextField
            select
            label={t('fiscal.taxRules.countryLabel')}
            value={form.countryCode}
            onChange={(e) => handleFormChange('countryCode', e.target.value)}
            size="small"
            fullWidth
            required
          >
            {COUNTRY_OPTIONS.map(c => (
              <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
            ))}
          </TextField>

          <TextField
            label={t('fiscal.taxRules.from')}
            value={form.effectiveFrom}
            onChange={(e) => handleFormChange('effectiveFrom', e.target.value)}
            size="small"
            fullWidth
            required
            type="date"
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label={t('fiscal.taxRules.to')}
            value={form.effectiveTo ?? ''}
            onChange={(e) => handleFormChange('effectiveTo', e.target.value || null)}
            size="small"
            fullWidth
            type="date"
            InputLabelProps={{ shrink: true }}
            helperText={t('fiscal.taxRules.toHelp')}
          />

          <TextField
            label={t('fiscal.taxRules.description')}
            value={form.description ?? ''}
            onChange={(e) => handleFormChange('description', e.target.value || null)}
            size="small"
            fullWidth
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} size="small">
            {t('fiscal.taxRules.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={isSaving || !form.taxName || !form.effectiveFrom}
            size="small"
            startIcon={isSaving ? <Spinner className="size-4" /> : undefined}
          >
            {isSaving ? t('fiscal.taxRules.saving') : t('fiscal.taxRules.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
        <DialogTitle>{t('fiscal.taxRules.deleteConfirmTitle')}</DialogTitle>
        <DialogContent>
          <p className="cn-text-body2">
            {t('fiscal.taxRules.deleteConfirmMessage', {
              name: deleteTarget?.taxName ?? '',
              category: deleteTarget ? categoryLabel(deleteTarget.taxCategory) : '',
            })}
          </p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} size="small">
            {t('fiscal.taxRules.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            size="small"
          >
            {deleteMutation.isPending ? t('fiscal.taxRules.deleting') : t('fiscal.taxRules.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default TaxRulesSection;
