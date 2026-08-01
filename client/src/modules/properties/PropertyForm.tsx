import React, { useState, useEffect } from 'react';
import { Alert as UiAlert, AlertDescription, Button } from '../../components/ui';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
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

// ─── Stable classes ─────────────────────────────────────────────────────────

// Carte hairline r14 plate — p: 2.5 = 15 px (spacing MUI 6).
const FORM_PANEL_CLASS = 'border border-solid border-[var(--line)] bg-[var(--card)] rounded-[14px] p-[15px] min-w-0 overflow-auto';

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
      <div className="flex justify-center items-center h-[40vh]">
        <Spinner className="size-7" />
      </div>
    );
  }

  if (isSuccess) {
    return (
      <UiAlert variant="success" className="text-[0.8125rem] py-1">
        <CircleCheck />
        <AlertDescription>{isEditMode ? t('properties.updateSuccess') : `${t('properties.create')} ${t('common.success')} !`}</AlertDescription>
      </UiAlert>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0">
        <CleaningPriceEstimator control={control} setValue={setValue} />
      </div>
      <form
        onSubmit={handleSubmit((data) => submitForm(data))}
        style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
      >
        <div className="flex gap-3 flex-1 min-h-0">
          {/* ── Colonne gauche : Infos principales ──────────────────── */}
          {/* `flex: 7` / `flex: 5` MUI = flex-grow/shrink 1 avec basis 0 : la
              repartition 7/5 des colonnes passe par un style (valeur numerique,
              pas de classe Tailwind equivalente). */}
          <div className={FORM_PANEL_CLASS} style={{ flex: 7 }}>
            <div className="flex flex-col gap-4">
              <PropertyFormBasicInfo control={control} errors={errors} propertyTypes={propertyTypes} />
              <PropertyFormAddress control={control} errors={errors} setValue={setValue} />
              <PropertyFormDetails control={control} errors={errors} />
            </div>
          </div>

          {/* ── Colonne droite : Configuration & Ménage ─────────────── */}
          <div className={FORM_PANEL_CLASS} style={{ flex: 5 }}>
            <PropertyFormSettings
              control={control}
              errors={errors}
              users={users}
              propertyStatuses={propertyStatuses}
              cleaningFrequencies={cleaningFrequencies}
              isAdmin={isAdmin}
              isManager={isManager}
            />
          </div>
        </div>

        {/* Error message */}
        {submitError && (
          <UiAlert variant="destructive" className="text-[0.8125rem] py-0.5 mt-2 shrink-0">
            <TriangleAlert />
            <AlertDescription>{submitError}</AlertDescription>
          </UiAlert>
        )}

        {/* Hidden submit button for PageHeader trigger */}
        <Button type="submit" className="hidden" data-submit-property disabled={isSubmitting}>
          Soumettre
        </Button>
      </form>
    </div>
  );
};

export default PropertyForm;
