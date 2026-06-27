import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, IconButton, Box, ButtonBase, CircularProgress,
} from '@mui/material';
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
    <Dialog
      open={open}
      onClose={() => { if (!translating) onClose(); }}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 'var(--radius-lg)' } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, pt: 2, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent-soft)', color: 'var(--accent)', flexShrink: 0 }}>
          <Languages size={18} strokeWidth={2} />
        </Box>
        <Box sx={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--ink)' }}>
          {k('title', 'Traduire par IA')}
        </Box>
        <IconButton onClick={onClose} size="small" aria-label={t('common.close', 'Fermer')} disabled={translating}><X size={18} /></IconButton>
      </Box>

      <DialogContent sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', lineHeight: 1.5 }}>
          {targetName
            ? k('introNamed', 'Choisissez les langues vers lesquelles traduire « {{name}} ». Les variantes sont créées en brouillon, à relire avant publication.', { name: targetName })
            : k('intro', 'Choisissez les langues cibles. Les variantes sont créées en brouillon, à relire avant publication.')}
        </Box>

        {availableTargets.length === 0 ? (
          <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', textAlign: 'center', py: 2 }}>
            {k('noTargets', 'Aucune autre langue disponible à traduire.')}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {availableTargets.map((code) => {
              const checked = selected.includes(code);
              return (
                <ButtonBase
                  key={code}
                  onClick={() => toggle(code)}
                  aria-pressed={checked}
                  sx={{
                    height: 34, px: 1.5, borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--fw-medium)', cursor: 'pointer',
                    border: '1px solid', borderColor: checked ? 'var(--accent)' : 'var(--line)',
                    color: checked ? 'var(--on-accent)' : 'var(--body)',
                    bgcolor: checked ? 'var(--accent)' : 'transparent',
                    transition: 'background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out)',
                    '&:hover': { borderColor: 'var(--accent)' },
                    '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
                  }}
                >
                  {localeLabel(code)}
                </ButtonBase>
              );
            })}
          </Box>
        )}

        {error && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.25, borderRadius: 'var(--radius-md)', bgcolor: 'var(--err-soft)', color: 'var(--err)', fontSize: 'var(--text-sm)' }}>
            <AlertTriangle size={16} strokeWidth={2} style={{ flexShrink: 0 }} /> {error}
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 0.5 }}>
          <ButtonBase onClick={onClose} disabled={translating} sx={ghostBtnSx}>
            {t('common.cancel', 'Annuler')}
          </ButtonBase>
          <ButtonBase onClick={handleSubmit} disabled={!canSubmit} sx={primaryBtnSx}>
            {translating
              ? <><CircularProgress size={15} thickness={5} sx={{ color: 'var(--on-accent)' }} /> {k('translating', 'Traduction…')}</>
              : <><Languages size={16} strokeWidth={2.2} /> {k('submit', 'Traduire')}</>}
          </ButtonBase>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

const primaryBtnSx = {
  display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 38, px: 2, flexShrink: 0,
  borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent)', color: 'var(--on-accent)',
  fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-sm)', cursor: 'pointer',
  transition: 'background var(--duration-fast) var(--ease-out)',
  '&:hover': { bgcolor: 'var(--accent-deep)' }, '&.Mui-disabled': { opacity: 0.5, cursor: 'not-allowed' },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
} as const;

const ghostBtnSx = {
  display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 38, px: 1.75, flexShrink: 0,
  borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', color: 'var(--body)',
  fontWeight: 'var(--fw-medium)', fontSize: 'var(--text-sm)', cursor: 'pointer',
  transition: 'border-color var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)',
  '&:hover': { borderColor: 'var(--accent)', color: 'var(--ink)' }, '&.Mui-disabled': { opacity: 0.5 },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
} as const;
