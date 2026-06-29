import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, IconButton, Box, InputBase, ButtonBase, CircularProgress,
} from '@mui/material';
import { X, Sparkles, AlertTriangle } from 'lucide-react';
import type { SiteGenerationBrief } from '../../../services/api/sitesApi';
import SiteGenerationProgress from './SiteGenerationProgress';

/**
 * Modale « Générer mon site par IA » du Studio (P2.a). Recueille un brief minimal (type de bien, ton,
 * nom de marque, couleur, langues) puis délègue la génération à l'appelant via `onGenerate`. Les pages
 * produites sont créées EN BROUILLON côté serveur (relecture humaine obligatoire avant publication).
 *
 * Modale présentationnelle : l'appel réseau, le toast de succès et le rafraîchissement de la liste de
 * pages sont portés par l'appelant (cf. {@link StudioHome}). Reprend le style de `DesignAnalysisModal`.
 */

export interface SiteGenerationModalProps {
  open: boolean;
  onClose: () => void;
  /** Génère le site à partir du brief. Doit rejeter en cas d'échec (message affiché dans la modale). */
  onGenerate: (brief: SiteGenerationBrief) => Promise<void>;
  /** Brief pré-assemblé par le constructeur de prompt du Studio (champ hero + chips). Pré-remplit les
   *  champs éditables (type/ton/couleur/langues) ; les champs structurés non éditables ici (audience,
   *  objectif, gamme, lieu, devise, points forts, pages) sont CONSERVÉS et renvoyés tels quels. */
  initialBrief?: Partial<SiteGenerationBrief>;
  /** Récapitulatif lisible des champs structurés portés (affiché en lecture seule). */
  recap?: string;
}

/** Langues proposées (alignées sur les locales supportées du Studio). */
const LANGUAGE_CHOICES = [
  { code: 'fr', labelKey: 'french', fallback: 'Français' },
  { code: 'en', labelKey: 'english', fallback: 'Anglais' },
  { code: 'ar', labelKey: 'arabic', fallback: 'Arabe' },
] as const;

/**
 * Champs pondérés par leur impact sur la qualité de la génération. Pilote la jauge de complétude :
 * plus le brief est riche et spécifique, meilleur est le prompt envoyé au LLM. `hint` = nudge affiché
 * pour les champs manquants à plus fort impact.
 */
const COMPLETENESS_FIELDS: { present: (b: Partial<SiteGenerationBrief>) => boolean; weight: number; hint: string }[] = [
  { present: (b) => !!b.propertyType?.trim(), weight: 25, hint: 'décrivez le type de biens' },
  { present: (b) => !!b.location, weight: 12, hint: 'ajoutez une localisation (SEO local)' },
  { present: (b) => !!(b.usps && b.usps.length), weight: 12, hint: 'listez vos points forts' },
  { present: (b) => !!b.audience, weight: 10, hint: 'précisez la clientèle cible' },
  { present: (b) => !!b.goal, weight: 8, hint: "définissez l'objectif principal" },
  { present: (b) => !!b.tone, weight: 8, hint: 'choisissez un ton' },
  { present: (b) => !!b.tier, weight: 7, hint: 'indiquez le niveau de gamme' },
  { present: (b) => !!b.brandName?.trim(), weight: 6, hint: 'renseignez le nom de marque' },
  { present: (b) => !!b.primaryColorHint, weight: 6, hint: 'définissez une couleur' },
  { present: (b) => !!(b.languages && b.languages.length), weight: 6, hint: 'sélectionnez les langues' },
];

/** Score de complétude (0-100) + les 2 nudges manquants à plus fort impact. */
function briefCompleteness(b: Partial<SiteGenerationBrief>): { score: number; hints: string[] } {
  let got = 0;
  let total = 0;
  const missing: { w: number; h: string }[] = [];
  for (const f of COMPLETENESS_FIELDS) {
    total += f.weight;
    if (f.present(b)) got += f.weight;
    else missing.push({ w: f.weight, h: f.hint });
  }
  missing.sort((x, y) => y.w - x.w);
  return { score: Math.round((got / total) * 100), hints: missing.slice(0, 2).map((m) => m.h) };
}

export default function SiteGenerationModal({ open, onClose, onGenerate, initialBrief, recap }: SiteGenerationModalProps) {
  const { t } = useTranslation();
  const [propertyType, setPropertyType] = useState('');
  const [tone, setTone] = useState('');
  const [brandName, setBrandName] = useState('');
  const [primaryColorHint, setPrimaryColorHint] = useState('');
  const [languages, setLanguages] = useState<string[]>(['fr']);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Aucun modèle IA exploitable (422 AI_NOT_CONFIGURED / AI_FEATURE_DISABLED) → modale d'indisponibilité.
  const [unavailable, setUnavailable] = useState(false);

  // À chaque ouverture (déclenchée par le champ hero), pré-remplit les champs éditables depuis le brief
  // assemblé par le constructeur de prompt. Les champs structurés (audience, pages…) sont portés tels
  // quels via `initialBrief` (cf. handleSubmit). `initialBrief` est mémoïsé côté StudioHome → identité
  // stable tant que la modale est ouverte (pas de réinitialisation pendant l'édition).
  useEffect(() => {
    if (!open) return;
    const b = initialBrief ?? {};
    setPropertyType(b.propertyType?.trim() ?? '');
    setPrimaryColorHint(/^#[0-9a-fA-F]{6}$/.test(b.primaryColorHint ?? '') ? (b.primaryColorHint as string) : '');
    setTone(b.tone ?? '');
    if (b.languages && b.languages.length) setLanguages(b.languages);
    setError(null);
    setUnavailable(false);
  }, [open, initialBrief]);

  const k = (key: string, fallback: string) => t(`bookingEngine.studio.ai.generate.${key}`, fallback);

  const toggleLanguage = (code: string) => {
    setLanguages((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const canSubmit = propertyType.trim().length > 0 && languages.length > 0 && !generating;

  // Jauge de complétude : reflète le brief complet (champs structurés portés + champs éditables courants).
  const { score: briefScore, hints: briefHints } = briefCompleteness({
    ...initialBrief,
    propertyType,
    tone: tone || null,
    brandName: brandName || null,
    primaryColorHint: primaryColorHint || null,
    languages,
  });
  const briefScoreColor = briefScore >= 80 ? 'var(--ok, #3E8E7E)' : briefScore >= 50 ? 'var(--accent)' : 'var(--warn, #D4A574)';

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setGenerating(true);
    setError(null);
    try {
      await onGenerate({
        // Champs structurés portés par le constructeur de prompt (audience, objectif, pages…)…
        ...initialBrief,
        // …puis les champs éditables de la modale prennent le dessus.
        propertyType: propertyType.trim(),
        tone: tone.trim() || null,
        brandName: brandName.trim() || null,
        primaryColorHint: primaryColorHint.trim() || null,
        // La 1re langue est la langue source rédigée par le LLM (les autres en auto-traduction).
        languages,
      });
    } catch (e) {
      // 422 AI_NOT_CONFIGURED / AI_FEATURE_DISABLED → aucun modèle exploitable : modale d'indisponibilité
      // (les admins ont déjà été notifiés côté serveur). Sinon : message d'erreur générique.
      const err = e as { status?: number; details?: { errorCode?: string } };
      const code = err?.details?.errorCode;
      if (err?.status === 422 && (code === 'AI_NOT_CONFIGURED' || code === 'AI_FEATURE_DISABLED')) {
        setUnavailable(true);
      } else {
        setError(e instanceof Error ? e.message : k('error', 'La génération a échoué. Réessayez dans un instant.'));
      }
      setGenerating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => { if (!generating) onClose(); }}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 'var(--radius-lg)' } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, pt: 2, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent-soft)', color: 'var(--accent)', flexShrink: 0 }}>
          <Sparkles size={18} strokeWidth={2} />
        </Box>
        <Box sx={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--ink)' }}>
          {k('title', 'Générer mon site par IA')}
        </Box>
        <IconButton onClick={onClose} size="small" aria-label={t('common.close', 'Fermer')} disabled={generating}><X size={18} /></IconButton>
      </Box>

      <DialogContent sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {unavailable ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 1.5, py: 3 }}>
            <Box sx={{ width: 48, height: 48, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'var(--err-soft)', color: 'var(--err, #c0392b)' }}>
              <AlertTriangle size={26} strokeWidth={2} />
            </Box>
            <Box sx={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--ink)' }}>
              {k('unavailableTitle', 'Génération IA indisponible')}
            </Box>
            <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', lineHeight: 1.5, maxWidth: 380 }}>
              {k('unavailableBody', "Aucun modèle IA n'est disponible pour la génération de site pour le moment. Les administrateurs ont été notifiés et vont rétablir le service. Réessayez plus tard.")}
            </Box>
            <ButtonBase onClick={onClose} sx={primaryBtnSx}>{k('unavailableClose', 'Fermer')}</ButtonBase>
          </Box>
        ) : generating ? (
          <SiteGenerationProgress brandLabel={brandName.trim() || null} />
        ) : (
        <>
        <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', lineHeight: 1.5 }}>
          {k('intro', "Décrivez votre activité : l'IA rédige et structure un site complet (selon les pages choisies) et dérive un thème. Les pages sont créées en brouillon — à relire avant publication.")}
        </Box>

        {recap ? (
          <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--body)', bgcolor: 'var(--accent-soft)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', px: 1.25, py: 1, lineHeight: 1.5 }}>
            <Box component="span" sx={{ fontWeight: 'var(--fw-semibold)', color: 'var(--ink)' }}>{k('briefRecap', 'Brief')} : </Box>
            {recap}
          </Box>
        ) : null}

        {/* Jauge de complétude du brief : plus il est riche, meilleur est le prompt envoyé au LLM. */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-2xs)', color: 'var(--muted)', mb: 0.5 }}>
            <span>{k('completeness', 'Complétude du brief')}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: briefScoreColor }}>{briefScore}%</span>
          </Box>
          <Box sx={{ height: 6, borderRadius: 999, bgcolor: 'var(--line)', overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${briefScore}%`, bgcolor: briefScoreColor, transition: 'width var(--duration-fast) var(--ease-out)' }} />
          </Box>
          {briefScore < 100 && briefHints.length > 0 ? (
            <Box sx={{ mt: 0.5, fontSize: 'var(--text-2xs)', color: 'var(--muted)' }}>
              {k('completenessHint', 'Pour un meilleur résultat')} : {briefHints.join(' · ')}
            </Box>
          ) : null}
        </Box>

        <Field label={k('propertyTypeLabel', 'Type de biens')} required>
          <InputBase
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            placeholder={k('propertyTypePlaceholder', 'Ex. riads de luxe à Marrakech, appartements urbains…')}
            sx={inputSx}
            autoFocus
          />
        </Field>

        <Field label={k('toneLabel', 'Ton souhaité')}>
          <InputBase
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder={k('tonePlaceholder', 'Ex. chaleureux et authentique, épuré et moderne…')}
            sx={inputSx}
          />
        </Field>

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Field label={k('brandLabel', 'Nom de marque')}>
            <InputBase
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder={k('brandPlaceholder', 'Optionnel')}
              sx={inputSx}
            />
          </Field>
          <Field label={k('colorLabel', 'Couleur principale')}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box
                component="input"
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(primaryColorHint) ? primaryColorHint : '#5453D6'}
                onChange={(e) => setPrimaryColorHint((e.target as HTMLInputElement).value)}
                aria-label={k('colorPickerLabel', 'Choisir une couleur')}
                sx={{ width: 38, height: 38, p: 0, border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', bgcolor: 'var(--field)', cursor: 'pointer', flexShrink: 0 }}
              />
              <InputBase
                value={primaryColorHint}
                onChange={(e) => setPrimaryColorHint(e.target.value)}
                placeholder={k('colorPlaceholder', 'Auto')}
                sx={{ ...inputSx, flex: 1 }}
              />
            </Box>
          </Field>
        </Box>

        <Field label={k('languagesLabel', 'Langues à générer')} required>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {LANGUAGE_CHOICES.map((lang) => {
              const selected = languages.includes(lang.code);
              return (
                <ButtonBase
                  key={lang.code}
                  onClick={() => toggleLanguage(lang.code)}
                  aria-pressed={selected}
                  sx={{
                    height: 34, px: 1.5, borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--fw-medium)', cursor: 'pointer',
                    border: '1px solid', borderColor: selected ? 'var(--accent)' : 'var(--line)',
                    color: selected ? 'var(--on-accent)' : 'var(--body)',
                    bgcolor: selected ? 'var(--accent)' : 'transparent',
                    transition: 'background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out)',
                    '&:hover': { borderColor: 'var(--accent)' },
                    '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
                  }}
                >
                  {t(`bookingEngine.studio.ai.locales.${lang.labelKey}`, lang.fallback)}
                </ButtonBase>
              );
            })}
          </Box>
          <Box sx={{ mt: 0.75, fontSize: 'var(--text-2xs)', color: 'var(--muted)' }}>
            {k('languagesHint', 'La première langue sélectionnée est rédigée par l’IA ; les autres sont produites par auto-traduction (à relire).')}
          </Box>
        </Field>

        {error && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.25, borderRadius: 'var(--radius-md)', bgcolor: 'var(--err-soft)', color: 'var(--err)', fontSize: 'var(--text-sm)' }}>
            <AlertTriangle size={16} strokeWidth={2} style={{ flexShrink: 0 }} /> {error}
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 0.5 }}>
          <ButtonBase onClick={onClose} disabled={generating} sx={ghostBtnSx}>
            {t('common.cancel', 'Annuler')}
          </ButtonBase>
          <ButtonBase onClick={handleSubmit} disabled={!canSubmit} sx={primaryBtnSx}>
            {generating
              ? <><CircularProgress size={15} thickness={5} sx={{ color: 'var(--on-accent)' }} /> {k('generating', 'Génération…')}</>
              : <><Sparkles size={16} strokeWidth={2.2} /> {k('submit', 'Générer le site')}</>}
          </ButtonBase>
        </Box>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box component="label" sx={{ display: 'block', mb: 0.5, fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--body)' }}>
        {label}{required && <Box component="span" sx={{ color: 'var(--accent)', ml: 0.25 }}>*</Box>}
      </Box>
      {children}
    </Box>
  );
}

const inputSx = {
  width: '100%', px: 1.25, py: 0.75, fontSize: 'var(--text-md)', color: 'var(--ink)',
  bgcolor: 'var(--field)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)',
  '&.Mui-focused': { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)' },
} as const;

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
