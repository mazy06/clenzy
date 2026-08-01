import React, { useState, useEffect } from 'react';
import { Badge } from '../../components/ui';
import { Alert, AlertDescription, Button } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Dialog, DialogTitle, DialogContent, DialogActions, RadioGroup, FormControlLabel, Radio } from '@mui/material';
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600 }}>Envoyer un template</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Spinner className="size-6" />
          </div>
        ) : !groups || groups.length === 0 ? (
          <p className="cn-text-body1 text-[0.8125rem] text-muted-foreground">
            Aucun template disponible.
          </p>
        ) : (
          <RadioGroup value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>
            {groups.map((g) => (
              <FormControlLabel
                key={g.templateKey}
                value={g.templateKey}
                control={<Radio size="small" sx={{ alignSelf: 'flex-start', pt: 0.5 }} />}
                sx={{ alignItems: 'flex-start', mb: 1, mr: 0, '& .MuiFormControlLabel-label': { width: '100%' } }}
                label={
                  <div className="py-0.5">
                    <div className="flex items-center gap-1">
                      <p className="cn-text-body1 text-[0.8125rem] font-semibold">{formatKey(g.templateKey)}</p>
                      <Badge variant="secondary" className="h-[16px] text-[0.5625rem] font-semibold bg-[var(--hover)]">{g.category}</Badge>
                    </div>
                    <p className="cn-text-body1 text-[0.75rem] text-muted-foreground whitespace-pre-wrap mt-0.5">
                      {(() => { const b = bodyOf(g); return b.length > 160 ? `${b.slice(0, 160)}…` : b; })()}
                    </p>
                  </div>
                }
              />
            ))}
          </RadioGroup>
        )}
        <p className="cn-text-body1 text-[0.7rem] text-muted-foreground mt-1.5 italic">
          Les variables (ex. {'{guestFirstName}'}) seront remplacées par les infos de la réservation.
          En OpenWA, le template part comme texte rendu.
        </p>
        {error && (
          <Alert variant="destructive" className="mt-1.5 text-[0.8125rem]">
            <TriangleAlert />
            <AlertDescription>Échec de l'envoi du template. Réessayez.</AlertDescription>
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button onClick={handleSend} disabled={!selectedKey || sending}>
          {sending ? 'Envoi…' : 'Envoyer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
