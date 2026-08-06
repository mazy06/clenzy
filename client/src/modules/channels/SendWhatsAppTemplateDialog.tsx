import React, { useState, useEffect } from 'react';
import { Badge } from '../../components/ui';
import { Alert, AlertDescription, Button } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  RadioGroup,
  RadioGroupItem,
} from '../../components/ui';
import { useWhatsAppTemplatesList } from '../../hooks/useWhatsAppTemplates';
import type { WhatsAppTemplateGroup } from '../../services/api/whatsappTemplatesApi';

interface SendWhatsAppTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  /** Envoi délégué au parent (conversation OU réservation). */
  onSend: (templateKey: string) => void;
  sending: boolean;
  error: boolean;
}

const PREFERRED_LANG = 'fr_FR';

function bodyOf(group: WhatsAppTemplateGroup): string {
  const content = group.languages[PREFERRED_LANG] ?? Object.values(group.languages)[0];
  return content?.bodyNamed ?? '';
}

function formatKey(key: string): string {
  const s = key.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Dialog de sélection + envoi d'un template WhatsApp. Réutilisable : le parent
 * fournit la logique d'envoi via {@code onSend} (conversation ou réservation).
 * Les variables sont interpolées côté serveur ; en OpenWA le template part en
 * texte rendu.
 */
export default function SendWhatsAppTemplateDialog({
  open,
  onClose,
  onSend,
  sending,
  error,
}: SendWhatsAppTemplateDialogProps) {
  const { data: groups, isLoading } = useWhatsAppTemplatesList();
  const [selectedKey, setSelectedKey] = useState('');

  useEffect(() => {
    if (open) setSelectedKey('');
  }, [open]);

  const handleSend = () => {
    if (selectedKey) onSend(selectedKey);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Envoyer un template</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Spinner className="size-6" />
          </div>
        ) : !groups || groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun template disponible.
          </p>
        ) : (
          <RadioGroup value={selectedKey} onValueChange={setSelectedKey}>
            {groups.map((g) => (
              <Field key={g.templateKey} orientation="horizontal">
                <RadioGroupItem value={g.templateKey} id={`wa-template-${g.templateKey}`} />
                <FieldContent>
                  <FieldLabel htmlFor={`wa-template-${g.templateKey}`} className="flex items-center gap-1">
                    <span className="text-sm font-semibold">{formatKey(g.templateKey)}</span>
                    <Badge variant="secondary" className="h-[16px] text-2xs font-semibold">{g.category}</Badge>
                  </FieldLabel>
                  <FieldDescription className="text-xs text-muted-foreground whitespace-pre-wrap mt-0.5">
                    {(() => { const b = bodyOf(g); return b.length > 160 ? `${b.slice(0, 160)}…` : b; })()}
                  </FieldDescription>
                </FieldContent>
              </Field>
            ))}
          </RadioGroup>
        )}
        <p className="text-xs text-muted-foreground mt-1.5 italic">
          Les variables (ex. {'{guestFirstName}'}) seront remplacées par les infos de la réservation.
          En OpenWA, le template part comme texte rendu.
        </p>
        {error && (
          <Alert variant="destructive" className="mt-1.5 text-sm">
            <TriangleAlert />
            <AlertDescription>Échec de l'envoi du template. Réessayez.</AlertDescription>
          </Alert>
        )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSend} disabled={!selectedKey || sending}>
            {sending ? 'Envoi…' : 'Envoyer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
