import { useIsFetching } from '@tanstack/react-query';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Plus, CalendarDays, LayoutList, ChevronLeft, ChevronRight } from '../../icons/glyphs';
import { Alert, AlertDescription } from '../../components/ui';
import { useScreenTabs } from '../../hooks/useScreenTabs';
import { useTabKeyParam, useTabValueParam } from '../../components/tabKeyParam';
import { PageHeaderActionsProvider, usePageHeaderActionsSlot } from '../../components/PageHeaderActionsContext';
import './baitlyPricing.css';
import { activeIntlLocaleGregorian } from '../../utils/activeLocale';
import {
  Button,
  NativeSelect,
  NativeSelectOption,
  Spinner,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import {
  CloudUpload as PushIcon,
  TrendingUp,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { useDynamicPricing } from '../../hooks/useDynamicPricing';
import PageHeader from '../../components/PageHeader';
import PricingCalendarView from './PricingCalendarView';
import RatePlanManager from './RatePlanManager';
import BaitlyPricingPropertyMenu from './BaitlyPricingPropertyMenu';
import RatePlanForm from './RatePlanForm';
import PricingOverviewView from './PricingOverviewView';
import RestrictionsPanel from './RestrictionsPanel';
import { calendarPricingApi } from '../../services/api/calendarPricingApi';
import type { RatePlan, CreateRatePlanData } from '../../services/api/calendarPricingApi';
import BaitlyPricingAiPanel from './BaitlyPricingAiPanel';
import { useBaitlyPricingProposals, proposalKey, type BaitlyPricingAiSelection } from './BaitlyPricingProposal';
import YieldRulesPanel from './YieldRulesPanel';
import { useIsAiFeatureEnabled } from '../../hooks/useAi';
import PageTabs from '../../components/PageTabs';
import compactHeaderActions from '../../components/compactHeaderActions';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Owner {
  id: number;
  name: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

const DynamicPricing: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isPricingAiEnabled = useIsAiFeatureEnabled('PRICING');
  const tabs = useScreenTabs('/dynamic-pricing');
  const [activeTab, setActiveTab] = useTabKeyParam(tabs);
  const [view, setView] = useTabValueParam(['property', 'portfolio'] as const, 'property', { param: 'view' });
  const [strategy, setStrategy] = useTabValueParam(['plans', 'automation'] as const, 'plans', { param: 'section' });
  const { slot, portalContainer } = usePageHeaderActionsSlot();
  const [formOpen, setFormOpen] = useState(false);

  // Role-based: only SUPER_ADMIN / SUPER_MANAGER see the owner selector
  const isPlatformStaff =
    user?.platformRole === 'SUPER_ADMIN' || user?.platformRole === 'SUPER_MANAGER';

  // Owner filter state (platform staff only)
  const [scopeParams, setScopeParams] = useSearchParams();
  const ownerParam = Number(scopeParams.get('owner'));
  const selectedOwnerId = Number.isSafeInteger(ownerParam) && ownerParam > 0 ? ownerParam : null;
  const setSelectedOwnerId = (ownerId: number | null) => setScopeParams((previous) => {
    const next = new URLSearchParams(previous);
    if (ownerId) next.set('owner', String(ownerId)); else next.delete('owner');
    next.delete('property');
    return next;
  }, { replace: true });

  // Push pricing state
  const [pushLoading, setPushLoading] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);

  // Inline editor opens on creation or modification.
  const [editingPlan, setEditingPlan] = useState<RatePlan | null>(null);

  const {
    properties,
    propertiesLoading,
    propertiesError,
    refetchProperties,
    calendarPricingError,
    refetchCalendarPricing,
    ratePlansError,
    refetchRatePlans,
    selectedPropertyId,
    currentMonth,
    from,
    to,
    goToPrevMonth,
    goToNextMonth,
    calendarPricing,
    calendarPricingLoading,
    ratePlans,
    ratePlansLoading,
    updatePrice,
    updatePriceLoading,
    createRatePlan,
    createRatePlanLoading,
    updateRatePlan,
    updateRatePlanLoading,
    deleteRatePlan,
    deleteRatePlanLoading,
  } = useDynamicPricing();

  // Derive currency from the first rate plan that has one, or fallback to 'EUR'
  const [showAiProposals, setShowAiProposals] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState<BaitlyPricingAiSelection | null>(null);
  // Masquage volontairement limité à cette session, sans modifier la proposition en BDD.
  const [hiddenProposals, setHiddenProposals] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setSelectedProposal(null);
  }, [selectedPropertyId, selectedOwnerId, from, to, view, activeTab]);
  const aiEnabled = isPricingAiEnabled && showAiProposals && activeTab === 0;
  const ai = useBaitlyPricingProposals(selectedPropertyId ?? 0, from, to, aiEnabled);
  const visibleProposals = useMemo(() => new Map([...ai.proposals].filter(([, rec]) =>
    !hiddenProposals.has(proposalKey(selectedPropertyId ?? 0, rec))
      && rec.suggestedPrice !== calendarPricing.find(day => day.date === rec.date)?.nightlyPrice)),
    [ai.proposals, hiddenProposals, selectedPropertyId, calendarPricing]);
  const dismissProposal = (selection: BaitlyPricingAiSelection) => {
    setHiddenProposals(previous => new Set([...previous, proposalKey(selection.propertyId, selection.recommendation)]));
    setSelectedProposal(null);
  };
  const applyProposal = async (data: Parameters<typeof updatePrice>[0]) => {
    await updatePrice(data);
    if (activeProposal) {
      setSelectedProposal(activeProposal);
      setHiddenProposals(previous => new Set([...previous, proposalKey(activeProposal.propertyId, activeProposal.recommendation)]));
    }
  };
  const aiFetching = useIsFetching({ queryKey: ['ai', 'pricing-predictions'],
    predicate: query => query.queryKey[3] === from && query.queryKey[4] === to
      && properties.some(p => p.id === query.queryKey[2]) });
  const aiPreparing = aiEnabled && (ai.isLoading || aiFetching > 0);
  const portfolioView = activeTab === 0 && view === 'portfolio';

  const selectedPropertyCurrency = useMemo(() => {
    const planWithCurrency = ratePlans.find((p) => p.currency);
    return calendarPricing.find(day => day.currency)?.currency || planWithCurrency?.currency || 'EUR';
  }, [ratePlans, calendarPricing]);

  // Extract unique owners from properties
  const owners = useMemo<Owner[]>(() => {
    const map = new Map<number, string>();
    for (const p of properties) {
      if (p.ownerId && !map.has(p.ownerId)) {
        map.set(p.ownerId, p.ownerName ?? `Owner #${p.ownerId}`);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [properties]);

  // Filter properties by selected owner
  // HOST: show all their properties (they only see their own from the API)
  // Platform staff: show ONLY when an owner is selected (empty otherwise)
  const filteredProperties = useMemo(() => {
    if (!isPlatformStaff) return properties;
    if (selectedOwnerId === null) return [];
    return properties.filter((p) => p.ownerId === selectedOwnerId);
  }, [properties, selectedOwnerId, isPlatformStaff]);

  const activeProposal = useMemo<BaitlyPricingAiSelection | null>(() => {
    if (selectedProposal) return selectedProposal;
    if (!aiEnabled || !selectedPropertyId || calendarPricingLoading) return null;
    const property = filteredProperties.find(p => p.id === selectedPropertyId);
    const today = new Date();
    const todayKey = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
    const proposals = [...visibleProposals.values()].sort((a, b) => a.date.localeCompare(b.date));
    const first = proposals.find(rec => rec.date === todayKey)
      ?? proposals.find(rec => rec.date > todayKey) ?? proposals[0];
    if (!property || !first) return null;
    return { propertyId: property.id, propertyName: property.name, currency: selectedPropertyCurrency,
      currentPrice: calendarPricing.find(day => day.date === first.date)?.nightlyPrice ?? null, recommendation: first };
  }, [selectedProposal, aiEnabled, selectedPropertyId, calendarPricingLoading,
    filteredProperties, visibleProposals, selectedPropertyCurrency, calendarPricing]);

  useEffect(() => {
    if (propertiesLoading || propertiesError || filteredProperties.length === 0) return;
    if (filteredProperties.some((property) => property.id === selectedPropertyId)) return;
    const firstPropertyId = String(filteredProperties[0].id);
    if (scopeParams.get('property') === firstPropertyId) return;
    setScopeParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set('property', firstPropertyId);
      return next;
    }, { replace: true });
  }, [filteredProperties, propertiesLoading, propertiesError, selectedPropertyId, scopeParams, setScopeParams]);

  // When owner changes, always reset property selection
  const handleOwnerChange = useCallback(
    (ownerId: number | null) => {
      setSelectedOwnerId(ownerId);
      setEditingPlan(null);
      setFormOpen(false);
    },
    [setScopeParams],
  );

  const handlePropertyChange = useCallback(
    (propertyId: number | null) => {
      setScopeParams((previous) => {
        const next = new URLSearchParams(previous);
        if (propertyId) next.set('property', String(propertyId)); else next.delete('property');
        if (activeTab === 0) next.delete('view');
        return next;
      }, { replace: true });
      setEditingPlan(null);
      setFormOpen(false);
    },
    [setScopeParams, activeTab],
  );

  const handleEditPlan = useCallback((plan: RatePlan) => {
    setEditingPlan(plan);
    setFormOpen(true);
  }, []);

  const handleFormReset = useCallback(() => {
    setEditingPlan(null);
    setFormOpen(false);
  }, []);

  const handlePushPricing = useCallback(async () => {
    if (!selectedPropertyId) return;
    setPushLoading(true);
    setPushResult(null);
    try {
      await calendarPricingApi.pushPricing(selectedPropertyId);
      setPushResult(t('channels.pushPricing.success'));
      setTimeout(() => setPushResult(null), 4000);
    } catch {
      setPushResult(t('channels.pushPricing.error'));
      setTimeout(() => setPushResult(null), 4000);
    } finally {
      setPushLoading(false);
    }
  }, [selectedPropertyId, t]);

  const handleFormSave = useCallback(
    async (data: CreateRatePlanData) => {
      if (editingPlan) {
        await updateRatePlan({ id: editingPlan.id, data });
      } else {
        await createRatePlan(data);
      }
      setEditingPlan(null);
      setFormOpen(false);
    },
    [editingPlan, updateRatePlan, createRatePlan],
  );

  const ownerSelector = isPlatformStaff ? (
    <NativeSelect size="sm" className="w-[180px]" aria-label={t('dynamicPricing.selectOwner')}
      value={selectedOwnerId ?? ''} disabled={propertiesLoading}
      onChange={(e) => handleOwnerChange(e.target.value === '' ? null : Number(e.target.value))}>
      <NativeSelectOption value="">{propertiesLoading ? t('common.loading') : t('dynamicPricing.selectOwner')}</NativeSelectOption>
      {owners.map((owner) => <NativeSelectOption key={owner.id} value={owner.id}>{owner.name}</NativeSelectOption>)}
    </NativeSelect>
  ) : undefined;

  const subtitles = [
    t('baitlyPricing.subtitles.calendar', 'Consultez vos nuitées et ajustez les prix sur une date ou une période.'),
    t('baitlyPricing.subtitles.strategy', 'Définissez vos plans tarifaires et encadrez les ajustements automatiques.'),
    t('baitlyPricing.subtitles.restrictions', 'Gérez les durées de séjour et les jours d’arrivée ou de départ.'),
  ];
  const subtitle = subtitles[activeTab];

  const actionButtons = selectedPropertyId ? (
    // Le Button du kit ne transmet pas de ref : le Tooltip s'accroche au span.
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePushPricing}
            disabled={pushLoading}
            // Le succes du push se signale par la famille `success` : l'encre AA
            // pour le libelle, la teinte vive pour le filet, le pastel au survol.
            // Les deux branches sont ecrites en litteral, une classe ne peut pas
            // naitre d'une variable.
            className={
              pushResult?.includes('succes') || pushResult?.includes('success')
                ? 'text-success-ink border-success hover:bg-success-soft'
                : ''
            }
          >
            {pushLoading ? <Spinner className="size-3.5" /> : <PushIcon size={16} strokeWidth={1.75} />}
            {pushLoading ? t('channels.pushPricing.pushing') : t('channels.pushPricing.button')}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{pushResult || t('channels.pushPricing.tooltip')}</TooltipContent>
    </Tooltip>
  ) : null;

  const aiToggle = isPricingAiEnabled ? <label className="bp-ai-toggle">
    <input type="checkbox" checked={showAiProposals} onChange={(e) => { setShowAiProposals(e.target.checked); setSelectedProposal(null); }} />
    {t('baitlyPricing.ai.show', 'Afficher les propositions IA')}
  </label> : null;

  return (
    <PageHeaderActionsProvider slot={slot}>
      <div className="baitly-pricing flex min-w-0 flex-1 flex-col">
        <PageHeader title={t('dynamicPricing.title', 'Prix dynamiques')} subtitle={subtitle}
          iconBadge={<TrendingUp />} showBackButton={false} actions={portalContainer} inlineControls={ownerSelector} />
        {slot && actionButtons && createPortal(compactHeaderActions(actionButtons), slot)}
        <PageTabs options={tabs} value={activeTab} onChange={setActiveTab} />
        {activeTab === 0 && <div className={portfolioView ? "bp-shared-calendar-toolbar" : "bp-shared-calendar-toolbar bp-property-calendar-toolbar"}>
          <div className="bp-month-nav flex items-center gap-0.5">
            <Button variant="ghost" size="icon-sm" aria-label={t('common.previous', 'Précédent')} onClick={goToPrevMonth}><ChevronLeft size={20} className="cn-rtl-flip" /></Button>
            <p className="text-sm font-semibold min-w-[140px] text-center capitalize">{currentMonth.toLocaleDateString(activeIntlLocaleGregorian(), { month: 'long', year: 'numeric' })}</p>
            <Button variant="ghost" size="icon-sm" aria-label={t('common.next', 'Suivant')} onClick={goToNextMonth}><ChevronRight size={20} className="cn-rtl-flip" /></Button>
          </div>
          <div className="bp-shared-calendar-controls">{aiPreparing && <span className="bp-ai-loading-status" role="status"><span className="bp-ai-progress" aria-hidden="true" />{t('baitlyPricing.ai.preparingShort', 'Analyse IA en cours…')}</span>}{aiToggle}<div className="bp-view-switch" role="group" aria-label={t('baitlyPricing.view', "Vue des prix")}>
              <Button variant={view === 'property' ? 'secondary' : 'ghost'} aria-pressed={view === 'property'} onClick={() => setView('property')}><CalendarDays size={16} />{t('baitlyPricing.property', "Par logement")}</Button>
              <Button variant={view === 'portfolio' ? 'secondary' : 'ghost'} aria-pressed={view === 'portfolio'} onClick={() => setView('portfolio')}><LayoutList size={16} />{t('baitlyPricing.portfolio', "Portefeuille")}</Button>
            </div></div>
        </div>}
        <div className={portfolioView ? "bp-property-workspace bp-calendar-workspace bp-portfolio-workspace" : activeTab === 0 ? "bp-property-workspace bp-calendar-workspace" : "bp-property-workspace"}>
          {!portfolioView && <BaitlyPricingPropertyMenu properties={filteredProperties} selectedPropertyId={selectedPropertyId}
            loading={propertiesLoading} ownerRequired={isPlatformStaff && selectedOwnerId === null} onSelect={handlePropertyChange} />}
          <main className="bp-workspace">
          {propertiesError && <Alert variant="destructive"><AlertDescription>{t('baitlyPricing.loadError', "Impossible de charger les tarifs. Réessayez.")} <Button variant="outline" onClick={() => void refetchProperties()}>{t('common.retry')}</Button></AlertDescription></Alert>}
          {pushResult && <Alert role="status"><AlertDescription>{pushResult}</AlertDescription></Alert>}
          {activeTab === 0 && <>
            {isPlatformStaff && selectedOwnerId === null && portfolioView &&
              <p className="bp-ai-hint">{t('baitlyPricing.ownerRequired', 'Sélectionnez un propriétaire dans le header pour afficher ses logements.')}</p>}
            {calendarPricingError && view === 'property' && <Alert variant="destructive"><AlertDescription>{t('baitlyPricing.loadError', 'Impossible de charger les tarifs. Réessayez.')} <Button variant="outline" onClick={() => void refetchCalendarPricing()}>{t('common.retry')}</Button></AlertDescription></Alert>}
            <div className="bp-calendar-layout">
              {portfolioView ? <PricingOverviewView properties={filteredProperties} propertiesLoading={propertiesLoading}
                currentMonth={currentMonth} from={from} to={to} onPrevMonth={goToPrevMonth} onNextMonth={goToNextMonth}
                hideToolbar aiEnabled={aiEnabled} hiddenProposals={hiddenProposals} selectedProposal={activeProposal} onSelectProposal={setSelectedProposal} /> :
                <PricingCalendarView key={selectedPropertyId} selectedPropertyId={selectedPropertyId} currentMonth={currentMonth}
                  onPrevMonth={goToPrevMonth} onNextMonth={goToNextMonth} calendarPricing={calendarPricing}
                  calendarPricingLoading={calendarPricingLoading} onUpdatePrice={updatePrice} updatePriceLoading={updatePriceLoading} currency={selectedPropertyCurrency}
                  hideToolbar propertyName={filteredProperties.find(p => p.id === selectedPropertyId)?.name}
                  proposalsLoading={aiEnabled && ai.isLoading} proposals={aiEnabled ? visibleProposals : undefined} selectedProposalDate={activeProposal?.recommendation.date} onSelectProposal={setSelectedProposal} />}
              <div className="bp-calendar-aside">
                {aiEnabled ? <BaitlyPricingAiPanel key={activeProposal ? proposalKey(activeProposal.propertyId, activeProposal.recommendation) : from + view}
                  selection={activeProposal} propertyId={selectedPropertyId} from={from} to={to}
                  enabled={aiEnabled} loading={updatePriceLoading} onApply={applyProposal} onDismiss={dismissProposal} /> :
                  <aside className="bp-context">
                    <h2>{t('baitlyPricing.ai.current', 'Prix appliqué')}</h2>
                    <p>{t('baitlyPricing.calendarHelp', 'Sélectionnez une nuit, puis ajustez son prix ou son séjour minimum. Pour une période, utilisez Maj + clic ou cliquez-glissez.')}</p>
                  </aside>}

              </div>
            </div>
            {aiEnabled && <p className="bp-ai-hint">{t('baitlyPricing.ai.noChange', 'Aucune modification avant votre validation.')}</p>}
          </>}
          {activeTab === 1 && <>
            <PageTabs trail={false} options={[{ label: t('baitlyPricing.plans', "Plans tarifaires") }, { label: t('baitlyPricing.automation', "Ajustements automatiques") }]}
              value={strategy === 'plans' ? 0 : 1} onChange={(index) => setStrategy(index === 0 ? 'plans' : 'automation')} />
            {strategy === 'automation' ? <>
              <YieldRulesPanel key={selectedPropertyId ?? 'organization'} property={filteredProperties.find(p => p.id === selectedPropertyId)} currency={selectedPropertyCurrency} />
            </> : selectedPropertyId ? <>
              <div className="bp-section-bar"><p>{t('baitlyPricing.plansHelp', "Prix de base, saisons, promotions et dernière minute : gérez les plans du logement sélectionné.")}</p><Button onClick={() => { setEditingPlan(null); setFormOpen(true); }}><Plus size={16} />{t('dynamicPricing.ratePlan.create')}</Button></div>
              {ratePlansError && <Alert variant="destructive"><AlertDescription>{t('baitlyPricing.loadError', "Impossible de charger les tarifs. Réessayez.")} <Button variant="outline" onClick={() => void refetchRatePlans()}>{t('common.retry')}</Button></AlertDescription></Alert>}
              <div className={formOpen ? 'bp-plan-layout' : ''}>
                <RatePlanManager ratePlans={ratePlans} loading={ratePlansLoading} onEditPlan={handleEditPlan}
                  onUpdatePlan={updateRatePlan} onDeletePlan={deleteRatePlan} updateLoading={updateRatePlanLoading} deleteLoading={deleteRatePlanLoading} />
                {formOpen && <RatePlanForm key={selectedPropertyId} propertyId={selectedPropertyId} currency={selectedPropertyCurrency}
                  editingPlan={editingPlan} onSave={handleFormSave} onCancel={handleFormReset} loading={createRatePlanLoading || updateRatePlanLoading} />}
              </div>
            </> : <div className="bp-introduction"><img src="/images/dashboard-kpis/adr.webp" alt="" /><h2>{t('baitlyPricing.chooseProperty', "Sélectionnez un logement")}</h2><p>{t('baitlyPricing.plansHelp', "Prix de base, saisons, promotions et dernière minute : gérez les plans du logement sélectionné.")}</p></div>}
          </>}
          {activeTab === 2 && <RestrictionsPanel key={selectedPropertyId} propertyId={selectedPropertyId} />}
          </main>
        </div>
      </div>
    </PageHeaderActionsProvider>
  );
};
export default DynamicPricing;
