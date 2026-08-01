import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import { Alert, AlertDescription, Button } from '../../components/ui';
import {
  Field,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
  Textarea,
} from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Dialog, DialogTitle, DialogContent, DialogActions, Divider } from '@mui/material';
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
          <label
            className={cn(
              'border-2 border-dashed rounded-[12px] p-[18px] text-center cursor-pointer',
              'transition-[border-color,background-color] duration-150 motion-reduce:transition-none',
              'hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]',
              file ? 'border-[var(--ok)] bg-[var(--ok-soft)]' : 'border-[var(--line-2)] bg-[var(--field)]',
            )}
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
          </label>

          <Field>
            <FieldLabel htmlFor="template-name">Nom du template *</FieldLabel>
            <Input
              id="template-name"
              className="w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="template-document-type">Type de document *</FieldLabel>
            <NativeSelect
              className="w-full"
              id="template-document-type"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
            >
              {/* Option vide explicite : un select natif afficherait sinon le
                  premier type alors que l'etat vaut encore '' (submit desactive). */}
              <NativeSelectOption value="">—</NativeSelectOption>
              {documentTypes.map((t) => (
                <NativeSelectOption key={t.value} value={t.value}>{t.label}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor="template-description">Description</FieldLabel>
            <Textarea
              id="template-description"
              className="w-full"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <Divider sx={{ my: 1 }}>
            <span className="cn-text-caption text-muted-foreground">Configuration email (optionnel)</span>
          </Divider>

          <Field>
            <FieldLabel htmlFor="template-email-subject">Objet de l'email</FieldLabel>
            <Input
              id="template-email-subject"
              className="w-full"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Ex: Votre facture Baitly"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="template-email-body">Corps de l'email (HTML)</FieldLabel>
            <Textarea
              id="template-email-body"
              className="w-full"
              rows={3}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="HTML du corps de l'email..."
            />
          </Field>
        </div>
      </DialogContent>
      <DialogActions>
        <Button variant="ghost" size="sm" onClick={handleClose} disabled={loading}>Annuler</Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={loading || !file || !name || !documentType}
        >
          {loading ? <Spinner className="size-4" /> : <CloudUpload />}
          {loading ? 'Upload...' : 'Uploader & scanner'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TemplateUpload;
