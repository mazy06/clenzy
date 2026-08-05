import { useMemo } from 'react';
import { Button, Input } from '../../../../components/ui';
import { cn } from '../../../../utils/cn';
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

const WEIGHT_OPTIONS = [
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semi-bold' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'Extra-bold' },
];

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
      <div className="h-full flex items-center justify-center px-4 text-xs text-muted-foreground">
        Chargement du thème…
      </div>
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
  const headingWeight = tokens.headingFontWeight || '700';
  const baseSize = tokens.baseFontSize || '16px';
  const radius = tokens.borderRadius || '12px';
  const shadow = tokens.cardShadow || tokens.boxShadow || 'none';
  const density = tokens.spacing || 'normal';
  const buttonStyle = tokens.buttonStyle || 'filled';
  const bg = tokens.backgroundColor || '#FFFFFF';

  return (
    <div className="p-3 flex flex-col gap-3.5">
      {/* Couleur */}
      <div>
        <label htmlFor="theme-primary" className={LABEL_CLS}>Couleur principale</label>
        <div className="flex items-center gap-1.5 mt-1">
          <input id="theme-primary" type="color" value={primary}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColor(e.target.value)}
            className={COLOR_INPUT_CLS}
          />
          <Input
            aria-label="Couleur principale (hexadécimal)"
            value={primary}
            onChange={(e) => setColor(e.target.value)}
            className={HEX_INPUT_CLS}
          />
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {SWATCHES.map((c) => (
            // La couleur du pastilleur est une donnee (SWATCHES) : elle ne peut pas
            // devenir une classe Tailwind, generee a la compilation → style inline.
            <button key={c} type="button" aria-label={`Couleur ${c}`} onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={cn(
                'w-[22px] h-[22px] rounded-full cursor-pointer p-0 border-2 border-solid ring-1 ring-border',
                'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                primary.toLowerCase() === c.toLowerCase() ? 'border-foreground' : 'border-transparent',
              )}
            />
          ))}
        </div>
      </div>

      {/* Couleur de fond de la page (site publié). L'éditeur GrapesJS garde, lui, un canvas blanc neutre. */}
      <div>
        <label htmlFor="theme-bg" className={LABEL_CLS}>Couleur de fond</label>
        <div className="flex items-center gap-1.5 mt-1">
          <input id="theme-bg" type="color" value={bg}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => writeTokens({ backgroundColor: e.target.value })}
            className={COLOR_INPUT_CLS}
          />
          <Input
            aria-label="Couleur de fond (hexadécimal)"
            value={bg}
            onChange={(e) => writeTokens({ backgroundColor: e.target.value })}
            className={HEX_INPUT_CLS}
          />
          <Button variant="outline" size="sm" type="button" className="shrink-0 cursor-pointer whitespace-nowrap" onClick={() => writeTokens({ backgroundColor: '#FFFFFF' })}>
            Blanc
          </Button>
        </div>
      </div>

      <Field label="Police du corps" htmlFor="theme-bodyfont">
        <SelectControl id="theme-bodyfont" value={bodyFont} onChange={setBodyFont} options={FONT_OPTIONS} />
      </Field>
      <Field label="Police des titres" htmlFor="theme-headfont">
        <SelectControl id="theme-headfont" value={headingFont} onChange={(v) => writeTokens({ headingFontFamily: v })} options={FONT_OPTIONS} />
      </Field>
      <Field label="Graisse des titres" htmlFor="theme-headweight">
        <SelectControl id="theme-headweight" value={headingWeight} onChange={(v) => writeTokens({ headingFontWeight: v })} options={WEIGHT_OPTIONS} />
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

      <div className="text-2xs text-faint leading-relaxed">
        Couleur, polices, rayon et ombre se reflètent dans l’aperçu. Taille, densité et style de bouton s’appliquent au widget de réservation sur la page publiée.
      </div>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      {/* mb 0.75 = 4.5px (theme.spacing = 6) */}
      <label htmlFor={htmlFor} className={`${LABEL_CLS} block mb-[4.5px]`}>{label}</label>
      {children}
    </div>
  );
}

const LABEL_CLS = 'text-xs font-medium text-foreground';

// Saisie hexadecimale a cote du pastilleur : bordure, fond, rayon et anneau de
// focus viennent du gabarit du primitif ; il ne reste que la mono et la largeur.
const HEX_INPUT_CLS = 'flex-1 min-w-0 text-sm [font-family:var(--font-mono,monospace)]';

const COLOR_INPUT_CLS =
  'w-[38px] h-[38px] p-0 border border-border rounded-lg bg-transparent cursor-pointer shrink-0 ' +
  '[&::-webkit-color-swatch-wrapper]:p-[3px] [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-[48px]';
