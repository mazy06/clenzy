import { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
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
          <button type="button" onClick={onBack} aria-label="Retour" className={ICON_BTN_CLASS}>
            <ChevronLeft size={20} strokeWidth={2} />
          </button>
        )}
        <div className="font-[family-name:var(--fw-semibold)] text-[var(--text-lg)] me-1.5 whitespace-nowrap">
          {projectName}
        </div>

        {/* fontSize en style : `text-[var(--text-sm)]` est ambigu en Tailwind v4
            (taille ou couleur) — meme raison que pour SEG_CLASS plus bas. */}
        <button
          type="button"
          onClick={onOpenCommand}
          className="ms-1.5 flex items-center gap-[4.5px] h-8 px-[7.5px] rounded-[var(--radius-md)] border border-solid border-[var(--line-2)] text-[var(--muted)] cursor-pointer transition-[border-color] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-[var(--accent)] hover:text-[var(--ink)] focus-visible:[outline:2px_solid_var(--accent)] focus-visible:outline-offset-2"
          style={{ fontSize: 'var(--text-sm)' }}
        >
          <CommandIcon size={14} strokeWidth={2} />
          <span>Rechercher / actions</span>
          <span className="ms-0.5 text-[var(--text-2xs)] opacity-70">⌘K</span>
        </button>

        {onAnalyzeDesign && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={onAnalyzeDesign} aria-label="Analyse du design" className={ICON_BTN_CLASS}>
                <Wand2 size={18} strokeWidth={2} />
              </button>
            </TooltipTrigger>
            <TooltipContent>Analyse du design (IA)</TooltipContent>
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
              <Tooltip key={s.key}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onSectionChange(s.key)}
                    aria-current={active ? 'page' : undefined}
                    className={
                      RAIL_BTN_CLASS + ' '
                      + (active
                        ? 'text-[var(--accent)] bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)]'
                        : 'text-[var(--muted)] bg-transparent hover:bg-[var(--hover)]')
                    }
                  >
                    <Icon size={17} strokeWidth={active ? 2 : 1.75} />
                    <span className="text-[var(--text-2xs)]" style={{ fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-medium)' }}>
                      {s.label}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{s.label}</TooltipContent>
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

// Bouton-icone 32px de la topbar (report de l'ancien `iconBtnSx`).
const ICON_BTN_CLASS =
  'w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-md)] text-[var(--muted)] cursor-pointer '
  + 'transition-[background,color] duration-[var(--duration-fast)] ease-[var(--ease-out)] '
  + 'hover:bg-[var(--hover)] hover:text-[var(--ink)] '
  + 'focus-visible:[outline:2px_solid_var(--accent)] focus-visible:outline-offset-2';

// Entree du rail lateral. Les deux etats sont passes en branches LITTERALES par
// l'appelant : une classe Tailwind ne peut pas naitre d'une variable.
const RAIL_BTN_CLASS =
  'flex flex-col items-center gap-[1.5px] py-1.5 rounded-[var(--radius-md)] cursor-pointer '
  + 'transition-[background,color] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:text-[var(--ink)] '
  + 'focus-visible:[outline:2px_solid_var(--accent)] focus-visible:outline-offset-2';

// Segment du commutateur de breakpoint (30x28).
const SEG_BTN_CLASS =
  'w-[30px] h-7 inline-flex items-center justify-center rounded-[var(--radius-sm)] cursor-pointer '
  + 'hover:text-[var(--ink)] focus-visible:[outline:2px_solid_var(--accent)] focus-visible:outline-offset-2';

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
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onChange(key)}
                aria-label={label}
                aria-pressed={active}
                className={
                  SEG_BTN_CLASS + ' '
                  + (active
                    ? 'text-[var(--accent)] bg-[var(--card)] shadow-[var(--shadow-card)]'
                    : 'text-[var(--muted)] bg-transparent shadow-none')
                }
              >
                <Icon size={15} strokeWidth={2} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
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
// Segment du commutateur de vue (fontSize/fontWeight restent en style :
// `text-[var(...)]` / `font-[var(...)]` sont ambigus en Tailwind v4).
const SEG_CLASS =
  'inline-flex items-center gap-[3px] h-7 px-1.5 rounded-[var(--radius-sm)] '
  + 'transition-[color,background] duration-[var(--duration-fast)] ease-[var(--ease-out)] '
  + 'focus-visible:[outline:2px_solid_var(--accent)] focus-visible:outline-offset-2';

function ViewToggle({ onOpenAssistant }: { onOpenAssistant: () => void }) {
  return (
    <div className="flex gap-0.5 p-0.5 rounded-[var(--radius-md)] bg-[var(--field)]" role="group" aria-label="Vue du studio">
      {/* Avancé — vue courante (active) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            aria-pressed
            className={SEG_CLASS + ' text-[var(--accent)] bg-[var(--card)] shadow-[var(--shadow-card)]'}
            style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)' }}
          >
            <SlidersHorizontal size={15} strokeWidth={2} />
            <span>Avancé</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>Éditeur complet : tous les blocs, calques, réglages et import de design.</TooltipContent>
      </Tooltip>
      {/* Assistant — bascule vers l'aperçu immersif + chat */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onOpenAssistant}
            className={SEG_CLASS + ' cursor-pointer text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--hover)]'}
            style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)' }}
          >
            <Sparkles size={15} strokeWidth={2} />
            <span>Assistant</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Aperçu live + assistant design : décrivez vos modifications en langage naturel.</TooltipContent>
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
