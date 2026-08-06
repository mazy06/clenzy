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
 * rail latéral de sections + zone de contenu. Peinture Baitly UI (palette `--bui-*`).
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
    <div className="flex flex-col h-[100vh] bg-background text-foreground">
      {/* ── Topbar ───────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center gap-[9px] px-[9px] border-b border-border bg-card" style={{ height: TOPBAR_H }}>
        {onBack && (
          <button type="button" onClick={onBack} aria-label="Retour" className={ICON_BTN_CLASS}>
            <ChevronLeft size={20} strokeWidth={2} />
          </button>
        )}
        <div className="text-base font-semibold tracking-tight me-1.5 whitespace-nowrap">
          {projectName}
        </div>

        <button
          type="button"
          onClick={onOpenCommand}
          className="ms-1.5 flex items-center gap-[4.5px] h-8 px-[7.5px] text-xs rounded-lg border border-border text-muted-foreground cursor-pointer transition-colors duration-150 ease-out-quart hover:border-primary hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <CommandIcon size={14} strokeWidth={2} />
          <span>Rechercher / actions</span>
          <span className="ms-0.5 text-2xs opacity-70">⌘K</span>
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
        <nav className="shrink-0 flex flex-col items-stretch gap-[3px] py-[9px] px-1.5 border-e border-border bg-card" style={{ width: RAIL_W }} aria-label="Sections du Studio">
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
                        ? 'text-primary bg-primary-soft hover:bg-primary-soft'
                        : 'text-muted-foreground bg-transparent hover:bg-muted')
                    }
                  >
                    <Icon size={17} strokeWidth={active ? 2 : 1.75} />
                    <span className={'text-2xs ' + (active ? 'font-semibold' : 'font-medium')}>
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
  'w-8 h-8 inline-flex items-center justify-center rounded-lg text-muted-foreground cursor-pointer '
  + 'transition-colors duration-150 ease-out-quart '
  + 'hover:bg-muted hover:text-foreground '
  + 'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2';

// Entree du rail lateral. Les deux etats sont passes en branches LITTERALES par
// l'appelant : une classe Tailwind ne peut pas naitre d'une variable.
const RAIL_BTN_CLASS =
  'flex flex-col items-center gap-[1.5px] py-1.5 rounded-lg cursor-pointer '
  + 'transition-colors duration-150 ease-out-quart hover:text-foreground '
  + 'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2';

// Segment du commutateur de breakpoint (30x28).
const SEG_BTN_CLASS =
  'w-[30px] h-7 inline-flex items-center justify-center rounded-md cursor-pointer '
  + 'hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2';

const items: { key: Breakpoint; icon: LucideIcon; label: string }[] = [
  { key: 'desktop', icon: Monitor, label: 'Bureau' },
  { key: 'tablet', icon: Tablet, label: 'Tablette' },
  { key: 'mobile', icon: Smartphone, label: 'Mobile' },
];

function SegmentedBreakpoint({ value, onChange }: { value: Breakpoint; onChange: (b: Breakpoint) => void }) {
  return (
    <div className="flex gap-0.5 p-0.5 rounded-lg bg-field">
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
                    ? 'text-primary bg-card shadow-sm'
                    : 'text-muted-foreground bg-transparent shadow-none')
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
const SEG_CLASS =
  'inline-flex items-center gap-[3px] h-7 px-1.5 text-xs rounded-md '
  + 'transition-colors duration-150 ease-out-quart '
  + 'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2';

function ViewToggle({ onOpenAssistant }: { onOpenAssistant: () => void }) {
  return (
    <div className="flex gap-0.5 p-0.5 rounded-lg bg-field" role="group" aria-label="Vue du studio">
      {/* Avancé — vue courante (active) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            aria-pressed
            className={SEG_CLASS + ' font-semibold text-primary bg-card shadow-sm'}
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
            className={SEG_CLASS + ' cursor-pointer font-medium text-muted-foreground hover:text-foreground hover:bg-muted'}
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
    <div className="flex items-center gap-0.5 text-muted-foreground">
      {icon}
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-[30px] px-[4.5px] text-xs font-[inherit] rounded-lg border border-border bg-card text-foreground cursor-pointer focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1"
      >
        {options.map((o) => <option key={o} value={o}>{o.toUpperCase()}</option>)}
      </select>
    </div>
  );
}
