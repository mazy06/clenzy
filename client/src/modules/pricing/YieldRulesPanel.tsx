import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { TriangleAlert, X } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Card } from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import { Field, FieldLabel, FieldDescription, Input } from '../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  NativeSelect,
  NativeSelectOption,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import EmptyState from '../../components/EmptyState';
import { History, Pencil, Plus, Save, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import {
  yieldRulesApi,
  type YieldConfig,
  type YieldJournalPage,
  type YieldMode,
  type YieldPropertyBounds,
  type YieldRuleV1,
} from '../../services/api/yieldRulesApi';
import PagePagination from '../../components/PagePagination';

// ─── Constants ──────────────────────────────────────────────────────────────

const EMPTY_RULE: Omit<YieldRuleV1, 'id'> = {
  propertyId: null,
  name: '',
  comparison: 'BELOW',
  occupancyThresholdPct: 40,
  windowDaysAhead: 30,
  adjustmentPct: 5,
  maxDailyChangePct: 10,
  active: true,
  priority: 0,
};

// ─── Component ──────────────────────────────────────────────────────────────

const YieldRulesPanel: React.FC = () => {
  const { t } = useTranslation();

  const [config, setConfig] = useState<YieldConfig | null>(null);
  const [rules, setRules] = useState<YieldRuleV1[]>([]);
  const [bounds, setBounds] = useState<YieldPropertyBounds[]>([]);
  const [journal, setJournal] = useState<YieldJournalPage | null>(null);
  const [journalPage, setJournalPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rule edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Omit<YieldRuleV1, 'id'>>(EMPTY_RULE);
  const [saving, setSaving] = useState(false);

  // Bounds inline edit
  const [boundsDraft, setBoundsDraft] = useState<Record<number, { floor: string; ceiling: string }>>({});

  const propertyNames = useMemo(() => {
    const map = new Map<number, string>();
    bounds.forEach((b) => map.set(b.propertyId, b.propertyName));
    return map;
  }, [bounds]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfg, ruleList, boundsList, journalPage0] = await Promise.all([
        yieldRulesApi.getConfig(),
        yieldRulesApi.listRules(),
        yieldRulesApi.listPropertyBounds(),
        yieldRulesApi.getJournal({ page: 0 }),
      ]);
      setConfig(cfg);
      setRules(ruleList);
      setBounds(boundsList);
      setJournal(journalPage0);
      setJournalPage(0);
    } catch {
      setError(t('yieldRules.loadError', 'Impossible de charger la configuration yield.'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const loadJournal = useCallback(async (page: number) => {
    try {
      const result = await yieldRulesApi.getJournal({ page });
      setJournal(result);
      setJournalPage(page);
    } catch {
      setError(t('yieldRules.loadError', 'Impossible de charger la configuration yield.'));
    }
  }, [t]);

  // ── Config handlers ──

  const updateConfig = async (next: YieldConfig) => {
    const previous = config;
    setConfig(next); // optimistic
    try {
      setConfig(await yieldRulesApi.updateConfig(next));
    } catch {
      setConfig(previous);
      setError(t('yieldRules.saveError', 'Enregistrement impossible, réessayez.'));
    }
  };

  // ── Rule handlers ──

  const openCreate = () => {
    setEditingId(null);
    setDraft(EMPTY_RULE);
    setDialogOpen(true);
  };

  const openEdit = (rule: YieldRuleV1) => {
    setEditingId(rule.id);
    setDraft({ ...rule });
    setDialogOpen(true);
  };

  const saveRule = async () => {
    setSaving(true);
    setError(null);
    try {
      if (editingId != null) {
        const updated = await yieldRulesApi.updateRule(editingId, draft);
        setRules((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
      } else {
        const created = await yieldRulesApi.createRule(draft);
        setRules((prev) => [...prev, created]);
      }
      setDialogOpen(false);
    } catch {
      setError(t('yieldRules.saveError', 'Enregistrement impossible, réessayez.'));
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (id: number) => {
    try {
      await yieldRulesApi.deleteRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError(t('yieldRules.saveError', 'Enregistrement impossible, réessayez.'));
    }
  };

  // ── Bounds handlers ──

  const boundsValue = (b: YieldPropertyBounds) =>
    boundsDraft[b.propertyId] ?? {
      floor: b.floor != null ? String(b.floor) : '',
      ceiling: b.ceiling != null ? String(b.ceiling) : '',
    };

  const saveBounds = async (propertyId: number) => {
    const value = boundsDraft[propertyId];
    if (!value) return;
    const floor = value.floor.trim() === '' ? null : Number(value.floor);
    const ceiling = value.ceiling.trim() === '' ? null : Number(value.ceiling);
    try {
      const updated = await yieldRulesApi.updatePropertyBounds(propertyId, floor, ceiling);
      setBounds((prev) => prev.map((b) => (b.propertyId === propertyId ? updated : b)));
      setBoundsDraft((prev) => {
        const next = { ...prev };
        delete next[propertyId];
        return next;
      });
    } catch {
      setError(t('yieldRules.boundsError', 'Bornes invalides : plancher < plafond, tous deux positifs (ou aucun).'));
    }
  };

  // ── Render ──

  if (loading) {
    return (
      <div className="flex justify-center py-9">
        <Spinner className="size-7" />
      </div>
    );
  }

  const modeHelp: Record<YieldMode, string> = {
    SIMULATION: t('yieldRules.modeHelp.simulation', 'Rapport de ce qui aurait changé — aucune écriture tarifaire.'),
    SUGGEST: t('yieldRules.modeHelp.suggest', 'Suggestions à approuver : les montants sont recalculés à l’application.'),
    AUTO: t('yieldRules.modeHelp.auto', 'Application automatique, bornée par le plancher/plafond de chaque bien.'),
  };

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <BuiAlert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setError(null)}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}

      {/* ── Config org : kill-switch + mode ── */}
      <Card className="gap-0 py-0 p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Field orientation="horizontal" className="w-auto">
            <Switch
              id="yield-kill-switch"
              checked={config?.enabled ?? false}
              onCheckedChange={(checked) => config && void updateConfig({ ...config, enabled: checked })}
            />
            <FieldLabel htmlFor="yield-kill-switch" className="flex-none font-normal">
              {t('yieldRules.killSwitch', 'Yield automatique activé')}
            </FieldLabel>
          </Field>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={config?.mode ?? 'SIMULATION'}
            // Radix renvoie '' quand on re-clique l'option active : le garde-fou
            // evite de repousser une config sans mode.
            onValueChange={(mode) =>
              mode && config && void updateConfig({ ...config, mode: mode as YieldMode })
            }
          >
            <ToggleGroupItem value="SIMULATION">{t('yieldRules.mode.simulation', 'Simulation')}</ToggleGroupItem>
            <ToggleGroupItem value="SUGGEST">{t('yieldRules.mode.suggest', 'Suggestion')}</ToggleGroupItem>
            <ToggleGroupItem value="AUTO">{t('yieldRules.mode.auto', 'Automatique')}</ToggleGroupItem>
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">
            {modeHelp[(config?.mode ?? 'SIMULATION') as YieldMode]}
          </p>
        </div>
      </Card>

      {/* ── Automatisations déterministes (R2) ── */}
      <Card className="gap-0 py-0 p-3">
        <h6 className="text-sm font-semibold tracking-tight mb-0.5">
          {t('yieldRules.automations.title', 'Automatisations')}
        </h6>
        <p className="text-xs text-muted-foreground mb-2">
          {t('yieldRules.automations.subtitle',
            'Ajustements déterministes appliqués chaque nuit, réversibles automatiquement.')}
        </p>

        {/* Orphan gap pricing */}
        <div className="flex items-center gap-3 flex-wrap">
          <Field orientation="horizontal" className="w-auto">
            <Switch
              id="yield-orphan-gap-toggle"
              checked={config?.orphanGapEnabled ?? false}
              onCheckedChange={(checked) =>
                config && void updateConfig({ ...config, orphanGapEnabled: checked })}
            />
            <FieldLabel htmlFor="yield-orphan-gap-toggle" className="flex-none font-normal">
              {t('yieldRules.automations.orphanGap.toggle', 'Tarifer les nuits orphelines')}
            </FieldLabel>
          </Field>
          {config?.orphanGapEnabled && (
            <>
              <Field className="w-[130px]">
                <FieldLabel htmlFor="yield-orphan-max-nights">
                  {t('yieldRules.automations.orphanGap.maxNights', 'Trou max (nuits)')}
                </FieldLabel>
                <Input
                  id="yield-orphan-max-nights"
                  type="number"
                  min={1}
                  max={7}
                  value={config.orphanGapMaxNights}
                  onChange={(e) =>
                    void updateConfig({ ...config, orphanGapMaxNights: Number(e.target.value) })}
                />
              </Field>
              <Field className="w-[110px]">
                <FieldLabel htmlFor="yield-orphan-discount-pct">
                  {t('yieldRules.automations.orphanGap.discountPct', 'Remise (%)')}
                </FieldLabel>
                <Input
                  id="yield-orphan-discount-pct"
                  type="number"
                  min={0}
                  max={50}
                  value={config.orphanGapDiscountPct}
                  onChange={(e) =>
                    void updateConfig({ ...config, orphanGapDiscountPct: Number(e.target.value) })}
                />
              </Field>
            </>
          )}
        </div>
        <span className="text-xs text-muted-foreground block mt-0.5 mb-2">
          {t('yieldRules.automations.orphanGap.help',
            'Remise + séjour minimum abaissé sur les courts trous entre deux réservations (jamais sous le prix plancher).')}
        </span>

        {/* Min-stay dynamique */}
        <div className="flex items-center gap-3 flex-wrap">
          <Field orientation="horizontal" className="w-auto">
            <Switch
              id="yield-minstay-toggle"
              checked={config?.minStayAutoEnabled ?? false}
              onCheckedChange={(checked) =>
                config && void updateConfig({ ...config, minStayAutoEnabled: checked })}
            />
            <FieldLabel htmlFor="yield-minstay-toggle" className="flex-none font-normal">
              {t('yieldRules.automations.minStay.toggle', 'Séjour minimum dynamique')}
            </FieldLabel>
          </Field>
          {config?.minStayAutoEnabled && (
            <>
              <Field className="w-[130px]">
                <FieldLabel htmlFor="yield-minstay-window">
                  {t('yieldRules.automations.minStay.reduceWithinDays', 'Fenêtre (jours)')}
                </FieldLabel>
                <Input
                  id="yield-minstay-window"
                  type="number"
                  min={1}
                  max={60}
                  value={config.minStayReduceWithinDays}
                  onChange={(e) =>
                    void updateConfig({ ...config, minStayReduceWithinDays: Number(e.target.value) })}
                />
              </Field>
              <Field className="w-[140px]">
                <FieldLabel htmlFor="yield-minstay-reduced">
                  {t('yieldRules.automations.minStay.reducedValue', 'Séjour min réduit')}
                </FieldLabel>
                <Input
                  id="yield-minstay-reduced"
                  type="number"
                  min={1}
                  max={30}
                  value={config.minStayReducedValue}
                  onChange={(e) =>
                    void updateConfig({ ...config, minStayReducedValue: Number(e.target.value) })}
                />
              </Field>
            </>
          )}
        </div>
        <span className="text-xs text-muted-foreground block mt-0.5">
          {t('yieldRules.automations.minStay.help',
            'Abaisse le séjour minimum des nuits encore libres à l’approche de la date (last-minute).')}
        </span>
      </Card>

      {/* ── Règles ── */}
      <Card className="gap-0 py-0 p-3">
        <div className="flex items-center justify-between mb-1.5">
          <h6 className="text-sm font-semibold tracking-tight">
            {t('yieldRules.rulesTitle', 'Règles d’occupation')}
          </h6>
          <BuiButton size="sm" variant="outline" onClick={openCreate}>
            <Plus size={16} />
            {t('yieldRules.addRule', 'Ajouter une règle')}
          </BuiButton>
        </div>
        {rules.length === 0 ? (
          <EmptyState
            icon={<SlidersHorizontal />}
            title={t(
              'yieldRules.noRules',
              'Aucune règle. Exemple : « si occupation < 40 % à 30 jours, baisser de 5 % ».',
            )}
            variant="transparent"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('yieldRules.col.name', 'Nom')}</TableHead>
                <TableHead>{t('yieldRules.col.scope', 'Périmètre')}</TableHead>
                <TableHead>{t('yieldRules.col.condition', 'Condition')}</TableHead>
                <TableHead className="text-end">{t('yieldRules.col.adjustment', 'Ajustement')}</TableHead>
                <TableHead className="text-end">{t('yieldRules.col.dailyCap', 'Cap / jour')}</TableHead>
                <TableHead>{t('yieldRules.col.status', 'Statut')}</TableHead>
                <TableHead className="text-end" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>{rule.name}</TableCell>
                  <TableCell>
                    {rule.propertyId != null
                      ? propertyNames.get(rule.propertyId) ?? `#${rule.propertyId}`
                      : t('yieldRules.scopeAll', 'Tous les biens')}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {rule.comparison === 'BELOW'
                      ? t('yieldRules.conditionBelow', 'Occupation < {{pct}} % à {{days}} j', {
                          pct: rule.occupancyThresholdPct,
                          days: rule.windowDaysAhead,
                        })
                      : t('yieldRules.conditionAbove', 'Occupation > {{pct}} % à {{days}} j', {
                          pct: rule.occupancyThresholdPct,
                          days: rule.windowDaysAhead,
                        })}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {rule.comparison === 'BELOW' ? '−' : '+'}
                    {rule.adjustmentPct} %
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{rule.maxDailyChangePct} %</TableCell>
                  <TableCell>
                    <StatusChip
                      tone={rule.active ? 'ok' : 'neutral'}
                      label={rule.active
                        ? t('yieldRules.active', 'Active')
                        : t('yieldRules.inactive', 'Inactive')}
                    />
                  </TableCell>
                  <TableCell className="text-end whitespace-nowrap">
                    <BuiButton
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('yieldRules.editRule', 'Modifier la règle')}
                      onClick={() => openEdit(rule)}
                    >
                      <Pencil size={15} />
                    </BuiButton>
                    <BuiButton
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('common.delete', 'Supprimer')}
                      onClick={() => rule.id != null && void deleteRule(rule.id)}
                    >
                      <Trash2 size={15} />
                    </BuiButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* ── Bornes par bien ── */}
      <Card className="gap-0 py-0 p-3">
        <h6 className="text-sm font-semibold tracking-tight mb-0.5">
          {t('yieldRules.boundsTitle', 'Garde-fous par bien')}
        </h6>
        <p className="text-xs text-muted-foreground mb-1.5">
          {t(
            'yieldRules.boundsSubtitle',
            'Plancher et plafond obligatoires : sans les deux, le yield ignore le bien (journalisé NO_BOUNDS).',
          )}
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('yieldRules.col.property', 'Bien')}</TableHead>
              <TableHead className="text-end">{t('yieldRules.col.floor', 'Plancher (€)')}</TableHead>
              <TableHead className="text-end">{t('yieldRules.col.ceiling', 'Plafond (€)')}</TableHead>
              <TableHead className="text-end" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {bounds.map((b) => {
              const value = boundsValue(b);
              const dirty = boundsDraft[b.propertyId] != null;
              return (
                <TableRow key={b.propertyId}>
                  <TableCell>{b.propertyName}</TableCell>
                  <TableCell className="text-end">
                    {/* Pas de libellé visible : l'en-tête de colonne le porte. On garde
                        donc un aria-label nommant le bien pour le lecteur d'écran. */}
                    <div className="flex justify-end">
                      <Input
                        id={`yield-bounds-floor-${b.propertyId}`}
                        aria-label={`${t('yieldRules.col.floor', 'Plancher (€)')} — ${b.propertyName}`}
                        inputMode="decimal"
                        className="w-[110px] text-end tabular-nums"
                        value={value.floor}
                        onChange={(e) =>
                          setBoundsDraft((prev) => ({
                            ...prev,
                            [b.propertyId]: { ...value, floor: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex justify-end">
                      <Input
                        id={`yield-bounds-ceiling-${b.propertyId}`}
                        aria-label={`${t('yieldRules.col.ceiling', 'Plafond (€)')} — ${b.propertyName}`}
                        inputMode="decimal"
                        className="w-[110px] text-end tabular-nums"
                        value={value.ceiling}
                        onChange={(e) =>
                          setBoundsDraft((prev) => ({
                            ...prev,
                            [b.propertyId]: { ...value, ceiling: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {/* Un bouton desactive n'emet pas d'evenement de survol :
                            l'enveloppe porte le declencheur a sa place. */}
                        <span className="inline-flex">
                          <BuiButton
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t('yieldRules.saveBounds', 'Enregistrer les bornes')}
                            disabled={!dirty}
                            onClick={() => void saveBounds(b.propertyId)}
                          >
                            <Save size={15} />
                          </BuiButton>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{t('yieldRules.saveBounds', 'Enregistrer les bornes')}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* ── Journal ── */}
      <Card className="gap-0 py-0 p-3">
        <h6 className="text-sm font-semibold tracking-tight mb-1.5">
          {t('yieldRules.journalTitle', 'Journal des ajustements')}
        </h6>
        {!journal || journal.content.length === 0 ? (
          <EmptyState
            icon={<History />}
            title={t('yieldRules.journalEmpty', 'Aucun ajustement journalisé pour le moment.')}
            variant="transparent"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('yieldRules.col.day', 'Évalué le')}</TableHead>
                    <TableHead>{t('yieldRules.col.property', 'Bien')}</TableHead>
                    <TableHead>{t('yieldRules.col.targetDate', 'Nuit')}</TableHead>
                    <TableHead>{t('yieldRules.col.mode', 'Mode')}</TableHead>
                    <TableHead className="text-end">{t('yieldRules.col.before', 'Avant')}</TableHead>
                    <TableHead className="text-end">{t('yieldRules.col.after', 'Après')}</TableHead>
                    <TableHead className="text-end">{t('yieldRules.col.occupancy', 'Occupation')}</TableHead>
                    <TableHead>{t('yieldRules.col.detail', 'Détail')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {journal.content.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="tabular-nums">{entry.adjustmentDay}</TableCell>
                      <TableCell>
                        {propertyNames.get(entry.propertyId) ?? `#${entry.propertyId}`}
                      </TableCell>
                      <TableCell className="tabular-nums">{entry.targetDate ?? '—'}</TableCell>
                      <TableCell>
                        {entry.skipReason ? (
                          <Badge variant="warning">{entry.skipReason}</Badge>
                        ) : (
                          <Badge variant="outline">{entry.mode}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {entry.priceBefore != null ? entry.priceBefore.toFixed(2) : '—'}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {entry.priceAfter != null ? entry.priceAfter.toFixed(2) : '—'}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {entry.occupancyPct != null ? `${entry.occupancyPct} %` : '—'}
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <p className="text-xs truncate" title={entry.reason ?? ''}>
                          {entry.reason ?? '—'}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <PagePagination
              count={journal.totalElements}
              page={journalPage}
              onPageChange={(page) => void loadJournal(page)}
              rowsPerPage={journal.size}
            />
          </>
        )}
      </Card>

      {/* ── Dialog règle ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId != null
                ? t('yieldRules.editRule', 'Modifier la règle')
                : t('yieldRules.newRule', 'Nouvelle règle de yield')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="yield-rule-name">{t('yieldRules.field.name', 'Nom')}</FieldLabel>
            <Input
              id="yield-rule-name"
              className="w-full"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="yield-rule-scope">{t('yieldRules.field.scope', 'Périmètre')}</FieldLabel>
            <NativeSelect
              id="yield-rule-scope"
              size="sm"
              className="w-full"
              value={draft.propertyId ?? ''}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  propertyId: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
            >
              <NativeSelectOption value="">{t('yieldRules.scopeAll', 'Tous les biens')}</NativeSelectOption>
              {bounds.map((b) => (
                <NativeSelectOption key={b.propertyId} value={b.propertyId}>
                  {b.propertyName}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <div className="flex gap-3">
            <Field className="flex-1">
              <FieldLabel htmlFor="yield-rule-comparison">
                {t('yieldRules.field.comparison', 'Si occupation')}
              </FieldLabel>
              <NativeSelect
                id="yield-rule-comparison"
                size="sm"
                className="w-full"
                value={draft.comparison}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, comparison: e.target.value as YieldRuleV1['comparison'] }))
                }
              >
                <NativeSelectOption value="BELOW">{t('yieldRules.below', 'Inférieure à (→ baisse)')}</NativeSelectOption>
                <NativeSelectOption value="ABOVE">{t('yieldRules.above', 'Supérieure à (→ hausse)')}</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field className="w-[120px]">
              <FieldLabel htmlFor="yield-rule-threshold">
                {t('yieldRules.field.threshold', 'Seuil (%)')}
              </FieldLabel>
              <Input
                id="yield-rule-threshold"
                type="number"
                min={0}
                max={100}
                value={draft.occupancyThresholdPct}
                onChange={(e) => setDraft((d) => ({ ...d, occupancyThresholdPct: Number(e.target.value) }))}
              />
            </Field>
            <Field className="w-[120px]">
              <FieldLabel htmlFor="yield-rule-window">
                {t('yieldRules.field.window', 'Fenêtre (j)')}
              </FieldLabel>
              <Input
                id="yield-rule-window"
                type="number"
                min={1}
                max={365}
                value={draft.windowDaysAhead}
                onChange={(e) => setDraft((d) => ({ ...d, windowDaysAhead: Number(e.target.value) }))}
              />
            </Field>
          </div>
          <div className="flex gap-3 items-center">
            <Field className="w-[160px]">
              <FieldLabel htmlFor="yield-rule-adjustment">
                {t('yieldRules.field.adjustment', 'Ajustement (%)')}
              </FieldLabel>
              <Input
                id="yield-rule-adjustment"
                type="number"
                min={0.5}
                max={50}
                step={0.5}
                value={draft.adjustmentPct}
                onChange={(e) => setDraft((d) => ({ ...d, adjustmentPct: Number(e.target.value) }))}
              />
              <FieldDescription>
                {draft.comparison === 'BELOW'
                  ? t('yieldRules.adjustmentHelpDown', 'Appliqué en baisse')
                  : t('yieldRules.adjustmentHelpUp', 'Appliqué en hausse')}
              </FieldDescription>
            </Field>
            <Field className="w-[160px]">
              <FieldLabel htmlFor="yield-rule-daily-cap">
                {t('yieldRules.field.dailyCap', 'Cap / jour (%)')}
              </FieldLabel>
              <Input
                id="yield-rule-daily-cap"
                type="number"
                min={1}
                max={50}
                step={0.5}
                value={draft.maxDailyChangePct}
                onChange={(e) => setDraft((d) => ({ ...d, maxDailyChangePct: Number(e.target.value) }))}
              />
            </Field>
            <Field orientation="horizontal" className="w-auto">
              <Switch
                id="yield-rule-active"
                checked={draft.active}
                onCheckedChange={(checked) => setDraft((d) => ({ ...d, active: checked }))}
              />
              <FieldLabel htmlFor="yield-rule-active" className="flex-none font-normal">
                {t('yieldRules.field.active', 'Active')}
              </FieldLabel>
            </Field>
          </div>
          </div>
          <DialogFooter>
            <BuiButton variant="ghost" onClick={() => setDialogOpen(false)}>{t('common.cancel', 'Annuler')}</BuiButton>
            <BuiButton onClick={() => void saveRule()} disabled={saving || !draft.name.trim()}>
              {t('common.save', 'Enregistrer')}
            </BuiButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default YieldRulesPanel;
