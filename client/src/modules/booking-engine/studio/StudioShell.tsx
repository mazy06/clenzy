import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, ButtonBase, Tooltip } from '@mui/material';
import {
  ChevronLeft,
  Command as CommandIcon,
  Monitor,
  Tablet,
  Smartphone,
  Wand2,
  Compass,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import type { StudioMode } from './studioMode';

/**
 * Baitly Studio — coquille structurelle (F0) : topbar (projet + preview controls + Publier) +
 * rail latéral de sections + zone de contenu. Tokens « Baitly Signature » (var(--accent) indigo).
 * Props-driven : le contenu par section est fourni par le parent (StudioPage / sections F1-F5).
 */

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

export interface StudioSection {
  key: string;
  label: string;
  icon: LucideIcon;
}

export interface StudioShellProps {
  projectName: string;
  sections: StudioSection[];
  activeSection: string;
  onSectionChange: (key: string) => void;
  previewCurrency: string;
  onPreviewCurrencyChange: (currency: string) => void;
  breakpoint: Breakpoint;
  onBreakpointChange: (bp: Breakpoint) => void;
  onOpenCommand: () => void;
  /** Ouvre la modale « Analyse du design » (analyse IA d'un site → thème du widget). */
  onAnalyzeDesign?: () => void;
  /** Mode d'édition courant (Guidé / Avancé) — affiché seulement si `onModeChange` est fourni. */
  mode?: StudioMode;
  /** Bascule le mode d'édition. Si absent, le sélecteur n'est pas rendu. */
  onModeChange?: (mode: StudioMode) => void;
  onBack?: () => void;
  children: ReactNode;
}

const TOPBAR_H = 56;
const RAIL_W = 76;

export default function StudioShell({
  projectName,
  sections,
  activeSection,
  onSectionChange,
  previewCurrency,
  onPreviewCurrencyChange,
  breakpoint,
  onBreakpointChange,
  onOpenCommand,
  onAnalyzeDesign,
  mode,
  onModeChange,
  onBack,
  children,
}: StudioShellProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'var(--bg)', color: 'var(--ink)' }}>
      {/* ── Topbar ───────────────────────────────────────────────── */}
      <Box
        component="header"
        sx={{
          height: TOPBAR_H,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 1.5,
          borderBottom: '1px solid var(--line)',
          bgcolor: 'var(--card)',
        }}
      >
        {onBack && (
          <ButtonBase
            onClick={onBack}
            aria-label="Retour"
            sx={iconBtnSx}
          >
            <ChevronLeft size={20} strokeWidth={2} />
          </ButtonBase>
        )}
        <Box sx={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-lg)', mr: 1, whiteSpace: 'nowrap' }}>
          {projectName}
        </Box>

        <ButtonBase
          onClick={onOpenCommand}
          sx={{
            ml: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            height: 32,
            px: 1.25,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--line-2)',
            color: 'var(--muted)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            transition: 'border-color var(--duration-fast) var(--ease-out)',
            '&:hover': { borderColor: 'var(--accent)', color: 'var(--ink)' },
            '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
          }}
        >
          <CommandIcon size={14} strokeWidth={2} />
          <Box component="span">Rechercher / actions</Box>
          <Box component="span" sx={{ ml: 0.5, fontSize: 'var(--text-2xs)', opacity: 0.7 }}>⌘K</Box>
        </ButtonBase>

        {onAnalyzeDesign && (
          <Tooltip title="Analyse du design (IA)">
            <ButtonBase onClick={onAnalyzeDesign} aria-label="Analyse du design" sx={iconBtnSx}>
              <Wand2 size={18} strokeWidth={2} />
            </ButtonBase>
          </Tooltip>
        )}

        <Box sx={{ flex: 1 }} />

        {/* Sélecteur de mode d'édition (Guidé / Avancé) */}
        {mode && onModeChange && <ModeToggle value={mode} onChange={onModeChange} />}

        {/* Breakpoint switcher */}
        <SegmentedBreakpoint value={breakpoint} onChange={onBreakpointChange} />

        {/* La langue d'ÉDITION se choisit dans la barre de langues de l'éditeur (Design), pas ici. */}

        {/* Devise de preview */}
        <PreviewSelect value={previewCurrency} onChange={onPreviewCurrencyChange}
          options={['EUR', 'MAD', 'SAR']} ariaLabel="Devise de preview" />
        {/* La publication se fait par page dans l'éditeur GrapesJS (badge Brouillon/Publié + bouton
            Publier), modèle draft/live multi-pages. Pas de bouton « Publier » global dans la topbar. */}
      </Box>

      {/* ── Body : rail + contenu ────────────────────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Box
          component="nav"
          aria-label="Sections du Studio"
          sx={{
            width: RAIL_W,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 0.5,
            py: 1.5,
            px: 1,
            borderRight: '1px solid var(--line)',
            bgcolor: 'var(--surface-2)',
          }}
        >
          {sections.map((s) => {
            const active = s.key === activeSection;
            const Icon = s.icon;
            return (
              <Tooltip key={s.key} title={s.label} placement="right">
                <ButtonBase
                  onClick={() => onSectionChange(s.key)}
                  aria-current={active ? 'page' : undefined}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0.25,
                    py: 1,
                    borderRadius: 'var(--radius-md)',
                    color: active ? 'var(--accent)' : 'var(--muted)',
                    bgcolor: active ? 'var(--accent-soft)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)',
                    '&:hover': { color: 'var(--ink)', bgcolor: active ? 'var(--accent-soft)' : 'var(--hover)' },
                    '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
                  }}
                >
                  <Icon size={17} strokeWidth={active ? 2 : 1.75} />
                  <Box component="span" sx={{ fontSize: 'var(--text-2xs)', fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-medium)' }}>
                    {s.label}
                  </Box>
                </ButtonBase>
              </Tooltip>
            );
          })}
        </Box>

        {/* overflowX hidden = la zone principale du Studio ne défile JAMAIS horizontalement
            (le scroll horizontal appartient à un widget précis, jamais à « l'écran »). */}
        <Box component="main" sx={{ flex: 1, minWidth: 0, overflowX: 'hidden', overflowY: 'auto' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

const iconBtnSx = {
  width: 32,
  height: 32,
  borderRadius: 'var(--radius-md)',
  color: 'var(--muted)',
  cursor: 'pointer',
  transition: 'background var(--duration-fast) var(--ease-out)',
  '&:hover': { bgcolor: 'var(--hover)', color: 'var(--ink)' },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
} as const;

function SegmentedBreakpoint({ value, onChange }: { value: Breakpoint; onChange: (b: Breakpoint) => void }) {
  const items: { key: Breakpoint; icon: LucideIcon; label: string }[] = [
    { key: 'desktop', icon: Monitor, label: 'Bureau' },
    { key: 'tablet', icon: Tablet, label: 'Tablette' },
    { key: 'mobile', icon: Smartphone, label: 'Mobile' },
  ];
  return (
    <Box sx={{ display: 'flex', gap: 0.25, p: 0.25, borderRadius: 'var(--radius-md)', bgcolor: 'var(--field)' }}>
      {items.map(({ key, icon: Icon, label }) => {
        const active = key === value;
        return (
          <Tooltip key={key} title={label}>
            <ButtonBase
              onClick={() => onChange(key)}
              aria-label={label}
              aria-pressed={active}
              sx={{
                width: 30,
                height: 28,
                borderRadius: 'var(--radius-sm)',
                color: active ? 'var(--accent)' : 'var(--muted)',
                bgcolor: active ? 'var(--card)' : 'transparent',
                boxShadow: active ? 'var(--shadow-card)' : 'none',
                cursor: 'pointer',
                '&:hover': { color: 'var(--ink)' },
                '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
              }}
            >
              <Icon size={15} strokeWidth={2} />
            </ButtonBase>
          </Tooltip>
        );
      })}
    </Box>
  );
}

/**
 * Sélecteur de mode d'édition (segmented) : « Guidé » (bridé, façon Lodgify) vs « Avancé » (GrapesJS
 * libre + import). Accessible (aria-pressed, focus visible), tooltips i18n, icônes lucide.
 */
function ModeToggle({ value, onChange }: { value: StudioMode; onChange: (m: StudioMode) => void }) {
  const { t } = useTranslation();
  const items: { key: StudioMode; icon: LucideIcon; label: string; tip: string }[] = [
    {
      key: 'guided',
      icon: Compass,
      label: t('bookingEngine.studio.mode.guided', 'Guidé'),
      tip: t('bookingEngine.studio.mode.guidedTip', 'Édition simplifiée : blocs essentiels, couleurs et typo. Idéal pour démarrer vite.'),
    },
    {
      key: 'advanced',
      icon: SlidersHorizontal,
      label: t('bookingEngine.studio.mode.advanced', 'Avancé'),
      tip: t('bookingEngine.studio.mode.advancedTip', 'Éditeur complet : tous les blocs, calques, réglages et import de design.'),
    },
  ];
  return (
    <Box
      role="group"
      aria-label={t('bookingEngine.studio.mode.label', 'Mode d’édition')}
      sx={{ display: 'flex', gap: 0.25, p: 0.25, borderRadius: 'var(--radius-md)', bgcolor: 'var(--field)' }}
    >
      {items.map(({ key, icon: Icon, label, tip }) => {
        const active = key === value;
        return (
          <Tooltip key={key} title={tip}>
            <ButtonBase
              onClick={() => onChange(key)}
              aria-pressed={active}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                height: 28,
                px: 1,
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-sm)',
                fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-medium)',
                color: active ? 'var(--accent)' : 'var(--muted)',
                bgcolor: active ? 'var(--card)' : 'transparent',
                boxShadow: active ? 'var(--shadow-card)' : 'none',
                cursor: 'pointer',
                transition: 'color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out)',
                '&:hover': { color: active ? 'var(--accent)' : 'var(--ink)' },
                '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
              }}
            >
              <Icon size={15} strokeWidth={2} />
              <Box component="span">{label}</Box>
            </ButtonBase>
          </Tooltip>
        );
      })}
    </Box>
  );
}

function PreviewSelect({
  value, onChange, options, ariaLabel, icon,
}: { value: string; onChange: (v: string) => void; options: string[]; ariaLabel: string; icon?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'var(--muted)' }}>
      {icon}
      <Box
        component="select"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
        sx={{
          height: 30,
          px: 0.75,
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--line-2)',
          bgcolor: 'var(--card)',
          color: 'var(--ink)',
          fontSize: 'var(--text-sm)',
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
          '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 1 },
        }}
      >
        {options.map((o) => <option key={o} value={o}>{o.toUpperCase()}</option>)}
      </Box>
    </Box>
  );
}
