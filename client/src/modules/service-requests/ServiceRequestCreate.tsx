import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Box } from '@mui/material';
import { Cancel, Save } from '@mui/icons-material';
import ServiceRequestForm from './ServiceRequestForm';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';

const ServiceRequestCreate: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  const { t } = useTranslation();
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const submitRef = useRef<(() => void) | null>(null);

  // Vérifier les permissions silencieusement
  const [canCreate, setCanCreate] = useState(false);
  
  useEffect(() => {
    const checkPermissions = async () => {
      const canCreatePermission = await hasPermissionAsync('service-requests:create');
      setCanCreate(canCreatePermission);
    };
    
    checkPermissions();
  }, [hasPermissionAsync]);

  const handleClose = () => {
    navigate('/service-requests');
  };

  const handleSuccess = () => {
    setSuccess(true);
    // Rediriger vers la liste des demandes de service après un court délai
    setTimeout(() => {
      navigate('/service-requests');
    }, 1500);
  };

  // VÉRIFICATIONS APRÈS TOUS LES HOOKS
  // Si l'utilisateur n'a pas les permissions, ne rien afficher
  if (!canCreate) {
    return null;
  }

  if (success) {
    return (
      <Box>
        <Alert severity="success" sx={{ mb: 3 }}>
          {t('serviceRequests.createSuccess')}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={t('serviceRequests.create')}
        subtitle={t('serviceRequests.createSubtitle')}
        backPath="/service-requests"
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
              onClick={() => submitRef.current?.()}
              startIcon={<Save />}
              disabled={loading}
            >
              {loading ? t('serviceRequests.creating') : t('serviceRequests.createRequest')}
            </Button>
          </>
        }
      />
      
      <ServiceRequestForm
        onClose={handleClose}
        onSuccess={handleSuccess}
        setLoading={setLoading}
        loading={loading}
        submitRef={submitRef}
      />
    </Box>
  );
};

export default ServiceRequestCreate;
