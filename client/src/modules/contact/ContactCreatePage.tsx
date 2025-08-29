import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Container,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Grid,
  Divider
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';

interface ContactCreateFormData {
  recipient: string;
  subject: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  attachments: File[];
}

const ContactCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [formData, setFormData] = useState<ContactCreateFormData>({
    recipient: '',
    subject: '',
    message: '',
    priority: 'medium',
    category: 'general',
    attachments: []
  });

  const priorityColors = {
    low: 'success',
    medium: 'warning',
    high: 'error'
  } as const;

  const priorityLabels = {
    low: 'Basse',
    medium: 'Moyenne',
    high: 'Haute'
  };

  const categories = [
    { value: 'general', label: 'Général' },
    { value: 'support', label: 'Support technique' },
    { value: 'billing', label: 'Facturation' },
    { value: 'feature', label: 'Demande de fonctionnalité' },
    { value: 'bug', label: 'Signalement de bug' },
    { value: 'other', label: 'Autre' }
  ];

  const handleInputChange = (field: keyof ContactCreateFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setFormData(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...files]
    }));
  };

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Simulation d'envoi - à remplacer par l'appel API réel
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setSubmitSuccess(true);
      setTimeout(() => {
        navigate('/contact');
      }, 2000);
    } catch (error) {
      setSubmitError('Erreur lors de l\'envoi du message. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    setFormData({
      recipient: '',
      subject: '',
      message: '',
      priority: 'medium',
      category: 'general',
      attachments: []
    });
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  if (!user) {
    return null;
  }

  return (
    <Container maxWidth="md">
      <PageHeader
        title="Nouveau message"
        subtitle="Créez et envoyez un nouveau message"
        backPath="/contact"
        showBackButton={true}
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<SendIcon />}
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.recipient || !formData.subject || !formData.message}
            sx={{ minWidth: 140 }}
          >
            {isSubmitting ? <CircularProgress size={20} /> : 'Envoyer'}
          </Button>
        }
      />

      {submitSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Message envoyé avec succès ! Redirection en cours...
        </Alert>
      )}

      {submitError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {submitError}
        </Alert>
      )}

      <Paper sx={{ p: 4 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Destinataire */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Destinataire"
                value={formData.recipient}
                onChange={(e) => handleInputChange('recipient', e.target.value)}
                placeholder="email@exemple.com ou nom d'utilisateur"
                required
                variant="outlined"
              />
            </Grid>

            {/* Sujet */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Sujet"
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                placeholder="Sujet de votre message"
                required
                variant="outlined"
              />
            </Grid>

            {/* Priorité et Catégorie */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Priorité</InputLabel>
                <Select
                  value={formData.priority}
                  onChange={(e) => handleInputChange('priority', e.target.value)}
                  label="Priorité"
                >
                  <MenuItem value="low">
                    <Chip 
                      label={priorityLabels.low} 
                      color={priorityColors.low} 
                      size="small" 
                      sx={{ minWidth: 80 }}
                    />
                  </MenuItem>
                  <MenuItem value="medium">
                    <Chip 
                      label={priorityLabels.medium} 
                      color={priorityColors.medium} 
                      size="small" 
                      sx={{ minWidth: 80 }}
                    />
                  </MenuItem>
                  <MenuItem value="high">
                    <Chip 
                      label={priorityLabels.high} 
                      color={priorityColors.high} 
                      size="small" 
                      sx={{ minWidth: 80 }}
                    />
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Catégorie</InputLabel>
                <Select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  label="Catégorie"
                >
                  {categories.map((category) => (
                    <MenuItem key={category.value} value={category.value}>
                      {category.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Message */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Message"
                value={formData.message}
                onChange={(e) => handleInputChange('message', e.target.value)}
                placeholder="Contenu de votre message..."
                required
                multiline
                rows={8}
                variant="outlined"
              />
            </Grid>

            {/* Pièces jointes */}
            <Grid item xs={12}>
              <Box>
                <Typography variant="h6" gutterBottom>
                  Pièces jointes
                </Typography>
                <Box display="flex" gap={2} alignItems="center" mb={2}>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<AttachFileIcon />}
                    disabled={isSubmitting}
                  >
                    Ajouter des fichiers
                    <input
                      type="file"
                      multiple
                      hidden
                      onChange={handleFileUpload}
                      accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                    />
                  </Button>
                  <Typography variant="body2" color="text.secondary">
                    Formats acceptés: PDF, DOC, TXT, Images (max 10MB par fichier)
                  </Typography>
                </Box>

                {formData.attachments.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Fichiers sélectionnés ({formData.attachments.length}):
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {formData.attachments.map((file, index) => (
                        <Chip
                          key={index}
                          label={file.name}
                          onDelete={() => removeAttachment(index)}
                          deleteIcon={<ClearIcon />}
                          variant="outlined"
                          color="primary"
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={handleClear}
                  disabled={isSubmitting}
                  startIcon={<ClearIcon />}
                >
                  Effacer
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={isSubmitting || !formData.recipient || !formData.subject || !formData.message}
                  startIcon={isSubmitting ? <CircularProgress size={20} /> : <SendIcon />}
                  sx={{ minWidth: 140 }}
                >
                  {isSubmitting ? 'Envoi...' : 'Envoyer le message'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Container>
  );
};

export default ContactCreatePage;
