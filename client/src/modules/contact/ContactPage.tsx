import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Typography,
  Button,
  Badge
} from '@mui/material';
import {
  Send as SendIcon,
  Inbox as InboxIcon,
  Archive as ArchiveIcon,
  Description as FormsIcon,
  Edit as EditIcon,
  Hub as AirbnbIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import ContactMessages from './ContactMessages';
import ReceivedFormsTab from './ReceivedFormsTab';
import AirbnbInboxTab from '../channels/AirbnbInboxTab';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { receivedFormsApi } from '../../services/api/receivedFormsApi';

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
  const [unreadCount, setUnreadCount] = useState(0);
  const [newFormsCount, setNewFormsCount] = useState(0);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdminOrManager = user?.roles?.some((r) => ['SUPER_ADMIN', 'SUPER_MANAGER'].includes(r)) ?? false;

  // Charger le compteur de formulaires NEW pour le badge
  useEffect(() => {
    if (!isAdminOrManager) return;
    receivedFormsApi.getStats().then((stats) => {
      setNewFormsCount(stats.totalNew);
    });
  }, [isAdminOrManager]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleNewMessage = () => {
    navigate('/contact/create');
  };

  const handleUnreadCountChange = useCallback((count: number) => {
    setUnreadCount(count);
  }, []);

  return (
    <Box sx={{ width: '100%', height: 'calc(100vh - 56px - 32px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', height: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="contact tabs" sx={{ flex: 1 }}>
            <Tab
              icon={
                <Badge badgeContent={unreadCount} color="error" max={99}>
                  <InboxIcon />
                </Badge>
              }
              label={t('contact.messagesReceived')}
              id="contact-tab-0"
              aria-controls="contact-tabpanel-0"
            />
            <Tab
              icon={<SendIcon />}
              label={t('contact.messagesSent')}
              id="contact-tab-1"
              aria-controls="contact-tabpanel-1"
            />
            <Tab
              icon={<ArchiveIcon />}
              label={t('contact.archived')}
              id="contact-tab-2"
              aria-controls="contact-tabpanel-2"
            />
            {isAdminOrManager && (
              <Tab
                icon={
                  <Badge badgeContent={newFormsCount} color="warning" max={99}>
                    <FormsIcon />
                  </Badge>
                }
                label="Formulaires reçus"
                id="contact-tab-3"
                aria-controls="contact-tabpanel-3"
              />
            )}
            <Tab
              icon={<AirbnbIcon />}
              label="Airbnb"
              id={`contact-tab-${isAdminOrManager ? 4 : 3}`}
              aria-controls={`contact-tabpanel-${isAdminOrManager ? 4 : 3}`}
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
            <ContactMessages type="received" onUnreadCountChange={handleUnreadCountChange} />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <ContactMessages type="sent" />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <ContactMessages type="archived" />
          </TabPanel>

          {isAdminOrManager && (
            <TabPanel value={tabValue} index={3}>
              <ReceivedFormsTab />
            </TabPanel>
          )}

          <TabPanel value={tabValue} index={isAdminOrManager ? 4 : 3}>
            <AirbnbInboxTab />
          </TabPanel>
        </Box>
      </Paper>

    </Box>
  );
};

export default ContactPage;
