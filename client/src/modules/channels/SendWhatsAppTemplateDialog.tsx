import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
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
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : !groups || groups.length === 0 ? (
          <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
            Aucun template disponible.
          </Typography>
        ) : (
          <RadioGroup value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>
            {groups.map((g) => (
              <FormControlLabel
                key={g.templateKey}
                value={g.templateKey}
                control={<Radio size="small" sx={{ alignSelf: 'flex-start', pt: 0.5 }} />}
                sx={{ alignItems: 'flex-start', mb: 1, mr: 0, '& .MuiFormControlLabel-label': { width: '100%' } }}
                label={
                  <Box sx={{ py: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>{formatKey(g.templateKey)}</Typography>
                      <Chip
                        label={g.category}
                        size="small"
                        sx={{ height: 16, fontSize: '0.5625rem', fontWeight: 600, bgcolor: 'action.hover' }}
                      />
                    </Box>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'pre-wrap', mt: 0.25 }}>
                      {(() => { const b = bodyOf(g); return b.length > 160 ? `${b.slice(0, 160)}…` : b; })()}
                    </Typography>
                  </Box>
                }
              />
            ))}
          </RadioGroup>
        )}
        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mt: 1, fontStyle: 'italic' }}>
          Les variables (ex. {'{guestFirstName}'}) seront remplacées par les infos de la réservation.
          En OpenWA, le template part comme texte rendu.
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mt: 1, fontSize: '0.8125rem' }}>
            Échec de l'envoi du template. Réessayez.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          Annuler
        </Button>
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={!selectedKey || sending}
          sx={{ textTransform: 'none' }}
        >
          {sending ? 'Envoi…' : 'Envoyer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
