import { useMemo } from 'react';
import { Box, InputBase } from '@mui/material';
import type { BookingEngineConfig, DesignTokens } from '../../../../services/api/bookingEngineApi';
import { SelectControl } from '../settings/settingsControls';

/**
 * Inspecteur de thème (onglet « Thème », étape 1 — édition granulaire des design tokens).
 * Édite couleur + polices (miroir sur les champs config primaryColor/fontFamily pour cohérence)
 * et les tokens (police de titre, taille de base, rayon, ombre) dans config.designTokens.
 * Tout se répercute en direct (canvas + aperçu) et se persiste via la barre d'enregistrement.
 */

const FONTS = ['Inter', 'Poppins', 'Montserrat', 'Playfair Display', 'Lora', 'Merriweather', 'Work Sans', 'Nunito', 'system-ui'];
const FONT_OPTIONS = FONTS.map((f) => ({ value: f, label: f }));

const SIZE_OPTIONS = [
  { value: '14px', label: 'Compacte (14)' },
  { value: '15px', label: 'Moyenne (15)' },
  { value: '16px', label: 'Normale (16)' },
  { value: '17px', label: 'Confort (17)' },
];
const RADIUS_OPTIONS = [
  { value: '0px', label: 'Carré' },
  { value: '6px', label: 'Léger' },
  { value: '12px', label: 'Arrondi' },
  { value: '18px', label: 'Très arrondi' },
];
const SHADOW_OPTIONS = [
  { value: 'none', label: 'Aucune' },
  { value: '0 1px 3px rgba(0,0,0,0.08)', label: 'Légère' },
  { value: '0 4px 14px rgba(0,0,0,0.10)', label: 'Moyenne' },
  { value: '0 14px 36px rgba(0,0,0,0.16)', label: 'Prononcée' },
];
const DENSITY_OPTIONS = [
  { value: 'compact', label: 'Compacte' },
  { value: 'normal', label: 'Normale' },
  { value: 'spacious', label: 'Spacieuse' },
];
const BUTTON_OPTIONS = [
  { value: 'filled', label: 'Plein' },
  { value: 'outlined', label: 'Contour' },
];

const SWATCHES = ['#5453D6', '#0F7A6B', '#C2410C', '#B91C6B', '#1D4ED8', '#15803D', '#7C3AED', '#0E7490'];

export interface ThemeInspectorProps {
  config: BookingEngineConfig | null;
  patch: (changes: Partial<BookingEngineConfig>) => void;
}

export default function ThemeInspector({ config, patch }: ThemeInspectorProps) {
  const tokens = useMemo<DesignTokens>(() => {
    if (!config?.designTokens) return {};
    try { return JSON.parse(config.designTokens) as DesignTokens; } catch { return {}; }
  }, [config?.designTokens]);

  if (!config) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3, color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>
        Chargement du thème…
      </Box>
    );
  }

  const writeTokens = (changes: Partial<DesignTokens>) =>
    patch({ designTokens: JSON.stringify({ ...tokens, ...changes }) });
  // Couleur/police : miroir sur les champs config (consommés en priorité par les legacy) + tokens.
  const setColor = (v: string) => patch({ primaryColor: v, designTokens: JSON.stringify({ ...tokens, primaryColor: v }) });
  const setBodyFont = (v: string) => patch({ fontFamily: v, designTokens: JSON.stringify({ ...tokens, bodyFontFamily: v }) });

  const primary = tokens.primaryColor || config.primaryColor || '#5453D6';
  const bodyFont = config.fontFamily || tokens.bodyFontFamily || 'Inter';
  const headingFont = tokens.headingFontFamily || bodyFont;
  const baseSize = tokens.baseFontSize || '16px';
  const radius = tokens.borderRadius || '12px';
  const shadow = tokens.cardShadow || tokens.boxShadow || 'none';
  const density = tokens.spacing || 'normal';
  const buttonStyle = tokens.buttonStyle || 'filled';

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      {/* Couleur */}
      <Box>
        <Box component="label" htmlFor="theme-primary" sx={labelSx}>Couleur principale</Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
          <Box component="input" id="theme-primary" type="color" value={primary}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColor(e.target.value)}
            sx={{ width: 38, height: 38, p: 0, border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', bgcolor: 'transparent', cursor: 'pointer', flexShrink: 0, '&::-webkit-color-swatch-wrapper': { p: '3px' }, '&::-webkit-color-swatch': { border: 'none', borderRadius: 6 } }}
          />
          <InputBase value={primary} onChange={(e) => setColor(e.target.value)}
            sx={{ flex: 1, px: 1.25, py: 0.75, fontSize: 'var(--text-md)', fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink)', bgcolor: 'var(--field)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', '&.Mui-focused': { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)' } }}
          />
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
          {SWATCHES.map((c) => (
            <Box key={c} component="button" type="button" aria-label={`Couleur ${c}`} onClick={() => setColor(c)}
              sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: c, cursor: 'pointer', p: 0,
                border: primary.toLowerCase() === c.toLowerCase() ? '2px solid var(--ink)' : '2px solid transparent',
                boxShadow: '0 0 0 1px var(--line)', '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 } }}
            />
          ))}
        </Box>
      </Box>

      <Field label="Police du corps" htmlFor="theme-bodyfont">
        <SelectControl id="theme-bodyfont" value={bodyFont} onChange={setBodyFont} options={FONT_OPTIONS} />
      </Field>
      <Field label="Police des titres" htmlFor="theme-headfont">
        <SelectControl id="theme-headfont" value={headingFont} onChange={(v) => writeTokens({ headingFontFamily: v })} options={FONT_OPTIONS} />
      </Field>
      <Field label="Taille de texte" htmlFor="theme-size">
        <SelectControl id="theme-size" value={baseSize} onChange={(v) => writeTokens({ baseFontSize: v })} options={SIZE_OPTIONS} />
      </Field>
      <Field label="Rayon des coins" htmlFor="theme-radius">
        <SelectControl id="theme-radius" value={radius}
          onChange={(v) => writeTokens({ borderRadius: v, cardBorderRadius: v, buttonBorderRadius: v })} options={RADIUS_OPTIONS} />
      </Field>
      <Field label="Ombre des cartes" htmlFor="theme-shadow">
        <SelectControl id="theme-shadow" value={shadow}
          onChange={(v) => writeTokens({ boxShadow: v, cardShadow: v })} options={SHADOW_OPTIONS} />
      </Field>
      <Field label="Densité" htmlFor="theme-density">
        <SelectControl id="theme-density" value={density} onChange={(v) => writeTokens({ spacing: v })} options={DENSITY_OPTIONS} />
      </Field>
      <Field label="Style des boutons" htmlFor="theme-btn">
        <SelectControl id="theme-btn" value={buttonStyle} onChange={(v) => writeTokens({ buttonStyle: v })} options={BUTTON_OPTIONS} />
      </Field>

      <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--faint)', lineHeight: 1.5 }}>
        Couleur, polices, rayon et ombre se reflètent dans l’aperçu. Taille, densité et style de bouton s’appliquent au widget de réservation sur la page publiée.
      </Box>
    </Box>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <Box>
      <Box component="label" htmlFor={htmlFor} sx={{ ...labelSx, display: 'block', mb: 0.75 }}>{label}</Box>
      {children}
    </Box>
  );
}

const labelSx = {
  fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--body)',
} as const;
