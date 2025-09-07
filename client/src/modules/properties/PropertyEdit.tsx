import React, { useState, useEffect } from 'react';
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
  Home,
  LocationOn,
  Euro,
  Bed,
  Bathroom,
  SquareFoot,
  Close,
  Save,
  Cancel,
  ArrowBack,
  Person,
  Add,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';
import { PropertyStatus, PROPERTY_STATUS_OPTIONS } from '../../types/statusEnums';
import PageHeader from '../../components/PageHeader';

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

const PropertyEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasPermissionAsync, isAdmin, isManager, isHost } = useAuth();
  
  // TOUS les useState DOIVENT être déclarés AVANT tout useEffect
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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
  const [canEdit, setCanEdit] = useState(false);
  const [formData, setFormData] = useState<PropertyFormData>({
    name: '',
    address: '',
    city: '',
    postalCode: '',
    country: '',
    type: 'apartment',
    status: 'active',
    bedroomCount: 1,
    bathroomCount: 1,
    squareMeters: 0,
    nightlyPrice: 0,
    description: '',
    maxGuests: 2,
    cleaningFrequency: 'after_each_stay',
    ownerId: 0,
  });

  // Vérifier les permissions au chargement
  useEffect(() => {
    const checkPermissions = async () => {
      const canEditPermission = await hasPermissionAsync('properties:edit');
      setCanEdit(canEditPermission);
    };
    
    checkPermissions();
  }, [hasPermissionAsync]);

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
          const property = await response.json();
          console.log('🔍 PropertyEdit - Propriété chargée:', property);
          
          setFormData({
            name: property.name || '',
            address: property.address || '',
            city: property.city || '',
            postalCode: property.postalCode || '',
            country: property.country || '',
            type: property.type?.toLowerCase() || 'apartment',
            status: property.status?.toLowerCase() || 'active',
            bedroomCount: property.bedroomCount || 1,
            bathroomCount: property.bathroomCount || 1,
            squareMeters: property.squareMeters || 0,
            nightlyPrice: property.nightlyPrice || 0,
            description: property.description || '',
            maxGuests: property.maxGuests || 2,
            cleaningFrequency: property.cleaningFrequency?.toLowerCase() || 'after_each_stay',
            ownerId: property.ownerId || 0,
          });
        } else {
          setError('Erreur lors du chargement de la propriété');
        }
      } catch (err) {
        console.error('🔍 PropertyEdit - Erreur chargement propriété:', err);
        setError('Erreur lors du chargement de la propriété');
      } finally {
        setLoading(false);
      }
    };

    loadProperty();
  }, [id]);

  // Charger la liste des utilisateurs
  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/users`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUsers(data.content || data);
          
          // Si c'est un HOST, définir automatiquement son ID comme owner
          if (isHost() && user?.id) {
            const hostUser = data.content?.find((u: User) => u.id.toString() === user.id);
            if (hostUser) {
              setFormData(prev => ({ ...prev, ownerId: hostUser.id }));
            }
          }
        }
      } catch (err) {
        console.error('🔍 PropertyEdit - Erreur chargement utilisateurs:', err);
      } finally {
        setLoadingUsers(false);
      }
    };

    loadUsers();
  }, [isHost, user?.id]);

  // Vérifier les permissions APRÈS tous les hooks
  if (!canEdit) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Vous n'avez pas les permissions nécessaires pour modifier les propriétés.
        </Alert>
      </Box>
    );
  }

  const handleInputChange = (field: keyof PropertyFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.address || !formData.city || !formData.postalCode || !formData.country) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (!formData.ownerId || formData.ownerId === 0) {
      setError('Veuillez sélectionner un propriétaire');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Construire les données pour le backend
      const backendData = {
        name: formData.name,
        address: formData.address,
        city: formData.city,
        postalCode: formData.postalCode,
        country: formData.country,
        type: formData.type.toUpperCase(),
        status: formData.status.toUpperCase(),
        bedroomCount: formData.bedroomCount,
        bathroomCount: formData.bathroomCount,
        squareMeters: formData.squareMeters,
        nightlyPrice: formData.nightlyPrice,
        description: formData.description,
        maxGuests: formData.maxGuests,
        cleaningFrequency: formData.cleaningFrequency.toUpperCase(),
        ownerId: formData.ownerId,
      };

      console.log('🔍 PropertyEdit - Données envoyées au backend:', backendData);

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/properties/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
        body: JSON.stringify(backendData),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          navigate(`/properties/${id}`);
        }, 1500);
      } else {
        const errorData = await response.json();
        console.error('🔍 PropertyEdit - Erreur mise à jour:', errorData);
        setError('Erreur lors de la mise à jour: ' + (errorData.message || 'Erreur inconnue'));
      }
    } catch (err) {
      console.error('🔍 PropertyEdit - Erreur mise à jour:', err);
      setError('Erreur lors de la mise à jour de la propriété');
    } finally {
      setSaving(false);
    }
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
        console.error('🔍 PropertyEdit - Erreur création owner:', errorData);
        setError('Erreur lors de la création de l\'owner: ' + (errorData.message || 'Erreur inconnue'));
      }
    } catch (err) {
      console.error('🔍 PropertyEdit - Erreur création owner:', err);
      setError('Erreur lors de la création de l\'owner');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Constantes pour les enums
  const propertyTypes = [
    { value: 'apartment', label: 'Appartement' },
    { value: 'house', label: 'Maison' },
    { value: 'villa', label: 'Villa' },
    { value: 'studio', label: 'Studio' },
    { value: 'loft', label: 'Loft' },
  ];

  // Utilisation des enums partagés pour les statuts des propriétés
  const propertyStatuses = PROPERTY_STATUS_OPTIONS.map(option => ({
    value: option.value.toLowerCase(),
    label: option.label
  }));

  const cleaningFrequencies = [
    { value: 'after_each_stay', label: 'Après chaque séjour' },
    { value: 'daily', label: 'Quotidien' },
    { value: 'weekly', label: 'Hebdomadaire' },
    { value: 'biweekly', label: 'Bi-hebdomadaire' },
    { value: 'monthly', label: 'Mensuel' },
    { value: 'on_demand', label: 'Sur demande' },
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header avec bouton retour */}
      <PageHeader
        title="Modifier la propriété"
        subtitle="Modifiez les détails de votre propriété"
        backPath={`/properties/${id}`}
        backLabel="Retour aux détails"
        showBackButton={true}
        actions={
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => navigate(`/properties/${id}`)}
              startIcon={<Cancel />}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={saving ? <CircularProgress size={20} /> : <Save />}
              disabled={saving}
              onClick={handleSubmit}
            >
              {saving ? 'Mise à jour...' : 'Mettre à jour'}
            </Button>
          </Box>
        }
      />

      {/* Messages d'erreur/succès */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Propriété mise à jour avec succès ! Redirection en cours...
        </Alert>
      )}

      {/* Formulaire */}
      <Card>
        <CardContent sx={{ p: 4 }}>
          <form onSubmit={handleSubmit}>
            {/* Informations de base */}
            <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
              Informations de base
            </Typography>

            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  label="Nom de la propriété *"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                  placeholder="Ex: Appartement Montmartre"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth required>
                  <InputLabel>Type de propriété *</InputLabel>
                  <Select
                    value={formData.type}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                    label="Type de propriété *"
                  >
                    {propertyTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Adresse */}
            <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
              Adresse
            </Typography>

            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Adresse complète *"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  required
                  placeholder="Ex: 15 rue de la Paix"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Ville"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  required
                  placeholder="Ex: Paris"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Code postal"
                  value={formData.postalCode}
                  onChange={(e) => handleInputChange('postalCode', e.target.value)}
                  required
                  placeholder="Ex: 75001"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Pays"
                  value={formData.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  required
                />
              </Grid>
            </Grid>

            {/* Caractéristiques */}
            <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
              Caractéristiques
            </Typography>

            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  type="number"
                  label="Chambres"
                  value={formData.bedroomCount}
                  onChange={(e) => handleInputChange('bedroomCount', parseInt(e.target.value))}
                  required
                  InputProps={{
                    startAdornment: <Bed sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  type="number"
                  label="Salles de bain"
                  value={formData.bathroomCount}
                  onChange={(e) => handleInputChange('bathroomCount', parseInt(e.target.value))}
                  required
                  InputProps={{
                    startAdornment: <Bathroom sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  type="number"
                  label="Surface (m²)"
                  value={formData.squareMeters}
                  onChange={(e) => handleInputChange('squareMeters', parseFloat(e.target.value))}
                  required
                  InputProps={{
                    startAdornment: <SquareFoot sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  type="number"
                  label="Prix de la nuit (€)"
                  value={formData.nightlyPrice}
                  onChange={(e) => handleInputChange('nightlyPrice', parseFloat(e.target.value))}
                  InputProps={{
                    startAdornment: <Euro sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                  placeholder="0.00"
                  inputProps={{
                    step: "0.01",
                    min: "0"
                  }}
                />
              </Grid>
            </Grid>

            {/* Configuration */}
            <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
              Configuration
            </Typography>

            {/* Champ Owner - comportement différent selon le rôle */}
            <Grid item xs={12} sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Propriétaire *
              </Typography>
              
              {isHost() ? (
                // Pour les HOST : affichage en lecture seule
                <Box sx={{ 
                  p: 2, 
                  border: 1, 
                  borderColor: 'divider', 
                  borderRadius: 1,
                  bgcolor: 'background.paper'
                }}>
                  <Typography variant="body1">
                    {users.find(u => u.id === formData.ownerId)?.firstName} {users.find(u => u.id === formData.ownerId)?.lastName}
                  </Typography>
                </Box>
              ) : (
                // Pour les ADMIN/MANAGER : sélection + création
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  <Autocomplete
                    options={users}
                    getOptionLabel={(option) => `${option.firstName} ${option.lastName} (${option.email})`}
                    value={users.find(u => u.id === formData.ownerId) || null}
                    onChange={(_, newValue) => {
                      if (newValue) {
                        handleInputChange('ownerId', newValue.id);
                      }
                    }}
                    loading={loadingUsers}
                    sx={{ flexGrow: 1 }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Sélectionner un propriétaire"
                        placeholder="Rechercher un propriétaire..."
                      />
                    )}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<Add />}
                    onClick={() => setShowOwnerDialog(true)}
                    sx={{ minWidth: 'auto', px: 2 }}
                  >
                    Nouveau
                  </Button>
                </Box>
              )}
            </Grid>

            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth required>
                  <InputLabel>Statut *</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    label="Statut *"
                  >
                    {propertyStatuses.map((status) => (
                      <MenuItem key={status.value} value={status.value}>
                        {status.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth required>
                  <InputLabel>Fréquence de nettoyage *</InputLabel>
                  <Select
                    value={formData.cleaningFrequency}
                    onChange={(e) => handleInputChange('cleaningFrequency', e.target.value)}
                    label="Fréquence de nettoyage *"
                  >
                    {cleaningFrequencies.map((freq) => (
                      <MenuItem key={freq.value} value={freq.value}>
                        {freq.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Nombre max de voyageurs *"
                  value={formData.maxGuests}
                  onChange={(e) => handleInputChange('maxGuests', parseInt(e.target.value))}
                  required
                  InputProps={{
                    startAdornment: <Person sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                />
              </Grid>
            </Grid>

            {/* Description */}
            <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
              Description
            </Typography>

            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Description de la propriété"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Décrivez votre propriété..."
                />
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>

      {/* Dialog pour créer un owner temporaire */}
      <Dialog open={showOwnerDialog} onClose={() => setShowOwnerDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Person />
            Nouveau propriétaire temporaire
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Prénom *"
                value={temporaryOwner.firstName}
                onChange={(e) => setTemporaryOwner(prev => ({ ...prev, firstName: e.target.value }))}
                required
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nom *"
                value={temporaryOwner.lastName}
                onChange={(e) => setTemporaryOwner(prev => ({ ...prev, lastName: e.target.value }))}
                required
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email *"
                type="email"
                value={temporaryOwner.email}
                onChange={(e) => setTemporaryOwner(prev => ({ ...prev, email: e.target.value }))}
                required
                helperText="Un mot de passe sécurisé sera généré automatiquement (8+ caractères)"
              />
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowOwnerDialog(false)}>
            Annuler
          </Button>
          <Button onClick={handleCreateTemporaryOwner} variant="contained">
            Créer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PropertyEdit;
