import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Box, Divider } from '@mui/material';
import { CloudUpload } from '../../icons';
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
        {error && <Alert variant="destructive" className="mb-3">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>}

        <div className="mt-1.5 flex flex-col gap-3">
          {/* Upload zone — tokens Signature (pas encore de pattern dropzone baseline) */}
          <Box
            sx={{
              border: '2px dashed',
              borderColor: file ? 'var(--ok)' : 'var(--line-2)',
              borderRadius: '12px',
              p: 3,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: file ? 'var(--ok-soft)' : 'var(--field)',
              transition: 'border-color .15s, background-color .15s',
              '&:hover': { borderColor: 'var(--accent)', bgcolor: 'var(--accent-soft)' },
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
            component="label"
          >
            <input type="file" accept=".odt" hidden onChange={handleFileChange} aria-label="Sélectionner un fichier template ODT" />
            <span className={cn('inline-flex mb-1.5', file ? 'text-[var(--ok)]' : 'text-[var(--faint)]')}><CloudUpload size={40} strokeWidth={1.75} /></span>
            <p className="cn-text-body1 font-medium">
              {file ? file.name : 'Cliquez pour sélectionner un fichier .odt'}
            </p>
            {file && (
              <span className="cn-text-caption text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </span>
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

          <Divider sx={{ my: 1 }}>
            <span className="cn-text-caption text-muted-foreground">Configuration email (optionnel)</span>
          </Divider>

          <TextField
            label="Objet de l'email"
            size="small"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            fullWidth
            placeholder="Ex: Votre facture Baitly"
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
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading} size="small">Annuler</Button>
        <Button
          variant="contained"
          size="small"
          onClick={handleSubmit}
          disabled={loading || !file || !name || !documentType}
          startIcon={loading ? <Spinner className="size-4" /> : <CloudUpload />}
        >
          {loading ? 'Upload...' : 'Uploader & scanner'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TemplateUpload;
