import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Button,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  ViewList,
  ChatBubbleOutline,
  Description,
  History,
  LocalOffer,
  GppGood,
  Refresh,
  Add,
  Send,
  Search,
} from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { useTemplates } from './hooks/useDocuments';
import TemplateCatalogAccordions from './TemplateCatalogAccordions';
import MessageTemplatesSection, { type MessageTemplatesSectionRef } from './MessageTemplatesSection';
import TemplatesList, { type TemplatesListRef } from './TemplatesList';
import UnifiedHistoryTab, { type UnifiedHistoryTabRef } from './UnifiedHistoryTab';
import AvailableTagsReference from './AvailableTagsReference';
import ComplianceDashboard, { type ComplianceDashboardRef } from './ComplianceDashboard';

// ─── Tab indices ────────────────────────────────────────────────────────────

const TAB_CATALOG = 0;
const TAB_MSG_TEMPLATES = 1;
const TAB_DOC_TEMPLATES = 2;
const TAB_HISTORY = 3;
const TAB_VARIABLES = 4;
const TAB_COMPLIANCE = 5;

// ─── Component ──────────────────────────────────────────────────────────────

const DocumentsPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = parseInt(searchParams.get('tab') || '0', 10);
  const [activeTab, setActiveTab] = useState(isNaN(initialTab) ? 0 : Math.min(initialTab, 5));

  const [tagsSearch, setTagsSearch] = useState('');
  const [complianceSearch, setComplianceSearch] = useState('');

  const msgTemplatesRef = useRef<MessageTemplatesSectionRef>(null);
  const docTemplatesRef = useRef<TemplatesListRef>(null);
  const historyRef = useRef<UnifiedHistoryTabRef>(null);
  const complianceRef = useRef<ComplianceDashboardRef>(null);

  // Templates for the catalog tab
  const { data: catalogTemplates = [] } = useTemplates();

  // Sync tab to URL param
  const handleTabChange = useCallback((_: React.SyntheticEvent, v: number) => {
    setActiveTab(v);
    setSearchParams(v === 0 ? {} : { tab: String(v) }, { replace: true });
  }, [setSearchParams]);

  // Handle initial tab from URL
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const parsed = parseInt(tabParam, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 5 && parsed !== activeTab) {
        setActiveTab(parsed);
      }
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchToMessagingTab = useCallback(() => {
    setActiveTab(TAB_MSG_TEMPLATES);
    setSearchParams({ tab: String(TAB_MSG_TEMPLATES) }, { replace: true });
  }, [setSearchParams]);

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title={t('documents.title')}
        subtitle={t('documents.subtitle')}
        backPath="/dashboard"
        showBackButton={false}
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
            <Tab icon={<ViewList sx={{ fontSize: 18 }} />} iconPosition="start" label={t('documents.tabs.catalog')} />
            <Tab icon={<ChatBubbleOutline sx={{ fontSize: 18 }} />} iconPosition="start" label={t('documents.tabs.messageTemplates')} />
            <Tab icon={<Description sx={{ fontSize: 18 }} />} iconPosition="start" label={t('documents.tabs.documentTemplates')} />
            <Tab icon={<History sx={{ fontSize: 18 }} />} iconPosition="start" label={t('documents.tabs.history')} />
            <Tab icon={<LocalOffer sx={{ fontSize: 18 }} />} iconPosition="start" label={t('documents.tabs.variablesAndTags')} />
            <Tab icon={<GppGood sx={{ fontSize: 18 }} />} iconPosition="start" label={t('documents.tabs.compliance')} />
          </Tabs>

          {/* ── Tab-specific actions ── */}

          {/* Catalogue — refresh catalog */}
          {activeTab === TAB_CATALOG && (
            <Box sx={{ display: 'flex', gap: 1, pr: 2 }}>
              <Button startIcon={<Refresh />} size="small" onClick={() => docTemplatesRef.current?.fetchTemplates()}>
                {t('common.refresh')}
              </Button>
            </Box>
          )}

          {/* Templates messages — New + Refresh */}
          {activeTab === TAB_MSG_TEMPLATES && (
            <Box sx={{ display: 'flex', gap: 1, pr: 2 }}>
              <Button startIcon={<Refresh />} size="small" onClick={() => msgTemplatesRef.current?.fetchTemplates()}>
                {t('common.refresh')}
              </Button>
              <Button variant="contained" startIcon={<Add />} size="small" onClick={() => msgTemplatesRef.current?.openEditor()}>
                {t('messaging.templates.create')}
              </Button>
            </Box>
          )}

          {/* Templates documents — New + Refresh */}
          {activeTab === TAB_DOC_TEMPLATES && (
            <Box sx={{ display: 'flex', gap: 1, pr: 2 }}>
              <Button startIcon={<Refresh />} size="small" onClick={() => docTemplatesRef.current?.fetchTemplates()}>
                {t('common.refresh')}
              </Button>
              <Button variant="contained" startIcon={<Add />} size="small" onClick={() => docTemplatesRef.current?.openUpload()}>
                {t('documents.tabs.newDocTemplate')}
              </Button>
            </Box>
          )}

          {/* Historique — Refresh + Generate */}
          {activeTab === TAB_HISTORY && (
            <Box sx={{ display: 'flex', gap: 1, pr: 2 }}>
              <Button startIcon={<Refresh />} size="small" onClick={() => historyRef.current?.refresh()}>
                {t('common.refresh')}
              </Button>
              <Button variant="contained" startIcon={<Send />} size="small" onClick={() => historyRef.current?.openGenerate()}>
                {t('documents.tabs.generateDoc')}
              </Button>
            </Box>
          )}

          {/* Variables & Tags — search */}
          {activeTab === TAB_VARIABLES && (
            <Box sx={{ display: 'flex', gap: 1, pr: 2, alignItems: 'center' }}>
              <TextField
                size="small"
                placeholder={t('documents.tabs.searchTag')}
                value={tagsSearch}
                onChange={(e) => setTagsSearch(e.target.value)}
                sx={{ minWidth: 250 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          )}

          {/* Conformite NF — Refresh + search */}
          {activeTab === TAB_COMPLIANCE && (
            <Box sx={{ display: 'flex', gap: 1, pr: 2, alignItems: 'center' }}>
              <Button startIcon={<Refresh />} size="small" onClick={() => complianceRef.current?.fetchData()}>
                {t('common.refresh')}
              </Button>
              <TextField
                size="small"
                placeholder="Ex: FAC-2025-00001"
                value={complianceSearch}
                onChange={(e) => setComplianceSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && complianceRef.current?.searchByNumber(complianceSearch)}
                sx={{ minWidth: 250 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          )}
        </Box>
      </Paper>

      {/* ── Tab content ── */}
      {activeTab === TAB_CATALOG && (
        <TemplateCatalogAccordions
          templates={catalogTemplates}
          onOpenUpload={() => {
            setActiveTab(TAB_DOC_TEMPLATES);
            setSearchParams({ tab: String(TAB_DOC_TEMPLATES) }, { replace: true });
            setTimeout(() => docTemplatesRef.current?.openUpload(), 100);
          }}
          onSwitchToMessagingTab={switchToMessagingTab}
        />
      )}
      {activeTab === TAB_MSG_TEMPLATES && <MessageTemplatesSection ref={msgTemplatesRef} />}
      {activeTab === TAB_DOC_TEMPLATES && <TemplatesList ref={docTemplatesRef} />}
      {activeTab === TAB_HISTORY && <UnifiedHistoryTab ref={historyRef} />}
      {activeTab === TAB_VARIABLES && <AvailableTagsReference search={tagsSearch} />}
      {activeTab === TAB_COMPLIANCE && <ComplianceDashboard ref={complianceRef} />}
    </Box>
  );
};

export default DocumentsPage;
