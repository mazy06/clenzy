import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
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
} from '../../icons';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import {
  PageHeaderActionsProvider,
  usePageHeaderActionsSlot,
  resolveTabHeader,
  type TabHeaderMeta,
} from '../../components/PageHeaderActionsContext';
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

// ─── Metadata par tab (breadcrumb + subtitle) ────────────────────────────────
// Clef = LABEL traduit du tab (string stable face aux changements d'index visible).
const DOCUMENTS_TAB_META: Record<string, TabHeaderMeta> = {
  'Catalogue': {
    subtitle: 'Catalogue des templates par étape du parcours voyageur : messagerie, documents, communications.',
  },
  'Templates messages': {
    subtitle: 'Templates de messagerie automatique (check-in, bienvenue, push tarification) déclenchés par évènement.',
  },
  'Templates documents': {
    subtitle: 'Bibliothèque des templates PDF (factures, attestations, état des lieux) versionnés et réutilisables.',
  },
  'Historique': {
    subtitle: "Historique unifié des messages envoyés et documents générés, filtrable par canal et statut.",
  },
  'Variables & Tags': {
    subtitle: 'Référence des variables disponibles ({{guest.name}}, {{property.address}}…) pour personnaliser vos templates.',
  },
  'Conformite': {
    subtitle: "Tableau de bord conformité : factures NF, attestations légales, recherche par numéro de document.",
  },
};
const DOCUMENTS_ROOT_TITLE = 'Documents & Communications';
const DOCUMENTS_DEFAULT_SUBTITLE = 'Templates, historique et conformite reglementaire';

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

  // Slot DOM pour que chaque tab puisse portaler ses actions dans le PageHeader.
  // /!\ DOIT etre declare AVANT tout early return pour respecter Rules of Hooks.
  const { slot: headerActionsSlot, portalContainer: headerActionsPortal } = usePageHeaderActionsSlot();

  // Templates for the catalog tab
  const { data: catalogTemplates = [] } = useTemplates();

  // Sync tab to URL param
  const handleTabChange = useCallback((v: number) => {
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

  // Source de verite des tabs — utilisee pour PageTabs ET pour la resolution
  // {title, subtitle} via resolveTabHeader (indexe par label).
  const tabs = [
    { value: TAB_CATALOG,       label: t('documents.tabs.catalog'),           icon: <ViewList /> },
    { value: TAB_MSG_TEMPLATES, label: t('documents.tabs.messageTemplates'),  icon: <ChatBubbleOutline /> },
    { value: TAB_DOC_TEMPLATES, label: t('documents.tabs.documentTemplates'), icon: <Description /> },
    { value: TAB_HISTORY,       label: t('documents.tabs.history'),           icon: <History /> },
    { value: TAB_VARIABLES,     label: t('documents.tabs.variablesAndTags'),  icon: <LocalOffer /> },
    { value: TAB_COMPLIANCE,    label: t('documents.tabs.compliance'),        icon: <GppGood /> },
  ];
  const { title, subtitle } = resolveTabHeader(
    DOCUMENTS_ROOT_TITLE,
    DOCUMENTS_DEFAULT_SUBTITLE,
    tabs.map((tab) => tab.label),
    activeTab,
    DOCUMENTS_TAB_META,
  );

  // Inline actions per tab
  const inlineActions = (() => {
    if (activeTab === TAB_CATALOG) {
      return (
        <Button startIcon={<Refresh size={14} strokeWidth={1.75} />} size="small" onClick={() => docTemplatesRef.current?.fetchTemplates()}>
          {t('common.refresh')}
        </Button>
      );
    }
    if (activeTab === TAB_MSG_TEMPLATES) {
      return (
        <>
          <Button startIcon={<Refresh size={14} strokeWidth={1.75} />} size="small" onClick={() => msgTemplatesRef.current?.fetchTemplates()}>
            {t('common.refresh')}
          </Button>
          <Button variant="contained" startIcon={<Add size={14} strokeWidth={1.75} />} size="small" onClick={() => msgTemplatesRef.current?.openEditor()}>
            {t('messaging.templates.create')}
          </Button>
        </>
      );
    }
    if (activeTab === TAB_DOC_TEMPLATES) {
      return (
        <>
          <Button startIcon={<Refresh size={14} strokeWidth={1.75} />} size="small" onClick={() => docTemplatesRef.current?.fetchTemplates()}>
            {t('common.refresh')}
          </Button>
          <Button variant="contained" startIcon={<Add size={14} strokeWidth={1.75} />} size="small" onClick={() => docTemplatesRef.current?.openUpload()}>
            {t('documents.tabs.newDocTemplate')}
          </Button>
        </>
      );
    }
    if (activeTab === TAB_HISTORY) {
      return (
        <>
          <Button startIcon={<Refresh size={14} strokeWidth={1.75} />} size="small" onClick={() => historyRef.current?.refresh()}>
            {t('common.refresh')}
          </Button>
          <Button variant="contained" startIcon={<Send size={14} strokeWidth={1.75} />} size="small" onClick={() => historyRef.current?.openGenerate()}>
            {t('documents.tabs.generateDoc')}
          </Button>
        </>
      );
    }
    if (activeTab === TAB_VARIABLES) {
      return (
        <TextField
          size="small"
          placeholder={t('documents.tabs.searchTag')}
          value={tagsSearch}
          onChange={(e) => setTagsSearch(e.target.value)}
          sx={{ minWidth: 220 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Search size={14} strokeWidth={1.75} /></Box>
              </InputAdornment>
            ),
          }}
        />
      );
    }
    if (activeTab === TAB_COMPLIANCE) {
      return (
        <>
          <Button startIcon={<Refresh size={14} strokeWidth={1.75} />} size="small" onClick={() => complianceRef.current?.fetchData()}>
            {t('common.refresh')}
          </Button>
          <TextField
            size="small"
            placeholder="Ex: FAC-2025-00001"
            value={complianceSearch}
            onChange={(e) => setComplianceSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && complianceRef.current?.searchByNumber(complianceSearch)}
            sx={{ minWidth: 220 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Search size={14} strokeWidth={1.75} /></Box>
                </InputAdornment>
              ),
            }}
          />
        </>
      );
    }
    return null;
  })();

  return (
    <PageHeaderActionsProvider slot={headerActionsSlot}>
      <Box>
        <PageHeader
          title={title}
          subtitle={subtitle}
          iconBadge={<Description />}
          backPath="/dashboard"
          showBackButton={false}
          actions={headerActionsPortal}
        />
        <PageTabs
          options={tabs}
          value={activeTab}
          onChange={handleTabChange}
          inlineActions={inlineActions}
        />

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
    </PageHeaderActionsProvider>
  );
};

export default DocumentsPage;
