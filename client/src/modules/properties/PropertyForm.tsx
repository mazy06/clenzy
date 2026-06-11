import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { Property } from '../../services/api';
import { usePropertyForm } from '../../hooks/usePropertyForm';
import type { FormUser } from '../../hooks/usePropertyForm';
import { PROPERTY_STATUS_OPTIONS } from '../../types/statusEnums';
import { useTranslation } from '../../hooks/useTranslation';
import { PROPERTY_TYPES } from '../../utils/statusUtils';

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

// ─── Types ──────────────────────────────────────────────────────────────────

interface PropertyFormProps {
  onClose?: () => void;
  onSuccess?: (created: Property) => void;
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
    onSuccess: (created) => {
      // En création, on délègue à onSuccess (qui ouvre la modal de contrat) sans naviguer ;
      // sinon (autres contextes) on ferme. L'édition passe par onNavigate.
      if (onSuccess) onSuccess(created);
      else if (onClose) onClose();
    },
    onNavigate: (path) => navigate(path),
  });

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

  // ─── Option lists ─────────────────────────────────────────────────────
  // Source unique de verite : PROPERTY_TYPES dans utils/statusUtils.ts.
  // Synchronisee avec l'enum PropertyType cote backend.
  const propertyTypes = PROPERTY_TYPES.map(pt => ({
    value: pt.value,
    label: t(pt.i18nKey),
  }));

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
        <CleaningPriceEstimator control={control} setValue={setValue} />
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
              <PropertyFormAddress control={control} errors={errors} setValue={setValue} />
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
    </Box>
  );
};

export default PropertyForm;
