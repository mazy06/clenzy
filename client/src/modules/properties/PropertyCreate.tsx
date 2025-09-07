import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Box } from '@mui/material';
import { Cancel, Save } from '@mui/icons-material';
import PropertyForm from './PropertyForm';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { createSpacing } from '../../theme/spacing';

const PropertyCreate: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
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
          Propriété créée avec succès ! Redirection en cours...
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={createSpacing.page()}>
      <PageHeader
        title="Nouvelle propriété"
        subtitle="Créer une nouvelle propriété dans le système"
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
              Annuler
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
              {loading ? 'Création...' : 'Créer la propriété'}
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
