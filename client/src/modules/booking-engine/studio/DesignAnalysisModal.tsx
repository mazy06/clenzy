import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui';
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
    // maxWidth="sm" + fullWidth MUI = pleine largeur plafonnee a 600 px. La croix
    // de fermeture est celle du primitif : l'IconButton du titre faisait doublon.
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="w-full sm:max-w-[600px] rounded-[var(--radius-lg)]">
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-[family-name:var(--fw-bold)] text-[var(--ink)] pe-8">
            Analyse du design
          </DialogTitle>
        </DialogHeader>
        <div>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
