import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Typography, Box } from '@mui/material';
import { Cancel, Save } from '@mui/icons-material';
import InterventionForm from './InterventionForm';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';

const InterventionCreate: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  const { t } = useTranslation();
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Vérifier les permissions silencieusement
  const [canCreate, setCanCreate] = useState(false);
  
  useEffect(() => {
    const checkPermissions = async () => {
      const canCreatePermission = await hasPermissionAsync('interventions:create');
      setCanCreate(canCreatePermission);
    };
    
    checkPermissions();
  }, [hasPermissionAsync]);

  // Vérification conditionnelle après les hooks
  if (!canCreate) {
    return null;
  }

  const handleSuccess = () => {
    setSuccess(true);
    navigate('/interventions');
  };

  const handleClose = () => {
    navigate('/interventions');
  };

  return (
    <Box>
      <PageHeader
        title="Créer une intervention"
        subtitle="Formulaire de création d'une nouvelle intervention"
        backPath="/interventions"
        showBackButton={true}
        actions={
          <div>
            <Button 
              variant="outlined" 
              color="primary" 
              onClick={handleClose}
              startIcon={<Cancel />}
            >
              Annuler
            </Button>
            <Button 
              variant="contained" 
              color="primary" 
              style={{ marginLeft: '10px' }}
              startIcon={<Save />}
              form="intervention-form"
              type="submit"
            >
              Créer l'intervention
            </Button>
          </div>
        }
      />

      <InterventionForm
        onClose={handleClose}
        onSuccess={handleSuccess}
        setLoading={setLoading}
        loading={loading}
      />
    </Box>
  );
};

export default InterventionCreate;
