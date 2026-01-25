import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Box } from '@mui/material';
import { Cancel, Save } from '@mui/icons-material';
import PropertyForm from './PropertyForm';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { createSpacing } from '../../theme/spacing';
import { useTranslation } from '../../hooks/useTranslation';

const PropertyCreate: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  const { t } = useTranslation();
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Vérifier les permissions silencieusement
  const [canCreate, setCanCreate] = useState(false);
  
  useEffect(() => {
    const checkPermissions = async () => {
      const canCreatePermission = await hasPermissionAsync('properties:create');
      setCanCreate(canCreatePermission);
    };
    
    checkPermissions();
  }, [hasPermissionAsync]);

  const handleClose = () => {
    navigate('/properties');
  };

  const handleSuccess = () => {
    setSuccess(true);
    // Rediriger vers la liste des propriétés après un court délai
    setTimeout(() => {
      navigate('/properties');
    }, 1500);
  };

  // VÉRIFICATIONS APRÈS TOUS LES HOOKS
  // Si l'utilisateur n'a pas les permissions, ne rien afficher
  if (!canCreate) {
    return null;
  }

  if (success) {
    return (
      <Box sx={createSpacing.page()}>
        <Alert severity="success" sx={createSpacing.section()}>
          {t('properties.create')} {t('common.success')} ! {t('common.loading')}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={createSpacing.page()}>
      <PageHeader
        title={t('properties.create')}
        subtitle={t('properties.subtitle')}
        backPath="/properties"
        showBackButton={true}
        actions={
          <>
            <Button
              variant="outlined"
              onClick={handleClose}
              startIcon={<Cancel />}
              disabled={loading}
              sx={{ mr: 1 }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                // Déclencher la soumission du formulaire
                const submitButton = document.querySelector('[data-submit-property]') as HTMLButtonElement;
                if (submitButton) {
                  submitButton.click();
                }
              }}
              startIcon={<Save />}
              disabled={loading}
            >
              {loading ? t('properties.creating') : t('properties.createProperty')}
            </Button>
          </>
        }
      />
      
      <PropertyForm
        onClose={handleClose}
        onSuccess={handleSuccess}
        setLoading={setLoading}
        loading={loading}
      />
    </Box>
  );
};

export default PropertyCreate;
