import StatusChip from './StatusChip';
import { cn } from '../utils/cn';
import React, { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Slider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui';
import { Autorenew, Close as CloseIcon, ContentCopy, CheckCircle, VpnKey as KeyIcon } from '../icons';
import { useTranslation } from '../hooks/useTranslation';

// ─── Types & format ───────────────────────────────────────────────────────────

export type CodeCharType = 'digits' | 'letters' | 'symbols';

export interface CodeFormat {
  /** Type de caractère par position (l'ordre = la position dans le code ; longueur = nb de positions). */
  pattern: CodeCharType[];
  /** Sous-ensemble de lettres autorisées ; vide/undefined = toutes les lettres. */
  letters?: string[];
  /** Sous-ensemble de symboles autorisés ; vide/undefined = tous les symboles. */
  symbols?: string[];
}

const DIGITS = '0123456789'.split('');
const LETTER_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split(''); // 24 — sans I et O (ambigus)
const SYMBOL_CHARS = '#@$%&*?!'.split('');

// Pré-sélection par défaut quand le type est utilisé (l'hôte reste libre de modifier).
const DEFAULT_LETTERS = ['A', 'B'];
const DEFAULT_SYMBOLS = ['#', '*'];

const MIN_LEN = 4;
const MAX_LEN = 16;
const BRAND = '#6B8A9A';

const TYPE_META: Record<CodeCharType, { abbr: string; color: string; labelKey: string; defaultLabel: string }> = {
  digits: { abbr: '0-9', color: '#6B8A9A', labelKey: 'typeDigits', defaultLabel: 'Chiffres' },
  letters: { abbr: 'A-Z', color: '#4A9B8E', labelKey: 'typeLetters', defaultLabel: 'Lettres' },
  symbols: { abbr: '#', color: '#D4A574', labelKey: 'typeSymbols', defaultLabel: 'Symboles' },
};

const TYPE_ORDER: CodeCharType[] = ['digits', 'letters', 'symbols'];
const NEXT_TYPE: Record<CodeCharType, CodeCharType> = { digits: 'letters', letters: 'symbols', symbols: 'digits' };

export const DEFAULT_CODE_FORMAT: CodeFormat = { pattern: Array(6).fill('digits') };

/** Bascule de caractere : tokens pleins a l'etat presse, neutres au repos. */
const toggleTokens = (on: boolean, color: string) =>
  (on ? { color: '#fff', bg: color } : { color: 'var(--muted)', bg: 'var(--hover)' });

// ─── Generation (crypto.getRandomValues, repli Math.random) ───────────────────

function randomInt(max: number): number {
  if (max <= 0) return 0;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % max;
  }
  return Math.floor(Math.random() * max);
}

/** Jeu de caractères effectif pour un type (sous-ensembles lettres/symboles pris en compte). */
function poolFor(type: CodeCharType, format: CodeFormat): string[] {
  if (type === 'digits') return DIGITS;
  if (type === 'letters') return format.letters && format.letters.length ? format.letters : LETTER_CHARS;
  return format.symbols && format.symbols.length ? format.symbols : SYMBOL_CHARS;
}

/** Génère un code en respectant le type de chaque position du patron. */
export function generateCode(format: CodeFormat): string {
  const pattern = (format.pattern && format.pattern.length ? format.pattern : DEFAULT_CODE_FORMAT.pattern);
  return pattern
    .map((type) => {
      const pool = poolFor(type, format);
      return pool.length ? pool[randomInt(pool.length)] : '';
    })
    .join('');
}

function typeOfChar(ch: string): CodeCharType {
  if (/[0-9]/.test(ch)) return 'digits';
  if (/[A-Za-z]/.test(ch)) return 'letters';
  return 'symbols';
}

/**
 * Déduit un format depuis un code existant : le patron (type de chaque position) + la
 * palette de lettres/symboles réellement présents (pour régénérer un code « similaire »).
 */
export function inferFormat(code: string | null | undefined): CodeFormat {
  if (!code) return { pattern: [...DEFAULT_CODE_FORMAT.pattern] };
  let pattern = code.split('').map(typeOfChar);
  if (pattern.length > MAX_LEN) pattern = pattern.slice(0, MAX_LEN);
  while (pattern.length < MIN_LEN) pattern.push('digits');
  const letters = Array.from(new Set(code.toUpperCase().split('').filter((c) => LETTER_CHARS.includes(c))));
  const symbols = Array.from(new Set(code.split('').filter((c) => SYMBOL_CHARS.includes(c))));
  return {
    pattern,
    letters: letters.length ? letters : undefined,
    symbols: symbols.length ? symbols : undefined,
  };
}

// ─── Composant ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  /** Code actuel — sert à pré-remplir le format et l'aperçu à l'ouverture. */
  initialCode?: string | null;
  /** Format persisté du logement — prioritaire sur l'inférence depuis le code (palettes complètes). */
  initialFormat?: CodeFormat | null;
  /** true = une serrure connectée existe → note « seuls les chiffres sont utilisés par la serrure ». */
  smartLockHint?: boolean;
  onClose: () => void;
  /** Applique le code généré (+ le format choisi, pour la régénération rapide ensuite). */
  onApply: (code: string, format: CodeFormat) => void;
}

export default function AccessCodeGeneratorDialog({ open, initialCode, initialFormat, smartLockHint, onClose, onApply }: Props) {
  const { t } = useTranslation();
  const [pattern, setPattern] = useState<CodeCharType[]>(DEFAULT_CODE_FORMAT.pattern);
  const [selectedLetters, setSelectedLetters] = useState<string[]>(DEFAULT_LETTERS);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(DEFAULT_SYMBOLS);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  // À l'ouverture : reprend le format PERSISTÉ du logement (palettes complètes) s'il existe,
  // sinon déduit le format du code courant. Affiche l'aperçu courant.
  useEffect(() => {
    if (!open) return;
    const f = initialFormat && Array.isArray(initialFormat.pattern) && initialFormat.pattern.length
      ? initialFormat
      : inferFormat(initialCode);
    const letters = f.letters && f.letters.length ? f.letters : DEFAULT_LETTERS;
    const symbols = f.symbols && f.symbols.length ? f.symbols : DEFAULT_SYMBOLS;
    setPattern(f.pattern);
    setSelectedLetters(letters);
    setSelectedSymbols(symbols);
    setCode(initialCode || generateCode({ ...f, letters, symbols }));
    setCopied(false);
  }, [open, initialCode, initialFormat]);

  const buildFormat = (over: Partial<CodeFormat> = {}): CodeFormat => ({
    pattern,
    letters: selectedLetters,
    symbols: selectedSymbols,
    ...over,
  });

  // Longueur = nombre de positions : on ajoute des "chiffres" ou on coupe par la fin.
  const applyLength = (n: number) => {
    let next = pattern.slice(0, n);
    while (next.length < n) next.push('digits');
    setPattern(next);
    setCode(generateCode(buildFormat({ pattern: next })));
  };

  // Clic sur une position : fait défiler son type (chiffre → lettre → symbole → ...).
  const cycleSlot = (i: number) => {
    const next = pattern.slice();
    next[i] = NEXT_TYPE[next[i]];
    setPattern(next);
    setCode(generateCode(buildFormat({ pattern: next })));
  };

  const toggleLetter = (ch: string) => {
    const next = selectedLetters.includes(ch) ? selectedLetters.filter((x) => x !== ch) : [...selectedLetters, ch];
    setSelectedLetters(next);
    setCode(generateCode(buildFormat({ letters: next })));
  };

  const toggleSymbol = (ch: string) => {
    const next = selectedSymbols.includes(ch) ? selectedSymbols.filter((x) => x !== ch) : [...selectedSymbols, ch];
    setSelectedSymbols(next);
    setCode(generateCode(buildFormat({ symbols: next })));
  };

  const regenerate = () => setCode(generateCode(buildFormat()));

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papiers indisponible — ignore */
    }
  };

  const counts: Record<CodeCharType, number> = {
    digits: pattern.filter((p) => p === 'digits').length,
    letters: pattern.filter((p) => p === 'letters').length,
    symbols: pattern.filter((p) => p === 'symbols').length,
  };
  const hasLetters = counts.letters > 0;
  const hasSymbols = counts.symbols > 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      {/* showCloseButton={false} : la croix vit dans l'entete, a cote du titre,
          pour garder son libelle traduit (celui du kit est un « Close » fige). */}
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto" showCloseButton={false}>
        <DialogHeader className="flex-row items-center gap-1.5">
          <div className="w-[32px] h-[32px] rounded-[12px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND}1A`, color: BRAND }}>
            <KeyIcon size={17} strokeWidth={1.8} />
          </div>
          <DialogTitle className="flex-1 font-bold text-[1.05rem]">{t('channels.checkIn.generator.title', "Générer un code d'accès")}</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('channels.checkIn.generator.close', 'Fermer')}>
              <CloseIcon size={18} strokeWidth={1.8} />
            </Button>
          </DialogClose>
        </DialogHeader>

      <div>
        {/* Aperçu du code + régénération / copie */}
        <div className="flex items-center justify-between gap-1.5 p-3 rounded-[2px] bg-[var(--hover)] border border-solid border-[var(--line)]">
          {/* Éditable : l'hôte peut saisir un code précis (boîte à clé existante, digicode imposé). */}
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="—"
            aria-label={t('channels.checkIn.generator.codeInput', "Code d'accès")}
            maxLength={32}
            className="flex-1 min-w-0 h-auto border-0 bg-transparent p-0 rounded-none shadow-none focus-visible:ring-0 font-mono text-[1.7rem] font-bold tracking-[0.14em] tabular-nums leading-[1.2]"
          />
          <div className="flex gap-0.5 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                {/* span : TooltipTrigger asChild pose une ref DOM, que le Button du
                    kit (fonction, React 18) ne transmet pas. */}
                <span className="inline-flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    style={{ color: BRAND }}
                    onClick={regenerate}
                    aria-label={t('channels.checkIn.generator.regenerate', 'Régénérer le code')}
                  >
                    <Autorenew size={19} strokeWidth={1.85} />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{t('channels.checkIn.generator.regenerate', 'Régénérer le code')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copy}
                    aria-label={copied ? t('channels.checkIn.generator.copied', 'Copié !') : t('channels.checkIn.generator.copy', 'Copier')}
                  >
                    {copied ? <CheckCircle size={19} strokeWidth={2} color="#10b981" /> : <ContentCopy size={17} strokeWidth={1.75} />}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {copied ? t('channels.checkIn.generator.copied', 'Copié !') : t('channels.checkIn.generator.copy', 'Copier')}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Longueur */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-0.5">
            <p className="cn-text-body2 font-semibold">{t('channels.checkIn.generator.length', 'Longueur')}</p>
            <p className="cn-text-body2 font-bold tabular-nums" style={{ color: BRAND }}>
              {t('channels.checkIn.generator.chars', '{{n}} caractères', { n: pattern.length })}
            </p>
          </div>
          {/* Le Slider du kit ne connait ni `marks` ni bulle de valeur : les reperes
              sont rendus dessous, et la valeur est deja lue dans la ligne ci-dessus. */}
          <Slider
            value={[pattern.length]}
            onValueChange={([v]) => applyLength(v)}
            min={MIN_LEN}
            max={MAX_LEN}
            step={1}
            aria-label={t('channels.checkIn.generator.length', 'Longueur')}
          />
          <div className="flex justify-between mt-1" aria-hidden>
            {[4, 8, 12, 16].map((mark) => (
              <span key={mark} className="cn-text-caption text-muted-foreground tabular-nums">{mark}</span>
            ))}
          </div>
        </div>

        {/* Composition : type de chaque position (nombre + position de chaque type) */}
        <div className="mt-2">
          <p className="cn-text-body2 font-semibold mb-1">{t('channels.checkIn.generator.composition', 'Composition')}</p>
          {/* Récap des quantités (sert aussi de légende couleur) */}
          <div className="flex gap-3 flex-wrap mb-2">
            {TYPE_ORDER.map((tp) => (
              <div className="flex items-center gap-0.5" key={tp}>
                <div className="w-[9px] h-[9px] rounded-[50%]" style={{ backgroundColor: TYPE_META[tp].color }} />
                <span className="cn-text-caption font-semibold tabular-nums">
                  {counts[tp]} {t(`channels.checkIn.generator.${TYPE_META[tp].labelKey}`, TYPE_META[tp].defaultLabel)}
                </span>
              </div>
            ))}
          </div>
          {/* Positions : un clic fait défiler le type */}
          <div className="flex flex-wrap gap-1">
            {pattern.map((type, i) => {
              const meta = TYPE_META[type];
              return (
                // Fonds au repos ET au survol derives de la couleur du type (valeur
                // d'execution) : passes en variables CSS, pas en style inline, sinon le
                // style l'emporterait sur la classe hover:.
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <div
                      onClick={() => cycleSlot(i)}
                      className="w-[46px] py-[4.5px] rounded-[12px] cursor-pointer text-center border border-solid bg-[var(--slot-bg)] transition-all duration-150 ease-[ease] hover:bg-[var(--slot-bg-hover)]"
                      style={{
                        borderColor: `${meta.color}66`,
                        '--slot-bg': `${meta.color}14`,
                        '--slot-bg-hover': `${meta.color}24`,
                      } as React.CSSProperties}
                    >
                      <p className="cn-text-body1 text-[0.6rem] text-muted-foreground leading-[1] tabular-nums">{i + 1}</p>
                      <p className="cn-text-body1 font-bold text-[0.78rem] mt-[1.5px]" style={{ fontFamily: 'monospace', color: meta.color }}>{meta.abbr}</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{t('channels.checkIn.generator.slotCycle', 'Changer le type')}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <span className="cn-text-caption text-muted-foreground mt-1 block">
            {t('channels.checkIn.generator.compositionHint', 'Cliquez sur une position pour changer le type de caractère.')}
          </span>
          {smartLockHint ? (
            <span className="cn-text-caption text-[var(--bui-warning-ink)] mt-0.5 block">
              {t('channels.checkIn.generator.smartLockDigitsHint', 'Serrure connectée : seuls les chiffres du format (et sa longueur) sont utilisés pour le PIN de la serrure.')}
            </span>
          ) : null}
        </div>

        {/* Sous-sélecteur : lettres autorisées (si au moins une position lettre) */}
        {hasLetters && (
          <div className="mt-3">
            <p className="cn-text-body2 font-semibold mb-1.5">{t('channels.checkIn.generator.lettersAllowed', 'Lettres autorisées')}</p>
            <div className="flex flex-wrap gap-0.5">
              {LETTER_CHARS.map((ch) => {
                const on = selectedLetters.includes(ch);
                return <StatusChip key={ch} label={ch} pressed={on} onClick={() => toggleLetter(ch)} tokens={toggleTokens(on, TYPE_META.letters.color)} className="min-w-[34px] font-mono font-bold" />;
              })}
            </div>
            <span className="cn-text-caption text-muted-foreground mt-1 block">
              {t('channels.checkIn.generator.allLettersHint', 'Aucune sélection = toutes les lettres.')}
            </span>
          </div>
        )}

        {/* Sous-sélecteur : symboles autorisés (souvent limités par la serrure) */}
        {hasSymbols && (
          <div className="mt-3">
            <p className="cn-text-body2 font-semibold mb-1.5">{t('channels.checkIn.generator.symbolsAllowed', 'Symboles autorisés')}</p>
            <div className="flex flex-wrap gap-0.5">
              {SYMBOL_CHARS.map((ch) => {
                const on = selectedSymbols.includes(ch);
                return <StatusChip key={ch} label={ch} pressed={on} onClick={() => toggleSymbol(ch)} tokens={toggleTokens(on, TYPE_META.symbols.color)} className="min-w-[34px] font-mono font-bold" />;
              })}
            </div>
            <span className="cn-text-caption text-muted-foreground mt-1 block">
              {t('channels.checkIn.generator.allSymbolsHint', 'Aucune sélection = tous les symboles.')}
            </span>
          </div>
        )}
      </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t('channels.checkIn.generator.cancel', 'Annuler')}</Button>
          {/* L'encre pleine du kit remplace le fond de marque code en dur. */}
          <Button
            variant="default"
            onClick={() => onApply(code, buildFormat())}
            disabled={!code}
          >
            {t('channels.checkIn.generator.apply', 'Utiliser ce code')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
