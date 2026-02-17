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
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { Send } from '@mui/icons-material';
import { useDocumentTypes, useGenerateDocument } from './hooks/useDocuments';

interface GenerateDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const REFERENCE_TYPES = [
  { value: 'intervention', label: 'Intervention' },
  { value: 'service_request', label: 'Demande de service' },
  { value: 'property', label: 'Bien immobilier' },
  { value: 'user', label: 'Utilisateur' },
];

const GenerateDialog: React.FC<GenerateDialogProps> = ({ open, onClose, onSuccess }) => {
  const [documentType, setDocumentType] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [referenceType, setReferenceType] = useState('intervention');
  const [emailTo, setEmailTo] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: documentTypes = [] } = useDocumentTypes();
  const generateMutation = useGenerateDocument();

  const handleSubmit = async () => {
    if (!documentType || !referenceId) {
      setError('Veuillez remplir les champs obligatoires');
      return;
    }

    if (sendEmail && !emailTo) {
      setError('Veuillez saisir une adresse email');
      return;
    }

    if (sendEmail && emailTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo)) {
      setError('Adresse email invalide');
      return;
    }

    setError(null);

    try {
      await generateMutation.mutateAsync({
        documentType,
        referenceId: Number(referenceId),
        referenceType,
        emailTo: sendEmail ? emailTo : undefined,
        sendEmail,
      });
      resetForm();
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la génération');
    }
  };

  const resetForm = () => {
    setDocumentType('');
    setReferenceId('');
    setReferenceType('intervention');
    setEmailTo('');
    setSendEmail(false);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const loading = generateMutation.isPending;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Générer un document</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
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
            label="Type de référence *"
            select
            size="small"
            value={referenceType}
            onChange={(e) => setReferenceType(e.target.value)}
            fullWidth
          >
            {REFERENCE_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="ID de référence *"
            type="number"
            size="small"
            value={referenceId}
            onChange={(e) => setReferenceId(e.target.value)}
            fullWidth
            placeholder="Ex: 42"
            helperText="ID de l'intervention, demande, bien ou utilisateur"
          />

          <FormControlLabel
            control={<Switch checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />}
            label="Envoyer par email"
          />

          {sendEmail && (
            <TextField
              label="Adresse email du destinataire"
              type="email"
              size="small"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              fullWidth
              placeholder="client@example.com"
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading} size="small">Annuler</Button>
        <Button
          variant="contained"
          size="small"
          onClick={handleSubmit}
          disabled={loading || !documentType || !referenceId}
          startIcon={loading ? <CircularProgress size={16} /> : <Send />}
        >
          {loading ? 'Génération...' : 'Générer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GenerateDialog;
