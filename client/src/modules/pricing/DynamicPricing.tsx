import React, { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Typography,
  Button,
  Tooltip,
} from '@mui/material';
import {
  CloudUpload as PushIcon,
  TrendingUp,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { useDynamicPricing } from '../../hooks/useDynamicPricing';
import PageHeader from '../../components/PageHeader';
import { SPACING } from '../../theme/spacing';
import PricingCalendarView from './PricingCalendarView';
import RatePlanManager from './RatePlanManager';
import RatePlanForm from './RatePlanForm';
import PricingOverviewView from './PricingOverviewView';
import { calendarPricingApi } from '../../services/api/calendarPricingApi';
import type { RatePlan, CreateRatePlanData } from '../../services/api/calendarPricingApi';
import AiPricingRecommendations from './AiPricingRecommendations';
import { useIsAiFeatureEnabled } from '../../hooks/useAi';

// ─── Style Constants ────────────────────────────────────────────────────────

const TABS_SX = {
  minHeight: 36,
  mb: 1.5,
  '& .MuiTab-root': {
    minHeight: 36,
    py: 0.5,
    px: 2,
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'none',
    color: 'text.secondary',
    '&.Mui-selected': {
      fontWeight: 700,
      color: 'primary.main',
    },
  },
  '& .MuiTabs-indicator': {
    height: 2,
    borderRadius: 1,
  },
} as const;

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

  const filterSelectors = (
    <>
      {isPlatformStaff && (
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel sx={{ fontSize: '0.8125rem' }}>{t('dynamicPricing.selectOwner')}</InputLabel>
          <Select
            value={selectedOwnerId ?? ''}
            label={t('dynamicPricing.selectOwner')}
            onChange={(e) => {
              const val = e.target.value;
              handleOwnerChange(val === '' ? null : Number(val));
            }}
            sx={{ fontSize: '0.8125rem', '& .MuiSelect-select': { py: 0.75 } }}
          >
            <MenuItem value="">
              <em>{t('dynamicPricing.allOwners')}</em>
            </MenuItem>
            {propertiesLoading && (
              <MenuItem disabled>
                <CircularProgress size={14} sx={{ mr: 1 }} /> {t('common.loading')}
              </MenuItem>
            )}
            {owners.map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {o.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel sx={{ fontSize: '0.8125rem' }}>{t('dynamicPricing.calendar.selectProperty')}</InputLabel>
        <Select
          value={selectedPropertyId ?? ''}
          label={t('dynamicPricing.calendar.selectProperty')}
          onChange={(e) => {
            const val = e.target.value;
            handlePropertyChange(val === '' ? null : Number(val));
          }}
          disabled={isPlatformStaff && selectedOwnerId === null}
          sx={{ fontSize: '0.8125rem', '& .MuiSelect-select': { py: 0.75 } }}
        >
          {propertiesLoading && (
            <MenuItem disabled>
              <CircularProgress size={14} sx={{ mr: 1 }} /> {t('common.loading')}
            </MenuItem>
          )}
          {filteredProperties.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {isPlatformStaff && selectedOwnerId !== null && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem', whiteSpace: 'nowrap' }}>
          {filteredProperties.length} {t('dynamicPricing.propertiesCount')}
        </Typography>
      )}
    </>
  );

  const actionButtons = selectedPropertyId ? (
    <Tooltip title={pushResult || t('channels.pushPricing.tooltip')}>
      <Button
        variant="outlined"
        size="small"
        startIcon={pushLoading ? <CircularProgress size={14} /> : <PushIcon size={16} strokeWidth={1.75} />}
        onClick={handlePushPricing}
        disabled={pushLoading}
        color={pushResult?.includes('succes') || pushResult?.includes('success') ? 'success' : 'primary'}
        sx={{ textTransform: 'none', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
      >
        {pushLoading ? t('channels.pushPricing.pushing') : t('channels.pushPricing.button')}
      </Button>
    </Tooltip>
  ) : null;

  return (
    <Box sx={{ p: embedded ? 0 : SPACING.PAGE_PADDING }}>
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          {filterSelectors}
        </Box>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={TABS_SX}
      >
        <Tab label={t('dynamicPricing.tabs.byProperty')} />
        <Tab label={t('dynamicPricing.tabs.overview')} />
      </Tabs>

      {/* ─── Tab: Par propriété ─── */}
      {activeTab === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* Top row: Calendar (left) + Form (right) — same height */}
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'stretch', flexWrap: { xs: 'wrap', lg: 'nowrap' } }}>
            {/* Left column — Calendar (stretches to match right column) */}
            <Box sx={{ flex: 7, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
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
            </Box>

            {/* Right column — Always-visible inline form */}
            {selectedPropertyId && (
              <Box sx={{ flex: 5, minWidth: 0 }}>
                <RatePlanForm
                  propertyId={selectedPropertyId}
                  editingPlan={editingPlan}
                  onSave={handleFormSave}
                  onCancel={handleFormReset}
                  loading={createRatePlanLoading || updateRatePlanLoading}
                />
              </Box>
            )}
          </Box>

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
        </Box>
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
    </Box>
  );
};

export default DynamicPricing;
