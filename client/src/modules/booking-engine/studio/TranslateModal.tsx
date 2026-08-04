import { useState } from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Spinner } from '../../../components/ui';
import { useTranslation } from 'react-i18next';
import { X, Languages, AlertTriangle } from 'lucide-react';
import type { AutoTranslateResult } from '../../../services/api/sitesApi';

/**
 * Modale « Traduire (IA) » du Studio (auto-traduction P1). Laisse choisir les langues cibles puis délègue
 * la traduction à l'appelant via `onTranslate` (page ou article). Les variantes sont créées EN BROUILLON
 * côté serveur (relecture humaine obligatoire) — jamais publiées automatiquement.
 *
 * Modale présentationnelle : l'appel réseau, le toast et le rafraîchissement sont portés par l'appelant.
 */

export interface TranslateModalProps {
  open: boolean;
  onClose: () => void;
  /** Libellé de la cible (titre de page ou d'article) affiché dans la modale. */
  targetName?: string | null;
  /** Locales cibles proposées (déjà privées de la locale source). */
  availableTargets: string[];
  /** Traduit vers les langues cochées. Doit rejeter en cas d'échec (message affiché). */
  onTranslate: (targets: string[]) => Promise<AutoTranslateResult>;
}

const LOCALE_FALLBACK: Record<string, string> = { fr: 'Français', en: 'Anglais', ar: 'Arabe' };

export default function TranslateModal({ open, onClose, targetName, availableTargets, onTranslate }: TranslateModalProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>([]);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const k = (key: string, fallback: string, opts?: Record<string, unknown>) =>
    t(`bookingEngine.studio.ai.translate.${key}`, fallback, opts);
  const localeLabel = (code: string) =>
    t(`bookingEngine.studio.ai.locales.${({ fr: 'french', en: 'english', ar: 'arabic' } as Record<string, string>)[code] ?? code}`, LOCALE_FALLBACK[code] ?? code.toUpperCase());

  const toggle = (code: string) => {
    setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const canSubmit = selected.length > 0 && !translating;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setTranslating(true);
    setError(null);
    try {
      await onTranslate(selected);
      setSelected([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : k('error', 'La traduction a échoué. Réessayez dans un instant.'));
      setTranslating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !translating) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-[var(--radius-lg)]" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center justify-center w-[32px] h-[32px] rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)] shrink-0">
              <Languages size={18} strokeWidth={2} />
            </div>
            <DialogTitle className="flex-1 font-[family-name:var(--font-display)] text-[var(--text-lg)] font-[family-name:var(--fw-bold)] text-[var(--ink)]">
              {k('title', 'Traduire par IA')}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label={t('common.close', 'Fermer')}
              disabled={translating}
            >
              <X size={18} />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3">
        <div className="text-[var(--text-sm)] text-[var(--muted)] leading-[1.5]">
          {targetName
            ? k('introNamed', 'Choisissez les langues vers lesquelles traduire « {{name}} ». Les variantes sont créées en brouillon, à relire avant publication.', { name: targetName })
            : k('intro', 'Choisissez les langues cibles. Les variantes sont créées en brouillon, à relire avant publication.')}
        </div>

        {availableTargets.length === 0 ? (
          <div className="text-[var(--text-sm)] text-[var(--muted)] text-center py-3">
            {k('noTargets', 'Aucune autre langue disponible à traduire.')}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {availableTargets.map((code) => {
              const checked = selected.includes(code);
              return (
                // Branches litterales : une classe Tailwind ne peut pas naitre
                // d'une valeur d'execution.
                <button
                  type="button"
                  key={code}
                  onClick={() => toggle(code)}
                  aria-pressed={checked}
                  className={
                    'inline-flex items-center justify-center h-[34px] px-2.5 cursor-pointer '
                    + 'rounded-[var(--radius-md)] text-[var(--text-sm)] font-[family-name:var(--fw-medium)] '
                    + 'border border-solid '
                    + '[transition:background-color_var(--duration-fast)_var(--ease-out),border-color_var(--duration-fast)_var(--ease-out)] '
                    + 'hover:border-[var(--accent)] '
                    + 'focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:2px] '
                    + (checked
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]'
                      : 'border-[var(--line)] bg-transparent text-[var(--body)]')
                  }
                >
                  {localeLabel(code)}
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-1.5 p-2 rounded-[var(--radius-md)] bg-[var(--err-soft)] text-[var(--err)] text-[var(--text-sm)]">
            <AlertTriangle size={16} strokeWidth={2} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        <div className="flex justify-end gap-1.5 pt-0.5">
          <Button variant="outline" onClick={onClose} disabled={translating}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {translating
              ? <><Spinner className="size-[15px]" /> {k('translating', 'Traduction…')}</>
              : <><Languages size={16} strokeWidth={2.2} /> {k('submit', 'Traduire')}</>}
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
