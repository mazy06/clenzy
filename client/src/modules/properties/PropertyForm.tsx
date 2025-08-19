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
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';

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
}

const PropertyForm: React.FC<PropertyFormProps> = ({ onClose, onSuccess }) => {
  const { user, hasPermission, isAdmin, isManager, isHost } = useAuth();
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

  // Charger la liste des utilisateurs (pour ADMIN/MANAGER)
  const loadUsers = useCallback(async () => {
    if (!isAdmin() && !isManager()) return;
    
    setLoadingUsers(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.content || []);
      } else {
        console.error('Erreur lors du chargement des utilisateurs:', response.status);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
    } finally {
      setLoadingUsers(false);
    }
  }, [isAdmin, isManager]);

  // Charger les utilisateurs au montage
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Définir l'owner par défaut selon le rôle
  useEffect(() => {
    if (isHost() && user?.id) {
      // Pour un HOST, essayer de trouver son ID dans la base
      const hostUser = users.find(u => u.email === user.email);
      if (hostUser) {
        setFormData(prev => ({ ...prev, ownerId: hostUser.id }));
      }
    }
  }, [users, user, isHost]);

  // Vérifier les permissions (après déclaration des hooks)
  const canCreate = hasPermission('properties:create');
  if (!canCreate) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Vous n'avez pas les permissions nécessaires pour créer des propriétés.
      </Alert>
    );
  }

  // Types de propriétés disponibles (correspondant au backend)
  const propertyTypes = [
    { value: 'APARTMENT', label: 'Appartement' },
    { value: 'HOUSE', label: 'Maison' },
    { value: 'VILLA', label: 'Villa' },
    { value: 'STUDIO', label: 'Studio' },
    { value: 'LOFT', label: 'Loft' },
    { value: 'GUEST_ROOM', label: 'Chambre d\'hôte' },
    { value: 'COTTAGE', label: 'Gîte rural' },
    { value: 'CHALET', label: 'Chalet' },
    { value: 'BOAT', label: 'Bateau' },
    { value: 'OTHER', label: 'Autre' },
  ];

  // Statuts disponibles (correspondant au backend)
  const propertyStatuses = [
    { value: 'ACTIVE', label: 'Actif' },
    { value: 'INACTIVE', label: 'Inactif' },
    { value: 'UNDER_MAINTENANCE', label: 'En maintenance' },
    { value: 'ARCHIVED', label: 'Archivé' },
  ];

  // Fréquences de nettoyage (correspondant au backend)
  const cleaningFrequencies = [
    { value: 'AFTER_EACH_STAY', label: 'Après chaque séjour' },
    { value: 'WEEKLY', label: 'Hebdomadaire' },
    { value: 'BIWEEKLY', label: 'Bi-hebdomadaire' },
    { value: 'MONTHLY', label: 'Mensuel' },
    { value: 'ON_DEMAND', label: 'Sur demande' },
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

    // Validation de l'owner
    if (!formData.ownerId || formData.ownerId === 0) {
      setError('Veuillez sélectionner un propriétaire.');
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
        Propriété créée avec succès ! Redirection en cours...
      </Alert>
    );
  }

  return (
    <>
    <Card sx={{ mt: 2, width: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        {/* Header avec boutons de retour */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton 
              onClick={onClose} 
              size="small"
              sx={{ 
                display: { xs: 'flex', md: 'none' }, // Visible uniquement sur mobile
                color: 'text.secondary'
              }}
            >
              <ArrowBack />
            </IconButton>
            <Typography variant="h5" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Home color="primary" />
              Nouvelle Propriété
            </Typography>
          </Box>
          <IconButton 
            onClick={onClose} 
            size="small"
            sx={{ 
              display: { xs: 'none', md: 'flex' }, // Visible uniquement sur desktop
              color: 'text.secondary'
            }}
          >
            <Close />
          </IconButton>
        </Box>

        <form onSubmit={handleSubmit}>
          <Grid container spacing={4}>
            {/* Informations de base */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                Informations de base
              </Typography>
            </Grid>

            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="Nom de la propriété"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
                placeholder="Ex: Appartement T2 Centre-ville"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth required>
                <InputLabel>Type de propriété</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  label="Type de propriété"
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
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                <LocationOn sx={{ mr: 1, verticalAlign: 'middle' }} />
                Adresse
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Adresse complète"
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

            {/* Caractéristiques */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                Caractéristiques
              </Typography>
            </Grid>

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

            {/* Configuration */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                Configuration
              </Typography>
            </Grid>

            {/* Champ Owner - comportement différent selon le rôle */}
            <Grid item xs={12}>
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
                  bgcolor: 'grey.50',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  <Person color="action" />
                  <Typography>
                    {user?.username || 'Vous'} (HOST)
                  </Typography>
                </Box>
              ) : (
                // Pour ADMIN/MANAGER : sélection + création
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <Autocomplete
                    sx={{ flexGrow: 1 }}
                    options={users}
                    getOptionLabel={(option) => `${option.firstName} ${option.lastName} (${option.email})`}
                    value={users.find(u => u.id === formData.ownerId) || null}
                    onChange={(_, newValue) => {
                      if (newValue) {
                        handleInputChange('ownerId', newValue.id);
                      }
                    }}
                    loading={loadingUsers}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Sélectionner un propriétaire"
                        placeholder="Rechercher un propriétaire..."
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {loadingUsers ? <CircularProgress color="inherit" size={20} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
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

            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Statut</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  label="Statut"
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
                <InputLabel>Fréquence de nettoyage</InputLabel>
                <Select
                  value={formData.cleaningFrequency}
                  onChange={(e) => handleInputChange('cleaningFrequency', e.target.value)}
                  label="Fréquence de nettoyage"
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
                label="Nombre max de voyageurs"
                value={formData.maxGuests}
                onChange={(e) => handleInputChange('maxGuests', parseInt(e.target.value))}
                required
              />
            </Grid>

            {/* Description */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                Description
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={4}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Décrivez votre propriété, ses atouts, son environnement..."
              />
            </Grid>

            {/* Messages d'erreur et de succès */}
            {error && (
              <Grid item xs={12}>
                <Alert severity="error">{error}</Alert>
              </Grid>
            )}
          </Grid>
        </form>

        {/* Boutons d'action */}
        <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' } }}>
            <Button
              variant="outlined"
              onClick={onClose}
              disabled={loading}
              startIcon={<Cancel />}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <Save />}
              onClick={handleSubmit}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              {loading ? 'Création...' : 'Créer la propriété'}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>

    {/* Dialog pour créer un nouvel owner temporaire */}
    <Dialog open={showOwnerDialog} onClose={() => setShowOwnerDialog(false)} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Person color="primary" />
          Nouveau propriétaire temporaire
        </Typography>
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
        <Button 
          onClick={handleCreateTemporaryOwner}
          variant="contained"
          disabled={!temporaryOwner.firstName || !temporaryOwner.lastName || !temporaryOwner.email}
        >
          Créer
        </Button>
      </DialogActions>
    </Dialog>
  </>
  );
};

export default PropertyForm;
