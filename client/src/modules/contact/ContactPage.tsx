import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Button,
  Badge
} from '@mui/material';
import {
  Chat as ChatIcon,
  Archive as ArchiveIcon,
  Description as FormsIcon,
  Edit as EditIcon,
  Forum as ChannelsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import InternalChatTab from './InternalChatTab';
import ContactMessages from './ContactMessages';
import ReceivedFormsTab from './ReceivedFormsTab';
import ChannelInboxTab from '../channels/ChannelInboxTab';
import PageHeader from '../../components/PageHeader';
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

  // Compteur de formulaires NEW via React Query
  const { data: formsStats } = useFormsStats(isAdminOrManager);
  const newFormsCount = formsStats?.totalNew ?? 0;

  // Compteur de messages non-lus pour la messagerie interne
  const { data: threads } = useContactThreads();
  const internalUnread = threads?.reduce((sum, th) => sum + th.unreadCount, 0) ?? 0;

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleNewMessage = () => {
    navigate('/contact/create');
  };

  return (
    <Box sx={{ width: '100%', height: 'calc(100vh - 56px - 32px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader
        title={t('contact.title')}
        subtitle={t('contact.subtitle')}
        backPath="/dashboard"
        showBackButton={false}
      />
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', height: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="contact tabs" sx={{ flex: 1 }}>
            <Tab
              icon={
                <Badge badgeContent={internalUnread} color="error" max={99}>
                  <ChatIcon />
                </Badge>
              }
              label={t('contact.internalChat')}
              id="contact-tab-0"
              aria-controls="contact-tabpanel-0"
            />
            <Tab
              icon={<ArchiveIcon />}
              label={t('contact.archived')}
              id="contact-tab-1"
              aria-controls="contact-tabpanel-1"
            />
            {isAdminOrManager && (
              <Tab
                icon={
                  <Badge badgeContent={newFormsCount} color="warning" max={99}>
                    <FormsIcon />
                  </Badge>
                }
                label="Formulaires reçus"
                id="contact-tab-2"
                aria-controls="contact-tabpanel-2"
              />
            )}
            <Tab
              icon={<ChannelsIcon />}
              label={t('contact.channelMessages')}
              id={`contact-tab-${isAdminOrManager ? 3 : 2}`}
              aria-controls={`contact-tabpanel-${isAdminOrManager ? 3 : 2}`}
            />
          </Tabs>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={handleNewMessage}
            sx={{ mr: 2, textTransform: 'none', fontWeight: 600, borderRadius: '8px', whiteSpace: 'nowrap' }}
          >
            {t('contact.newMessage')}
          </Button>
        </Box>

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

          <TabPanel value={tabValue} index={isAdminOrManager ? 3 : 2}>
            <ChannelInboxTab />
          </TabPanel>
        </Box>
      </Paper>

    </Box>
  );
};

export default ContactPage;
