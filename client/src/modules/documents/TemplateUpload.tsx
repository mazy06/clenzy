import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import { Alert, AlertDescription, Button } from '../../components/ui';
import {
  Field,
  FieldLabel,
  FieldSeparator,
  Input,
  NativeSelect,
  NativeSelectOption,
  Textarea,
} from '../../components/ui';
import { TriangleAlert } from '../../icons/glyphs';
import { Spinner } from '../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui';
import { CloudUpload } from '../../icons';
import { useDocumentTypes, useUploadTemplate } from './hooks/useDocuments';
import { useTranslation } from '../../hooks/useTranslation';

interface TemplateUploadProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TemplateUpload: React.FC<TemplateUploadProps> = ({ open, onClose, onSuccess }) => {
  const { t } = useTranslation();
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
    setFile(null);
    if (f) {
      if (!f.name.toLowerCase().endsWith('.html')
          || (f.type && f.type !== 'text/html')) {
        setError(t('documents.onlyOdt'));
        return;
      }
      if (f.size === 0 || f.size > 5 * 1024 * 1024) {
        setError(t('documents.htmlSizeLimit', 'Le modèle HTML doit contenir entre 1 octet et 5 Mo.'));
        return;
      }
      setFile(f);
      if (!name) setName(f.name.replace(/\.html$/i, ''));
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!file || !name || !documentType) {
      setError(t('common.fillRequiredFields'));
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
      setError(err instanceof Error ? err.message : t('documents.uploadError'));
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
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('documents.upload.title')}</DialogTitle>
        </DialogHeader>
        {error && <Alert variant="destructive" className="mb-3">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>}

        <div className="mt-1.5 flex flex-col gap-3">
          {/* Zone de dépôt — Baitly UI (pas encore de primitive dropzone dans le kit) */}
          <label
            className={cn(
              'border-2 border-dashed rounded-xl p-[18px] text-center cursor-pointer',
              'transition-[border-color,background-color] duration-150 motion-reduce:transition-none',
              'hover:border-primary hover:bg-primary-soft',
              file ? 'border-success bg-success-soft' : 'border-border bg-field',
            )}
          >
            <input type="file" accept=".html" hidden onChange={handleFileChange} aria-label={t('documents.upload.selectFile')} />
            <span className={cn('inline-flex mb-1.5', file ? 'text-success' : 'text-faint')}><CloudUpload size={40} strokeWidth={1.75} /></span>
            <p className="text-sm font-medium">
              {file ? file.name : 'Cliquez pour sélectionner un fichier .html'}
            </p>
            {file && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            )}
          </label>

          <Field>
            <FieldLabel htmlFor="template-name">{t('documents.upload.name')}</FieldLabel>
            <Input
              id="template-name"
              className="w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="template-document-type">{t('documents.upload.documentType')}</FieldLabel>
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

          {/* FieldSeparator = le primitif « filet a legende centree » du kit,
              equivalent direct du <Divider> a enfant. */}
          <FieldSeparator className="my-1.5">
            <span className="text-xs text-muted-foreground">Configuration email (optionnel)</span>
          </FieldSeparator>

          <Field>
            <FieldLabel htmlFor="template-email-subject">{t('documents.upload.emailSubject')}</FieldLabel>
            <Input
              id="template-email-subject"
              className="w-full"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder={t('documents.upload.emailSubjectPlaceholder')}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="template-email-body">{t('documents.upload.emailBody')}</FieldLabel>
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
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={loading}>Annuler</Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={loading || !file || !name || !documentType}
          >
            {loading ? <Spinner className="size-4" /> : <CloudUpload />}
            {loading ? 'Upload...' : 'Uploader & scanner'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateUpload;
