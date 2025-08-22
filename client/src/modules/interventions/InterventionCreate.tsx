import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Alert, Button, Typography } from '@mui/material';
import { Cancel, Save } from '@mui/icons-material';
import InterventionForm from './InterventionForm';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';

const InterventionCreate: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Vérifier les permissions silencieusement
  const canCreate = hasPermission('interventions:create');

  const handleClose = () => {
    navigate('/interventions');
  };

  const handleSuccess = () => {
    setSuccess(true);
    // Rediriger vers la liste des interventions après un court délai
    setTimeout(() => {
      navigate('/interventions');
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
          Intervention créée avec succès ! Redirection en cours...
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Nouvelle intervention"
        subtitle="Créer une nouvelle intervention dans le système"
        backPath="/interventions"
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
                const submitButton = document.querySelector('[data-submit-intervention]') as HTMLButtonElement;
                if (submitButton) {
                  submitButton.click();
                }
              }}
              startIcon={<Save />}
              disabled={loading}
            >
              {loading ? 'Création...' : 'Créer l\'intervention'}
            </Button>
          </>
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
