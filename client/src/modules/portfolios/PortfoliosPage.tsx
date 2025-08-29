import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Container,
  Fab,
} from '@mui/material';
import { Business as BusinessIcon, Add as AddIcon } from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import PortfolioList from './PortfolioList';
import PortfolioForm from './PortfolioForm';
import PortfolioCard from './PortfolioCard';

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
      id={`portfolios-tabpanel-${index}`}
      aria-labelledby={`portfolios-tab-${index}`}
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
    id: `portfolios-tab-${index}`,
    'aria-controls': `portfolios-tabpanel-${index}`,
  };
}

const PortfoliosPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { user, isAdmin, isManager } = useAuth();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleFormOpen = () => {
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
  };

  if (!user || (!isAdmin() && !isManager())) {
    return (
      <Container maxWidth="lg">
        <Typography variant="h4" color="error" sx={{ mt: 4 }}>
          Accès refusé. Seuls les administrateurs et managers peuvent accéder à cette page.
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <PageHeader
        title="Portefeuilles"
        subtitle="Gérez vos portefeuilles clients et vos équipes opérationnelles"
        backPath="/dashboard"
        showBackButton={true}
        actions={
          <Fab
            color="primary"
            aria-label="Nouveau portefeuille"
            onClick={handleFormOpen}
            sx={{ position: 'fixed', bottom: 16, right: 16 }}
          >
            <AddIcon />
          </Fab>
        }
      />

      <Paper sx={{ width: '100%', mt: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="portfolios tabs"
            sx={{ px: 2 }}
          >
            <Tab
              label="Mes Portefeuilles"
              {...a11yProps(0)}
              icon={<BusinessIcon />}
              iconPosition="start"
            />
            <Tab
              label="Gestion des Équipes"
              {...a11yProps(1)}
            />
            <Tab
              label="Statistiques"
              {...a11yProps(2)}
            />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <PortfolioList />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            Gestion des Équipes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gérez les membres de vos équipes opérationnelles par portefeuille.
          </Typography>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>
            Statistiques des Portefeuilles
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Consultez les statistiques et performances de vos portefeuilles.
          </Typography>
        </TabPanel>
      </Paper>

      {/* Formulaire de création/édition de portefeuille */}
      <PortfolioForm
        open={isFormOpen}
        onClose={handleFormClose}
        onSuccess={() => {
          handleFormClose();
          // TODO: Rafraîchir la liste des portefeuilles
        }}
      />
    </Container>
  );
};

export default PortfoliosPage;
