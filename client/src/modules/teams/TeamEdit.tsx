import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Group,
  Save,
  Cancel,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';
import PageHeader from '../../components/PageHeader';

interface TeamFormData {
  name: string;
  description: string;
  interventionType: string;
}

const TeamEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState<TeamFormData>({
    name: '',
    description: '',
    interventionType: 'CLEANING'
  });

  // Charger les données de l'équipe
  useEffect(() => {
    const loadTeam = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/teams/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        });

        if (response.ok) {
          const teamData = await response.json();
          console.log('🔍 TeamEdit - Équipe chargée:', teamData);
          
          setFormData({
            name: teamData.name || '',
            description: teamData.description || '',
            interventionType: teamData.interventionType || 'CLEANING'
          });
        } else {
          setError('Erreur lors du chargement de l\'équipe');
        }
      } catch (err) {
        console.error('🔍 TeamEdit - Erreur chargement équipe:', err);
        setError('Erreur lors du chargement de l\'équipe');
      } finally {
        setLoading(false);
      }
    };

    loadTeam();
  }, [id]);

  // Gestionnaires de changement
  const handleInputChange = (field: keyof TeamFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Soumission du formulaire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setSaving(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/teams/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setSuccess(true);
        
        // Redirection après un délai
        setTimeout(() => {
          navigate(`/teams/${id}`);
        }, 1500);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Erreur lors de la mise à jour');
      }
    } catch (err) {
      console.error('🔍 TeamEdit - Erreur mise à jour:', err);
      setError('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  // Constantes pour les options
  const interventionTypes = [
    { value: 'CLEANING', label: 'Nettoyage' },
    { value: 'MAINTENANCE', label: 'Maintenance' },
    { value: 'REPAIR', label: 'Réparation' },
    { value: 'OTHER', label: 'Autre' }
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Vérifier les permissions pour l'édition
  const canEdit = hasPermission('teams:edit');

  if (!canEdit) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          <Typography variant="h6" gutterBottom>
            Accès non autorisé
          </Typography>
          <Typography variant="body1">
            Vous n'avez pas les permissions nécessaires pour modifier des équipes.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* PageHeader avec titre, sous-titre, bouton retour et bouton modifier */}
      <PageHeader
        title="Modifier l'équipe"
        subtitle="Modifiez les détails de l'équipe"
        backPath={`/teams/${id}`}
        backLabel="Retour aux détails"
        showBackButton={true}
        actions={
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => navigate(`/teams/${id}`)}
              startIcon={<Cancel />}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={<Save />}
              disabled={saving}
              onClick={handleSubmit}
            >
              {saving ? 'Mise à jour...' : 'Mettre à jour'}
            </Button>
          </Box>
        }
      />

      {/* Messages d'erreur/succès */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Équipe mise à jour avec succès ! Redirection en cours...
        </Alert>
      )}

      {/* Formulaire */}
      <Card>
        <CardContent sx={{ p: 4 }}>
          <form onSubmit={handleSubmit}>
            {/* Informations de base */}
            <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
              Informations de base
            </Typography>

            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  label="Nom de l'équipe *"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                  placeholder="Ex: Équipe Nettoyage Premium"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth required>
                  <InputLabel>Type d'intervention *</InputLabel>
                  <Select
                    value={formData.interventionType}
                    onChange={(e) => handleInputChange('interventionType', e.target.value)}
                    label="Type d'intervention *"
                  >
                    {interventionTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Description */}
            <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
              Description
            </Typography>

            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Description de l'équipe"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Décrivez votre équipe..."
                />
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default TeamEdit;
