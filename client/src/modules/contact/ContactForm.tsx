import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  FormHelperText,
} from '@mui/material';
import {
  Send,
  AttachFile,
  Delete,
  CloudUpload,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';

// Types de messages et priorités (synchronisés avec le backend)
const MESSAGE_TYPES = [
  { value: 'QUESTION_FACTURATION', label: 'Question facturation' },
  { value: 'DEMANDE_ADMINISTRATIVE', label: 'Demande administrative' },
  { value: 'CLARIFICATION_CONTRAT', label: 'Clarification contrat' },
  { value: 'QUESTION_PORTEFEUILLE', label: 'Question portefeuille' },
  { value: 'SUGGESTION', label: 'Suggestion' },
  { value: 'PROBLEME_COMMUNICATION', label: 'Problème de communication' },
  { value: 'DEMANDE_RENDEZ_VOUS', label: 'Demande de rendez-vous' },
  { value: 'REMARQUE_FEEDBACK', label: 'Remarque/Feedback' },
  { value: 'QUESTION_GENERALE', label: 'Question générale' },
];

const PRIORITIES = [
  { value: 'BASSE', label: 'Basse', color: 'default' },
  { value: 'MOYENNE', label: 'Moyenne', color: 'primary' },
  { value: 'HAUTE', label: 'Haute', color: 'warning' },
  { value: 'URGENTE', label: 'Urgente', color: 'error' },
];

interface ContactFormData {
  recipientId: number | '';
  propertyId: number | '';
  messageType: string;
  priority: string;
  subject: string;
  content: string;
}

interface FileUpload {
  file: File;
  id: string;
  name: string;
  size: number;
  type: string;
}

const ContactForm: React.FC = () => {
  const { user, isHost, isTechnician, isHousekeeper } = useAuth();
  const [formData, setFormData] = useState<ContactFormData>({
    recipientId: '',
    propertyId: '',
    messageType: 'QUESTION_GENERALE',
    priority: 'BASSE',
    subject: '',
    content: '',
  });
  
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Array<{id: number, name: string, role: string}>>([]);
  const [properties, setProperties] = useState<Array<{id: number, name: string}>>([]);

  // Charger les destinataires et propriétés au montage
  useEffect(() => {
    loadRecipients();
    if (isHost()) {
      loadUserProperties();
    }
  }, [user]);

  const loadRecipients = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const usersList = data.content || data;
        
        // Filtrer selon le rôle de l'utilisateur connecté
        let filteredRecipients = usersList;
        if (isHost()) {
          // HOST peut contacter uniquement les MANAGER
          filteredRecipients = usersList.filter((u: any) => u.role === 'MANAGER');
        } else if (isTechnician() || isHousekeeper()) {
          // Équipe peut contacter les MANAGER et SUPERVISOR
          filteredRecipients = usersList.filter((u: any) => 
            ['MANAGER', 'SUPERVISOR'].includes(u.role)
          );
        }
        
        setRecipients(filteredRecipients.map((u: any) => ({
          id: u.id,
          name: `${u.firstName} ${u.lastName}`,
          role: u.role
        })));
      }
    } catch (err) {
      console.error('Erreur chargement destinataires:', err);
    }
  };

  const loadUserProperties = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/properties`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const propertiesList = data.content || data;
        
        // Pour les HOST, filtrer leurs propriétés
        if (isHost() && user) {
          const userProperties = propertiesList.filter((p: any) => 
            p.owner?.id === user.id
          );
          setProperties(userProperties.map((p: any) => ({
            id: p.id,
            name: p.name
          })));
        } else {
          setProperties(propertiesList.map((p: any) => ({
            id: p.id,
            name: p.name
          })));
        }
      }
    } catch (err) {
      console.error('Erreur chargement propriétés:', err);
    }
  };

  const handleInputChange = (field: keyof ContactFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Mettre à jour automatiquement la priorité selon le type de message
    if (field === 'messageType') {
      const newPriority = determinePriority(value);
      setFormData(prev => ({ ...prev, priority: newPriority }));
    }
  };

  const determinePriority = (messageType: string): string => {
    switch (messageType) {
      case 'QUESTION_FACTURATION':
      case 'CLARIFICATION_CONTRAT':
      case 'DEMANDE_RENDEZ_VOUS':
        return 'MOYENNE';
      case 'DEMANDE_ADMINISTRATIVE':
      case 'QUESTION_PORTEFEUILLE':
      case 'SUGGESTION':
      case 'REMARQUE_FEEDBACK':
      case 'QUESTION_GENERALE':
        return 'BASSE';
      case 'PROBLEME_COMMUNICATION':
        return 'MOYENNE';
      default:
        return 'BASSE';
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(event.target.files || []);
    
    const newFiles = uploadedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!formData.recipientId || !formData.subject || !formData.content) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Préparer les données du message
      const messageData = {
        ...formData,
        senderId: user?.id,
        recipientId: formData.recipientId,
        propertyId: formData.propertyId || null,
      };

      // Créer FormData pour l'upload de fichiers
      const formDataToSend = new FormData();
      formDataToSend.append('message', new Blob([JSON.stringify(messageData)], {
        type: 'application/json'
      }));

      // Ajouter les fichiers
      files.forEach(fileUpload => {
        formDataToSend.append('files', fileUpload.file);
      });

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/contact/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
        body: formDataToSend,
      });

      if (response.ok) {
        setSuccess(true);
        setFormData({
          recipientId: '',
          propertyId: '',
          messageType: 'QUESTION_GENERALE',
          priority: 'BASSE',
          subject: '',
          content: '',
        });
        setFiles([]);
        
        // Réinitialiser le formulaire après 3 secondes
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const errorData = await response.text();
        setError(`Erreur lors de l'envoi: ${errorData}`);
      }
    } catch (err) {
      setError('Erreur de connexion. Veuillez réessayer.');
      console.error('Erreur envoi message:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Message envoyé avec succès !
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Destinataire */}
        <Grid item xs={12} md={6}>
          <FormControl fullWidth required>
            <InputLabel>Destinataire *</InputLabel>
            <Select
              value={formData.recipientId}
              onChange={(e) => handleInputChange('recipientId', e.target.value)}
              label="Destinataire *"
            >
              {recipients.map((recipient) => (
                <MenuItem key={recipient.id} value={recipient.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">
                      {recipient.name}
                    </Typography>
                    <Chip 
                      label={recipient.role} 
                      size="small" 
                      variant="outlined"
                    />
                  </Box>
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              Sélectionnez la personne à contacter
            </FormHelperText>
          </FormControl>
        </Grid>

        {/* Propriété (optionnel) */}
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Propriété (optionnel)</InputLabel>
            <Select
              value={formData.propertyId}
              onChange={(e) => handleInputChange('propertyId', e.target.value)}
              label="Propriété (optionnel)"
            >
              <MenuItem value="">
                <em>Aucune propriété spécifique</em>
              </MenuItem>
              {properties.map((property) => (
                <MenuItem key={property.id} value={property.id}>
                  {property.name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              Liez votre message à une propriété si nécessaire
            </FormHelperText>
          </FormControl>
        </Grid>

        {/* Type de message */}
        <Grid item xs={12} md={6}>
          <FormControl fullWidth required>
            <InputLabel>Type de message *</InputLabel>
            <Select
              value={formData.messageType}
              onChange={(e) => handleInputChange('messageType', e.target.value)}
              label="Type de message *"
            >
              {MESSAGE_TYPES.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              Le type détermine automatiquement la priorité
            </FormHelperText>
          </FormControl>
        </Grid>

        {/* Priorité (automatique) */}
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Priorité</InputLabel>
            <Select
              value={formData.priority}
              onChange={(e) => handleInputChange('priority', e.target.value)}
              label="Priorité"
              disabled
            >
              {PRIORITIES.map((priority) => (
                <MenuItem key={priority.value} value={priority.value}>
                  <Chip 
                    label={priority.label} 
                    color={priority.color as any}
                    size="small"
                  />
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              Priorité automatique basée sur le type de message
            </FormHelperText>
          </FormControl>
        </Grid>

        {/* Sujet */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Sujet *"
            value={formData.subject}
            onChange={(e) => handleInputChange('subject', e.target.value)}
            required
            helperText="Donnez un titre clair à votre message"
          />
        </Grid>

        {/* Contenu */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Message *"
            value={formData.content}
            onChange={(e) => handleInputChange('content', e.target.value)}
            required
            multiline
            rows={6}
            helperText="Décrivez votre demande ou question en détail"
          />
        </Grid>

        {/* Upload de fichiers */}
        <Grid item xs={12}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Pièces jointes
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<CloudUpload />}
                  sx={{ mr: 2 }}
                >
                  Ajouter des fichiers
                  <input
                    type="file"
                    multiple
                    hidden
                    onChange={handleFileUpload}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  />
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Photos, documents (max 10MB par fichier)
                </Typography>
              </Box>

              {/* Liste des fichiers */}
              {files.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Fichiers sélectionnés ({files.length})
                  </Typography>
                  {files.map((fileUpload) => (
                    <Chip
                      key={fileUpload.id}
                      label={`${fileUpload.name} (${formatFileSize(fileUpload.size)})`}
                      onDelete={() => removeFile(fileUpload.id)}
                      deleteIcon={<Delete />}
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Bouton d'envoi */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              type="submit"
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : <Send />}
              disabled={loading || !formData.recipientId || !formData.subject || !formData.content}
              size="large"
            >
              {loading ? 'Envoi en cours...' : 'Envoyer le message'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ContactForm;
