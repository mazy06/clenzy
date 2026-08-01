import { ReactNode } from 'react';
import { ButtonBase, Tooltip } from '@mui/material';
import {
  ChevronLeft,
  Command as CommandIcon,
  Monitor,
  Tablet,
  Smartphone,
  Wand2,
  Sparkles,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';

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
  /** Bascule vers le studio IMMERSIF (aperçu live + assistant design). Si absent, l'onglet n'est pas rendu. */
  onOpenAssistant?: () => void;
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
  onOpenAssistant,
  onBack,
  children,
}: StudioShellProps) {
  return (
    <div className="flex flex-col h-[100vh] bg-[var(--bg)] text-[var(--ink)]">
      {/* ── Topbar ───────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center gap-[9px] px-[9px] bg-[var(--card)]" style={{ height: TOPBAR_H, borderBottom: '1px solid var(--line)' }}>
        {onBack && (
          <ButtonBase
            onClick={onBack}
            aria-label="Retour"
            sx={iconBtnSx}
          >
            <ChevronLeft size={20} strokeWidth={2} />
          </ButtonBase>
        )}
        <div className="font-[family-name:var(--fw-semibold)] text-[var(--text-lg)] me-1.5 whitespace-nowrap">
          {projectName}
        </div>

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
          <span>Rechercher / actions</span>
          <span className="ms-0.5 text-[var(--text-2xs)] opacity-70">⌘K</span>
        </ButtonBase>

        {onAnalyzeDesign && (
          <Tooltip title="Analyse du design (IA)">
            <ButtonBase onClick={onAnalyzeDesign} aria-label="Analyse du design" sx={iconBtnSx}>
              <Wand2 size={18} strokeWidth={2} />
            </ButtonBase>
          </Tooltip>
        )}

        <div className="flex-1" />

        {/* Bascule de vue : « Avancé » (éditeur courant) ↔ « Assistant » (studio immersif + chat) */}
        {onOpenAssistant && <ViewToggle onOpenAssistant={onOpenAssistant} />}

        {/* Breakpoint switcher */}
        <SegmentedBreakpoint value={breakpoint} onChange={onBreakpointChange} />

        {/* La langue d'ÉDITION se choisit dans la barre de langues de l'éditeur (Design), pas ici. */}

        {/* Devise de preview */}
        <PreviewSelect value={previewCurrency} onChange={onPreviewCurrencyChange}
          options={['EUR', 'MAD', 'SAR']} ariaLabel="Devise de preview" />
        {/* La publication se fait par page dans l'éditeur GrapesJS (badge Brouillon/Publié + bouton
            Publier), modèle draft/live multi-pages. Pas de bouton « Publier » global dans la topbar. */}
      </header>

      {/* ── Body : rail + contenu ────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">
        <nav className="shrink-0 flex flex-col items-stretch gap-[3px] py-[9px] px-1.5 border-e-[1px_solid_var(--line)] bg-[var(--surface-2)]" style={{ width: RAIL_W }} aria-label="Sections du Studio">
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
                  <span className="text-[var(--text-2xs)]" style={{ fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-medium)' }}>
                    {s.label}
                  </span>
                </ButtonBase>
              </Tooltip>
            );
          })}
        </nav>

        {/* overflowX hidden = la zone principale du Studio ne défile JAMAIS horizontalement
            (le scroll horizontal appartient à un widget précis, jamais à « l'écran »). */}
        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
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

const items: { key: Breakpoint; icon: LucideIcon; label: string }[] = [
  { key: 'desktop', icon: Monitor, label: 'Bureau' },
  { key: 'tablet', icon: Tablet, label: 'Tablette' },
  { key: 'mobile', icon: Smartphone, label: 'Mobile' },
];

function SegmentedBreakpoint({ value, onChange }: { value: Breakpoint; onChange: (b: Breakpoint) => void }) {
  return (
    <div className="flex gap-0.5 p-0.5 rounded-[var(--radius-md)] bg-[var(--field)]">
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
    </div>
  );
}

/**
 * Bascule de VUE du studio (segmented) : « Avancé » = l'éditeur GrapesJS complet (vue COURANTE, active)
 * ↔ « Assistant » = bascule vers le studio IMMERSIF (aperçu live + chat pour modifier le site en langage
 * naturel). Remplace l'ancien mode « Guidé/Avancé » (le guidé a été retiré).
 */
const seg = {
  display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 28, px: 1,
  borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)',
  transition: 'color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out)',
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
} as const;

// Equivalent Tailwind de `seg` pour le segment non interactif (fontSize/fontWeight
// restent en style : `text-[var(...)]` / `font-[var(...)]` sont ambigus en Tailwind v4).
const SEG_CLASS =
  'inline-flex items-center gap-[3px] h-7 px-1.5 rounded-[var(--radius-sm)] '
  + 'transition-[color,background] duration-[var(--duration-fast)] ease-[var(--ease-out)] '
  + 'focus-visible:[outline:2px_solid_var(--accent)] focus-visible:outline-offset-2';

function ViewToggle({ onOpenAssistant }: { onOpenAssistant: () => void }) {
  return (
    <div className="flex gap-0.5 p-0.5 rounded-[var(--radius-md)] bg-[var(--field)]" role="group" aria-label="Vue du studio">
      {/* Avancé — vue courante (active) */}
      <Tooltip title="Éditeur complet : tous les blocs, calques, réglages et import de design.">
        <div
          aria-pressed
          className={SEG_CLASS + ' text-[var(--accent)] bg-[var(--card)] shadow-[var(--shadow-card)]'}
          style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)' }}
        >
          <SlidersHorizontal size={15} strokeWidth={2} />
          <span>Avancé</span>
        </div>
      </Tooltip>
      {/* Assistant — bascule vers l'aperçu immersif + chat */}
      <Tooltip title="Aperçu live + assistant design : décrivez vos modifications en langage naturel.">
        <ButtonBase
          onClick={onOpenAssistant}
          sx={{ ...seg, cursor: 'pointer', fontWeight: 'var(--fw-medium)', color: 'var(--muted)', '&:hover': { color: 'var(--ink)', bgcolor: 'var(--hover)' } }}
        >
          <Sparkles size={15} strokeWidth={2} />
          <span>Assistant</span>
        </ButtonBase>
      </Tooltip>
    </div>
  );
}

function PreviewSelect({
  value, onChange, options, ariaLabel, icon,
}: { value: string; onChange: (v: string) => void; options: string[]; ariaLabel: string; icon?: ReactNode }) {
  return (
    <div className="flex items-center gap-0.5 text-[var(--muted)]">
      {icon}
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-[30px] px-[4.5px] rounded-[var(--radius-md)] border border-solid border-[var(--line-2)] bg-[var(--card)] text-[var(--ink)] cursor-pointer focus-visible:[outline:2px_solid_var(--accent)] focus-visible:outline-offset-1"
        style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)' }}
      >
        {options.map((o) => <option key={o} value={o}>{o.toUpperCase()}</option>)}
      </select>
    </div>
  );
}
