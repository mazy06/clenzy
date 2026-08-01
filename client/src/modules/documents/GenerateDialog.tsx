import React, { useState } from 'react';
import { Alert, AlertDescription, Button } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import {
  Field,
  FieldLabel,
  FieldDescription,
  Input,
  NativeSelect,
  NativeSelectOption,
} from '../../components/ui';
import { Dialog, DialogTitle, DialogContent, DialogActions, FormControlLabel, Switch } from '@mui/material';
import { Send } from '../../icons';
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
        {error && <Alert variant="destructive" className="mb-3">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>}

        <div className="mt-1.5 flex flex-col gap-3">
          {/* L'option vide desactivee tient la place de l'etat « rien de
              choisi » : un select natif afficherait sinon la premiere entree
              alors que documentType vaut encore ''. */}
          <Field>
            <FieldLabel htmlFor="generate-document-type">Type de document *</FieldLabel>
            <NativeSelect
              id="generate-document-type"
              className="w-full"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
            >
              <NativeSelectOption value="" disabled>Choisir un type</NativeSelectOption>
              {documentTypes.map((type) => (
                <NativeSelectOption key={type.value} value={type.value}>{type.label}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor="generate-reference-type">Type de référence *</FieldLabel>
            <NativeSelect
              id="generate-reference-type"
              className="w-full"
              value={referenceType}
              onChange={(e) => setReferenceType(e.target.value)}
            >
              {REFERENCE_TYPES.map((type) => (
                <NativeSelectOption key={type.value} value={type.value}>{type.label}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor="generate-reference-id">ID de référence *</FieldLabel>
            <Input
              id="generate-reference-id"
              type="number"
              className="tabular-nums"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              placeholder="Ex: 42"
            />
            <FieldDescription>ID de l'intervention, demande, bien ou utilisateur</FieldDescription>
          </Field>

          <FormControlLabel
            control={<Switch checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />}
            label="Envoyer par email"
          />

          {sendEmail && (
            <Field>
              <FieldLabel htmlFor="generate-email-to">Adresse email du destinataire</FieldLabel>
              <Input
                id="generate-email-to"
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="client@example.com"
              />
            </Field>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button variant="ghost" size="sm" onClick={handleClose} disabled={loading}>Annuler</Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={loading || !documentType || !referenceId}
        >
          {loading ? <Spinner className="size-4" /> : <Send />}
          {loading ? 'Génération...' : 'Générer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GenerateDialog;
