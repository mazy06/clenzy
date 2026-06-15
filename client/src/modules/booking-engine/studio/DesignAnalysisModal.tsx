import { useState } from 'react';
import { Dialog, DialogContent, IconButton, Box } from '@mui/material';
import { X } from 'lucide-react';
import AiDesignMatcher from '../AiDesignMatcher';
import type { DesignTokens } from '../../../services/api/bookingEngineApi';

/**
 * Modale « Analyse du design » du Studio (reprise de la feature de l'ancienne config).
 * Réutilise {@link AiDesignMatcher} (saisie URL + analyse IA → tokens + CSS) et applique le design
 * extrait au booking engine courant (widget + blocs) via `onApply`.
 */
export interface DesignAnalysisModalProps {
  open: boolean;
  onClose: () => void;
  configId: number | null;
  initialUrl: string;
  onApply: (tokens: DesignTokens, generatedCss: string) => void;
}

export default function DesignAnalysisModal({ open, onClose, configId, initialUrl, onApply }: DesignAnalysisModalProps) {
  const [url, setUrl] = useState(initialUrl);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 'var(--radius-lg)' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, pt: 2, pb: 1 }}>
        <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--ink)' }}>
          Analyse du design
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Fermer"><X size={18} /></IconButton>
      </Box>
      <DialogContent sx={{ pt: 1 }}>
        <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', mb: 2, lineHeight: 1.5 }}>
          Renseigne l’URL du site du client : l’IA en extrait les couleurs/typo et applique le design
          au widget de réservation et aux blocs de la page.
        </Box>
        <AiDesignMatcher
          configId={configId}
          sourceWebsiteUrl={url}
          onSourceWebsiteUrlChange={setUrl}
          onTokensExtracted={(tokens, css) => onApply(tokens, css)}
        />
      </DialogContent>
    </Dialog>
  );
}
