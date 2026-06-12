import React, { useEffect } from 'react';
import { Box, Button, Paper } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Archive as ArchiveIcon,
  Description as FormsIcon,
  Edit as EditIcon,
  Forum as ForumIcon,
  Message as MessageIcon,
} from '../../icons';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import { useTabKeyParam } from '../../components/tabKeyParam';
import {
  PageHeaderActionsProvider,
  usePageHeaderActionsSlot,
  usePageHeaderFiltersSlot,
} from '../../components/PageHeaderActionsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { useContactThreads } from '../../hooks/useContactMessages';
import { useUnreadCount } from '../../hooks/useConversations';
import { useFormsStats } from '../../hooks/useReceivedForms';
import ConversationsPane from './panes/ConversationsPane';
import ArchivedPane from './panes/ArchivedPane';
import ReceivedFormsPane from './panes/ReceivedFormsPane';
import OtaPane from './panes/OtaPane';

/** Anciennes clés d'onglets de /contact → clés du hub (compat bookmarks). */
const LEGACY_TAB_KEYS: Record<string, string> = {
  'internal-chat': 'messagerie',
  archived: 'archives',
  'received-forms': 'formulaires',
  'channel-messages': 'ota',
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`messaging-tabpanel-${index}`}
      aria-labelledby={`messaging-tab-${index}`}
      style={{
        display: value === index ? 'flex' : 'none',
        flex: 1,
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {value === index && (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, p: 0 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

/**
 * Écran Messagerie unifié (« tout dans un seul chat ») — référence .mh :
 * bandeau Signature + 4 onglets soulignés accent (Messagerie · Messages
 * archivés · Formulaires reçus · Messagerie OTA) + bouton « Nouveau message ».
 * Monté sur la route /contact (entrée Messagerie de la sidebar).
 */
export default function MessagingHubPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const isAdminOrManager =
    user?.roles?.some((r) => ['SUPER_ADMIN', 'SUPER_MANAGER'].includes(r)) ?? false;
  const canAccessOta =
    user?.roles?.some((r) => ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST'].includes(r)) ?? false;

  // Compteurs des badges : non-lus internes + canal (onglet Messagerie),
  // formulaires NEW (onglet Formulaires reçus).
  const { data: threads } = useContactThreads();
  const internalUnread = threads?.reduce((sum, th) => sum + th.unreadCount, 0) ?? 0;
  const { data: unreadData } = useUnreadCount();
  const conversationsUnread = internalUnread + (unreadData?.count ?? 0);
  const { data: formsStats } = useFormsStats(isAdminOrManager);
  const newFormsCount = formsStats?.totalNew ?? 0;

  // Slots pour que les volets portalent leurs actions/filtres dans le PageHeader.
  // /!\ DOIT être déclaré AVANT tout early return (Rules of Hooks).
  const { slot: headerActionsSlot, portalContainer: headerActionsPortal } = usePageHeaderActionsSlot();
  const { filtersSlot, filtersContainer } = usePageHeaderFiltersSlot();

  // Compat : réécrit les anciennes clés ?tab= de /contact vers celles du hub.
  useEffect(() => {
    const raw = searchParams.get('tab');
    const alias = raw ? LEGACY_TAB_KEYS[raw] : undefined;
    if (alias) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('tab', alias);
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  const tabs = [
    {
      key: 'messagerie',
      label: t('messagingHub.tabs.conversations', 'Messagerie'),
      icon: <MessageIcon />,
      badge: conversationsUnread,
      badgeColor: 'error' as const,
      hidden: false,
    },
    {
      key: 'archives',
      label: t('messagingHub.tabs.archived', 'Messages archivés'),
      icon: <ArchiveIcon />,
      hidden: false,
    },
    {
      key: 'formulaires',
      label: t('messagingHub.tabs.receivedForms', 'Formulaires reçus'),
      icon: <FormsIcon />,
      badge: newFormsCount,
      badgeColor: 'warning' as const,
      hidden: !isAdminOrManager,
    },
    {
      key: 'ota',
      label: t('messagingHub.tabs.ota', 'Messagerie OTA'),
      icon: <ForumIcon />,
      hidden: !canAccessOta,
    },
  ];
  const [tabValue, setTabValue] = useTabKeyParam(tabs);

  // Index visibles (les onglets masqués par rôle décalent les suivants).
  const formsIndex = 2;
  const otaIndex = isAdminOrManager ? 3 : 2;

  return (
    <PageHeaderActionsProvider slot={headerActionsSlot} filtersSlot={filtersSlot}>
      <Box sx={{ width: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <PageHeader
          title={t('messagingHub.title', 'Messagerie')}
          subtitle={t('messagingHub.subtitle', 'Email · SMS · WhatsApp')}
          iconBadge={<MessageIcon />}
          backPath="/dashboard"
          showBackButton={false}
          actions={headerActionsPortal}
          filters={filtersContainer}
        />
        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', height: '100%' }}>
          <PageTabs
            options={tabs}
            value={tabValue}
            onChange={setTabValue}
            paper={false}
            mb={0}
            ariaLabel="messaging tabs"
            inlineActions={
              <Button
                variant="outlined"
                size="small"
                startIcon={<EditIcon size={14} strokeWidth={1.75} />}
                onClick={() => navigate('/contact/create')}
              >
                {t('messagingHub.newMessage', 'Nouveau message')}
              </Button>
            }
          />

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <TabPanel value={tabValue} index={0}>
              <ConversationsPane />
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <ArchivedPane />
            </TabPanel>

            {isAdminOrManager && (
              <TabPanel value={tabValue} index={formsIndex}>
                <ReceivedFormsPane />
              </TabPanel>
            )}

            {canAccessOta && (
              <TabPanel value={tabValue} index={otaIndex}>
                <OtaPane />
              </TabPanel>
            )}
          </Box>
        </Paper>
      </Box>
    </PageHeaderActionsProvider>
  );
}
