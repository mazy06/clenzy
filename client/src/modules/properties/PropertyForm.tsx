import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
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
import { Person } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usersApi } from '../../services/api';
import { usePropertyForm } from '../../hooks/usePropertyForm';
import type { FormUser } from '../../hooks/usePropertyForm';
import { PROPERTY_STATUS_OPTIONS } from '../../types/statusEnums';
import { useTranslation } from '../../hooks/useTranslation';

import PropertyFormBasicInfo from './PropertyFormBasicInfo';
import PropertyFormAddress from './PropertyFormAddress';
import PropertyFormDetails from './PropertyFormDetails';
import PropertyFormSettings from './PropertyFormSettings';
import CleaningPriceEstimator from './CleaningPriceEstimator';

// ─── Stable sx constants ────────────────────────────────────────────────────

const FORM_PAPER_SX = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1.5,
  boxShadow: 'none',
  p: 2.5,
} as const;

const DIALOG_TITLE_SX = {
  fontSize: '0.8125rem',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: 0.75,
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Main component ─────────────────────────────────────────────────────────

const PropertyForm: React.FC<PropertyFormProps> = ({ onClose, onSuccess, propertyId, mode = 'create' }) => {
  const { user, hasPermissionAsync, isAdmin, isManager, isHost } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEditMode = mode === 'edit' || !!propertyId;

  // ─── React Query hook ─────────────────────────────────────────────────
  const {
    control,
    errors,
    handleSubmit,
    setValue,
    users,
    isLoadingProperty,
    isSubmitting,
    isSuccess,
    submitError,
    submitForm,
  } = usePropertyForm({
    propertyId,
    isEditMode,
    onSuccess: () => {
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    },
    onNavigate: (path) => navigate(path),
  });

  // ─── Owner dialog (kept local) ───────────────────────────────────────
  const [showOwnerDialog, setShowOwnerDialog] = useState(false);
  const [temporaryOwner, setTemporaryOwner] = useState<TemporaryOwner>({
    firstName: '',
    lastName: '',
    email: '',
  });
  const [ownerError, setOwnerError] = useState<string | null>(null);

  // ─── Permissions ──────────────────────────────────────────────────────
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

  // ─── Auto-select owner for non-admin in create mode ───────────────────
  useEffect(() => {
    if (isEditMode || users.length === 0) return;
    if (isHost() && user?.email) {
      const hostUser = users.find(u => u.email === user.email);
      if (hostUser) setValue('ownerId', hostUser.id);
    } else if (!isAdmin() && !isManager() && user?.email) {
      const currentUser = users.find(u => u.email === user.email);
      if (currentUser) setValue('ownerId', currentUser.id);
    }
  }, [users, user, isHost, isAdmin, isManager, setValue, isEditMode]);

  // ─── Temporary owner creation ─────────────────────────────────────────
  const handleCreateTemporaryOwner = async () => {
    try {
      const newUser = await usersApi.create({
        firstName: temporaryOwner.firstName,
        lastName: temporaryOwner.lastName,
        email: temporaryOwner.email,
        password: 'TempPass123!',
        role: 'HOST',
      });
      setValue('ownerId', newUser.id);
      setShowOwnerDialog(false);
      setTemporaryOwner({ firstName: '', lastName: '', email: '' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setOwnerError('Erreur lors de la création: ' + message);
    }
  };

  // ─── Option lists ─────────────────────────────────────────────────────
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

  const propertyStatuses = PROPERTY_STATUS_OPTIONS.map(option => ({
    value: option.value,
    label: option.label,
  }));

  const cleaningFrequencies = [
    { value: 'AFTER_EACH_STAY', label: t('properties.cleaningFrequencies.afterEachStay') },
    { value: 'WEEKLY', label: t('properties.cleaningFrequencies.weekly') },
    { value: 'BIWEEKLY', label: t('properties.cleaningFrequencies.biweekly') },
    { value: 'MONTHLY', label: t('properties.cleaningFrequencies.monthly') },
    { value: 'ON_DEMAND', label: t('properties.cleaningFrequencies.onDemand') },
  ];

  // ─── Guards ───────────────────────────────────────────────────────────

  if (!hasPermission) return null;

  if (isLoadingProperty) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '40vh' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (isSuccess) {
    return (
      <Alert severity="success" sx={{ fontSize: '0.8125rem', py: 0.75 }}>
        {isEditMode ? t('properties.updateSuccess') : `${t('properties.create')} ${t('common.success')} !`}
      </Alert>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ flexShrink: 0 }}>
        <CleaningPriceEstimator control={control} />
      </Box>
      <form
        onSubmit={handleSubmit((data) => submitForm(data))}
        style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
      >
        <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>
          {/* ── Colonne gauche : Infos principales ──────────────────── */}
          <Paper sx={{ ...FORM_PAPER_SX, flex: 7, minWidth: 0, overflow: 'auto' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <PropertyFormBasicInfo control={control} errors={errors} propertyTypes={propertyTypes} />
              <PropertyFormAddress control={control} errors={errors} />
              <PropertyFormDetails control={control} errors={errors} />
            </Box>
          </Paper>

          {/* ── Colonne droite : Configuration & Ménage ─────────────── */}
          <Paper sx={{ ...FORM_PAPER_SX, flex: 5, minWidth: 0, overflow: 'auto' }}>
            <PropertyFormSettings
              control={control}
              errors={errors}
              users={users}
              propertyStatuses={propertyStatuses}
              cleaningFrequencies={cleaningFrequencies}
              isAdmin={isAdmin}
              isManager={isManager}
            />
          </Paper>
        </Box>

        {/* Error message */}
        {submitError && (
          <Alert severity="error" sx={{ fontSize: '0.8125rem', py: 0.5, mt: 1.5, flexShrink: 0 }}>{submitError}</Alert>
        )}

        {/* Hidden submit button for PageHeader trigger */}
        <Button type="submit" sx={{ display: 'none' }} data-submit-property disabled={isSubmitting}>
          Soumettre
        </Button>
      </form>

      {/* ─── Owner creation dialog ─────────────────────────────────────── */}
      <Dialog open={showOwnerDialog} onClose={() => setShowOwnerDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography sx={DIALOG_TITLE_SX}>
            <Person color="primary" sx={{ fontSize: 16 }} />
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
            {ownerError && (
              <Grid item xs={12}>
                <Alert severity="error" sx={{ fontSize: '0.8125rem', py: 0.5 }}>{ownerError}</Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button onClick={() => setShowOwnerDialog(false)} size="small" sx={{ fontSize: '0.75rem' }}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleCreateTemporaryOwner}
            variant="contained"
            disabled={!temporaryOwner.firstName || !temporaryOwner.lastName || !temporaryOwner.email}
            size="small"
            sx={{ fontSize: '0.75rem' }}
          >
            {t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PropertyForm;
