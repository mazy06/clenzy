import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Typography,
  Button,
  Fab
} from '@mui/material';
import {
  Add as AddIcon,
  Send as SendIcon,
  Inbox as InboxIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import ContactMessages from './ContactMessages';

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
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const ContactPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const navigate = useNavigate();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleNewMessage = () => {
    navigate('/contact/create');
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Paper sx={{ width: '100%', mb: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="contact tabs">
            <Tab 
              icon={<InboxIcon />} 
              label="Messages Reçus" 
              id="contact-tab-0"
              aria-controls="contact-tabpanel-0"
            />
            <Tab 
              icon={<SendIcon />} 
              label="Messages Envoyés" 
              id="contact-tab-1"
              aria-controls="contact-tabpanel-1"
            />
          </Tabs>
        </Box>
        
        <TabPanel value={tabValue} index={0}>
          <ContactMessages type="received" />
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          <ContactMessages type="sent" />
        </TabPanel>
      </Paper>

      {/* Bouton flottant pour nouveau message */}
      <Fab
        color="primary"
        size="small"
        aria-label="nouveau message"
        onClick={handleNewMessage}
        sx={{
          position: 'fixed',
          bottom: 12,
          right: 12,
        }}
      >
        <AddIcon sx={{ fontSize: 20 }} />
      </Fab>
    </Box>
  );
};

export default ContactPage;
