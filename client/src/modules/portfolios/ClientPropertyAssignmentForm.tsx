import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Container,
  Stepper,
  Step,
  StepLabel,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  FormControlLabel,
  Divider,
} from '@mui/material';
import {
  Business,
  People,
  Assignment,
  CheckCircle,
  ArrowForward,
  ArrowBack,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import PageHeader from '../../components/PageHeader';
import { API_CONFIG } from '../../config/api';
import { useTranslation } from '../../hooks/useTranslation';

interface Portfolio {
  id: number;
  name: string;
  description: string;
  managerId: number;
  managerName?: string;
  isActive: boolean;
}

interface Manager {
  id: number;
  keycloakId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
}

interface Client {
  id: number;
  keycloakId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
}

interface Property {
  id: number;
  name: string;
  address: string;
  city: string;
  type: string;
  status: string;
  ownerId: number;
  ownerName: string;
  isActive: boolean;
}

// steps sera généré dynamiquement avec les traductions

const ClientPropertyAssignmentForm: React.FC = () => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);
  
  // Générer les étapes avec traductions
  const steps = [
    t('portfolios.steps.selectManager'),
    t('portfolios.steps.chooseClients'),
    t('portfolios.steps.chooseProperties'),
    t('portfolios.steps.confirmAssignments')
  ];
  const [managers, setManagers] = useState<Manager[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [hostUsers, setHostUsers] = useState<Client[]>([]);
  const [selectedManager, setSelectedManager] = useState<number | ''>('');
  const [selectedClients, setSelectedClients] = useState<number[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    const checkPermissions = async () => {
      const adminPerm = await hasPermission('portfolios:manage_all');
      const managerPerm = await hasPermission('portfolios:manage');
      setIsAdmin(adminPerm);
      setIsManager(managerPerm && !adminPerm);
    };
    checkPermissions();
  }, [hasPermission]);

  useEffect(() => {
    if (isAdmin !== undefined && isManager !== undefined && user?.id) {
      console.log('🔄 ClientPropertyAssignmentForm - useEffect triggered:', { isAdmin, isManager, userId: user.id });
      
      // Charger la liste des managers pour tous les utilisateurs
      loadManagers();
      // Charger la liste des utilisateurs HOST
      loadHostUsers();
      
      if (isManager && !isAdmin) {
        // Si c'est un manager (mais pas admin), pré-sélectionner son ID
        console.log('🔄 ClientPropertyAssignmentForm - Pré-sélection manager:', user.id);
        setSelectedManager(Number(user.id));
      }
    }
  }, [isAdmin, isManager, user?.id]);

  useEffect(() => {
    if (selectedManager) {
      loadClientsAndProperties();
    }
  }, [selectedManager]);

  useEffect(() => {
    if (selectedClients.length > 0) {
      loadPropertiesForSelectedClients();
    } else {
      setProperties([]);
      setSelectedProperties([]);
    }
  }, [selectedClients]);

  const loadManagers = async () => {
    try {
      console.log('🔄 ClientPropertyAssignmentForm - Chargement des managers...');
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/managers/all`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}` }
      });

      console.log('📡 ClientPropertyAssignmentForm - Réponse managers:', response.status, response.statusText);

      if (response.ok) {
        const managersArray = await response.json();
        console.log('📊 ClientPropertyAssignmentForm - Managers reçus:', managersArray);
        
        setManagers(managersArray);
      } else {
        console.error('❌ ClientPropertyAssignmentForm - Erreur utilisateurs:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ ClientPropertyAssignmentForm - Détails erreur:', errorText);
        setManagers([]);
      }
    } catch (err) {
      console.error('Erreur chargement utilisateurs:', err);
      setManagers([]);
    }
  };

  const loadHostUsers = async () => {
    try {
      console.log('🔄 ClientPropertyAssignmentForm - Chargement des utilisateurs HOST...');
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/managers/hosts`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}` }
      });

      console.log('📡 ClientPropertyAssignmentForm - Réponse HOST users:', response.status, response.statusText);

      if (response.ok) {
        const hostUsersArray = await response.json();
        console.log('📊 ClientPropertyAssignmentForm - Utilisateurs HOST reçus:', hostUsersArray);
        
        setHostUsers(hostUsersArray);
      } else {
        console.error('❌ ClientPropertyAssignmentForm - Erreur utilisateurs HOST:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ ClientPropertyAssignmentForm - Détails erreur:', errorText);
        setHostUsers([]);
      }
    } catch (err) {
      console.error('Erreur chargement utilisateurs HOST:', err);
      setHostUsers([]);
    }
  };

  const loadPropertiesForSelectedClients = async () => {
    if (selectedClients.length === 0) {
      console.log('⏳ ClientPropertyAssignmentForm - Aucun client sélectionné pour charger les propriétés');
      setProperties([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔄 ClientPropertyAssignmentForm - Chargement des propriétés pour clients:', selectedClients);
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/managers/properties/by-clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`
        },
        body: JSON.stringify(selectedClients)
      });

      console.log('📡 ClientPropertyAssignmentForm - Réponse propriétés:', response.status, response.statusText);

      if (response.ok) {
        const propertiesArray = await response.json();
        console.log('📊 ClientPropertyAssignmentForm - Propriétés reçues:', propertiesArray);
        
        setProperties(propertiesArray);
        
        // Cocher toutes les propriétés par défaut
        const allPropertyIds = propertiesArray.map((prop: Property) => prop.id);
        setSelectedProperties(allPropertyIds);
        console.log('✅ ClientPropertyAssignmentForm - Toutes les propriétés cochées par défaut:', allPropertyIds);
      } else {
        console.error('❌ ClientPropertyAssignmentForm - Erreur propriétés:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ ClientPropertyAssignmentForm - Détails erreur:', errorText);
        setProperties([]);
      }
    } catch (err) {
      console.error('Erreur chargement propriétés:', err);
      setProperties([]);
    } finally {
      setLoading(false);
    }
  };

  const loadClientsAndProperties = async () => {
    if (!selectedManager) {
      console.log('⏳ ClientPropertyAssignmentForm - En attente de la sélection du manager...');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔄 ClientPropertyAssignmentForm - Chargement des clients et propriétés pour manager:', selectedManager);
      
      const [clientsRes, propertiesRes] = await Promise.all([
        fetch(`${API_CONFIG.BASE_URL}/api/managers/hosts`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}` }
        }),
        fetch(`${API_CONFIG.BASE_URL}/api/properties`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}` }
        })
      ]);


      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        console.log('📊 ClientPropertyAssignmentForm - Clients reçus:', clientsData);
        // S'assurer que c'est un tableau
        const clientsArray = Array.isArray(clientsData) ? clientsData : (clientsData.content || []);
        setClients(clientsArray);
      } else {
        console.error('❌ ClientPropertyAssignmentForm - Erreur clients:', clientsRes.status, clientsRes.statusText);
      }

      if (propertiesRes.ok) {
        const propertiesData = await propertiesRes.json();
        console.log('📊 ClientPropertyAssignmentForm - Propriétés reçues:', propertiesData);
        // S'assurer que c'est un tableau
        const propertiesArray = Array.isArray(propertiesData) ? propertiesData : (propertiesData.content || []);
        // Filtrer les propriétés selon le rôle
        const filteredProperties = isAdmin 
          ? propertiesArray 
          : propertiesArray.filter((p: Property) => p.ownerId === Number(user?.id));
        setProperties(filteredProperties);
      } else {
        console.error('❌ ClientPropertyAssignmentForm - Erreur propriétés:', propertiesRes.status, propertiesRes.statusText);
      }
    } catch (err) {
      setError('Erreur lors du chargement des données');
      console.error('Erreur chargement données:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleClientToggle = (clientId: number) => {
    setSelectedClients(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handlePropertyToggle = (propertyId: number) => {
    setSelectedProperties(prev => 
      prev.includes(propertyId) 
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId]
    );
  };

  const handleSubmit = async () => {
    if (!selectedManager || selectedClients.length === 0 || selectedProperties.length === 0) {
      setError('Veuillez sélectionner un manager, au moins un client et une propriété');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔄 ClientPropertyAssignmentForm - Soumission assignation:', {
        managerId: selectedManager,
        clientIds: selectedClients,
        propertyIds: selectedProperties
      });

      // Utiliser le nouvel endpoint d'assignation avec validation d'unicité
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/managers/${selectedManager}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`
        },
        body: JSON.stringify({
          clientIds: selectedClients,
          propertyIds: selectedProperties,
          notes: `Assignation effectuée le ${new Date().toLocaleString('fr-FR')}`
        })
      });

      console.log('📡 ClientPropertyAssignmentForm - Réponse assignation:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ ClientPropertyAssignmentForm - Assignation réussie:', result);
        setSuccessMessage(`Assignation réussie ! ${result.clientsAssigned} clients et ${result.propertiesAssigned} propriétés assignés.`);
        
        // Rediriger vers la page des portefeuilles après 2 secondes
        setTimeout(() => {
          window.location.href = '/portfolios';
        }, 2000);
      } else {
        const errorData = await response.json();
        console.error('❌ ClientPropertyAssignmentForm - Erreur assignation:', errorData);
        
        if (errorData.conflicts && errorData.conflicts.length > 0) {
          setError(`Conflits d'assignation détectés : ${errorData.conflicts.join(', ')}`);
        } else {
          setError(errorData.error || 'Erreur lors de l\'assignation');
        }
      }
    } catch (err) {
      setError('Erreur lors de l\'assignation');
      console.error('Erreur assignation:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              {t('portfolios.steps.selectManagerTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              {t('portfolios.steps.selectManagerDescription')}
            </Typography>
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel shrink={true} sx={{ 
                position: 'absolute',
                top: '-6px',
                left: '12px',
                backgroundColor: 'white',
                padding: '0 6px',
                zIndex: 1,
                fontSize: '0.75rem',
                fontWeight: 500,
                color: '#1976d2'
              }}>Manager</InputLabel>
              <Select
                value={selectedManager}
                onChange={(e) => {
                  console.log('🔄 ClientPropertyAssignmentForm - Sélection manager:', e.target.value);
                  setSelectedManager(e.target.value as number);
                }}
                label="Manager"
                disabled={false} // Tous les utilisateurs peuvent changer
                displayEmpty
                renderValue={(value) => {
                  if (!value || value === 0) {
                    return <span style={{ color: '#999' }}>{t('portfolios.fields.selectManager')}</span>;
                  }
                  const selectedManagerData = managers.find(m => m.id === value);
                  if (selectedManagerData) {
                    return `${selectedManagerData.firstName} ${selectedManagerData.lastName} - ${selectedManagerData.email}`;
                  }
                  return value;
                }}
                sx={{
                  '& .MuiSelect-select': {
                    paddingTop: '16px',
                    paddingBottom: '16px',
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d0d0d0',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#1976d2',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#1976d2',
                    borderWidth: '2px',
                  }
                }}
              >
                <MenuItem value="">
                  <Typography variant="body2" color="text.secondary">
                    Sélectionnez un manager...
                  </Typography>
                </MenuItem>
                {managers.length > 0 ? (
                  managers.map((manager) => (
                    <MenuItem key={manager.id} value={manager.id}>
                      <Typography variant="subtitle1">
                        {manager.firstName} {manager.lastName} - {manager.email}
                      </Typography>
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>
                    <Typography variant="body2" color="text.secondary">
                      {t('portfolios.fields.noManagerFound')}
                    </Typography>
                  </MenuItem>
                )}
              </Select>
            </FormControl>
            
            {/* Debug info - Commenté pour éviter les erreurs de build */}
            {/* 
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="caption" display="block">
                Debug: isAdmin={isAdmin.toString()}, isManager={isManager.toString()}
              </Typography>
              <Typography variant="caption" display="block">
                Managers count: {managers.length}
              </Typography>
              <Typography variant="caption" display="block">
                Selected manager: {selectedManager}
              </Typography>
              <Typography variant="caption" display="block">
                User ID: {user?.id}
              </Typography>
            </Box>
            */}
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              {t('portfolios.fields.selectClientsToAssign')}
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              {t('portfolios.fields.selectClientsDescription')}
            </Typography>
            
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel shrink={true} sx={{ 
                position: 'absolute',
                top: '-6px',
                left: '12px',
                backgroundColor: 'white',
                padding: '0 6px',
                zIndex: 1,
                fontSize: '0.75rem',
                fontWeight: 500,
                color: '#1976d2'
              }}>Clients (HOST)</InputLabel>
              <Select
                multiple
                value={selectedClients}
                onChange={(e) => {
                  console.log('🔄 ClientPropertyAssignmentForm - Sélection clients:', e.target.value);
                  setSelectedClients(e.target.value as number[]);
                }}
                label="Clients (HOST)"
                displayEmpty
                renderValue={(selected) => {
                  if (selected.length === 0) {
                    return <span style={{ color: '#999' }}>Sélectionnez des clients...</span>;
                  }
                  return selected.map(id => {
                    const client = hostUsers.find(c => c.id === id);
                    return client ? `${client.firstName} ${client.lastName}` : id;
                  }).join(', ');
                }}
                sx={{
                  '& .MuiSelect-select': {
                    paddingTop: '16px',
                    paddingBottom: '16px',
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#d0d7de',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#1976d2',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#1976d2',
                    borderWidth: 2,
                  },
                }}
              >
                <MenuItem value="">
                    <Typography variant="body2" color="text.secondary">
                      {t('portfolios.fields.selectClients')}
                    </Typography>
                </MenuItem>
                {hostUsers.length > 0 ? (
                  hostUsers.map((client) => (
                    <MenuItem key={client.id} value={client.id}>
                      <Typography variant="subtitle1">
                        {client.firstName} {client.lastName} - {client.email}
                      </Typography>
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>
                    <Typography variant="body2" color="text.secondary">
                      {t('portfolios.fields.noClientFound')}
                    </Typography>
                  </MenuItem>
                )}
              </Select>
            </FormControl>
            
            {selectedClients.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {t('portfolios.fields.clientsSelected')} ({selectedClients.length}) :
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {selectedClients.map(clientId => {
                    const client = hostUsers.find(c => c.id === clientId);
                    return client ? (
                      <Chip
                        key={clientId}
                        label={`${client.firstName} ${client.lastName}`}
                        onDelete={() => handleClientToggle(clientId)}
                        color="primary"
                        variant="outlined"
                      />
                    ) : null;
                  })}
                </Box>
              </Box>
            )}
            
            {hostUsers.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                {t('portfolios.fields.noClientFound')}
              </Alert>
            )}
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              {t('portfolios.fields.selectProperties')}
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              {t('portfolios.fields.propertiesDescription')}
            </Typography>
            <Grid container spacing={2}>
              {properties.map((property) => (
                <Grid item xs={12} sm={6} md={4} key={property.id}>
                  <Card 
                    variant={selectedProperties.includes(property.id) ? 'elevation' : 'outlined'}
                    sx={{ 
                      cursor: 'pointer',
                      border: selectedProperties.includes(property.id) ? 2 : 1,
                      borderColor: selectedProperties.includes(property.id) ? 'primary.main' : 'divider'
                    }}
                    onClick={() => handlePropertyToggle(property.id)}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Checkbox
                          checked={selectedProperties.includes(property.id)}
                          onChange={() => handlePropertyToggle(property.id)}
                          sx={{ mr: 1 }}
                        />
                        <Assignment color="info" sx={{ mr: 1 }} />
                        <Typography variant="subtitle1" noWrap>
                          {property.name}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {property.address}, {property.city}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <Chip label={property.type} size="small" color="default" />
                        <Chip 
                          label={property.status} 
                          size="small" 
                          color={property.status === 'ACTIVE' ? 'success' : 'default'} 
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            {properties.length === 0 && selectedClients.length > 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Aucune propriété trouvée pour les clients sélectionnés.
              </Alert>
            )}
            {selectedClients.length === 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Veuillez d'abord sélectionner des clients à l'étape précédente.
              </Alert>
            )}
          </Box>
        );

      case 3:
        const selectedClientsData = hostUsers.filter(c => selectedClients.includes(c.id));
        const selectedPropertiesData = properties.filter(p => selectedProperties.includes(p.id));
        const selectedManagerData = managers.find(m => m.id === selectedManager);
        
        console.log('🔍 ClientPropertyAssignmentForm - Debug confirmation step:', {
          selectedManager,
          managers: managers.map(m => ({ id: m.id, name: `${m.firstName} ${m.lastName}` })),
          selectedManagerData,
          selectedClients,
          selectedClientsData: selectedClientsData.map(c => ({ id: c.id, name: `${c.firstName} ${c.lastName}` })),
          selectedProperties,
          selectedPropertiesData: selectedPropertiesData.map(p => ({ id: p.id, name: p.name }))
        });

        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              {t('portfolios.fields.confirmAssignments')}
            </Typography>
            
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                <People sx={{ mr: 1, verticalAlign: 'middle' }} />
                {t('portfolios.fields.selectedManager')}
              </Typography>
              {selectedManagerData ? (
                <>
                  <Typography variant="h6" color="primary">
                    {selectedManagerData.firstName} {selectedManagerData.lastName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedManagerData.email}
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" color="error">
                  {t('portfolios.confirmations.noManagerFound')}: {selectedManager}
                </Typography>
              )}
            </Paper>


            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    <People sx={{ mr: 1, verticalAlign: 'middle' }} />
                    {t('portfolios.fields.selectedClients')} ({selectedClientsData.length})
                  </Typography>
                  <List dense>
                    {selectedClientsData.map((client) => (
                      <ListItem key={client.id}>
                        <ListItemIcon>
                          <CheckCircle color="success" />
                        </ListItemIcon>
                        <ListItemText
                          primary={`${client.firstName} ${client.lastName}`}
                          secondary={client.email}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    <Assignment sx={{ mr: 1, verticalAlign: 'middle' }} />
                    {t('portfolios.fields.selectedProperties')} ({selectedPropertiesData.length})
                  </Typography>
                  <List dense>
                    {selectedPropertiesData.map((property) => (
                      <ListItem key={property.id}>
                        <ListItemIcon>
                          <CheckCircle color="success" />
                        </ListItemIcon>
                        <ListItemText
                          primary={property.name}
                          secondary={`${property.address}, ${property.city}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        );

      default:
        return 'Étape inconnue';
    }
  };

  if (!user?.id) {
    return (
      <Container maxWidth="lg">
        <PageHeader
          title={t('portfolios.forms.clientPropertyAssociation')}
          subtitle={t('portfolios.forms.clientPropertyAssociationSubtitle')}
          backPath="/portfolios"
          showBackButton={true}
        />
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <Box textAlign="center">
            <CircularProgress size={60} />
            <Typography variant="h6" sx={{ mt: 2 }}>
              Chargement de votre profil...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Veuillez patienter pendant que nous récupérons vos informations.
            </Typography>
          </Box>
        </Box>
      </Container>
    );
  }

  if (loading && activeStep === 0) {
    return (
      <Container maxWidth="lg">
        <PageHeader
          title={t('portfolios.forms.clientPropertyAssociation')}
          subtitle={t('portfolios.forms.clientPropertyAssociationSubtitle')}
          backPath="/portfolios"
          showBackButton={true}
        />
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <Box textAlign="center">
            <CircularProgress size={60} />
            <Typography variant="h6" sx={{ mt: 2 }}>
              Chargement des données...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Récupération des portefeuilles, clients et propriétés.
            </Typography>
          </Box>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <PageHeader
        title={t('portfolios.forms.clientPropertyAssociation')}
        subtitle={t('portfolios.forms.clientPropertyAssociationSubtitle')}
        backPath="/portfolios"
        showBackButton={true}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ mb: 4 }}>
          {getStepContent(activeStep)}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            startIcon={<ArrowBack />}
          >
            {t('portfolios.forms.back')}
          </Button>
          
          {activeStep === steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={loading || !selectedManager || selectedClients.length === 0 || selectedProperties.length === 0}
              startIcon={loading ? <CircularProgress size={20} /> : <CheckCircle />}
            >
              {loading ? t('portfolios.forms.assigning') : t('portfolios.forms.confirmAssignments')}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={
                (activeStep === 0 && !selectedManager) ||
                (activeStep === 1 && selectedClients.length === 0) ||
                (activeStep === 2 && selectedProperties.length === 0)
              }
              endIcon={<ArrowForward />}
            >
              {t('portfolios.forms.next')}
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default ClientPropertyAssignmentForm;
