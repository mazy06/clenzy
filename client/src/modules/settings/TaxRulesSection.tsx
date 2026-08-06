import React, { useState, useMemo } from 'react';
import StatusChip, { type StatusTone } from '../../components/StatusChip';
import { Alert as UiAlert, AlertAction, AlertDescription } from '../../components/ui';
import { Info } from 'lucide-react';
import { Spinner } from '../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import { Card, Button } from '../../components/ui';
import {
  Field,
  FieldLabel,
  FieldDescription,
  Input,
  Textarea,
  NativeSelect,
  NativeSelectOption,
} from '../../components/ui';
import {
  Add, Edit, Delete, Gavel, Info as InfoIcon,
  Hotel, Percent, CleaningServices, Restaurant,
} from '../../icons';
import type { LucideIcon } from 'lucide-react';
import { useTaxRules, useCreateTaxRule, useUpdateTaxRule, useDeleteTaxRule } from '../../hooks/useTaxRules';
import { useFiscalProfile } from '../../hooks/useFiscalProfile';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
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

/**
 * Categorie de taxe → icone + ton semantique du kit. Le ton porte deja le
 * couple fond doux / encre conforme AA : plus de `color-mix` a la volee.
 */
const CATEGORY_STYLE: Record<TaxCategoryType, { Icon: LucideIcon; tone: StatusTone }> = {
  ACCOMMODATION: { Icon: Hotel, tone: 'ok' },
  STANDARD: { Icon: Percent, tone: 'accent' },
  CLEANING: { Icon: CleaningServices, tone: 'info' },
  FOOD: { Icon: Restaurant, tone: 'warn' },
};

const DEFAULT_CATEGORY_STYLE: { Icon: LucideIcon; tone: StatusTone } = { Icon: Percent, tone: 'neutral' };

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
  const { notify } = useNotification();
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
        notify.success(t('fiscal.taxRules.updated'));
      } else {
        await createMutation.mutateAsync(form);
        notify.success(t('fiscal.taxRules.created'));
      }
      closeDialog();
    } catch {
      notify.error(t('fiscal.taxRules.error'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      notify.success(t('fiscal.taxRules.deleted'));
      setDeleteTarget(null);
    } catch {
      notify.error(t('fiscal.taxRules.error'));
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
      <UiAlert variant="warning" className="mb-3">
        <InfoIcon />
        <AlertDescription>{t('fiscal.taxRules.loadError')}</AlertDescription>
        <AlertAction>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            {t('fiscal.taxRules.retry')}
          </Button>
        </AlertAction>
      </UiAlert>
    );
  }

  return (
    <div>
      <Card className="gap-0 py-0 p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex text-primary"><Gavel size={20} strokeWidth={1.75} /></span>
            <h6 className="text-[0.95rem] font-semibold tracking-tight">
              {t('fiscal.taxRules.title')}
            </h6>
          </div>

          <div className="flex items-center gap-2">
            {/* Country selector */}
            {/* Filtre sans libelle visible (il jouxte le titre de la carte) :
                l'aria-label reste la seule etiquette. */}
            <NativeSelect
              className="min-w-[160px]"
              aria-label={t('fiscal.taxRules.countryLabel')}
              value={countryCode}
              onChange={(e) => setSelectedCountry(e.target.value)}
            >
              {COUNTRY_OPTIONS.map(c => (
                <NativeSelectOption key={c.code} value={c.code}>{c.label}</NativeSelectOption>
              ))}
            </NativeSelect>

            {/* Add button (SUPER_ADMIN only) */}
            {isSuperAdmin && (
              <Button size="sm" onClick={openCreateDialog}>
                <Add size={14} strokeWidth={2} />
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
                  const { Icon: CategoryIcon, tone: categoryTone } =
                    CATEGORY_STYLE[catKey] ?? DEFAULT_CATEGORY_STYLE;
                  return (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <StatusChip tone={categoryTone} label={categoryLabel(catKey)} icon={<CategoryIcon size={11} strokeWidth={2} />} className="tracking-[0.01em] px-0.5" />
                    </TableCell>
                    <TableCell>{rule.taxName}</TableCell>
                    <TableCell className="text-end font-semibold tabular-nums">
                      {rateToPercent(rule.taxRate)} %
                    </TableCell>
                    <TableCell className="text-[0.8rem] tabular-nums">
                      {rule.effectiveFrom}
                    </TableCell>
                    <TableCell className="text-[0.8rem] text-muted-foreground tabular-nums">
                      {rule.effectiveTo ?? '—'}
                    </TableCell>
                    <TableCell className="text-[0.8rem] text-muted-foreground max-w-[200px]">
                      {rule.description ?? '—'}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell className="text-center">
                        <div className="inline-flex items-center gap-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {/* Le span porte la ref que Radix pose sur son
                                  enfant : Button est une fonction, il n'en
                                  transmet pas. */}
                              <span className="inline-flex">
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  onClick={() => openEditDialog(rule)}
                                  aria-label={t('fiscal.taxRules.edit')}
                                  className="text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary-soft"
                                >
                                  <Edit size={13} strokeWidth={1.75} />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{t('fiscal.taxRules.edit')}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  onClick={() => setDeleteTarget(rule)}
                                  aria-label={t('fiscal.taxRules.delete')}
                                  className="text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive-soft"
                                >
                                  <Delete size={13} strokeWidth={1.75} />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{t('fiscal.taxRules.delete')}</TooltipContent>
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
      <Dialog open={dialogOpen} onOpenChange={(next) => { if (!next) closeDialog(); }}>
        <DialogContent className="max-w-[600px] max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? t('fiscal.taxRules.editTitle') : t('fiscal.taxRules.addTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="tax-rule-category">{t('fiscal.taxRules.category')}</FieldLabel>
            <NativeSelect
              id="tax-rule-category"
              className="w-full"
              required
              value={form.taxCategory}
              onChange={(e) => handleFormChange('taxCategory', e.target.value)}
            >
              {TAX_CATEGORIES.map(cat => (
                <NativeSelectOption key={cat} value={cat}>{categoryLabel(cat)}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor="tax-rule-name">{t('fiscal.taxRules.taxName')}</FieldLabel>
            <Input
              id="tax-rule-name"
              required
              placeholder="Ex: TVA 20%"
              value={form.taxName}
              onChange={(e) => handleFormChange('taxName', e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="tax-rule-rate">{t('fiscal.taxRules.ratePercent')}</FieldLabel>
            <Input
              id="tax-rule-rate"
              type="number"
              required
              min={0}
              max={100}
              step={0.01}
              className="tabular-nums"
              value={ratePercent}
              onChange={(e) => handleRateChange(e.target.value)}
            />
            <FieldDescription>{t('fiscal.taxRules.rateHelp')}</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="tax-rule-country">{t('fiscal.taxRules.countryLabel')}</FieldLabel>
            <NativeSelect
              id="tax-rule-country"
              className="w-full"
              required
              value={form.countryCode}
              onChange={(e) => handleFormChange('countryCode', e.target.value)}
            >
              {COUNTRY_OPTIONS.map(c => (
                <NativeSelectOption key={c.code} value={c.code}>{c.label}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor="tax-rule-from">{t('fiscal.taxRules.from')}</FieldLabel>
            <Input
              id="tax-rule-from"
              type="date"
              required
              value={form.effectiveFrom}
              onChange={(e) => handleFormChange('effectiveFrom', e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="tax-rule-to">{t('fiscal.taxRules.to')}</FieldLabel>
            <Input
              id="tax-rule-to"
              type="date"
              value={form.effectiveTo ?? ''}
              onChange={(e) => handleFormChange('effectiveTo', e.target.value || null)}
            />
            <FieldDescription>{t('fiscal.taxRules.toHelp')}</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="tax-rule-description">{t('fiscal.taxRules.description')}</FieldLabel>
            {/* Le primitif pose field-sizing:content, qui neutralise `rows` :
                min-h en unites de ligne garantit les deux lignes. */}
            <Textarea
              id="tax-rule-description"
              className="min-h-[2lh]"
              value={form.description ?? ''}
              onChange={(e) => handleFormChange('description', e.target.value || null)}
            />
          </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={closeDialog}>
              {t('fiscal.taxRules.cancel')}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !form.taxName || !form.effectiveFrom}
            >
              {isSaving ? <Spinner className="size-4" /> : null}
              {isSaving ? t('fiscal.taxRules.saving') : t('fiscal.taxRules.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(next) => { if (!next) setDeleteTarget(null); }}>
        <DialogContent className="max-w-[444px]">
          <DialogHeader>
            <DialogTitle>{t('fiscal.taxRules.deleteConfirmTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('fiscal.taxRules.deleteConfirmMessage', {
              name: deleteTarget?.taxName ?? '',
              category: deleteTarget ? categoryLabel(deleteTarget.taxCategory) : '',
            })}
          </p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              {t('fiscal.taxRules.cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t('fiscal.taxRules.deleting') : t('fiscal.taxRules.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaxRulesSection;
