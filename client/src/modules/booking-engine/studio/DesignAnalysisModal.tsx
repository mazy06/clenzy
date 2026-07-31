import { useState } from 'react';
import { Dialog, DialogContent, IconButton } from '@mui/material';
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
      <div className="flex items-center justify-between px-3.5 pt-3 pb-1.5">
        <div className="font-[var(--font-display)] text-[var(--text-lg)] font-[var(--fw-bold)] text-[var(--ink)]">
          Analyse du design
        </div>
        <IconButton onClick={onClose} size="small" aria-label="Fermer"><X size={18} /></IconButton>
      </div>
      <DialogContent sx={{ pt: 1 }}>
        <div className="text-[var(--text-sm)] text-[var(--muted)] mb-3 leading-[1.5]">
          Renseigne l’URL du site du client : l’IA en extrait les couleurs/typo et applique le design
          au widget de réservation et aux blocs de la page.
        </div>
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
