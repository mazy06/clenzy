import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Person,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { propertiesApi, usersApi } from '../../services/api';
import { propertySchema } from '../../schemas';
import type { PropertyFormValues } from '../../schemas';
import { PropertyStatus, PROPERTY_STATUS_OPTIONS } from '../../types/statusEnums';
import { useTranslation } from '../../hooks/useTranslation';
import { extractApiList } from '../../types';

import PropertyFormBasicInfo from './PropertyFormBasicInfo';
import PropertyFormAddress from './PropertyFormAddress';
import PropertyFormDetails from './PropertyFormDetails';
import PropertyFormSettings from './PropertyFormSettings';

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
  onClose?: () => void;
  onSuccess?: () => void;
  setLoading?: (loading: boolean) => void;
  loading?: boolean;
  propertyId?: number;
  mode?: 'create' | 'edit';
}

const PropertyForm: React.FC<PropertyFormProps> = ({ onClose, onSuccess, propertyId, mode = 'create' }) => {
  const { user, hasPermissionAsync, isAdmin, isManager, isHost } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEditMode = mode === 'edit' || !!propertyId;
  const [loading, setLoading] = useState(false);
  const [loadingProperty, setLoadingProperty] = useState(isEditMode);
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
  const { control, handleSubmit: rhfHandleSubmit, setValue, reset, formState: { errors } } = useForm<PropertyFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(propertySchema) as any, // zodResolver type mismatch with react-hook-form
    defaultValues: {
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
      defaultCheckInTime: '15:00',
      defaultCheckOutTime: '11:00',
    },
  });

  // Charger la liste des utilisateurs (nécessaire pour assigner le propriétaire)
  const loadUsers = useCallback(async () => {
    // Charger les utilisateurs pour tous les rôles (nécessaire pour l'assignation du propriétaire)
    setLoadingUsers(true);
    try {
      const data = await usersApi.getAll();
      setUsers(extractApiList(data));
    } catch (error) {
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Charger les utilisateurs au montage
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Définir l'owner par défaut selon le rôle (uniquement en mode création)
  useEffect(() => {
    if (isEditMode) return; // En mode édition, l'owner est chargé depuis la propriété
    if (isHost() && user?.email) {
      // Pour un HOST, essayer de trouver son ID dans la base
      const hostUser = users.find(u => u.email === user.email);
      if (hostUser) {
        setValue('ownerId', hostUser.id);
      }
    } else if (!isAdmin() && !isManager() && user?.email) {
      // Pour les autres rôles non-admin, sélectionner automatiquement l'utilisateur connecté
      const currentUser = users.find(u => u.email === user.email);
      if (currentUser) {
        setValue('ownerId', currentUser.id);
      }
    }
  }, [users, user, isHost, isAdmin, isManager, setValue, isEditMode]);

  // Charger les données de la propriété en mode édition
  useEffect(() => {
    if (!isEditMode || !propertyId) return;

    const loadProperty = async () => {
      setLoadingProperty(true);
      try {
        const property = await propertiesApi.getById(propertyId);
        reset({
          name: property.name || '',
          address: property.address || '',
          city: property.city || '',
          postalCode: property.postalCode || '',
          country: property.country || '',
          type: property.type?.toUpperCase() || 'APARTMENT',
          status: property.status?.toUpperCase() || 'ACTIVE',
          bedroomCount: property.bedroomCount || 1,
          bathroomCount: property.bathroomCount || 1,
          squareMeters: property.squareMeters || 0,
          nightlyPrice: property.nightlyPrice || 0,
          description: property.description || '',
          maxGuests: property.maxGuests || 2,
          cleaningFrequency: property.cleaningFrequency?.toUpperCase() || 'AFTER_EACH_STAY',
          ownerId: property.ownerId || 0,
          defaultCheckInTime: property.defaultCheckInTime || '15:00',
          defaultCheckOutTime: property.defaultCheckOutTime || '11:00',
        });
      } catch (err) {
        setError(t('properties.loadError'));
      } finally {
        setLoadingProperty(false);
      }
    };

    loadProperty();
  }, [isEditMode, propertyId, reset, t]);

  // Vérifier les permissions au chargement
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    const checkPermissions = async () => {
      const permission = isEditMode
        ? await hasPermissionAsync('properties:edit')
        : await hasPermissionAsync('properties:create');
      setHasPermission(permission);
    };

    checkPermissions();
  }, [hasPermissionAsync, isEditMode]);

  // Si l'utilisateur n'a pas les permissions, ne rien afficher
  if (!hasPermission) {
    return null;
  }

  // Afficher un loader pendant le chargement de la propriété en mode édition
  if (loadingProperty) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
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

  // Gestion de la création d'owner temporaire
  const handleCreateTemporaryOwner = async () => {
    try {
      const newUser = await usersApi.create({
        firstName: temporaryOwner.firstName,
        lastName: temporaryOwner.lastName,
        email: temporaryOwner.email,
        password: 'TempPass123!', // Mot de passe temporaire respectant les contraintes
        role: 'HOST',
      });
      setValue('ownerId', newUser.id);
      setUsers(prev => [...prev, newUser as User]);
      setShowOwnerDialog(false);
      setTemporaryOwner({ firstName: '', lastName: '', email: '' });
    } catch (err: any) {
      setError('Erreur lors de la création de l\'owner: ' + (err.message || 'Erreur inconnue'));
    }
  };

  // Soumission du formulaire
  const onSubmit = async (formData: PropertyFormValues) => {
    setLoading(true);
    setError(null);

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
        defaultCheckInTime: formData.defaultCheckInTime,
        defaultCheckOutTime: formData.defaultCheckOutTime,
      };

      if (isEditMode && propertyId) {
        await propertiesApi.update(propertyId, backendData);
        setSuccess(true);
        setTimeout(() => {
          navigate(`/properties/${propertyId}`);
        }, 1500);
      } else {
        await propertiesApi.create(backendData);
        setSuccess(true);
        setTimeout(() => {
          if (onSuccess) onSuccess();
          if (onClose) onClose();
        }, 1500);
      }
    } catch (err: any) {
      const errorMsg = isEditMode
        ? 'Erreur lors de la mise à jour: ' + (err.message || 'Erreur inconnue')
        : err.message || 'Erreur lors de la création de la propriété';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Alert severity="success" sx={{ mt: 2 }}>
        {isEditMode ? t('properties.updateSuccess') : `${t('properties.create')} ${t('common.success')} ! ${t('common.loading')}`}
      </Alert>
    );
  }

  return (
    <Box>
      <Card>
        <CardContent sx={{ p: 2 }}>
        <form onSubmit={rhfHandleSubmit(onSubmit)}>
          <Grid container spacing={2}>
            <PropertyFormBasicInfo control={control} errors={errors} propertyTypes={propertyTypes} />
            <PropertyFormAddress control={control} errors={errors} />
            <PropertyFormDetails control={control} errors={errors} />
            <PropertyFormSettings
              control={control}
              errors={errors}
              users={users}
              propertyStatuses={propertyStatuses}
              cleaningFrequencies={cleaningFrequencies}
              isAdmin={isAdmin}
              isManager={isManager}
            />

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
