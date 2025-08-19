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
  ArrowBack,
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
  description: string;
  scheduledDate: string;
  completedDate?: string;
  assignedTeam?: string;
  priority: string;
}

// Interface pour les onglets
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
  const { hasPermission } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [property, setProperty] = useState<PropertyDetailsData | null>(null);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [tabValue, setTabValue] = useState(0);

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
            amenities: [], // Pas d'amenities dans le backend pour l'instant
            cleaningFrequency: propertyData.cleaningFrequency?.toLowerCase() || 'after_each_stay',
            maxGuests: propertyData.maxGuests || 2,
            contactPhone: '', // Pas de contact phone dans le backend pour l'instant
            contactEmail: '', // Pas de contact email dans le backend pour l'instant
            rating: 4.5, // Valeur par défaut
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
        // Pas d'erreur critique, on peut continuer sans les interventions
      }
    };

    loadInterventions();
  }, [id]);

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

  // Filtrer les interventions par type
  const cleaningInterventions = interventions.filter(i => 
    i.type.toLowerCase().includes('cleaning') || 
    i.type.toLowerCase().includes('nettoyage') ||
    i.type.toLowerCase().includes('ménage')
  );

  const maintenanceInterventions = interventions.filter(i => 
    i.type.toLowerCase().includes('maintenance') || 
    i.type.toLowerCase().includes('entretien') ||
    i.type.toLowerCase().includes('préventif')
  );

  const repairInterventions = interventions.filter(i => 
    i.type.toLowerCase().includes('repair') || 
    i.type.toLowerCase().includes('réparation') ||
    i.type.toLowerCase().includes('dépannage')
  );

  const inspectionInterventions = interventions.filter(i => 
    i.type.toLowerCase().includes('inspection') || 
    i.type.toLowerCase().includes('contrôle') ||
    i.type.toLowerCase().includes('qualité')
  );

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

  // Vérifier les permissions pour l'édition
  const canEdit = hasPermission('properties:edit');

  return (
    <Box sx={{ p: 3 }}>
      {/* Header avec bouton retour et bouton modifier */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton 
            onClick={() => navigate('/properties')} 
            sx={{ mr: 2 }}
            size="large"
          >
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" fontWeight={700}>
            Détails de la propriété
          </Typography>
        </Box>
        
        {canEdit && (
          <Button
            variant="contained"
            startIcon={<Edit />}
            onClick={() => navigate(`/properties/${id}/edit`)}
          >
            Modifier
          </Button>
        )}
      </Box>

      {/* Carte principale avec résumé */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          {/* En-tête de la propriété */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {getPropertyTypeIcon(property.propertyType)}
              <Typography variant="h5" fontWeight={600}>
                {property.name}
              </Typography>
            </Box>
            <Chip
              label={property.status}
              color={getStatusColor(property.status) as any}
              size="medium"
              sx={{ textTransform: 'capitalize' }}
            />
          </Box>

          {/* Adresse */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <LocationOn sx={{ fontSize: 20, color: 'text.secondary' }} />
            <Typography variant="body1" color="text.secondary">
              {property.address}, {property.postalCode} {property.city}, {property.country}
            </Typography>
          </Box>

          {/* Métriques principales */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Bed sx={{ fontSize: 20, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="body2" fontWeight={500}>
                  {property.bedrooms}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Chambres
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Bathroom sx={{ fontSize: 20, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="body2" fontWeight={500}>
                  {property.bathrooms}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  SDB
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <SquareFoot sx={{ fontSize: 20, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="body2" fontWeight={500}>
                  {property.surfaceArea}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  m²
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Person sx={{ fontSize: 20, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="body2" fontWeight={500}>
                  {property.maxGuests}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Voyageurs
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* Prix */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <Euro sx={{ fontSize: 24, color: 'success.main' }} />
            <Typography variant="h4" fontWeight={700} color="success.main">
              {property.nightlyPrice}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              /nuit
            </Typography>
          </Box>

          {/* Fréquence de nettoyage */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CleaningServices sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              Nettoyage : {formatCleaningFrequency(property.cleaningFrequency)}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Système d'onglets */}
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
                label="Interventions de ménage" 
                icon={<CleaningServices />} 
                iconPosition="start"
                {...a11yProps(1)} 
              />
              <Tab 
                label="Maintenance" 
                icon={<Build />} 
                iconPosition="start"
                {...a11yProps(2)} 
              />
              <Tab 
                label="Réparation" 
                icon={<Build />} 
                iconPosition="start"
                {...a11yProps(3)} 
              />
              <Tab 
                label="Inspection" 
                icon={<List />} 
                iconPosition="start"
                {...a11yProps(4)} 
              />
            </Tabs>
          </Box>

          {/* Contenu des onglets */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ p: 4 }}>
              <Grid container spacing={4}>
                {/* Informations de base */}
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
                    Informations de base
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Nom
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {property.name}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Type
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {property.propertyType}
                  </Typography>
                </Grid>

                {/* Adresse complète */}
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
                    Adresse
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Adresse complète
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {property.address}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Ville
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {property.city}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Code postal
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {property.postalCode}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Pays
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {property.country}
                  </Typography>
                </Grid>

                {/* Caractéristiques détaillées */}
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
                    Caractéristiques
                  </Typography>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Chambres
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {property.bedrooms}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Salles de bain
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {property.bathrooms}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Surface
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {property.surfaceArea} m²
                  </Typography>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Prix/nuit
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {property.nightlyPrice} €
                  </Typography>
                </Grid>

                {/* Commodités */}
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
                    Commodités
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  {property.amenities.length > 0 ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {property.amenities.map((amenity, index) => (
                        <Chip
                          key={index}
                          label={amenity}
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Aucune commodité renseignée
                    </Typography>
                  )}
                </Grid>

                {/* Configuration */}
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
                    Configuration
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Statut
                  </Typography>
                  <Chip
                    label={property.status}
                    color={getStatusColor(property.status) as any}
                    sx={{ mb: 2 }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Fréquence de nettoyage
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {formatCleaningFrequency(property.cleaningFrequency)}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Nombre max de voyageurs
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {property.maxGuests}
                  </Typography>
                </Grid>

                {/* Description */}
                {property.description && (
                  <>
                    <Grid item xs={12}>
                      <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
                        Description
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body1">
                        {property.description}
                      </Typography>
                    </Grid>
                  </>
                )}

                {/* Contact */}
                {(property.contactPhone || property.contactEmail) && (
                  <>
                    <Grid item xs={12}>
                      <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
                        Contact
                      </Typography>
                    </Grid>
                    {property.contactPhone && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Téléphone
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 2 }}>
                          {property.contactPhone}
                        </Typography>
                      </Grid>
                    )}
                    {property.contactEmail && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Email
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 2 }}>
                          {property.contactEmail}
                        </Typography>
                      </Grid>
                    )}
                  </>
                )}

                {/* Métadonnées */}
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
                    Informations système
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Créé le
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {property.createdAt ? new Date(property.createdAt).toLocaleDateString('fr-FR') : 'Non renseigné'}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Modifié le
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {property.updatedAt ? new Date(property.updatedAt).toLocaleDateString('fr-FR') : 'Non renseigné'}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          {/* Onglet Interventions de ménage */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
                Interventions de ménage et nettoyage
              </Typography>
              
              {cleaningInterventions.length > 0 ? (
                <Grid container spacing={2}>
                  {cleaningInterventions.map((intervention) => (
                    <Grid item xs={12} key={intervention.id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box>
                              <Typography variant="subtitle1" fontWeight={600}>
                                {intervention.description}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Type: {intervention.type}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Date prévue: {new Date(intervention.scheduledDate).toLocaleDateString('fr-FR')}
                              </Typography>
                            </Box>
                            <Chip 
                              label={intervention.status} 
                              color={intervention.status === 'completed' ? 'success' : 'warning'}
                              size="small"
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Alert severity="info">
                  Aucune intervention de ménage programmée pour cette propriété.
                </Alert>
              )}
            </Box>
          </TabPanel>

          {/* Onglet Maintenance */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
                Interventions de maintenance préventive
              </Typography>
              
              {maintenanceInterventions.length > 0 ? (
                <Grid container spacing={2}>
                  {maintenanceInterventions.map((intervention) => (
                    <Grid item xs={12} key={intervention.id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box>
                              <Typography variant="subtitle1" fontWeight={600}>
                                {intervention.description}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Type: {intervention.type}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Date prévue: {new Date(intervention.scheduledDate).toLocaleDateString('fr-FR')}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Priorité: {intervention.priority}
                              </Typography>
                            </Box>
                            <Chip 
                              label={intervention.status} 
                              color={intervention.status === 'completed' ? 'success' : 'warning'}
                              size="small"
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Alert severity="info">
                  Aucune intervention de maintenance programmée pour cette propriété.
                </Alert>
              )}
            </Box>
          </TabPanel>

          {/* Onglet Réparation */}
          <TabPanel value={tabValue} index={3}>
            <Box sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
                Interventions de réparation et dépannage
              </Typography>
              
              {repairInterventions.length > 0 ? (
                <Grid container spacing={2}>
                  {repairInterventions.map((intervention) => (
                    <Grid item xs={12} key={intervention.id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box>
                              <Typography variant="subtitle1" fontWeight={600}>
                                {intervention.description}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Type: {intervention.type}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Date prévue: {new Date(intervention.scheduledDate).toLocaleDateString('fr-FR')}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Priorité: {intervention.priority}
                              </Typography>
                            </Box>
                            <Chip 
                              label={intervention.status} 
                              color={intervention.status === 'completed' ? 'success' : 'warning'}
                              size="small"
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Alert severity="info">
                  Aucune intervention de réparation programmée pour cette propriété.
                </Alert>
              )}
            </Box>
          </TabPanel>

          {/* Onglet Inspection */}
          <TabPanel value={tabValue} index={4}>
            <Box sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
                Inspections et contrôles de qualité
              </Typography>
              
              {inspectionInterventions.length > 0 ? (
                <Grid container spacing={2}>
                  {inspectionInterventions.map((intervention) => (
                    <Grid item xs={12} key={intervention.id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box>
                              <Typography variant="subtitle1" fontWeight={600}>
                                {intervention.description}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Type: {intervention.type}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Date prévue: {new Date(intervention.scheduledDate).toLocaleDateString('fr-FR')}
                              </Typography>
                            </Box>
                            <Chip 
                              label={intervention.status} 
                              color={intervention.status === 'completed' ? 'success' : 'warning'}
                              size="small"
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Alert severity="info">
                  Aucune inspection programmée pour cette propriété.
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
