import { STORAGE_KEYS } from '../../services/storageService';

/**
 * Teinte d'accent « Signature » — paramétrable par l'utilisateur (handoff §1).
 *
 * Mécanique 100% CSS : poser `data-accent="…"` sur <html> suffit à reteinter
 * toute l'UI (les composants ne lisent que --accent / --accent-deep /
 * --accent-soft, cf. tokens.css). Ici on ne gère que la persistance per-device
 * (anti-FOUC, lecture synchrone au boot — même pattern que clenzy_theme_mode)
 * et l'application de l'attribut.
 */

export type AccentName =
  | 'emeraude'
  | 'terracotta'
  | 'ambre'
  | 'indigo'
  | 'violet'
  | 'ocean'
  | 'slate';

export const DEFAULT_ACCENT: AccentName = 'emeraude';

/** Pastilles du sélecteur de teinte (couleur = valeur claire des tokens). */
export const ACCENT_OPTIONS: ReadonlyArray<{ value: AccentName; label: string; swatch: string }> = [
  { value: 'emeraude', label: 'Émeraude', swatch: '#2E8B6F' },
  { value: 'terracotta', label: 'Terracotta', swatch: '#C0613B' },
  { value: 'ambre', label: 'Ambre', swatch: '#C58B36' },
  { value: 'indigo', label: 'Indigo', swatch: '#5453D6' },
  { value: 'violet', label: 'Violet', swatch: '#8A4FD0' },
  { value: 'ocean', label: 'Océan', swatch: '#2C6BD8' },
  { value: 'slate', label: 'Slate', swatch: '#5F7E8C' },
];

function isValidAccent(value: unknown): value is AccentName {
  return ACCENT_OPTIONS.some((o) => o.value === value);
}

export function getSavedAccent(): AccentName {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.ACCENT);
    if (isValidAccent(saved)) return saved;
  } catch {
    // Silent fail (Safari private mode, etc.)
  }
  return DEFAULT_ACCENT;
}

export function applyAccent(accent: AccentName): void {
  document.documentElement.setAttribute('data-accent', accent);
}

export function setAccent(accent: AccentName): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACCENT, accent);
  } catch {
    // Silent fail
  }
  applyAccent(accent);
}

/**
 * Pose `data-theme` sur <html> (les tokens sombres s'activent via
 * [data-theme="dark"]). Le clair est le défaut :root → on retire l'attribut.
 */
export function applyThemeAttribute(isDark: boolean): void {
  if (isDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

/**
 * Boot synchrone (avant le premier render) — anti-FOUC : applique la teinte
 * sauvegardée + le mode résolu depuis clenzy_theme_mode (même clé/sémantique
 * que useThemeMode, dupliquée ici car ce code doit tourner hors React).
 */
export function applyThemeAttributesAtBoot(): void {
  applyAccent(getSavedAccent());
  let mode: string | null = null;
  try {
    mode = localStorage.getItem('clenzy_theme_mode');
  } catch {
    // Silent fail
  }
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyThemeAttribute(mode === 'dark' || (mode !== 'light' && prefersDark));
}
