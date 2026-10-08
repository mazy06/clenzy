import React, { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, History, Pencil, Plus, ShieldCheck, Trash2 } from '../../icons/glyphs';
import { Button, Field, FieldLabel, Input, Switch } from '../../components/ui';
import PagePagination from '../../components/PagePagination';
import { useTranslation } from '../../hooks/useTranslation';
import type { Property } from '../../services/api/propertiesApi';
import type { YieldConfig, YieldJournalPage, YieldMode, YieldPropertyBounds, YieldRuleV1 } from '../../services/api/yieldRulesApi';
import { PropertyThumbnail } from './BaitlyPricingPropertyMenu';
import { pricingAmount } from './BaitlyPricingProposal';

export function groupYieldRules(rules: YieldRuleV1[]) {
  const groups = new Map<string, YieldRuleV1[]>();
  for (const rule of rules) {
    const key = JSON.stringify([rule.name, rule.comparison, rule.occupancyThresholdPct, rule.windowDaysAhead,
      Math.abs(rule.adjustmentPct), rule.maxDailyChangePct, rule.active, rule.priority]);
    groups.set(key, [...(groups.get(key) ?? []), rule]);
  }
  return [...groups.values()];
}

interface Props {
  config: YieldConfig | null;
  rules: YieldRuleV1[];
  bounds: YieldPropertyBounds[];
  property?: Property;
  currency: string;
  journal: YieldJournalPage | null;
  journalPage: number;
  modeHelp: Record<YieldMode, string>;
  editor: React.ReactNode;
  onConfig: (config: YieldConfig) => void;
  onCreate: () => void;
  onEdit: (rule: YieldRuleV1) => void;
  onDelete: (id: number) => void;
  boundsValue: (bounds: YieldPropertyBounds) => { floor: string; ceiling: string };
  onBoundsChange: (id: number, value: { floor: string; ceiling: string }) => void;
  onSaveBounds: (id: number) => void;
  dirtyBounds: Record<number, unknown>;
  onJournalPage: (page: number) => void;
}

export default function BaitlyYieldWorkspace(props: Props) {
  const { t } = useTranslation();
  const { config, property, bounds, currency, journal, rules } = props;
  const [page, setPage] = useState(0);
  const groups = useMemo(() => groupYieldRules(rules), [rules]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(groups.length / 6) - 1));
  const mode = config?.mode ?? 'SIMULATION';
  const bound = bounds.find(b => b.propertyId === property?.id) ?? (!property ? bounds[0] : undefined);
  const value = bound ? props.boundsValue(bound) : null;
  const validBounds = value && value.floor.trim() !== '' && value.ceiling.trim() !== ''
    && Number.isFinite(Number(value.floor)) && Number.isFinite(Number(value.ceiling))
    && Number(value.floor) > 0 && Number(value.ceiling) > Number(value.floor);
  const clearedBounds = value && value.floor.trim() === '' && value.ceiling.trim() === '';
  const update = (patch: Partial<YieldConfig>) => config && props.onConfig({ ...config, ...patch });
  const namedProperty = (id: number | null) => id == null ? t('yieldRules.scopeAll', 'Tous les biens')
    : bounds.find(b => b.propertyId === id)?.propertyName ?? `#${id}`;

  return <div className="by-workspace">
    <section className="by-pilot" aria-label={t('baitlyPricing.yield.pilot', 'Pilotage des ajustements')}>
      <div className="by-pilot-intro"><img src="/images/hitl/pricing-optimization.webp" alt="" />
        <div><h2>{t('baitlyPricing.yield.pilot', 'Pilotage des ajustements')}</h2>
          <p>{t('baitlyPricing.yield.scope', 'Le mode et les automatismes s’appliquent à l’organisation. Les règles et les limites ci-dessous concernent le logement sélectionné.')}</p></div>
        <Field orientation="horizontal" className="w-auto"><Switch id="yield-kill-switch" checked={config?.enabled ?? false} onCheckedChange={enabled => update({ enabled })} />
          <FieldLabel htmlFor="yield-kill-switch">{config?.enabled ? t('baitlyPricing.yield.running', 'Activé') : t('baitlyPricing.yield.paused', 'En pause')}</FieldLabel></Field>
      </div>
      <div className="by-modes" role="group" aria-label={t('yieldRules.col.mode', 'Mode')}>
        {(['SIMULATION', 'SUGGEST', 'AUTO'] as const).map((item, index) => <Button key={item} variant="ghost" aria-pressed={mode === item}
          onClick={() => update({ mode: item })}><span className="by-mode-number">{index + 1}</span>{t(`yieldRules.mode.${item === 'SIMULATION' ? 'simulation' : item === 'SUGGEST' ? 'suggest' : 'auto'}`, item === 'SIMULATION' ? 'Simulation' : item === 'SUGGEST' ? 'Suggestion' : 'Automatique')}</Button>)}
      </div>
      <p className="by-mode-explanation">{props.modeHelp[mode]}</p>
      {!config?.enabled && <p className="by-paused-note">{t('baitlyPricing.yield.pausedHelp', 'Les réglages sont conservés. Aucun nouvel ajustement n’est exécuté tant que le pilotage est en pause.')}</p>}
    </section>

    <div className="by-layout"><div className="by-scenarios">
      <section className="by-scenario">
        <div className="by-scenario-heading"><div><h3>{t('baitlyPricing.yield.fillGaps', 'Combler les nuits entre deux séjours')}</h3><p>{t('yieldRules.automations.orphanGap.help', 'Remise et séjour minimum réduit sur les courts trous entre deux réservations, sans passer sous le plancher.')}</p></div>
          <Switch aria-label={t('yieldRules.automations.orphanGap.toggle', 'Tarifer les nuits orphelines')} checked={config?.orphanGapEnabled ?? false} onCheckedChange={orphanGapEnabled => update({ orphanGapEnabled })} /></div>
        <div className="by-gap-example" aria-label={t('baitlyPricing.yield.example', 'Exemple illustratif')}>
          <span className="by-reserved">{t('baitlyPricing.yield.booked', 'Réservé')}</span><span className="by-gap"><strong>{config?.orphanGapMaxNights ?? 3}</strong>{t('baitlyPricing.yield.nightsMax', 'nuits maximum')}</span><span className="by-reserved">{t('baitlyPricing.yield.booked', 'Réservé')}</span>
          <span className="by-example-label">{t('baitlyPricing.yield.example', 'Exemple illustratif')}</span>
        </div>
        <div className="by-outcome"><ArrowRight size={16} /><span>{t('baitlyPricing.yield.gapOutcome', 'Une remise pour rendre ce court séjour plus attractif')}</span><strong>−{config?.orphanGapDiscountPct ?? 15} %</strong></div>
        <details className="by-settings"><summary>{t('baitlyPricing.yield.settings', 'Réglages du scénario')}<ChevronDown size={15} /></summary><div className="by-fields">
          <Field><FieldLabel htmlFor="yield-orphan-max-nights">{t('yieldRules.automations.orphanGap.maxNights', 'Trou max (nuits)')}</FieldLabel><Input id="yield-orphan-max-nights" type="number" min={1} max={7} disabled={!config?.orphanGapEnabled} value={config?.orphanGapMaxNights ?? 3} onChange={e => update({ orphanGapMaxNights: Number(e.target.value) })} /></Field>
          <Field><FieldLabel htmlFor="yield-orphan-discount-pct">{t('yieldRules.automations.orphanGap.discountPct', 'Remise (%)')}</FieldLabel><Input id="yield-orphan-discount-pct" type="number" min={0} max={50} disabled={!config?.orphanGapEnabled} value={config?.orphanGapDiscountPct ?? 15} onChange={e => update({ orphanGapDiscountPct: Number(e.target.value) })} /></Field>
        </div></details>
      </section>

      <section className="by-scenario by-last-minute">
        <div className="by-scenario-heading"><div><h3>{t('baitlyPricing.yield.lastMinute', 'Assouplir les séjours à l’approche de la date')}</h3><p>{t('yieldRules.automations.minStay.help', 'Abaisse le séjour minimum des nuits encore libres à l’approche de la date.')}</p></div>
          <Switch aria-label={t('yieldRules.automations.minStay.toggle', 'Séjour minimum dynamique')} checked={config?.minStayAutoEnabled ?? false} onCheckedChange={minStayAutoEnabled => update({ minStayAutoEnabled })} /></div>
        <div className="by-time-window"><span>J−{config?.minStayReduceWithinDays ?? 14}</span><div><span /></div><span>{t('baitlyPricing.yield.arrival', 'Arrivée')}</span></div>
        <div className="by-outcome"><ArrowRight size={16} /><span>{t('baitlyPricing.yield.minStayOutcome', 'Les nuits libres acceptent des séjours plus courts')}</span><strong>{t('baitlyPricing.yield.nightLabel', { count: config?.minStayReducedValue ?? 1, defaultValue: '{{count}} nuit(s)' })}</strong></div>
        <details className="by-settings"><summary>{t('baitlyPricing.yield.settings', 'Réglages du scénario')}<ChevronDown size={15} /></summary><div className="by-fields">
          <Field><FieldLabel htmlFor="yield-minstay-window">{t('yieldRules.automations.minStay.reduceWithinDays', 'Fenêtre (jours)')}</FieldLabel><Input id="yield-minstay-window" type="number" min={1} max={60} disabled={!config?.minStayAutoEnabled} value={config?.minStayReduceWithinDays ?? 14} onChange={e => update({ minStayReduceWithinDays: Number(e.target.value) })} /></Field>
          <Field><FieldLabel htmlFor="yield-minstay-reduced">{t('yieldRules.automations.minStay.reducedValue', 'Séjour min réduit')}</FieldLabel><Input id="yield-minstay-reduced" type="number" min={1} max={30} disabled={!config?.minStayAutoEnabled} value={config?.minStayReducedValue ?? 1} onChange={e => update({ minStayReducedValue: Number(e.target.value) })} /></Field>
        </div></details>
      </section>

      <section className="by-demand"><div className="by-section-heading"><div><h3>{t('yieldRules.rulesTitle', 'Règles d’occupation')}</h3><p>{t('baitlyPricing.yield.rulesHelp', 'Lisez chaque scénario de gauche à droite : déclencheur, ajustement, limite.')}</p></div><Button variant="outline" size="sm" onClick={props.onCreate}><Plus size={16} />{t('yieldRules.addRule', 'Ajouter une règle')}</Button></div>
        {props.editor}
        {groups.length === 0 && <div className="by-rule-empty"><h4>{t('baitlyPricing.yield.noRules', 'Aucun scénario d’occupation pour ce logement')}</h4><p>{t('yieldRules.noRules', 'Exemple : si l’occupation est inférieure à 40 % à 30 jours, baisser le prix de 5 %.')}</p></div>}
        {groups.slice(currentPage * 6, currentPage * 6 + 6).map(group => { const rule = group[0]; return <article className="by-rule" key={group.map(r => r.id).join(':')}>
          <div className="by-rule-title"><h4>{rule.name}</h4><span className="by-rule-status">{rule.active ? t('yieldRules.active', 'Active') : t('yieldRules.inactive', 'Inactive')}</span></div>
          <div className="by-rule-flow"><div><small>{t('baitlyPricing.yield.when', 'Quand')}</small><strong>{rule.comparison === 'BELOW' ? '<' : '>'} {rule.occupancyThresholdPct} %</strong><span>{t('baitlyPricing.yield.occupancyAt', { defaultValue: 'd’occupation à {{days}} jours', days: rule.windowDaysAhead })}</span><div className="by-threshold" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, rule.occupancyThresholdPct))}%` }} /></div></div>
            <ArrowRight size={18} className="by-flow-arrow" /><div><small>{t('baitlyPricing.yield.then', 'Alors')}</small><strong className="by-rule-adjustment">{rule.comparison === 'BELOW' ? '−' : '+'}{Math.abs(rule.adjustmentPct)} %</strong><span>{t('baitlyPricing.yield.rateAdjustment', 'sur le prix de la nuit')}</span></div>
            <div className="by-rule-limit"><ShieldCheck size={16} /><span>{t('baitlyPricing.yield.dailyLimit', { defaultValue: '{{value}} % maximum par jour', value: rule.maxDailyChangePct })}</span></div>
          </div>
          <details className="by-rule-properties"><summary>{group.length === 1 ? namedProperty(rule.propertyId) : t('baitlyPricing.yield.propertyCount', { defaultValue: '{{count}} logements concernés', count: group.length })}<ChevronDown size={15} /></summary>
            {group.map(item => <div key={item.id ?? 'all'}><span>{namedProperty(item.propertyId)}</span><Button variant="ghost" size="sm" onClick={() => props.onEdit(item)}><Pencil size={14} />{t('yieldRules.editRule', 'Modifier la règle')}</Button><Button variant="ghost" size="icon-sm" aria-label={`${t('common.delete', 'Supprimer')} ${item.name} · ${namedProperty(item.propertyId)}`} onClick={() => item.id != null && props.onDelete(item.id)}><Trash2 size={14} /></Button></div>)}
          </details>
        </article>; })}
        {groups.length > 6 && <PagePagination page={currentPage} onPageChange={setPage} count={groups.length} rowsPerPage={6} />}
      </section>
    </div>

    <aside className="by-guardrails"><div className="by-property-identity">{property && <PropertyThumbnail property={property} />}<div><small>{t('baitlyPricing.yield.protectedProperty', 'Logement encadré')}</small><h3>{property?.name ?? bound?.propertyName ?? t('baitlyPricing.chooseProperty', 'Sélectionnez un logement')}</h3></div></div>
      <h4>{t('baitlyPricing.yield.safeRange', 'Une plage de prix maîtrisée')}</h4><p>{t('baitlyPricing.yield.boundsHelp', 'Chaque ajustement reste entre ces deux limites. Sans plancher et plafond, le logement est exclu des ajustements.')}</p>
      {bound && value ? <><div className="by-price-range"><div><small>{t('baitlyPricing.yield.floor', 'Plancher')}</small><strong>{value.floor === '' || !Number.isFinite(Number(value.floor)) ? '–' : pricingAmount(Number(value.floor), currency)}</strong></div><span aria-hidden="true" /><div><small>{t('baitlyPricing.yield.ceiling', 'Plafond')}</small><strong>{value.ceiling === '' || !Number.isFinite(Number(value.ceiling)) ? '–' : pricingAmount(Number(value.ceiling), currency)}</strong></div></div>
        <p className={validBounds ? 'by-bounds-status' : 'by-bounds-status by-bounds-missing'}>{validBounds ? t('baitlyPricing.yield.boundsReady', 'Limites définies') : t('baitlyPricing.yield.boundsMissing', 'Définissez les deux limites pour inclure ce logement.')}</p>
        <div className="by-fields"><Field><FieldLabel htmlFor={`yield-bounds-floor-${bound.propertyId}`}>{t('baitlyPricing.yield.floor', 'Plancher')} ({currency})</FieldLabel><Input id={`yield-bounds-floor-${bound.propertyId}`} inputMode="decimal" value={value.floor} onChange={e => props.onBoundsChange(bound.propertyId, { ...value, floor: e.target.value })} /></Field><Field><FieldLabel htmlFor={`yield-bounds-ceiling-${bound.propertyId}`}>{t('baitlyPricing.yield.ceiling', 'Plafond')} ({currency})</FieldLabel><Input id={`yield-bounds-ceiling-${bound.propertyId}`} inputMode="decimal" value={value.ceiling} onChange={e => props.onBoundsChange(bound.propertyId, { ...value, ceiling: e.target.value })} /></Field></div>
        <Button className="by-save-bounds" disabled={!props.dirtyBounds[bound.propertyId] || (!validBounds && !clearedBounds)} onClick={() => props.onSaveBounds(bound.propertyId)}>{t('yieldRules.saveBounds', 'Enregistrer les bornes')}</Button>
      </> : <p className="by-bounds-status by-bounds-missing">{t('baitlyPricing.yield.boundsUnavailable', 'Les limites de ce logement sont indisponibles.')}</p>}
    </aside></div>

    <details className="by-journal"><summary><History size={17} />{t('yieldRules.journalTitle', 'Journal des ajustements')}<span>{journal?.totalElements ?? 0}</span><ChevronDown size={16} /></summary>
      {!journal?.content.length ? <p>{t('yieldRules.journalEmpty', 'Aucun ajustement journalisé pour le moment.')}</p> : <><ol>{journal.content.map(entry => <li key={entry.id}><div><time>{entry.targetDate ?? entry.adjustmentDay}</time><small>{entry.adjustmentDay}</small></div><div><strong>{namedProperty(entry.propertyId)}</strong><p>{entry.reason ?? (entry.skipReason ? t('baitlyPricing.yield.skippedHelp', 'Cet ajustement n’a pas été appliqué. Vérifiez les règles et les limites du logement.') : '–')}</p></div><div className="by-journal-price">{entry.priceBefore != null ? pricingAmount(entry.priceBefore, currency) : '–'}<ArrowRight size={14} /><strong>{entry.priceAfter != null ? pricingAmount(entry.priceAfter, currency) : '–'}</strong></div><span>{(entry.skipReason ? t('baitlyPricing.yield.skipped', 'Non appliqué') : null) ?? (entry.mode === 'APPLIED' ? t('baitlyPricing.yield.applied', 'Appliqué') : entry.mode === 'SUGGESTED' ? t('yieldRules.mode.suggest', 'Suggestion') : t('yieldRules.mode.simulation', 'Simulation'))}</span></li>)}</ol><PagePagination count={journal.totalElements} page={props.journalPage} onPageChange={props.onJournalPage} rowsPerPage={journal.size} /></>}
    </details>
  </div>;
}
