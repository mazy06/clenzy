import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Edit,
  Home,
  LocationOn,
  Euro,
  Bed,
  Bathroom,
  SquareFoot,
  Person,
  CleaningServices,
  Build,
  Info,
  List,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';
import PageHeader from '../../components/PageHeader';

// Interface pour les propriétés détaillées
export interface PropertyDetailsData {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  propertyType: string;
  status: string;
  nightlyPrice: number;
  bedrooms: number;
  bathrooms: number;
  surfaceArea: number;
  description: string;
  amenities: string[];
  cleaningFrequency: string;
  maxGuests: number;
  contactPhone: string;
  contactEmail: string;
  rating?: number;
  lastCleaning?: string;
  nextCleaning?: string;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Interface pour les interventions
interface Intervention {
  id: string;
  type: string;
  status: string;
  scheduledDate: string;
  description: string;
  assignedTo?: string;
  cost?: number;
}

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
      id={`property-tabpanel-${index}`}
      aria-labelledby={`property-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `property-tab-${index}`,
    'aria-controls': `property-tabpanel-${index}`,
  };
}

const PropertyDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  
  // TOUS les useState DOIVENT être déclarés AVANT tout useEffect
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [property, setProperty] = useState<PropertyDetailsData | null>(null);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [tabValue, setTabValue] = useState(0);
  const [canEdit, setCanEdit] = useState(false);

  // Charger les données de la propriété
  useEffect(() => {
    const loadProperty = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/properties/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        });

        if (response.ok) {
          const propertyData = await response.json();
          console.log('🔍 PropertyDetails - Propriété chargée:', propertyData);
          
          // Convertir les données du backend vers le format frontend
          const convertedProperty: PropertyDetailsData = {
            id: propertyData.id.toString(),
            name: propertyData.name,
            address: propertyData.address,
            city: propertyData.city,
            postalCode: propertyData.postalCode,
            country: propertyData.country,
            propertyType: propertyData.type?.toLowerCase() || 'apartment',
            status: propertyData.status?.toLowerCase() || 'active',
            nightlyPrice: propertyData.nightlyPrice || 0,
            bedrooms: propertyData.bedroomCount || 1,
            bathrooms: propertyData.bathroomCount || 1,
            surfaceArea: propertyData.squareMeters || 0,
            description: propertyData.description || '',
            amenities: [],
            cleaningFrequency: propertyData.cleaningFrequency?.toLowerCase() || 'after_each_stay',
            maxGuests: propertyData.maxGuests || 2,
            contactPhone: '',
            contactEmail: '',
            rating: 4.5,
            lastCleaning: undefined,
            nextCleaning: undefined,
            ownerId: propertyData.ownerId?.toString(),
            createdAt: propertyData.createdAt,
            updatedAt: propertyData.updatedAt,
          };
          
          setProperty(convertedProperty);
        } else {
          setError('Erreur lors du chargement de la propriété');
        }
      } catch (err) {
        console.error('🔍 PropertyDetails - Erreur chargement propriété:', err);
        setError('Erreur lors du chargement de la propriété');
      } finally {
        setLoading(false);
      }
    };

    loadProperty();
  }, [id]);

  // Charger les interventions de la propriété
  useEffect(() => {
    const loadInterventions = async () => {
      if (!id) return;
      
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/interventions?propertyId=${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const interventionsList = data.content || data || [];
          console.log('🔍 PropertyDetails - Interventions chargées:', interventionsList);
          setInterventions(interventionsList);
        }
      } catch (err) {
        console.error('🔍 PropertyDetails - Erreur chargement interventions:', err);
      }
    };

    loadInterventions();
  }, [id]);

  // Vérifier les permissions pour l'édition
  useEffect(() => {
    const checkPermissions = async () => {
      const canEditPermission = await hasPermissionAsync('properties:edit');
      setCanEdit(canEditPermission);
    };
    
    checkPermissions();
  }, [hasPermissionAsync]);

  // Gestion du changement d'onglet
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Fonctions utilitaires
  const getPropertyTypeIcon = (type: string) => {
    switch (type) {
      case 'apartment':
        return <Home />;
      case 'house':
        return <Home />;
      case 'villa':
        return <Home />;
      case 'studio':
        return <Home />;
      case 'loft':
        return <Home />;
      default:
        return <Home />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'maintenance':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatCleaningFrequency = (freq: string) => {
    switch (freq) {
      case 'daily':
        return 'Quotidien';
      case 'weekly':
        return 'Hebdomadaire';
      case 'biweekly':
        return 'Bi-hebdomadaire';
      case 'monthly':
        return 'Mensuel';
      case 'on_demand':
        return 'Sur demande';
      case 'after_each_stay':
        return 'Après chaque séjour';
      default:
        return freq;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {error}
        </Alert>
      </Box>
    );
  }

  if (!property) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Propriété non trouvée
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={property.name}
        subtitle="Détails de la propriété"
        backPath="/properties"
        actions={
          canEdit && (
            <Button
              variant="contained"
              startIcon={<Edit />}
              onClick={() => navigate(`/properties/${id}/edit`)}
            >
              Modifier
            </Button>
          )
        }
      />

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange} 
              aria-label="Détails de la propriété"
              sx={{ px: 3 }}
            >
              <Tab 
                label="Informations détaillées" 
                icon={<Info />} 
                iconPosition="start"
                {...a11yProps(0)} 
              />
              <Tab 
                label="Interventions" 
                icon={<List />} 
                iconPosition="start"
                {...a11yProps(1)} 
              />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <Box sx={{ p: 3 }}>
              <Grid container spacing={3}>
                {/* Informations générales */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getPropertyTypeIcon(property.propertyType)}
                        Informations générales
                      </Typography>
                      
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LocationOn color="action" />
                          <Box>
                            <Typography variant="body2" color="text.secondary">Adresse</Typography>
                            <Typography variant="body1">
                              {property.address}, {property.city} {property.postalCode}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Euro color="action" />
                          <Box>
                            <Typography variant="body2" color="text.secondary">Prix par nuit</Typography>
                            <Typography variant="body1">{property.nightlyPrice}€</Typography>
                          </Box>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Bed color="action" />
                          <Box>
                            <Typography variant="body2" color="text.secondary">Chambres</Typography>
                            <Typography variant="body1">{property.bedrooms}</Typography>
                          </Box>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Bathroom color="action" />
                          <Box>
                            <Typography variant="body2" color="text.secondary">Salles de bain</Typography>
                            <Typography variant="body1">{property.bathrooms}</Typography>
                          </Box>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <SquareFoot color="action" />
                          <Box>
                            <Typography variant="body2" color="text.secondary">Surface</Typography>
                            <Typography variant="body1">{property.surfaceArea} m²</Typography>
                          </Box>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Person color="action" />
                          <Box>
                            <Typography variant="body2" color="text.secondary">Capacité max</Typography>
                            <Typography variant="body1">{property.maxGuests} personnes</Typography>
                          </Box>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Statut et nettoyage */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CleaningServices />
                        Statut et entretien
                      </Typography>
                      
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Statut</Typography>
                          <Chip 
                            label={property.status} 
                            color={getStatusColor(property.status) as any}
                            size="small"
                          />
                        </Box>

                        <Box>
                          <Typography variant="body2" color="text.secondary">Fréquence de nettoyage</Typography>
                          <Typography variant="body1">
                            {formatCleaningFrequency(property.cleaningFrequency)}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Description */}
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Description
                      </Typography>
                      <Typography variant="body1">
                        {property.description || 'Aucune description disponible'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Interventions
              </Typography>
              
              {interventions.length > 0 ? (
                <Grid container spacing={2}>
                  {interventions.map((intervention) => (
                    <Grid item xs={12} md={6} key={intervention.id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Typography variant="subtitle1">
                              {intervention.type}
                            </Typography>
                            <Chip 
                              label={intervention.status} 
                              color={intervention.status === 'completed' ? 'success' : 'warning'}
                              size="small"
                            />
                          </Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            {intervention.description}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Date prévue: {new Date(intervention.scheduledDate).toLocaleDateString('fr-FR')}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Alert severity="info">
                  Aucune intervention programmée pour cette propriété.
                </Alert>
              )}
            </Box>
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PropertyDetails;