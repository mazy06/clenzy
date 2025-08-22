import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Alert, Button } from '@mui/material';
import { Cancel, Save } from '@mui/icons-material';
import ServiceRequestForm from './ServiceRequestForm';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';

const ServiceRequestCreate: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Vérifier les permissions silencieusement
  const canCreate = hasPermission('service-requests:create');

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

  // Si l'utilisateur n'a pas les permissions, ne rien afficher
  if (!canCreate) {
    return null;
  }

  if (success) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="success" sx={{ mb: 3 }}>
          Demande de service créée avec succès ! Redirection en cours...
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Nouvelle demande de service"
        subtitle="Créer une nouvelle demande de service dans le système"
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
              Annuler
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                // Déclencher la soumission du formulaire
                const submitButton = document.querySelector('[data-submit-service-request]') as HTMLButtonElement;
                if (submitButton) {
                  submitButton.click();
                }
              }}
              startIcon={<Save />}
              disabled={loading}
            >
              {loading ? 'Création...' : 'Créer la demande'}
            </Button>
          </>
        }
      />
      
      <ServiceRequestForm
        onClose={handleClose}
        onSuccess={handleSuccess}
        setLoading={setLoading}
        loading={loading}
      />
    </Box>
  );
};

export default ServiceRequestCreate;
