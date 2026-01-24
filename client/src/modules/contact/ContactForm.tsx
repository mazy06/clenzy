import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Autocomplete,
  FormHelperText,
  Paper,
  Divider
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Subject as SubjectIcon,
  Message as MessageIcon,
  PriorityHigh as PriorityIcon,
  Category as CategoryIcon
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';

interface ContactFormData {
  recipientId: string;
  subject: string;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  category: 'GENERAL' | 'TECHNICAL' | 'MAINTENANCE' | 'CLEANING' | 'EMERGENCY';
  attachments: File[];
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

const ContactForm: React.FC = () => {
  const { user } = useAuth();
  const isRestrictedUser = user?.roles?.includes('HOST') || user?.roles?.includes('HOUSEKEEPER') || user?.roles?.includes('TECHNICIAN') || user?.roles?.includes('SUPERVISOR');
  const [formData, setFormData] = useState<ContactFormData>({
    recipientId: '',
    subject: '',
    message: '',
    priority: 'MEDIUM',
    category: 'GENERAL',
    attachments: []
  });

  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Charger la liste des destinataires autorisés
  useEffect(() => {
    const loadRecipients = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/contact/recipients`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const users = await response.json();
          setUsersList(users);
          console.log('📊 ContactForm - Destinataires autorisés chargés:', users.length);
        } else {
          console.error('❌ Erreur lors du chargement des destinataires');
        }
      } catch (error) {
        console.error('❌ Erreur lors du chargement des destinataires:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRecipients();
  }, []);

  const handleInputChange = (field: keyof ContactFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files);
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...fileArray]
      }));
    }
  };

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!formData.recipientId || !formData.subject || !formData.message) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const formDataToSend = new FormData();
      formDataToSend.append('recipientId', formData.recipientId);
      formDataToSend.append('subject', formData.subject);
      formDataToSend.append('message', formData.message);
      formDataToSend.append('priority', formData.priority);
      formDataToSend.append('category', formData.category);

      // Ajouter les pièces jointes
      formData.attachments.forEach((file, index) => {
        formDataToSend.append(`attachments`, file);
      });

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/contact/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formDataToSend
      });

      if (response.ok) {
        setSuccess('Message envoyé avec succès !');
        setFormData({
          recipientId: '',
          subject: '',
          message: '',
          priority: 'MEDIUM',
          category: 'GENERAL',
          attachments: []
        });
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Erreur lors de l\'envoi du message');
      }
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi du message:', error);
      setError('Erreur de connexion. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  const priorityOptions = [
    { value: 'LOW', label: 'Faible', color: 'success' },
    { value: 'MEDIUM', label: 'Moyenne', color: 'info' },
    { value: 'HIGH', label: 'Élevée', color: 'warning' },
    { value: 'URGENT', label: 'Urgente', color: 'error' }
  ];

  const categoryOptions = [
    { value: 'GENERAL', label: 'Général' },
    { value: 'TECHNICAL', label: 'Technique' },
    { value: 'MAINTENANCE', label: 'Maintenance' },
    { value: 'CLEANING', label: 'Nettoyage' },
    { value: 'EMERGENCY', label: 'Urgence' }
  ];

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MessageIcon color="primary" />
            Nouveau Message
          </Typography>

          {isRestrictedUser && (
            <Alert severity="info" sx={{ mb: 3 }}>
              En tant qu'utilisateur restreint, vous ne pouvez envoyer des messages qu'aux managers de votre portefeuille.
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              {success}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Destinataire */}
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>Destinataire</InputLabel>
                  <Select
                    value={formData.recipientId}
                    onChange={(e) => handleInputChange('recipientId', e.target.value)}
                    disabled={loading}
                  >
                    {usersList.map((user) => (
                      <MenuItem key={user.id} value={user.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PersonIcon fontSize="small" />
                          <Box>
                            <Typography variant="body2">
                              {user.firstName} {user.lastName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {user.email} • {user.role}
                            </Typography>
                          </Box>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Sujet */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Sujet"
                  value={formData.subject}
                  onChange={(e) => handleInputChange('subject', e.target.value)}
                  required
                  InputProps={{
                    startAdornment: <SubjectIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  }}
                />
              </Grid>

              {/* Priorité et Catégorie */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Priorité</InputLabel>
                  <Select
                    value={formData.priority}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                  >
                    {priorityOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        <Chip
                          label={option.label}
                          size="small"
                          color={option.color as any}
                          sx={{ mr: 1 }}
                        />
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Catégorie</InputLabel>
                  <Select
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                  >
                    {categoryOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        <CategoryIcon sx={{ mr: 1, fontSize: 16 }} />
                        {option.label}
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
                  multiline
                  rows={6}
                  value={formData.message}
                  onChange={(e) => handleInputChange('message', e.target.value)}
                  required
                  InputProps={{
                    startAdornment: <MessageIcon sx={{ mr: 1, color: 'text.secondary', alignSelf: 'flex-start', mt: 1 }} />
                  }}
                />
              </Grid>

              {/* Pièces jointes */}
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    <AttachFileIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Pièces jointes
                  </Typography>
                  
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    id="file-input"
                  />
                  <label htmlFor="file-input">
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={<AttachFileIcon />}
                      size="small"
                    >
                      Ajouter des fichiers
                    </Button>
                  </label>

                  {formData.attachments.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Fichiers sélectionnés :
                      </Typography>
                      {formData.attachments.map((file, index) => (
                        <Chip
                          key={index}
                          label={file.name}
                          onDelete={() => removeAttachment(index)}
                          size="small"
                          sx={{ mr: 1, mb: 1 }}
                        />
                      ))}
                    </Box>
                  )}
                </Paper>
              </Grid>

              {/* Boutons */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    onClick={() => setFormData({
                      recipientId: '',
                      subject: '',
                      message: '',
                      priority: 'MEDIUM',
                      category: 'GENERAL',
                      attachments: []
                    })}
                    disabled={submitting}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={submitting ? <CircularProgress size={20} /> : <SendIcon />}
                    disabled={submitting || loading}
                  >
                    {submitting ? 'Envoi en cours...' : 'Envoyer'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ContactForm;
