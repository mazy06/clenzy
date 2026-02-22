import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Tabs,
  Tab,
} from '@mui/material';
import {
  People,
  Business,
  Add,
  Sync,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import ExportButton from '../../components/ExportButton';
import UsersList from './UsersList';
import OrganizationsList from './OrganizationsList';
import type { UsersListHandle } from './UsersList';
import type { OrganizationsListHandle } from './OrganizationsList';

// ─── TabPanel ─────────────────────────────────────────────────────────────────

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
      id={`users-orgs-tabpanel-${index}`}
      aria-labelledby={`users-orgs-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 2 }}>{children}</Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `users-orgs-tab-${index}`,
    'aria-controls': `users-orgs-tabpanel-${index}`,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

const UsersAndOrganizations: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [, forceUpdate] = useState(0);
  const usersRef = useRef<UsersListHandle>(null);
  const orgsRef = useRef<OrganizationsListHandle>(null);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    // Force re-render pour mettre a jour les boutons du PageHeader
    setTimeout(() => forceUpdate(n => n + 1), 50);
  };

  // Actions dynamiques selon l'onglet actif
  const renderActions = () => {
    if (tabValue === 0) {
      // Onglet Utilisateurs
      const handle = usersRef.current;
      return (
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {handle && (
            <ExportButton
              data={handle.filteredUsers}
              columns={handle.exportColumns}
              fileName="utilisateurs"
            />
          )}
          <Button
            variant="outlined"
            color="secondary"
            size="small"
            startIcon={<Sync sx={{ fontSize: 18 }} />}
            onClick={() => handle?.sync()}
            disabled={handle?.syncing}
            sx={{ fontSize: '0.8125rem' }}
            title="Synchroniser"
          >
            {handle?.syncing ? 'Sync...' : 'Synchroniser'}
          </Button>
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={<Add sx={{ fontSize: 18 }} />}
            onClick={() => navigate('/users/new')}
            sx={{ fontSize: '0.8125rem' }}
            title="Nouvel utilisateur"
          >
            Nouvel utilisateur
          </Button>
        </Box>
      );
    }

    if (tabValue === 1) {
      // Onglet Organisations
      return (
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {isAdmin() && (
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<Add sx={{ fontSize: 18 }} />}
              onClick={() => orgsRef.current?.create()}
              sx={{ fontSize: '0.8125rem' }}
            >
              Nouvelle organisation
            </Button>
          )}
        </Box>
      );
    }

    return null;
  };

  return (
    <Box>
      <PageHeader
        title="Utilisateurs et Organisations"
        subtitle="Gestion des utilisateurs et des organisations de la plateforme"
        backPath="/dashboard"
        showBackButton={false}
        actions={renderActions()}
      />

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 0 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="Onglets utilisateurs et organisations"
          sx={{
            minHeight: 40,
            '& .MuiTab-root': {
              minHeight: 40,
              fontSize: '0.85rem',
              textTransform: 'none',
            },
          }}
        >
          <Tab
            icon={<People sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Utilisateurs"
            {...a11yProps(0)}
          />
          <Tab
            icon={<Business sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Organisations"
            {...a11yProps(1)}
          />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <UsersList ref={usersRef} />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <OrganizationsList ref={orgsRef} />
      </TabPanel>
    </Box>
  );
};

export default UsersAndOrganizations;
