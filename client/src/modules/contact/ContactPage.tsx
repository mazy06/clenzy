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
import ReceivedFormsTab from './ReceivedFormsTab';
import ChannelInboxTab, { OTA_CHANNELS } from '../channels/ChannelInboxTab';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import { useTabKeyParam } from '../../components/tabKeyParam';
import {
  PageHeaderActionsProvider,
  usePageHeaderActionsSlot,
  usePageHeaderFiltersSlot,
  resolveTabHeader,
  type TabHeaderMeta,
} from '../../components/PageHeaderActionsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { useFormsStats } from '../../hooks/useReceivedForms';
import { useContactThreads } from '../../hooks/useContactMessages';
import { useChannelInbox } from '../../hooks/useConversations';

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

// La metadata par tab (breadcrumb + subtitle) est construite dans le composant
// via t() pour reagir au changement de langue (cf. contactTabMeta plus bas).

const ContactPage: React.FC = () => {
  // Sous-vue de l'onglet "Messages archivés" : conversations (défaut), formulaires ou messagerie OTA.
  const [archivedView, setArchivedView] = useState<'conversations' | 'formulaires' | 'ota'>('conversations');
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

  // Compteurs de l'onglet "Messages archivés" → orientent vers le bon sous-onglet.
  // Conversations archivées = nombre de threads (1 ligne = 1 conversation), pas de messages.
  const archivedFormsCount = formsStats?.totalArchived ?? 0;
  const { data: archivedThreads } = useContactThreads(true);
  const archivedConversationsCount = archivedThreads?.length ?? 0;
  // Conversations OTA archivées (gated : seulement si l'utilisateur a accès aux canaux OTA).
  // Taille 20 (= celle de ChannelInboxTab) : la clé de cache inbox n'inclut pas `size`,
  // donc on partage exactement la même requête que la liste pour éviter une collision de cache.
  const { data: archivedOtaPage } = useChannelInbox(OTA_CHANNELS, 0, 20, 'ARCHIVED', canAccessOta);
  const archivedOtaCount = archivedOtaPage?.totalElements ?? 0;

  // Slot DOM pour que chaque tab puisse portaler ses actions dans le PageHeader.
  // /!\ DOIT etre declare AVANT tout early return pour respecter Rules of Hooks.
  const { slot: headerActionsSlot, portalContainer: headerActionsPortal } = usePageHeaderActionsSlot();
  const { filtersSlot, filtersContainer } = usePageHeaderFiltersSlot();

  const handleNewMessage = () => {
    navigate('/contact/create');
  };

  // Source de verite des tabs — utilisee pour PageTabs ET pour resolveTabHeader.
  const tabs = [
    { key: 'internal-chat',    label: t('contact.internalChat'),    icon: <ChatIcon />,      badge: internalUnread, badgeColor: 'error' as const, hidden: false },
    { key: 'archived',         label: t('contact.archived'),        icon: <ArchiveIcon />,                                                       hidden: false },
    { key: 'received-forms',   label: t('tabHeaders.contact.tabs.receivedForms', 'Formulaires reçus'), icon: <FormsIcon />, badge: newFormsCount, badgeColor: 'warning' as const, hidden: !isAdminOrManager },
    { key: 'channel-messages', label: t('contact.channelMessages'), icon: <ChannelsIcon />,                                                      hidden: !canAccessOta },
  ];
  const visibleTabs = tabs.filter((tab) => !tab.hidden);
  // useTabKeyParam derive l'onglet actif de l'URL (?tab=<key>) — robuste au role : received-forms /
  // channel-messages sont masques selon les droits, donc l'index visible shifte, jamais la cle.
  const [tabValue, setTabValue] = useTabKeyParam(tabs);
  const handleTabChange = setTabValue;
  // Mapping label → subtitle reconstruit a chaque render pour suivre la langue.
  const contactTabMeta: Record<string, TabHeaderMeta> = {
    [t('contact.internalChat')]: {
      subtitle: t('tabHeaders.contact.subtitle.internalChat', 'Conversations internes entre membres de votre organisation : equipes, supervision et coordination.'),
    },
    [t('contact.archived')]: {
      subtitle: t('tabHeaders.contact.subtitle.archived', 'Historique des conversations archivees : consultation en lecture seule, recherche et restauration.'),
    },
    [t('tabHeaders.contact.tabs.receivedForms', 'Formulaires reçus')]: {
      subtitle: t('tabHeaders.contact.subtitle.receivedForms', 'Demandes entrantes via vos formulaires publics (contact, devis, signalement) : tri et reponse.'),
    },
    [t('contact.channelMessages')]: {
      subtitle: t('tabHeaders.contact.subtitle.channelMessages', 'Messages voyageurs venant de vos canaux OTA (Airbnb, Booking) centralises dans une inbox unique.'),
    },
  };
  const { title, subtitle } = resolveTabHeader(
    t('tabHeaders.contact.title', 'Contact'),
    t('tabHeaders.contact.default', 'Messages de contact'),
    visibleTabs.map((tab) => tab.label),
    tabValue,
    contactTabMeta,
  );

  // Bascule des sous-vues de « Messages archivés ». Rendue DANS la colonne de
  // gauche du master-detail (via listHeaderSlot) afin que la bordure entre les
  // colonnes remonte jusqu'en haut, comme les autres onglets.
  const archivedToggle = (isAdminOrManager || canAccessOta) ? (
    <Box sx={{ display: 'flex', gap: 0.75, p: 1.5, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap', flexShrink: 0 }}>
      <Button
        size="small"
        variant={archivedView === 'conversations' ? 'contained' : 'text'}
        onClick={() => setArchivedView('conversations')}
        sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 500, borderRadius: '8px', minWidth: 0 }}
      >
        Conversations
        <Box component="span" sx={{ ml: 0.5, opacity: 0.55, fontVariantNumeric: 'tabular-nums' }}>{archivedConversationsCount}</Box>
      </Button>
      {isAdminOrManager && (
        <Button
          size="small"
          variant={archivedView === 'formulaires' ? 'contained' : 'text'}
          onClick={() => setArchivedView('formulaires')}
          sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 500, borderRadius: '8px', minWidth: 0 }}
        >
          Formulaires
          <Box component="span" sx={{ ml: 0.5, opacity: 0.55, fontVariantNumeric: 'tabular-nums' }}>{archivedFormsCount}</Box>
        </Button>
      )}
      {canAccessOta && (
        <Button
          size="small"
          variant={archivedView === 'ota' ? 'contained' : 'text'}
          onClick={() => setArchivedView('ota')}
          sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 500, borderRadius: '8px', minWidth: 0 }}
        >
          OTA
          <Box component="span" sx={{ ml: 0.5, opacity: 0.55, fontVariantNumeric: 'tabular-nums' }}>{archivedOtaCount}</Box>
        </Button>
      )}
    </Box>
  ) : null;

  return (
    <PageHeaderActionsProvider slot={headerActionsSlot} filtersSlot={filtersSlot}>
      <Box sx={{ width: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <PageHeader
          title={title}
          subtitle={subtitle}
          iconBadge={<ChatIcon />}
          backPath="/dashboard"
          showBackButton={false}
          actions={headerActionsPortal}
          filters={filtersContainer}
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
              {isAdminOrManager && archivedView === 'formulaires' ? (
                <ReceivedFormsTab archivedOnly listHeaderSlot={archivedToggle} />
              ) : canAccessOta && archivedView === 'ota' ? (
                <ChannelInboxTab archivedOnly listHeaderSlot={archivedToggle} />
              ) : (
                <InternalChatTab archived listHeaderSlot={archivedToggle} />
              )}
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
