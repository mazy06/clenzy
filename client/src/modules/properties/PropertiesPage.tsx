import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import {
  Home,
  TrendingUp,
} from '../../icons';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import PageHeader from '../../components/PageHeader';
import PropertiesList from './PropertiesList';
import DynamicPricing from '../pricing/DynamicPricing';

// ─── Portal container for child actions in PageHeader ────────────────────────
const PORTAL_STYLE = { display: 'contents' } as const;

// ─── Tab indices ────────────────────────────────────────────────────────────

const TAB_PROPERTIES = 0;
const TAB_PRICING = 1;

// ─── Component ──────────────────────────────────────────────────────────────

const PropertiesPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = parseInt(searchParams.get('tab') || '0', 10);
  const [activeTab, setActiveTab] = useState(
    isNaN(initialTab) ? 0 : Math.min(initialTab, TAB_PRICING)
  );

  // Portal containers: child components render their actions/filters into these DOM elements
  const [actionsContainer, setActionsContainer] = useState<HTMLDivElement | null>(null);
  const [filtersContainer, setFiltersContainer] = useState<HTMLDivElement | null>(null);
  const [tabInlineContainer, setTabInlineContainer] = useState<HTMLDivElement | null>(null);

  // Sync tab to URL param
  const handleTabChange = useCallback((_: React.SyntheticEvent, v: number) => {
    setActiveTab(v);
    setSearchParams(v === 0 ? {} : { tab: String(v) }, { replace: true });
  }, [setSearchParams]);

  // Handle URL param changes (browser back/forward)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const parsed = parseInt(tabParam, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= TAB_PRICING && parsed !== activeTab) {
        setActiveTab(parsed);
      }
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, p: 3 }}>
      <Box sx={{ flexShrink: 0 }}>
        <PageHeader
          title={t('propertiesPage.title')}
          subtitle={t('propertiesPage.subtitle')}
          backPath="/dashboard"
          showBackButton={false}
          actions={<div ref={setActionsContainer} style={PORTAL_STYLE} />}
          filters={<div ref={setFiltersContainer} style={PORTAL_STYLE} />}
        />
        <Paper sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              sx={{
                flex: 1,
                '& .MuiTab-root': { minHeight: 48, textTransform: 'none', fontSize: '0.8125rem' },
              }}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab
                icon={<Home size={18} strokeWidth={1.75} />}
                iconPosition="start"
                label={t('propertiesPage.tabs.properties')}
              />
              <Tab
                icon={<TrendingUp size={18} strokeWidth={1.75} />}
                iconPosition="start"
                label={t('propertiesPage.tabs.pricing')}
              />
            </Tabs>
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1.5, pr: 1.5 }}>
              <div ref={setTabInlineContainer} style={PORTAL_STYLE} />
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* ── Tab content ── */}
      {activeTab === TAB_PROPERTIES && (
        <PropertiesList embedded actionsContainer={actionsContainer} filtersContainer={filtersContainer} />
      )}
      {activeTab === TAB_PRICING && (
        <DynamicPricing embedded actionsContainer={actionsContainer} filtersContainer={filtersContainer} tabInlineContainer={tabInlineContainer} />
      )}
    </Box>
  );
};

export default PropertiesPage;
