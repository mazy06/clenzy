import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui';
import AiDesignMatcher from '../AiDesignMatcher';
import type { DesignTokens } from '../../../services/api/bookingEngineApi';
import { useTranslation } from '../../../hooks/useTranslation';

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
  const { t } = useTranslation();
  const [url, setUrl] = useState(initialUrl);

  return (
    // Pleine largeur plafonnee a 600 px. La croix de fermeture est celle du
    // primitif : un bouton d'icone dans le titre ferait doublon.
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="w-full sm:max-w-[600px] rounded-xl">
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-display)] text-base font-bold text-foreground pe-8">
            {t('studio.designAnalysis.title')}
          </DialogTitle>
        </DialogHeader>
        <div>
          <div className="text-xs text-muted-foreground mb-3 leading-[1.5]">
            {t('studio.designAnalysis.hint')}
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
