import React, { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Button,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
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
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `contact-tab-${index}`,
    'aria-controls': `contact-tabpanel-${index}`,
  };
}

const ContactPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleCreateMessage = () => {
    navigate('/contact/create');
  };

  if (!user) {
    return null;
  }

  return (
    <Box>
      <PageHeader
        title="Contact"
        subtitle="Communiquez avec votre équipe et vos interlocuteurs"
        backPath="/dashboard"
        showBackButton={false}
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleCreateMessage}
            sx={{ minWidth: 140 }}
          >
            Nouveau message
          </Button>
        }
      />

      <Paper sx={{ width: '100%', mt: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            aria-label="contact tabs"
            sx={{ px: 2 }}
          >
            <Tab 
              label="Messages reçus" 
              {...a11yProps(0)} 
            />
            <Tab 
              label="Messages envoyés" 
              {...a11yProps(1)} 
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
    </Box>
  );
};

export default ContactPage;
