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

  const handleTabChange = (newValue: number) => {
    setTabValue(newValue);
  };

  const handleNewMessage = () => {
    navigate('/contact/create');
  };

  return (
    <Box sx={{ width: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader
        title={t('contact.title')}
        subtitle={t('contact.subtitle')}
        iconBadge={<ChatIcon />}
        backPath="/dashboard"
        showBackButton={false}
      />
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', height: '100%' }}>
        <PageTabs
          options={[
            { label: t('contact.internalChat'), icon: <ChatIcon />, badge: internalUnread, badgeColor: 'error' },
            { label: t('contact.archived'),     icon: <ArchiveIcon /> },
            { label: 'Formulaires reçus', icon: <FormsIcon />, badge: newFormsCount, badgeColor: 'warning', hidden: !isAdminOrManager },
            { label: t('contact.channelMessages'), icon: <ChannelsIcon />, hidden: !canAccessOta },
          ]}
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
  );
};

export default ContactPage;
