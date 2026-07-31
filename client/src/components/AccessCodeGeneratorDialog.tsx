import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Slider,
  Chip,
  IconButton,
  InputBase,
  Button,
  Tooltip,
} from '@mui/material';
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

const chipSx = (on: boolean, color: string) => ({
  fontFamily: 'monospace',
  fontWeight: 700,
  cursor: 'pointer',
  minWidth: 34,
  ...(on ? { bgcolor: color, color: '#fff', borderColor: color, '&:hover': { bgcolor: color, opacity: 0.85 } } : {}),
});

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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <div className="flex items-center gap-1.5 px-4 pt-3.5 pb-1.5">
        <Box sx={{ width: 32, height: 32, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${BRAND}1A`, color: BRAND }}>
          <KeyIcon size={17} strokeWidth={1.8} />
        </Box>
        <p className="cn-text-body1 flex-1 font-bold text-[1.05rem]">{t('channels.checkIn.generator.title', "Générer un code d'accès")}</p>
        <IconButton size="small" onClick={onClose} aria-label={t('channels.checkIn.generator.close', 'Fermer')}><CloseIcon size={18} strokeWidth={1.8} /></IconButton>
      </div>

      <DialogContent sx={{ pt: 1 }}>
        {/* Aperçu du code + régénération / copie */}
        <div className="flex items-center justify-between gap-1.5 p-3 rounded-[2px] bg-[action.hover] border border-[divider]">
          {/* Éditable : l'hôte peut saisir un code précis (boîte à clé existante, digicode imposé). */}
          <InputBase
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="—"
            inputProps={{ 'aria-label': t('channels.checkIn.generator.codeInput', "Code d'accès"), maxLength: 32 }}
            sx={{
              flex: 1, minWidth: 0,
              '& input': {
                fontFamily: 'monospace', fontSize: '1.7rem', fontWeight: 700, letterSpacing: '0.14em',
                fontVariantNumeric: 'tabular-nums', lineHeight: 1.2, padding: 0,
              },
            }}
          />
          <div className="flex gap-0.5 shrink-0">
            <Tooltip title={t('channels.checkIn.generator.regenerate', 'Régénérer le code')}>
              <IconButton onClick={regenerate} sx={{ color: BRAND }}><Autorenew size={19} strokeWidth={1.85} /></IconButton>
            </Tooltip>
            <Tooltip title={copied ? t('channels.checkIn.generator.copied', 'Copié !') : t('channels.checkIn.generator.copy', 'Copier')}>
              <IconButton onClick={copy}>{copied ? <CheckCircle size={19} strokeWidth={2} color="#10b981" /> : <ContentCopy size={17} strokeWidth={1.75} />}</IconButton>
            </Tooltip>
          </div>
        </div>

        {/* Longueur */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-0.5">
            <p className="cn-text-body2 font-semibold">{t('channels.checkIn.generator.length', 'Longueur')}</p>
            <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: BRAND }}>
              {t('channels.checkIn.generator.chars', '{{n}} caractères', { n: pattern.length })}
            </Typography>
          </div>
          <Slider
            value={pattern.length}
            onChange={(_, v) => applyLength(v as number)}
            min={MIN_LEN}
            max={MAX_LEN}
            step={1}
            valueLabelDisplay="auto"
            marks={[{ value: 4, label: '4' }, { value: 8, label: '8' }, { value: 12, label: '12' }, { value: 16, label: '16' }]}
            sx={{ color: BRAND }}
          />
        </div>

        {/* Composition : type de chaque position (nombre + position de chaque type) */}
        <div className="mt-2">
          <p className="cn-text-body2 font-semibold mb-1">{t('channels.checkIn.generator.composition', 'Composition')}</p>
          {/* Récap des quantités (sert aussi de légende couleur) */}
          <div className="flex gap-3 flex-wrap mb-2">
            {TYPE_ORDER.map((tp) => (
              <div className="flex items-center gap-0.5" key={tp}>
                <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: TYPE_META[tp].color }} />
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
                <Tooltip key={i} title={t('channels.checkIn.generator.slotCycle', 'Changer le type')}>
                  <Box
                    onClick={() => cycleSlot(i)}
                    sx={{
                      width: 46, py: 0.75, borderRadius: 1.5, cursor: 'pointer', textAlign: 'center',
                      border: '1px solid', borderColor: `${meta.color}66`, bgcolor: `${meta.color}14`,
                      transition: 'all .15s ease', '&:hover': { bgcolor: `${meta.color}24` },
                    }}
                  >
                    <p className="cn-text-body1 text-[0.6rem] text-muted-foreground leading-[1] tabular-nums">{i + 1}</p>
                    <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem', color: meta.color, mt: 0.25 }}>{meta.abbr}</Typography>
                  </Box>
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
                return <Chip key={ch} label={ch} size="small" variant={on ? 'filled' : 'outlined'} onClick={() => toggleLetter(ch)} sx={chipSx(on, TYPE_META.letters.color)} />;
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
                return <Chip key={ch} label={ch} size="small" variant={on ? 'filled' : 'outlined'} onClick={() => toggleSymbol(ch)} sx={chipSx(on, TYPE_META.symbols.color)} />;
              })}
            </div>
            <span className="cn-text-caption text-muted-foreground mt-1 block">
              {t('channels.checkIn.generator.allSymbolsHint', 'Aucune sélection = tous les symboles.')}
            </span>
          </div>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit">{t('channels.checkIn.generator.cancel', 'Annuler')}</Button>
        <Button
          onClick={() => onApply(code, buildFormat())}
          variant="contained"
          disabled={!code}
          sx={{ bgcolor: BRAND, '&:hover': { bgcolor: '#5a7888' } }}
        >
          {t('channels.checkIn.generator.apply', 'Utiliser ce code')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
