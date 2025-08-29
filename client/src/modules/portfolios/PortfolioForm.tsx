import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Box,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Business as BusinessIcon } from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';

interface PortfolioFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  portfolio?: any; // Pour l'édition
}

interface PortfolioFormData {
  name: string;
  description: string;
  isActive: boolean;
}

const PortfolioForm: React.FC<PortfolioFormProps> = ({
  open,
  onClose,
  onSuccess,
  portfolio
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<PortfolioFormData>({
    name: '',
    description: '',
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});

  const isEditMode = Boolean(portfolio);

  useEffect(() => {
    if (open && portfolio) {
      // Mode édition : charger les données existantes
      setFormData({
        name: portfolio.name || '',
        description: portfolio.description || '',
        isActive: portfolio.isActive !== undefined ? portfolio.isActive : true,
      });
    } else if (open) {
      // Mode création : réinitialiser le formulaire
      setFormData({
        name: '',
        description: '',
        isActive: true,
      });
    }
    
    // Réinitialiser les erreurs
    setError(null);
    setValidationErrors({});
  }, [open, portfolio]);

  const validateForm = (): boolean => {
    const errors: {[key: string]: string} = {};

    if (!formData.name.trim()) {
      errors.name = 'Le nom du portefeuille est requis';
    } else if (formData.name.trim().length < 3) {
      errors.name = 'Le nom doit contenir au moins 3 caractères';
    }

    if (formData.description && formData.description.length > 500) {
      errors.description = 'La description ne peut pas dépasser 500 caractères';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const portfolioData = {
        ...formData,
        managerId: user.id,
      };

      const url = isEditMode 
        ? `${API_CONFIG.BASE_URL}/api/portfolios/${portfolio.id}`
        : `${API_CONFIG.BASE_URL}/api/portfolios`;
      
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(portfolioData),
      });

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || `Erreur lors de la ${isEditMode ? 'modification' : 'création'} du portefeuille`);
      }
    } catch (err) {
      setError('Erreur de connexion');
      console.error('Erreur portfolio:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const handleInputChange = (field: keyof PortfolioFormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Effacer l'erreur de validation pour ce champ
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BusinessIcon color="primary" />
          {isEditMode ? 'Modifier le portefeuille' : 'Nouveau portefeuille'}
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="Nom du portefeuille *"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            error={Boolean(validationErrors.name)}
            helperText={validationErrors.name || 'Ex: Portefeuille Île-de-France, Clients Premium...'}
            disabled={loading}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            error={Boolean(validationErrors.description)}
            helperText={validationErrors.description || 'Description optionnelle du portefeuille'}
            multiline
            rows={3}
            disabled={loading}
            sx={{ mb: 2 }}
          />

          <FormControl fullWidth>
            <InputLabel>Statut</InputLabel>
            <Select
              value={formData.isActive ? 'active' : 'inactive'}
              onChange={(e) => handleInputChange('isActive', e.target.value === 'active')}
              label="Statut"
              disabled={loading}
            >
              <MenuItem value="active">Actif</MenuItem>
              <MenuItem value="inactive">Inactif</MenuItem>
            </Select>
            <FormHelperText>
              Un portefeuille inactif n'accepte pas de nouveaux clients ou membres d'équipe
            </FormHelperText>
          </FormControl>

          {isEditMode && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Note :</strong> La modification du nom ou de la description n'affecte pas 
                les clients et membres d'équipe déjà associés.
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Annuler
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={loading || !formData.name.trim()}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          {loading ? 'Enregistrement...' : (isEditMode ? 'Modifier' : 'Créer')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PortfolioForm;
