import React, { useState, useEffect, useId } from 'react';
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
import PropertyFormTouristTax from './PropertyFormTouristTax';
import CleaningPriceEstimator from './CleaningPriceEstimator';
import PropertyFormSectionNav from './PropertyFormSectionNav';
import IllustratedHeading from '../../components/IllustratedHeading';
import { PROPERTY_ART } from './propertyArtwork';
import { cn } from '../../utils/cn';
import './propertyForm.css';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PropertyFormProps {
  onClose?: () => void;
  onSuccess?: (created: Property) => void;
  setLoading?: (loading: boolean) => void;
  loading?: boolean;
  propertyId?: number;
  mode?: 'create' | 'edit';
  embedded?: boolean;
}

// ─── Main component ─────────────────────────────────────────────────────────

const PropertyForm: React.FC<PropertyFormProps> = ({ onClose, onSuccess, propertyId, mode = 'create', embedded = false }) => {
  const { user, hasPermissionAsync, isAdmin, isManager, isHost } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEditMode = mode === 'edit' || !!propertyId;
  const sectionPrefix = useId().replace(/:/g, '');

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
    onNavigate: embedded ? undefined : (path) => navigate(path),
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
    label: t(option.labelKey),
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

  // Une section par sujet, chacune sous un en-tête illustré ; le sommaire (hors
  // mode intégré de l'onboarding) mène de l'une à l'autre.
  const settingsProps = { control, errors, users, propertyStatuses, cleaningFrequencies, isAdmin, isManager };
  const sections = [
    { key: 'identity', art: PROPERTY_ART.identity, body: <PropertyFormBasicInfo control={control} errors={errors} propertyTypes={propertyTypes} /> },
    { key: 'address', art: PROPERTY_ART.location, body: <PropertyFormAddress control={control} errors={errors} setValue={setValue} /> },
    { key: 'characteristics', art: PROPERTY_ART.characteristics, body: <PropertyFormDetails control={control} errors={errors} part="characteristics" /> },
    { key: 'amenities', art: PROPERTY_ART.amenities, body: <PropertyFormDetails control={control} errors={errors} part="amenities" /> },
    { key: 'management', art: PROPERTY_ART.management, body: <PropertyFormSettings {...settingsProps} part="configuration" /> },
    {
      key: 'cleaning',
      art: PROPERTY_ART.cleaning,
      body: (
        <>
          <CleaningPriceEstimator control={control} setValue={setValue} />
          <PropertyFormSettings {...settingsProps} part="cleaning" />
        </>
      ),
    },
    // Création seulement : la taxe de séjour est déclarée et confirmée (France, Maroc).
    ...(!isEditMode
      ? [{ key: 'touristTax', art: PROPERTY_ART.touristTax, body: <PropertyFormTouristTax control={control} errors={errors} setValue={setValue} /> }]
      : []),
  ].map((section) => ({
    ...section,
    id: `${sectionPrefix}-${section.key}`,
    title: t(`propertyWorkspace.form.${section.key}.title`),
    hint: t(`propertyWorkspace.form.${section.key}.hint`),
  }));

  return (
    <form
      onSubmit={handleSubmit((data) => submitForm(data))}
      className={cn('pf', embedded && 'pf--embedded')}
    >
      {!embedded && <PropertyFormSectionNav sections={sections} label={t('propertyWorkspace.form.navLabel')} />}

      <div className="pf-sections">
        {sections.map((section) => (
          <section key={section.key} id={section.id} className="pf-section">
            <IllustratedHeading art={section.art} title={section.title} hint={section.hint} />
            {section.body}
          </section>
        ))}

        {submitError && (
          <UiAlert variant="destructive" className="text-[0.8125rem]">
            <TriangleAlert />
            <AlertDescription>{submitError}</AlertDescription>
          </UiAlert>
        )}

        {/* Bouton de soumission déclenché par le PageHeader (masqué hors onboarding). */}
        <Button type="submit" className={embedded ? 'setup-primary self-start' : 'hidden'} data-submit-property disabled={isSubmitting}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
};

export default PropertyForm;
