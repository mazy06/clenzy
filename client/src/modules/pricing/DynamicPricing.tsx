import React, { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
import RatePlanForm from './RatePlanForm';
import PricingOverviewView from './PricingOverviewView';
import RestrictionsPanel from './RestrictionsPanel';
import { calendarPricingApi } from '../../services/api/calendarPricingApi';
import type { RatePlan, CreateRatePlanData } from '../../services/api/calendarPricingApi';
import AiPricingRecommendations from './AiPricingRecommendations';
import MarketPositioningCard from './MarketPositioningCard';
import YieldRulesPanel from './YieldRulesPanel';
import { useIsAiFeatureEnabled } from '../../hooks/useAi';
import PageTabs from '../../components/PageTabs';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Owner {
  id: number;
  name: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface DynamicPricingProps {
  embedded?: boolean;
  actionsContainer?: HTMLElement | null;
  filtersContainer?: HTMLElement | null;
  tabInlineContainer?: HTMLElement | null;
}

const DynamicPricing: React.FC<DynamicPricingProps> = ({ embedded = false, actionsContainer, tabInlineContainer }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isPricingAiEnabled = useIsAiFeatureEnabled('PRICING');
  const [activeTab, setActiveTab] = useState(0);

  // Role-based: only SUPER_ADMIN / SUPER_MANAGER see the owner selector
  const isPlatformStaff =
    user?.platformRole === 'SUPER_ADMIN' || user?.platformRole === 'SUPER_MANAGER';

  // Owner filter state (platform staff only)
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null);

  // Push pricing state
  const [pushLoading, setPushLoading] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);

  // Form state — inline form, always visible in right column
  const [editingPlan, setEditingPlan] = useState<RatePlan | null>(null);

  const {
    properties,
    propertiesLoading,
    selectedPropertyId,
    setSelectedPropertyId,
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
  const selectedPropertyCurrency = useMemo(() => {
    const planWithCurrency = ratePlans.find((p) => p.currency);
    return planWithCurrency?.currency || 'EUR';
  }, [ratePlans]);

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

  // When owner changes, always reset property selection
  const handleOwnerChange = useCallback(
    (ownerId: number | null) => {
      setSelectedOwnerId(ownerId);
      setSelectedPropertyId(null);
      setEditingPlan(null);
    },
    [setSelectedPropertyId],
  );

  const handlePropertyChange = useCallback(
    (propertyId: number | null) => {
      setSelectedPropertyId(propertyId);
      setEditingPlan(null);
    },
    [setSelectedPropertyId],
  );

  const handleEditPlan = useCallback((plan: RatePlan) => {
    setEditingPlan(plan);
  }, []);

  const handleFormReset = useCallback(() => {
    setEditingPlan(null);
  }, []);

  const handlePushPricing = useCallback(async () => {
    if (!selectedPropertyId) return;
    setPushLoading(true);
    setPushResult(null);
    try {
      const result = await calendarPricingApi.pushPricing(selectedPropertyId);
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
    },
    [editingPlan, updateRatePlan, createRatePlan],
  );

  // Ces selecteurs sont portes dans la barre d'onglets : pas de libelle empile qui
  // doublerait la hauteur de la rangee. Le nom du champ passe par `aria-label` et
  // par l'option vide, qui sert aussi d'etat de chargement (une <option> native ne
  // peut pas contenir de Spinner).
  const filterSelectors = (
    <>
      {isPlatformStaff && (
        <NativeSelect
          size="sm"
          className="w-[180px]"
          aria-label={t('dynamicPricing.selectOwner')}
          value={selectedOwnerId ?? ''}
          onChange={(e) => handleOwnerChange(e.target.value === '' ? null : Number(e.target.value))}
        >
          <NativeSelectOption value="">
            {propertiesLoading ? t('common.loading') : t('dynamicPricing.allOwners')}
          </NativeSelectOption>
          {owners.map((o) => (
            <NativeSelectOption key={o.id} value={o.id}>
              {o.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
      <NativeSelect
        size="sm"
        className="w-[200px]"
        aria-label={t('dynamicPricing.calendar.selectProperty')}
        value={selectedPropertyId ?? ''}
        onChange={(e) => handlePropertyChange(e.target.value === '' ? null : Number(e.target.value))}
        disabled={isPlatformStaff && selectedOwnerId === null}
      >
        <NativeSelectOption value="">
          {propertiesLoading ? t('common.loading') : t('dynamicPricing.calendar.selectProperty')}
        </NativeSelectOption>
        {filteredProperties.map((p) => (
          <NativeSelectOption key={p.id} value={p.id}>
            {p.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {isPlatformStaff && selectedOwnerId !== null && (
        <span className="text-2xs text-muted-foreground whitespace-nowrap tabular-nums">
          {filteredProperties.length} {t('dynamicPricing.propertiesCount')}
        </span>
      )}
    </>
  );

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

  return (
    // Padding de page : SPACING.PAGE_PADDING (2) = 12px avec theme.spacing = 6
    <div className={embedded ? 'p-0' : 'p-3'}>
      {/* Portal actions into parent's PageHeader when embedded */}
      {embedded && actionsContainer && actionButtons && createPortal(actionButtons, actionsContainer)}

      {/* Header */}
      {!embedded && (
        <PageHeader
          title={t('dynamicPricing.title')}
          subtitle={t('dynamicPricing.subtitle')}
          iconBadge={<TrendingUp />}
          backPath="/dashboard"
          showBackButton={false}
          actions={actionButtons}
        />
      )}

      {/* ── Filter selectors — portaled into tab bar when embedded ── */}
      {embedded && tabInlineContainer && createPortal(filterSelectors, tabInlineContainer)}
      {!embedded && (
        <div className="flex items-center gap-2 mb-2">
          {filterSelectors}
        </div>
      )}

      {/* Tabs */}
      <PageTabs
        options={[
          { label: t('dynamicPricing.tabs.byProperty') },
          { label: t('dynamicPricing.tabs.overview') },
          { label: t('dynamicPricing.tabs.yield', 'Yield') },
          { label: t('dynamicPricing.tabs.restrictions', 'Restrictions') },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {/* ─── Tab: Par propriété ─── */}
      {activeTab === 0 && (
        <div className="flex flex-col gap-2">
          {/* Top row: Calendar (left) + Form (right) — same height */}
          <div className="flex gap-[9px] items-stretch flex-wrap min-[1200px]:flex-nowrap">
            {/* Left column — Calendar (stretches to match right column) */}
            <div className="flex-[7] min-w-0 flex flex-col">
              <PricingCalendarView
                selectedPropertyId={selectedPropertyId}
                currentMonth={currentMonth}
                onPrevMonth={goToPrevMonth}
                onNextMonth={goToNextMonth}
                calendarPricing={calendarPricing}
                calendarPricingLoading={calendarPricingLoading}
                onUpdatePrice={updatePrice}
                updatePriceLoading={updatePriceLoading}
                currency={selectedPropertyCurrency}
              />
            </div>

            {/* Right column — Always-visible inline form */}
            {selectedPropertyId && (
              <div className="flex-[5] min-w-0">
                <RatePlanForm
                  propertyId={selectedPropertyId}
                  editingPlan={editingPlan}
                  onSave={handleFormSave}
                  onCancel={handleFormReset}
                  loading={createRatePlanLoading || updateRatePlanLoading}
                />
              </div>
            )}
          </div>

          {/* Positionnement marché — double signal réseau/marché (roadmap market data) */}
          {selectedPropertyId && (
            <MarketPositioningCard propertyId={selectedPropertyId} />
          )}

          {/* AI Pricing Recommendations (hidden when PRICING feature is disabled) */}
          {isPricingAiEnabled && selectedPropertyId && (
            <AiPricingRecommendations
              propertyId={selectedPropertyId}
              from={from}
              to={to}
            />
          )}

          {/* Full-width row: Rate Plan list */}
          {selectedPropertyId && (
            <RatePlanManager
              ratePlans={ratePlans}
              loading={ratePlansLoading}
              onEditPlan={handleEditPlan}
              onUpdatePlan={updateRatePlan}
              onDeletePlan={deleteRatePlan}
              updateLoading={updateRatePlanLoading}
              deleteLoading={deleteRatePlanLoading}
            />
          )}
        </div>
      )}

      {/* ─── Tab: Vue d'ensemble ─── */}
      {activeTab === 1 && (
        <PricingOverviewView
          properties={filteredProperties}
          propertiesLoading={propertiesLoading}
          currentMonth={currentMonth}
          from={from}
          to={to}
          onPrevMonth={goToPrevMonth}
          onNextMonth={goToNextMonth}
        />
      )}

      {/* ─── Tab: Yield (règles d'occupation, F8a) ─── */}
      {activeTab === 2 && <YieldRulesPanel />}

      {/* ─── Tab: Restrictions de séjour (min/max stay, CTA/CTD → OTAs) ─── */}
      {activeTab === 3 && <RestrictionsPanel propertyId={selectedPropertyId} />}
    </div>
  );
};

export default DynamicPricing;
