import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Chip,
  Divider,
  IconButton,
  Alert,
  CircularProgress,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Home,
  LocationOn,
  Person,
  Add,
  Close as CloseIcon,
  Euro,
  Bed,
  Bathroom,
  SquareFoot
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';
import { PropertyStatus, PROPERTY_STATUS_OPTIONS } from '../../types/statusEnums';
import { useTranslation } from '../../hooks/useTranslation';

// Types pour les propriétés
export interface PropertyFormData {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  type: string;
  status: string;
  bedroomCount: number;
  bathroomCount: number;
  squareMeters: number;
  nightlyPrice: number;
  description: string;
  maxGuests: number;
  cleaningFrequency: string;
  ownerId: number;
}

// Type pour les utilisateurs
interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

// Type pour la création d'owner temporaire
interface TemporaryOwner {
  firstName: string;
  lastName: string;
  email: string;
}

interface PropertyFormProps {
  onClose: () => void;
  onSuccess: () => void;
  setLoading?: (loading: boolean) => void;
  loading?: boolean;
}

const PropertyForm: React.FC<PropertyFormProps> = ({ onClose, onSuccess }) => {
  const { user, hasPermissionAsync, isAdmin, isManager, isHost } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showOwnerDialog, setShowOwnerDialog] = useState(false);
  const [temporaryOwner, setTemporaryOwner] = useState<TemporaryOwner>({
    firstName: '',
    lastName: '',
    email: '',
  });
  
  // IMPORTANT: déclarer tous les hooks avant tout retour conditionnel
  const [formData, setFormData] = useState<PropertyFormData>({
    name: '',
    address: '',
    city: '',
    postalCode: '',
    country: 'France',
    type: 'APARTMENT',
    status: 'ACTIVE',
    bedroomCount: 1,
    bathroomCount: 1,
    squareMeters: 0,
    nightlyPrice: 0,
    description: '',
    maxGuests: 2,
    cleaningFrequency: 'AFTER_EACH_STAY',
    ownerId: 0,
  });

  // Charger la liste des utilisateurs (nécessaire pour assigner le propriétaire)
  const loadUsers = useCallback(async () => {
    // Charger les utilisateurs pour tous les rôles (nécessaire pour l'assignation du propriétaire)
    setLoadingUsers(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const usersList = data.content || data || [];
        console.log('🔍 PropertyForm - Utilisateurs chargés:', usersList);
        setUsers(usersList);
      } else {
        console.error('Erreur lors du chargement des utilisateurs:', response.status);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Charger les utilisateurs au montage
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Définir l'owner par défaut selon le rôle
  useEffect(() => {
    console.log('🔍 PropertyForm - Définition de l\'owner, user:', user, 'users:', users);
    console.log('🔍 PropertyForm - isHost():', isHost(), 'isAdmin():', isAdmin(), 'isManager():', isManager());
    console.log('🔍 PropertyForm - formData actuel:', formData);
    
    if (isHost() && user?.email) {
      // Pour un HOST, essayer de trouver son ID dans la base
      const hostUser = users.find(u => u.email === user.email);
      console.log('🔍 PropertyForm - HOST trouvé dans users:', hostUser);
      if (hostUser) {
        setFormData(prev => ({ ...prev, ownerId: hostUser.id }));
        console.log('🔍 PropertyForm - ownerId défini pour HOST:', hostUser.id);
      } else {
        console.warn('🔍 PropertyForm - HOST non trouvé dans users, email:', user.email);
        console.warn('🔍 PropertyForm - Liste des utilisateurs disponibles:', users.map(u => ({ id: u.id, email: u.email, name: `${u.firstName} ${u.lastName}` })));
      }
    } else if (!isAdmin() && !isManager() && user?.email) {
      // Pour les autres rôles non-admin, sélectionner automatiquement l'utilisateur connecté
      const currentUser = users.find(u => u.email === user.email);
      console.log('🔍 PropertyForm - Utilisateur courant trouvé:', currentUser);
      if (currentUser) {
        setFormData(prev => ({ ...prev, ownerId: currentUser.id }));
        console.log('🔍 PropertyForm - ownerId défini pour utilisateur courant:', currentUser.id);
      }
    }
  }, [users, user, isHost, isAdmin, isManager]);

  // Vérifier les permissions au chargement
  const [canCreate, setCanCreate] = useState(false);
  
  useEffect(() => {
    const checkPermissions = async () => {
      const createPermission = await hasPermissionAsync('properties:create');
      setCanCreate(createPermission);
    };
    
    checkPermissions();
  }, [hasPermissionAsync]);

  // Si l'utilisateur n'a pas les permissions, ne rien afficher
  if (!canCreate) {
    return null;
  }

  // Types de propriétés disponibles (correspondant au backend)
  const propertyTypes = [
    { value: 'APARTMENT', label: t('properties.types.apartment') },
    { value: 'HOUSE', label: t('properties.types.house') },
    { value: 'VILLA', label: t('properties.types.villa') },
    { value: 'STUDIO', label: t('properties.types.studio') },
    { value: 'LOFT', label: t('properties.types.loft') },
    { value: 'GUEST_ROOM', label: t('properties.types.guestRoom') },
    { value: 'COTTAGE', label: t('properties.types.cottage') },
    { value: 'CHALET', label: t('properties.types.chalet') },
    { value: 'BOAT', label: t('properties.types.boat') },
    { value: 'OTHER', label: t('properties.types.other') },
  ];

  // Utilisation des enums partagés pour les statuts des propriétés
  const propertyStatuses = PROPERTY_STATUS_OPTIONS.map(option => ({
    value: option.value,
    label: option.label
  }));

  // Fréquences de nettoyage (correspondant au backend)
  const cleaningFrequencies = [
    { value: 'AFTER_EACH_STAY', label: t('properties.cleaningFrequencies.afterEachStay') },
    { value: 'WEEKLY', label: t('properties.cleaningFrequencies.weekly') },
    { value: 'BIWEEKLY', label: t('properties.cleaningFrequencies.biweekly') },
    { value: 'MONTHLY', label: t('properties.cleaningFrequencies.monthly') },
    { value: 'ON_DEMAND', label: t('properties.cleaningFrequencies.onDemand') },
  ];

  // Gestion des changements de formulaire
  const handleInputChange = (field: keyof PropertyFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Gestion de la création d'owner temporaire
  const handleCreateTemporaryOwner = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
        body: JSON.stringify({
          firstName: temporaryOwner.firstName,
          lastName: temporaryOwner.lastName,
          email: temporaryOwner.email,
          password: 'TempPass123!', // Mot de passe temporaire respectant les contraintes
          role: 'HOST',
        }),
      });

      if (response.ok) {
        const newUser = await response.json();
        setFormData(prev => ({ ...prev, ownerId: newUser.id }));
        setUsers(prev => [...prev, newUser]);
        setShowOwnerDialog(false);
        setTemporaryOwner({ firstName: '', lastName: '', email: '' });
      } else {
        const errorData = await response.json();
        console.error('🔍 PropertyForm - Erreur création owner:', errorData);
        setError('Erreur lors de la création de l\'owner: ' + (errorData.message || 'Erreur inconnue'));
      }
    } catch (err) {
      console.error('🔍 PropertyForm - Erreur création owner:', err);
      setError('Erreur lors de la création de l\'owner');
    }
  };

  // Soumission du formulaire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    console.log('🔍 PropertyForm - Tentative de soumission, formData:', formData);
    console.log('🔍 PropertyForm - ownerId actuel:', formData.ownerId);

    // Validation de l'owner
    if (!formData.ownerId || formData.ownerId === 0) {
      console.error('🔍 PropertyForm - Erreur: ownerId invalide:', formData.ownerId);
      setError(t('properties.selectOwner'));
      setLoading(false);
      return;
    }

    try {
      // Préparer les données pour le backend
      const backendData = {
        name: formData.name,
        address: formData.address,
        city: formData.city,
        postalCode: formData.postalCode,
        country: formData.country,
        type: formData.type,
        status: formData.status,
        bedroomCount: formData.bedroomCount,
        bathroomCount: formData.bathroomCount,
        squareMeters: formData.squareMeters,
        nightlyPrice: formData.nightlyPrice,
        description: formData.description,
        maxGuests: formData.maxGuests,
        cleaningFrequency: formData.cleaningFrequency,
        ownerId: formData.ownerId,
      };

      console.log('🔍 PropertyForm - Données envoyées au backend:', backendData);

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/properties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
        body: JSON.stringify(backendData),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        const errorData = await response.json();
        console.error('🔍 PropertyForm - Erreur backend:', errorData);
        setError(errorData.message || 'Erreur lors de la création de la propriété');
      }
    } catch (err) {
      console.error('🔍 PropertyForm - Erreur de connexion:', err);
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Alert severity="success" sx={{ mt: 2 }}>
        {t('properties.create')} {t('common.success')} ! {t('common.loading')}
      </Alert>
    );
  }

  return (
    <Box>
      <Card>
        <CardContent sx={{ p: 2 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            {/* Informations de base */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
                {t('properties.tabs.overview')}
              </Typography>
            </Grid>

            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label={t('properties.propertyName')}
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
                placeholder={t('properties.propertyNamePlaceholder')}
                size="small"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth required>
                <InputLabel>{t('properties.propertyType')}</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  label={t('properties.propertyType')}
                  size="small"
                >
                  {propertyTypes.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Adresse */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <LocationOn sx={{ fontSize: 18 }} />
                {t('properties.address')}
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('properties.fullAddress')}
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                required
                placeholder={t('properties.fullAddressPlaceholder')}
                size="small"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label={t('properties.city')}
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                required
                placeholder={t('properties.cityPlaceholder')}
                size="small"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label={t('properties.postalCode')}
                value={formData.postalCode}
                onChange={(e) => handleInputChange('postalCode', e.target.value)}
                required
                placeholder={t('properties.postalCodePlaceholder')}
                size="small"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label={t('properties.country')}
                value={formData.country}
                onChange={(e) => handleInputChange('country', e.target.value)}
                required
                size="small"
              />
            </Grid>

            {/* Caractéristiques */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
                {t('properties.characteristics')}
              </Typography>
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                type="number"
                label={t('properties.bedroomCount')}
                value={formData.bedroomCount}
                onChange={(e) => handleInputChange('bedroomCount', parseInt(e.target.value))}
                required
                size="small"
                InputProps={{
                  startAdornment: <Bed sx={{ mr: 0.75, color: 'text.secondary', fontSize: 18 }} />,
                }}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                type="number"
                label={t('properties.bathroomCount')}
                value={formData.bathroomCount}
                onChange={(e) => handleInputChange('bathroomCount', parseInt(e.target.value))}
                required
                size="small"
                InputProps={{
                  startAdornment: <Bathroom sx={{ mr: 0.75, color: 'text.secondary', fontSize: 18 }} />,
                }}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                type="number"
                label={t('properties.surface')}
                value={formData.squareMeters}
                onChange={(e) => handleInputChange('squareMeters', parseFloat(e.target.value))}
                required
                size="small"
                InputProps={{
                  startAdornment: <SquareFoot sx={{ mr: 0.75, color: 'text.secondary', fontSize: 18 }} />,
                }}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                type="number"
                label={t('properties.nightlyPriceField')}
                value={formData.nightlyPrice}
                onChange={(e) => handleInputChange('nightlyPrice', parseFloat(e.target.value))}
                size="small"
                InputProps={{
                  startAdornment: <Euro sx={{ mr: 0.75, color: 'text.secondary', fontSize: 18 }} />,
                }}
                placeholder={t('properties.nightlyPricePlaceholder')}
                inputProps={{
                  step: "0.01",
                  min: "0"
                }}
              />
            </Grid>

            {/* Configuration */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
                {t('properties.configuration')}
              </Typography>
            </Grid>

            {/* Champ Owner - comportement différent selon le rôle */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>{t('properties.owner')} *</InputLabel>
                <Select
                  value={formData.ownerId}
                  onChange={(e) => handleInputChange('ownerId', e.target.value)}
                  label={`${t('properties.owner')} *`}
                  disabled={!isAdmin() && !isManager()} // Seuls les admin/manager peuvent changer le propriétaire
                  size="small"
                >
                  {users.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Person sx={{ fontSize: 16 }} />
                        <Typography variant="body2">{user.firstName} {user.lastName} ({user.role}) - {user.email}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>{t('properties.status')}</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  label={t('properties.status')}
                  size="small"
                >
                  {propertyStatuses.map(status => (
                    <MenuItem key={status.value} value={status.value}>
                      {status.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>{t('properties.cleaningFrequency')}</InputLabel>
                <Select
                  value={formData.cleaningFrequency}
                  onChange={(e) => handleInputChange('cleaningFrequency', e.target.value)}
                  label={t('properties.cleaningFrequency')}
                  size="small"
                >
                  {cleaningFrequencies.map(freq => (
                    <MenuItem key={freq.value} value={freq.value}>
                      {freq.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label={t('properties.maxGuests')}
                value={formData.maxGuests}
                onChange={(e) => handleInputChange('maxGuests', parseInt(e.target.value))}
                required
                size="small"
              />
            </Grid>

            {/* Description */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'primary.main' }}>
                {t('properties.description')}
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('properties.description')}
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder={t('properties.descriptionPlaceholder')}
                size="small"
              />
            </Grid>

            {/* Messages d'erreur et de succès */}
            {error && (
              <Grid item xs={12}>
                <Alert severity="error">{error}</Alert>
              </Grid>
            )}
            
            {/* Bouton de soumission caché pour le PageHeader */}
            <Button
              type="submit"
              sx={{ display: 'none' }}
              data-submit-property
            >
              Soumettre
            </Button>
          </Grid>
        </form>
        </CardContent>
      </Card>

      {/* Dialog pour créer un nouvel owner temporaire */}
    <Dialog open={showOwnerDialog} onClose={() => setShowOwnerDialog(false)} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Person color="primary" sx={{ fontSize: 18 }} />
          {t('properties.newOwnerDialog')}
        </Typography>
      </DialogTitle>
      
      <DialogContent sx={{ pt: 1.5 }}>
        <Grid container spacing={1.5}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label={`${t('properties.firstName')} *`}
              value={temporaryOwner.firstName}
              onChange={(e) => setTemporaryOwner(prev => ({ ...prev, firstName: e.target.value }))}
              required
              size="small"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label={`${t('properties.lastName')} *`}
              value={temporaryOwner.lastName}
              onChange={(e) => setTemporaryOwner(prev => ({ ...prev, lastName: e.target.value }))}
              required
              size="small"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label={`${t('properties.email')} *`}
              type="email"
              value={temporaryOwner.email}
              onChange={(e) => setTemporaryOwner(prev => ({ ...prev, email: e.target.value }))}
              required
              size="small"
              helperText={t('properties.passwordHelper')}
            />
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions sx={{ px: 2, pb: 1.5 }}>
        <Button onClick={() => setShowOwnerDialog(false)} size="small">
          {t('common.cancel')}
        </Button>
        <Button 
          onClick={handleCreateTemporaryOwner}
          variant="contained"
          disabled={!temporaryOwner.firstName || !temporaryOwner.lastName || !temporaryOwner.email}
          size="small"
        >
          {t('common.create')}
        </Button>
      </DialogActions>
    </Dialog>
    </Box>
  );
};

export default PropertyForm;
