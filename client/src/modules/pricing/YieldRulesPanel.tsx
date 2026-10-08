import React, { useCallback, useEffect, useState } from 'react';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton, Skeleton,
  Field, FieldLabel, FieldDescription, Input, NativeSelect, NativeSelectOption, Switch } from '../../components/ui';
import { TriangleAlert, X } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { yieldRulesApi, type YieldConfig, type YieldJournalPage, type YieldMode,
  type YieldPropertyBounds, type YieldRuleV1 } from '../../services/api/yieldRulesApi';
import type { Property } from '../../services/api/propertiesApi';
import BaitlyYieldWorkspace from './BaitlyYieldWorkspace';
import './baitlyYield.css';

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

const YieldRulesPanel: React.FC<{ property?: Property; currency?: string }> = ({ property, currency = 'EUR' }) => {
  const { t } = useTranslation();

  const [config, setConfig] = useState<YieldConfig | null>(null);
  const [rules, setRules] = useState<YieldRuleV1[]>([]);
  const [bounds, setBounds] = useState<YieldPropertyBounds[]>([]);
  const [journal, setJournal] = useState<YieldJournalPage | null>(null);
  const [journalPage, setJournalPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Édition d’une règle dans le scénario.
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Omit<YieldRuleV1, 'id'>>(EMPTY_RULE);
  const [saving, setSaving] = useState(false);

  // Bounds inline edit
  const [boundsDraft, setBoundsDraft] = useState<Record<number, { floor: string; ceiling: string }>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfg, ruleList, boundsList, journalPage0] = await Promise.all([
        yieldRulesApi.getConfig(),
        yieldRulesApi.listRules(),
        yieldRulesApi.listPropertyBounds(),
        yieldRulesApi.getJournal({ page: 0, propertyId: property?.id }),
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
  }, [t, property?.id]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const loadJournal = useCallback(async (page: number) => {
    try {
      const result = await yieldRulesApi.getJournal({ page, propertyId: property?.id });
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
    setDraft({ ...EMPTY_RULE, propertyId: property?.id ?? null });
    setEditorOpen(true);
  };

  const openEdit = (rule: YieldRuleV1) => {
    setEditingId(rule.id);
    setDraft({ ...rule, adjustmentPct: Math.abs(rule.adjustmentPct) });
    setEditorOpen(true);
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
      setEditorOpen(false);
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
    if (!(floor == null && ceiling == null) && (floor == null || ceiling == null || !Number.isFinite(floor) || !Number.isFinite(ceiling) || floor <= 0 || ceiling <= floor)) {
      setError(t('yieldRules.boundsError', 'Bornes invalides : plancher < plafond, tous deux positifs (ou aucun).'));
      return;
    }
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
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const modeHelp: Record<YieldMode, string> = {
    SIMULATION: t('yieldRules.modeHelp.simulation', 'Rapport de ce qui aurait changé, sans écriture tarifaire.'),
    SUGGEST: t('yieldRules.modeHelp.suggest', 'Suggestions à approuver : les montants sont recalculés à l’application.'),
    AUTO: t('yieldRules.modeHelp.auto', 'Application automatique, bornée par le plancher/plafond de chaque bien.'),
  };

  const visibleRules = property ? rules.filter(rule => rule.propertyId == null || rule.propertyId === property.id) : rules;
  const editor = editorOpen ? <section className="by-rule-editor" aria-labelledby="yield-editor-heading">
    <h4 id="yield-editor-heading">{editingId != null ? t('yieldRules.editRule', 'Modifier la règle') : t('yieldRules.newRule', 'Nouvelle règle de yield')}</h4>
          <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="yield-rule-name">{t('yieldRules.field.name', 'Nom')}</FieldLabel>
            <Input
              id="yield-rule-name"
              autoFocus
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
          <div className="by-rule-editor-fields">
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
          <div className="by-rule-editor-fields">
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
    <div className="by-editor-actions">
      <BuiButton variant="ghost" onClick={() => setEditorOpen(false)}>{t('common.cancel', 'Annuler')}</BuiButton>
      <BuiButton onClick={() => void saveRule()} disabled={saving || !draft.name.trim()}>{saving ? t('common.loading', 'Chargement') : t('common.save', 'Enregistrer')}</BuiButton>
    </div>
  </section> : null;

  return <div className="by-controller">
    {error && <BuiAlert variant="destructive"><TriangleAlert /><AlertDescription>{error}{!config && <BuiButton variant="outline" size="sm" onClick={() => void loadAll()}>{t('common.retry', 'Réessayer')}</BuiButton>}</AlertDescription>
      <AlertAction><BuiButton variant="ghost" size="icon-xs" aria-label={t('common.close', 'Fermer')} onClick={() => setError(null)}><X /></BuiButton></AlertAction></BuiAlert>}
    <BaitlyYieldWorkspace config={config} rules={visibleRules} bounds={bounds} property={property} currency={currency}
      journal={journal} journalPage={journalPage} modeHelp={modeHelp} editor={editor}
      onConfig={next => void updateConfig(next)} onCreate={openCreate} onEdit={openEdit} onDelete={id => void deleteRule(id)}
      boundsValue={boundsValue} dirtyBounds={boundsDraft} onBoundsChange={(id, value) => setBoundsDraft(previous => ({ ...previous, [id]: value }))}
      onSaveBounds={id => void saveBounds(id)} onJournalPage={page => void loadJournal(page)} />
  </div>;
};

export default YieldRulesPanel;
