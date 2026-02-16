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
import { propertiesApi, interventionsApi } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { formatDate } from '../../utils/formatUtils';
import { getPropertyStatusColor, getCleaningFrequencyLabel } from '../../utils/statusUtils';
import { extractApiList } from '../../types';

const styles = {
  loadingBox: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '50vh',
  },
  sectionTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 0.75,
    mb: 1,
  },
  infoColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1.25,
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 0.75,
  },
  statusChip: {
    height: 22,
    fontSize: '0.7rem',
    mt: 0.5,
  },
  interventionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    mb: 0.75,
  },
  interventionDescription: {
    fontSize: '0.75rem',
    display: 'block',
    mb: 0.5,
  },
} as const;

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
        <Box sx={{ pt: 0 }}>
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
  const { t } = useTranslation();
  
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
        const propertyData = await propertiesApi.getById(Number(id));
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
      } catch (err) {
        setError(t('properties.loadError'));
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
        const data = await interventionsApi.getAll({ propertyId: Number(id) });
        setInterventions(extractApiList(data));
      } catch (err) {
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


  if (loading) {
    return (
      <Box sx={styles.loadingBox}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ py: 1 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!property) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning" sx={{ py: 1 }}>
          {t('properties.notFound')}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={property.name}
        subtitle={t('properties.details')}
        backPath="/properties"
        actions={
          canEdit && (
            <Button
              variant="contained"
              startIcon={<Edit />}
              onClick={() => navigate(`/properties/${id}/edit`)}
              size="small"
            >
              {t('properties.modify')}
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
              aria-label={t('properties.details')}
              sx={{ px: 2 }}
            >
              <Tab 
                label={t('properties.tabs.overview')} 
                icon={<Info sx={{ fontSize: 18 }} />} 
                iconPosition="start"
                {...a11yProps(0)}
                sx={{ fontSize: '0.85rem', minHeight: 48 }}
              />
              <Tab 
                label={t('properties.tabs.interventions')} 
                icon={<List sx={{ fontSize: 18 }} />} 
                iconPosition="start"
                {...a11yProps(1)}
                sx={{ fontSize: '0.85rem', minHeight: 48 }}
              />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <Box sx={{ p: 2 }}>
              <Grid container spacing={2}>
                {/* Informations générales */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 1.5 }}>
                      <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={styles.sectionTitleRow}>
                        <Box sx={{ fontSize: 18 }}>{getPropertyTypeIcon(property.propertyType)}</Box>
                        {t('properties.informationsGeneral')}
                      </Typography>
                      
                      <Box sx={styles.infoColumn}>
                        <Box sx={styles.infoRow}>
                          <LocationOn color="action" sx={{ fontSize: 18 }} />
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{t('properties.address')}</Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                              {property.address}, {property.city} {property.postalCode}
                            </Typography>
                          </Box>
                        </Box>

                        <Box sx={styles.infoRow}>
                          <Euro color="action" sx={{ fontSize: 18 }} />
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{t('properties.nightlyPrice')}</Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{property.nightlyPrice}€</Typography>
                          </Box>
                        </Box>

                        <Box sx={styles.infoRow}>
                          <Bed color="action" sx={{ fontSize: 18 }} />
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{t('properties.bedrooms')}</Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{property.bedrooms}</Typography>
                          </Box>
                        </Box>

                        <Box sx={styles.infoRow}>
                          <Bathroom color="action" sx={{ fontSize: 18 }} />
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{t('properties.bathroomCount')}</Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{property.bathrooms}</Typography>
                          </Box>
                        </Box>

                        <Box sx={styles.infoRow}>
                          <SquareFoot color="action" sx={{ fontSize: 18 }} />
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{t('properties.surface')}</Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{property.surfaceArea} {t('properties.squareMeters')}</Typography>
                          </Box>
                        </Box>

                        <Box sx={styles.infoRow}>
                          <Person color="action" sx={{ fontSize: 18 }} />
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{t('properties.maxCapacity')}</Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{property.maxGuests} {t('properties.people')}</Typography>
                          </Box>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Statut et nettoyage */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 1.5 }}>
                      <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={styles.sectionTitleRow}>
                        <CleaningServices sx={{ fontSize: 18 }} />
                        {t('properties.statusAndMaintenance')}
                      </Typography>
                      
                      <Box sx={styles.infoColumn}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{t('properties.status')}</Typography>
                          <Chip 
                            label={property.status} 
                            color={getPropertyStatusColor(property.status)}
                            size="small"
                            sx={styles.statusChip}
                          />
                        </Box>

                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{t('properties.cleaningFrequency')}</Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.85rem', mt: 0.5 }}>
                            {getCleaningFrequencyLabel(property.cleaningFrequency, t)}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Description */}
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 1.5 }}>
                      <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1 }}>
                        {t('properties.description')}
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        {property.description || t('properties.noDescription')}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5 }}>
                {t('properties.tabs.interventions')}
              </Typography>
              
              {interventions.length > 0 ? (
                <Grid container spacing={1.5}>
                  {interventions.map((intervention) => (
                    <Grid item xs={12} md={6} key={intervention.id}>
                      <Card variant="outlined">
                        <CardContent sx={{ p: 1.5 }}>
                          <Box sx={styles.interventionHeader}>
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                              {intervention.type}
                            </Typography>
                            <Chip 
                              label={intervention.status} 
                              color={intervention.status === 'completed' ? 'success' : 'warning'}
                              size="small"
                              sx={{ height: 22, fontSize: '0.7rem' }}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary" gutterBottom sx={styles.interventionDescription}>
                            {intervention.description}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                            {t('properties.scheduledDate')}: {formatDate(intervention.scheduledDate)}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Alert severity="info" sx={{ py: 1 }}>
                  {t('properties.noInterventions')}
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