import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Box } from '@mui/material';
import { Cancel, Save } from '../../icons';
import PropertyForm from './PropertyForm';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import type { Property } from '../../services/api';
import ManagementContractRequiredModal from '../contracts/ManagementContractRequiredModal';

// ─── Stable sx constants ────────────────────────────────────────────────────

const ACTION_BUTTON_SX = {
  textTransform: 'none',
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.01em',
  height: 28,
  px: 1.5,
  '& .MuiButton-startIcon': { mr: 0.5 },
  '& .MuiSvgIcon-root': { fontSize: 14 },
} as const;

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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ flexShrink: 0 }}>
        <PageHeader
          title={t('properties.create')}
          subtitle={t('properties.subtitle')}
          backPath="/properties"
          showBackButton={true}
          actions={
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <Button
                variant="outlined"
                onClick={handleClose}
                startIcon={<Cancel size={18} strokeWidth={1.75} />}
                size="small"
                sx={ACTION_BUTTON_SX}
                title={t('common.cancel')}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  const submitButton = document.querySelector('[data-submit-property]') as HTMLButtonElement;
                  if (submitButton) submitButton.click();
                }}
                startIcon={<Save size={18} strokeWidth={1.75} />}
                size="small"
                sx={ACTION_BUTTON_SX}
                title={t('properties.createProperty')}
              >
                {t('properties.createProperty')}
              </Button>
            </Box>
          }
        />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <PropertyForm onClose={handleClose} onSuccess={handleSuccess} />
      </Box>

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
    </Box>
  );
};

export default PropertyCreate;
