import React, { useMemo, useState } from 'react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Separator,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../../../components/ui';
import { Search } from '../../../icons';
import StatusChip, { type ToneTokens } from '../../../components/StatusChip';
import type { TemplateVariable } from '../../../services/api/guestMessagingApi';

/**
 * Sidebar de variables interpolables — chips tonales par categorie (tokens Baitly UI).
 *
 * <h3>Categorisation</h3>
 * Le groupement par categorie facilite la decouverte quand il y a beaucoup de
 * variables. Chaque categorie a son ton semantique (tokens StatusChip) :
 * <ul>
 *   <li>IDENTITÉ → info</li>
 *   <li>PROPRIÉTÉ → ok</li>
 *   <li>DATES & HEURES → warn</li>
 *   <li>ACCÈS → accent</li>
 *   <li>INSTRUCTIONS → muted</li>
 *   <li>LIENS & CODES → err</li>
 * </ul>
 *
 * <p>Les variables systeme HTML-safe ({@code detailsHtml}, {@code urgencyBanner})
 * sont affichees en section warning separee : non insertables (cursor: help),
 * juste pour montrer a l'user qu'elles sont injectees automatiquement par le
 * serveur.</p>
 */

// ─── Tons sémantiques (tokens Baitly UI) ────────────────────────────────────
// L'encre est le jeton `-ink` : ces tons habillent d'abord du TEXTE (puces de
// variables), et la teinte vive plafonne à ~2,2:1 sur `bg-card`. La couleur
// étant résolue à l'exécution, elle reste une valeur CSS — Tailwind n'émet ses
// classes qu'à la compilation.

interface Tone { c: string; bg: string }

const TONES: Record<'ok' | 'accent' | 'warn' | 'err' | 'info' | 'muted', Tone> = {
  ok:     { c: 'var(--bui-success-ink)',     bg: 'var(--bui-success-soft)' },
  accent: { c: 'var(--bui-primary)',         bg: 'var(--bui-primary-soft)' },
  warn:   { c: 'var(--bui-warning-ink)',     bg: 'var(--bui-warning-soft)' },
  err:    { c: 'var(--bui-destructive-ink)', bg: 'var(--bui-destructive-soft)' },
  info:   { c: 'var(--bui-info-ink)',        bg: 'var(--bui-info-soft)' },
  muted:  { c: 'var(--bui-muted-foreground)', bg: 'var(--bui-muted)' },
};

// Le picker parle son propre vocabulaire de tons {c,bg} ; la primitive attend {color,bg}.
const toTokens = (tone: Tone): ToneTokens => ({ color: tone.c, bg: tone.bg });

interface CategoryDef {
  id: string;
  label: string;
  tone: Tone;
}

const CATEGORIES: Record<string, CategoryDef> = {
  guest:        { id: 'guest',        label: 'IDENTITÉ',      tone: TONES.info },
  property:     { id: 'property',     label: 'PROPRIÉTÉ',     tone: TONES.ok },
  dates:        { id: 'dates',        label: 'DATES & HEURES', tone: TONES.warn },
  access:       { id: 'access',       label: 'ACCÈS',         tone: TONES.accent },
  instructions: { id: 'instructions', label: 'INSTRUCTIONS',  tone: TONES.muted },
  links:        { id: 'links',        label: 'LIENS & CODES', tone: TONES.err },
  other:        { id: 'other',        label: 'AUTRES',        tone: TONES.muted },
  uncategorized:{ id: 'uncategorized',label: 'AUTRES',        tone: TONES.muted },
};

const CATEGORY_ORDER = ['guest', 'property', 'dates', 'access', 'instructions', 'links', 'other', 'uncategorized'];

const CATEGORY_OF: Record<string, string> = {
  guestName: 'guest', guestFirstName: 'guest',
  propertyName: 'property', propertyAddress: 'property', emergencyContact: 'property', emergencyPhone: 'property',
  checkInDate: 'dates', checkOutDate: 'dates', checkInTime: 'dates', checkOutTime: 'dates',
  accessCode: 'access', wifiName: 'access', wifiPassword: 'access', parkingInfo: 'access',
  accessMethod: 'access', keyExchangeStoreName: 'access', keyExchangeStoreAddress: 'access',
  keyExchangeStorePhone: 'access', keyExchangeStoreHours: 'access',
  arrivalInstructions: 'instructions', departureInstructions: 'instructions', houseRules: 'instructions',
  checkInLink: 'links', guideLink: 'links', paymentLink: 'links', reviewLink: 'links',
  confirmationCode: 'links',
  locationMap: 'other', paymentAmount: 'other', paymentCurrency: 'other',
};

// ─── Props ──────────────────────────────────────────────────────────────────

interface VariablePickerProps {
  variables: TemplateVariable[];
  usedKeys?: Set<string>;
  onInsert: (key: string) => void;
  /** Variables systeme HTML-safe utilisees — affichees en warning, non insertables. */
  systemVariablesUsed?: string[];
  /** Affiche la section "Detail des variables" sous le picker (defaut: true). */
  showDetails?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

const VariablePicker: React.FC<VariablePickerProps> = ({
  variables,
  usedKeys = new Set(),
  onInsert,
  systemVariablesUsed = [],
  showDetails = true,
}) => {
  const [query, setQuery] = useState('');

  const groupedFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? variables.filter(
          (v) => v.key.toLowerCase().includes(q) || v.description.toLowerCase().includes(q),
        )
      : variables;

    const groups: Record<string, TemplateVariable[]> = {};
    for (const v of filtered) {
      const cat = CATEGORY_OF[v.key] ?? 'uncategorized';
      (groups[cat] ??= []).push(v);
    }
    return CATEGORY_ORDER
      .filter((cat) => groups[cat]?.length)
      .map((cat) => ({ category: cat, def: CATEGORIES[cat], items: groups[cat] }));
  }, [variables, query]);

  return (
    <div className="flex flex-col gap-3">
      {/* Search bar discrete */}
      {variables.length > 10 && (
        <InputGroup className="bg-field">
          <InputGroupAddon align="inline-start">
            <span className="inline-flex text-muted-foreground opacity-60">
              <Search size={14} strokeWidth={1.75} />
            </span>
          </InputGroupAddon>
          {/* Champ de recherche sans libelle visible : le placeholder ne suffit
              pas a un lecteur d'ecran, d'ou l'aria-label. */}
          <InputGroupInput
            id="variable-picker-search"
            aria-label="Filtrer les variables"
            placeholder="Filtrer les variables…"
            className="text-[0.8125rem]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </InputGroup>
      )}

      {/* Variables systeme (HTML-safe, non insertables) */}
      {systemVariablesUsed.length > 0 && (
        <div>
          <SectionHeading label="VARIABLES SYSTÈME" tone={TONES.err} />
          <div className="flex flex-wrap gap-0.5">
            {systemVariablesUsed.map((key) => (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  {/* Le span porte la ref que Radix pose : StatusChip n'en
                      transmet pas (React 18). */}
                  <span className="inline-flex">
                    <StatusChip
                      tokens={toTokens(TONES.err)}
                      label={`{${key}}`}
                      className="font-mono text-[0.72rem] cursor-help"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Contenu HTML généré automatiquement par le serveur. À ne pas supprimer.
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      {/* Groupes user-insertable, chacun avec sa couleur */}
      {groupedFiltered.length === 0 ? (
        <div className="py-4 text-center text-muted-foreground opacity-60">
          <span className="text-xs">Aucune variable ne correspond à « {query} »</span>
        </div>
      ) : (
        groupedFiltered.map((group) => (
          <div key={group.category}>
            <SectionHeading label={group.def.label} tone={group.def.tone} />
            <div className="flex flex-wrap gap-0.5">
              {group.items.map((v) => {
                const isUsed = usedKeys.has(v.key);
                return (
                  <Tooltip key={v.key}>
                    <TooltipTrigger asChild>
                      {/* Le span porte la ref que Radix pose : StatusChip n'en
                          transmet pas (React 18). */}
                      <span className="inline-flex">
                        <StatusChip
                          tokens={toTokens(group.def.tone)}
                          label={`{${v.key}}`}
                          onClick={() => onInsert(v.key)}
                          className={[
                            'font-mono text-[0.72rem]',
                            isUsed
                              ? 'opacity-100 hover:opacity-100 font-bold'
                              : 'opacity-[0.85] hover:opacity-100 font-medium',
                          ].join(' ')}
                          // Le liseré de « déjà utilisée » est teinté par la catégorie :
                          // couleur connue seulement a l'execution, donc style inline.
                          sx={isUsed
                            ? { outline: `1.5px solid ${group.def.tone.c}`, outlineOffset: '-1.5px' }
                            : undefined}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <div className="font-semibold mb-0.5">{v.description}</div>
                      <div className="font-mono text-[0.7rem] opacity-70">
                        ex. « {v.example} »
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Detail des variables (optionnel — pattern MessageTemplateEditor) */}
      {showDetails && variables.length > 0 && (
        <div>
          <Separator className="mb-[9px]" />
          <span className="text-xs font-semibold block mb-[0.35em]">
            Détail des variables
          </span>
          <div className="max-h-[200px] overflow-y-auto">
            {variables.map((v) => (
              <div className="mb-0.5" key={v.key}>
                {/* Teinte de la categorie connue seulement a l'execution : style inline. */}
                <span
                  className="text-xs font-mono font-semibold"
                  style={{ color: CATEGORIES[CATEGORY_OF[v.key] ?? 'uncategorized'].tone.c }}
                >
                  {`{${v.key}}`}
                </span>
                <span className="text-xs text-muted-foreground">
                  {' — '}{v.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── SectionHeading : label small caps avec barre couleur ────────────────────

interface SectionHeadingProps {
  label: string;
  tone: Tone;
}

const SectionHeading: React.FC<SectionHeadingProps> = ({ label, tone }) => (
  <div className="flex items-center gap-1 mb-1">
    <div className="w-[12px] h-[2px] rounded-[8px]" style={{ backgroundColor: tone.c }} />
    <div className="text-[0.65rem] font-semibold tracking-[0.08em] text-muted-foreground">
      {label}
    </div>
  </div>
);

export default VariablePicker;
