import React, { useState } from 'react';
import {
  Box,
  Paper,
  Button,
} from '@mui/material';
import {
  Chat as ChatIcon,
  Archive as ArchiveIcon,
  Description as FormsIcon,
  Edit as EditIcon,
  Forum as ChannelsIcon,
} from '../../icons';
import { useNavigate } from 'react-router-dom';
import InternalChatTab from './InternalChatTab';
import ContactMessages from './ContactMessages';
import ReceivedFormsTab from './ReceivedFormsTab';
import ChannelInboxTab from '../channels/ChannelInboxTab';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import {
  PageHeaderActionsProvider,
  usePageHeaderActionsSlot,
  resolveTabHeader,
  type TabHeaderMeta,
} from '../../components/PageHeaderActionsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { useFormsStats } from '../../hooks/useReceivedForms';
import { useContactThreads } from '../../hooks/useContactMessages';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`contact-tabpanel-${index}`}
      aria-labelledby={`contact-tab-${index}`}
      style={{
        display: value === index ? 'flex' : 'none',
        flex: 1,
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden'
      }}
      {...other}
    >
      {value === index && (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, p: 0 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// ─── Metadata par tab (breadcrumb + subtitle) ────────────────────────────────
// Clef = LABEL traduit du tab (string stable face aux filtres roles/permissions).
const CONTACT_TAB_META: Record<string, TabHeaderMeta> = {
  'Messagerie': {
    subtitle: 'Conversations internes entre membres de votre organisation : equipes, supervision et coordination.',
  },
  'Messages archivés': {
    subtitle: 'Historique des conversations archivees : consultation en lecture seule, recherche et restauration.',
  },
  'Formulaires reçus': {
    subtitle: 'Demandes entrantes via vos formulaires publics (contact, devis, signalement) : tri et reponse.',
  },
  'Messagerie OTA': {
    subtitle: 'Messages voyageurs venant de vos canaux OTA (Airbnb, Booking) centralises dans une inbox unique.',
  },
};
const CONTACT_ROOT_TITLE = 'Contact';
const CONTACT_DEFAULT_SUBTITLE = 'Messages de contact';

const ContactPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdminOrManager = user?.roles?.some((r) => ['SUPER_ADMIN', 'SUPER_MANAGER'].includes(r)) ?? false;
  const canAccessOta = user?.roles?.some((r) => ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST'].includes(r)) ?? false;

  // Compteur de formulaires NEW via React Query
  const { data: formsStats } = useFormsStats(isAdminOrManager);
  const newFormsCount = formsStats?.totalNew ?? 0;

  // Compteur de messages non-lus pour la messagerie interne
  const { data: threads } = useContactThreads();
  const internalUnread = threads?.reduce((sum, th) => sum + th.unreadCount, 0) ?? 0;

  // Slot DOM pour que chaque tab puisse portaler ses actions dans le PageHeader.
  // /!\ DOIT etre declare AVANT tout early return pour respecter Rules of Hooks.
  const { slot: headerActionsSlot, portalContainer: headerActionsPortal } = usePageHeaderActionsSlot();

  const handleTabChange = (newValue: number) => {
    setTabValue(newValue);
  };

  const handleNewMessage = () => {
    navigate('/contact/create');
  };

  // Source de verite des tabs — utilisee pour PageTabs ET pour resolveTabHeader.
  const tabs = [
    { label: t('contact.internalChat'),    icon: <ChatIcon />,      badge: internalUnread, badgeColor: 'error' as const, hidden: false },
    { label: t('contact.archived'),        icon: <ArchiveIcon />,                                                       hidden: false },
    { label: 'Formulaires reçus',          icon: <FormsIcon />,     badge: newFormsCount,  badgeColor: 'warning' as const, hidden: !isAdminOrManager },
    { label: t('contact.channelMessages'), icon: <ChannelsIcon />,                                                      hidden: !canAccessOta },
  ];
  const visibleTabs = tabs.filter((tab) => !tab.hidden);
  const { title, subtitle } = resolveTabHeader(
    CONTACT_ROOT_TITLE,
    CONTACT_DEFAULT_SUBTITLE,
    visibleTabs.map((tab) => tab.label),
    tabValue,
    CONTACT_TAB_META,
  );

  return (
    <PageHeaderActionsProvider slot={headerActionsSlot}>
      <Box sx={{ width: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <PageHeader
          title={title}
          subtitle={subtitle}
          iconBadge={<ChatIcon />}
          backPath="/dashboard"
          showBackButton={false}
          actions={headerActionsPortal}
        />
        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', height: '100%' }}>
          <PageTabs
            options={tabs}
            value={tabValue}
            onChange={handleTabChange}
            paper={false}
            mb={0}
            ariaLabel="contact tabs"
            inlineActions={(
              <Button
                variant="outlined"
                size="small"
                startIcon={<EditIcon size={14} strokeWidth={1.75} />}
                onClick={handleNewMessage}
              >
                {t('contact.newMessage')}
              </Button>
            )}
          />

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <TabPanel value={tabValue} index={0}>
              <InternalChatTab />
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <ContactMessages type="archived" />
            </TabPanel>

            {isAdminOrManager && (
              <TabPanel value={tabValue} index={2}>
                <ReceivedFormsTab />
              </TabPanel>
            )}

            {canAccessOta && (
              <TabPanel value={tabValue} index={isAdminOrManager ? 3 : 2}>
                <ChannelInboxTab />
              </TabPanel>
            )}
          </Box>
        </Paper>

      </Box>
    </PageHeaderActionsProvider>
  );
};

export default ContactPage;
