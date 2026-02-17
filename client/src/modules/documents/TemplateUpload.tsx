import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
import { useDocumentTypes, useUploadTemplate } from './hooks/useDocuments';

interface TemplateUploadProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TemplateUpload: React.FC<TemplateUploadProps> = ({ open, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [eventTrigger, setEventTrigger] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: documentTypes = [] } = useDocumentTypes();
  const uploadMutation = useUploadTemplate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      if (!f.name.toLowerCase().endsWith('.odt')
          || (f.type && f.type !== 'application/vnd.oasis.opendocument.text')) {
        setError('Seuls les fichiers .odt sont acceptés');
        return;
      }
      setFile(f);
      if (!name) setName(f.name.replace('.odt', ''));
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!file || !name || !documentType) {
      setError('Veuillez remplir les champs obligatoires');
      return;
    }

    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name);
      formData.append('documentType', documentType);
      if (description) formData.append('description', description);
      if (eventTrigger) formData.append('eventTrigger', eventTrigger);
      if (emailSubject) formData.append('emailSubject', emailSubject);
      if (emailBody) formData.append('emailBody', emailBody);

      await uploadMutation.mutateAsync(formData);
      resetForm();
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'upload du template');
    }
  };

  const resetForm = () => {
    setFile(null);
    setName('');
    setDescription('');
    setDocumentType('');
    setEventTrigger('');
    setEmailSubject('');
    setEmailBody('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const loading = uploadMutation.isPending;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Nouveau template de document</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Upload zone */}
          <Box
            sx={{
              border: '2px dashed',
              borderColor: file ? 'success.main' : 'grey.300',
              borderRadius: 2,
              p: 3,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: file ? 'success.50' : 'grey.50',
              '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' },
            }}
            component="label"
          >
            <input type="file" accept=".odt" hidden onChange={handleFileChange} aria-label="Sélectionner un fichier template ODT" />
            <CloudUpload sx={{ fontSize: 40, color: file ? 'success.main' : 'grey.400', mb: 1 }} />
            <Typography variant="body1" fontWeight={500}>
              {file ? file.name : 'Cliquez pour sélectionner un fichier .odt'}
            </Typography>
            {file && (
              <Typography variant="caption" color="text.secondary">
                {(file.size / 1024).toFixed(1)} KB
              </Typography>
            )}
          </Box>

          <TextField
            label="Nom du template *"
            size="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />

          <TextField
            label="Type de document *"
            select
            size="small"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            fullWidth
          >
            {documentTypes.map((t) => (
              <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="Description"
            size="small"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />

          <TextField
            label="Déclencheur (événement)"
            size="small"
            value={eventTrigger}
            onChange={(e) => setEventTrigger(e.target.value)}
            fullWidth
            placeholder="Ex: intervention.completed"
            helperText="Événement métier qui déclenche la génération automatique"
          />

          <Divider sx={{ my: 1 }}>
            <Typography variant="caption" color="text.secondary">Configuration email (optionnel)</Typography>
          </Divider>

          <TextField
            label="Objet de l'email"
            size="small"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            fullWidth
            placeholder="Ex: Votre facture Clenzy"
          />

          <TextField
            label="Corps de l'email (HTML)"
            size="small"
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            fullWidth
            multiline
            rows={3}
            placeholder="HTML du corps de l'email..."
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading} size="small">Annuler</Button>
        <Button
          variant="contained"
          size="small"
          onClick={handleSubmit}
          disabled={loading || !file || !name || !documentType}
          startIcon={loading ? <CircularProgress size={16} /> : <CloudUpload />}
        >
          {loading ? 'Upload...' : 'Uploader & scanner'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TemplateUpload;
