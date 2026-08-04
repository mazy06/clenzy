import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { Cancel, Save } from '../../icons';
import PropertyForm from './PropertyForm';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import type { Property } from '../../services/api';
import ManagementContractRequiredModal from '../contracts/ManagementContractRequiredModal';

// ─── Component ──────────────────────────────────────────────────────────────

const PropertyCreate: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  const { t } = useTranslation();

  const [canCreate, setCanCreate] = useState(false);
  // Propriété fraîchement créée : déclenche la modal de contrat obligatoire.
  const [createdProperty, setCreatedProperty] = useState<Property | null>(null);

  useEffect(() => {
    const checkPermissions = async () => {
      const canCreatePermission = await hasPermissionAsync('properties:create');
      setCanCreate(canCreatePermission);
    };
    checkPermissions();
  }, [hasPermissionAsync]);

  const handleClose = () => navigate('/properties');
  // Au lieu de naviguer, on ouvre la modal de contrat obligatoire (bloquante).
  const handleSuccess = (created: Property) => setCreatedProperty(created);

  if (!canCreate) return null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0">
        <PageHeader
          title={t('properties.create')}
          subtitle={t('properties.subtitle')}
          backPath="/properties"
          showBackButton={true}
          actions={
            <div className="flex gap-1">
              <Button
                variant="outline"
                onClick={handleClose}
                size="sm"
                title={t('common.cancel')}
              >
                <Cancel size={18} strokeWidth={1.75} />
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => {
                  const submitButton = document.querySelector('[data-submit-property]') as HTMLButtonElement;
                  if (submitButton) submitButton.click();
                }}
                size="sm"
                title={t('properties.createProperty')}
              >
                <Save size={18} strokeWidth={1.75} />
                {t('properties.createProperty')}
              </Button>
            </div>
          }
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <PropertyForm onClose={handleClose} onSuccess={handleSuccess} />
      </div>

      <ManagementContractRequiredModal
        open={!!createdProperty}
        property={createdProperty ? {
          id: createdProperty.id,
          name: createdProperty.name,
          ownerId: createdProperty.ownerId,
          ownerName: createdProperty.ownerName,
        } : null}
        onCompleted={() => navigate('/properties')}
      />
    </div>
  );
};

export default PropertyCreate;
