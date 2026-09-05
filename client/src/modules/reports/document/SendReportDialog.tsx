import React, { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Spinner,
} from '../../../components/ui';
import { Plus, TriangleAlert, X } from 'lucide-react';
import { getParsedAccessToken } from '../../../keycloak';
import { cn } from '../../../utils/cn';
import {
  reportDocumentsApi,
  type ReportDocumentSummary,
} from '../../../services/api/reportDocumentsApi';

/**
 * A qui transmettre le rapport.
 *
 * <p>L'envoi partait auparavant sans rien demander, a la seule adresse du
 * destinataire. Un releve se copie pourtant souvent — un co-indivisaire, un
 * comptable, soi-meme pour archive — et l'alternative etait de le renvoyer a la
 * main depuis sa messagerie, hors de toute trace.</p>
 *
 * <p>Les adresses connues sont PROPOSEES, jamais imposees : celle du
 * destinataire est cochee, la sienne ne l'est pas. Envoyer un document a
 * quelqu'un est irreversible ; ce qui part doit avoir ete coche.</p>
 */
interface SendReportDialogProps {
  document: ReportDocumentSummary | null;
  onClose: () => void;
  onSent: () => void;
}

const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

const SendReportDialog: React.FC<SendReportDialogProps> = ({ document, onClose, onSent }) => {
  const own = getParsedAccessToken()?.email as string | undefined;

  /** Les adresses proposees, dans l'ordre ou on les coche. */
  const suggestions = useMemo(() => {
    const list: Array<{ email: string; label: string; checked: boolean }> = [];
    if (document?.recipientEmail) {
      list.push({
        email: document.recipientEmail,
        label: document.recipientName || 'Destinataire du rapport',
        checked: true,
      });
    }
    if (own && own !== document?.recipientEmail) {
      list.push({ email: own, label: 'Vous, en copie', checked: false });
    }
    return list;
  }, [document?.recipientEmail, document?.recipientName, own]);

  const [selected, setSelected] = useState<string[]>([]);
  const [extras, setExtras] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [openedFor, setOpenedFor] = useState<number | null>(null);

  // Le document change : on repart des adresses proposees pour CE document.
  if (document && openedFor !== document.id) {
    setOpenedFor(document.id);
    setSelected(suggestions.filter((item) => item.checked).map((item) => item.email));
    setExtras([]);
    setDraft('');
  }

  const sendMutation = useMutation({
    mutationFn: () => reportDocumentsApi.send(document!.id, selected),
    onSuccess: () => {
      onSent();
      onClose();
    },
  });

  const toggle = (email: string) =>
    setSelected((current) =>
      current.includes(email) ? current.filter((item) => item !== email) : [...current, email]);

  const addDraft = () => {
    const address = draft.trim().toLowerCase();
    if (!EMAIL.test(address) || selected.includes(address)) return;
    setExtras((current) => (current.includes(address) ? current : [...current, address]));
    setSelected((current) => [...current, address]);
    setDraft('');
  };

  const draftIsValid = EMAIL.test(draft.trim().toLowerCase());

  return (
    <Dialog open={document != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Envoyer le rapport</DialogTitle>
          <DialogDescription>
            {document?.title}
            {document ? ` · ${document.documentNumber}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            {suggestions.map((item) => (
              <Recipient
                key={item.email}
                email={item.email}
                label={item.label}
                checked={selected.includes(item.email)}
                onToggle={() => toggle(item.email)}
              />
            ))}
            {extras.map((email) => (
              <Recipient
                key={email}
                email={email}
                label="Ajoutée à la main"
                checked={selected.includes(email)}
                onToggle={() => toggle(email)}
                onRemove={() => {
                  setExtras((current) => current.filter((item) => item !== email));
                  setSelected((current) => current.filter((item) => item !== email));
                }}
              />
            ))}
            {suggestions.length === 0 && extras.length === 0 && (
              <p className="m-0 text-xs text-muted-foreground">
                Ce rapport n’a pas de destinataire enregistré. Ajoutez une adresse ci-dessous.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="email"
              placeholder="Ajouter une adresse"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addDraft();
                }
              }}
            />
            <Button size="sm" variant="outline" disabled={!draftIsValid} onClick={addDraft}>
              <Plus className="size-3.5" />
              Ajouter
            </Button>
          </div>

          {sendMutation.isError && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>
                L’envoi a échoué. Vérifiez les adresses, puis réessayez.
              </AlertDescription>
            </Alert>
          )}

          {/* L'envoi vaut relecture : le dire ici, au moment ou la decision se
              prend, et non dans une aide qu'on ne lit pas. */}
          <p className="m-0 text-2xs text-muted-foreground">
            Le PDF part en pièce jointe, au nom de votre organisation. Le rapport passe alors au
            statut « envoyé » et ne peut plus être modifié : toute reprise crée une nouvelle version.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button
            size="sm"
            disabled={selected.length === 0 || sendMutation.isPending}
            onClick={() => sendMutation.mutate()}
          >
            {sendMutation.isPending ? <Spinner /> : null}
            {sendMutation.isPending
              ? 'Envoi…'
              : `Envoyer à ${selected.length} destinataire${selected.length > 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Recipient: React.FC<{
  email: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
  onRemove?: () => void;
}> = ({ email, label, checked, onToggle, onRemove }) => (
  <div
    className={cn(
      'flex items-center gap-2 rounded-md border px-3 py-2 transition-colors duration-200',
      checked ? 'border-primary bg-primary/5' : 'border-border',
    )}
  >
    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
      <input type="checkbox" className="cursor-pointer" checked={checked} onChange={onToggle} />
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-foreground">{email}</span>
        <span className="block truncate text-2xs text-muted-foreground">{label}</span>
      </span>
    </label>
    {onRemove ? (
      <button
        type="button"
        title="Retirer"
        aria-label={`Retirer ${email}`}
        onClick={onRemove}
        className="cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    ) : null}
  </div>
);

export default SendReportDialog;
