import React from 'react';
import { cn } from '../../../utils/cn';
import {
  Card,
  CardContent,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import {
  TrendingUp,
  TrendingDown,
  Remove,
} from '../../../icons';

// ─── Props ───────────────────────────────────────────────────────────────────

interface AnalyticsWidgetCardProps {
  title: string;
  value?: React.ReactNode;
  /** Texte indicatif pour dimensionner la police + l'attribut title quand
   *  `value` est un nœud (ex: <Money/> qui affiche le glyphe de devise). */
  valueText?: string;
  subtitle?: string;
  trend?: { value: number; label?: string };
  icon?: React.ReactNode;
  tooltip?: string;
  loading?: boolean;
  onClick?: () => void;
  minWidth?: number;
  children?: React.ReactNode;
  /** Card height override */
  height?: number | string;
}

// ─── Stable sx constants ────────────────────────────────────────────────────

const VALUE_SX = {
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  lineHeight: 1.15,
  letterSpacing: '-0.025em',
  color: 'var(--ink)',
  fontVariantNumeric: 'tabular-nums',
  mt: 0.25,
  // Une seule ligne : si le chiffre est long, la taille est réduite
  // (valueFontSize) et au pire on ellipse — jamais de retour à la ligne.
  whiteSpace: 'nowrap' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '100%',
} as const;

/** Report en classes de `VALUE_SX`. */
const VALUE_CLASS =
  'cn-text-h6 [font-family:var(--font-display)] font-semibold leading-[1.15] tracking-[-0.025em] text-[var(--ink)] tabular-nums mt-[1.5px] truncate max-w-full';

/**
 * Taille du chiffre adaptée à sa longueur (responsive) — un montant comme
 * « 120.00 € » doit tenir sur une ligne dans une carte étroite, alors qu'un
 * « 1 » ou « 46.7% » peut être affiché en grand.
 *
 * Les classes sont ecrites en toutes lettres : Tailwind ne peut pas les
 * fabriquer depuis une valeur calculee a l'execution. Le palier `md` du theme
 * vaut 900 px (breakpoints MUI par defaut), pas le `md` de Tailwind.
 */
function valueFontSizeClass(value?: string): string {
  if (value == null) return 'text-[1.05rem] min-[900px]:text-[1.2rem]'; // nœud sans hint → taille moyenne sûre
  const len = value.length;
  if (len <= 5) return 'text-[1.5rem] min-[900px]:text-[1.75rem]';
  if (len <= 8) return 'text-[1.25rem] min-[900px]:text-[1.45rem]';
  if (len <= 12) return 'text-[1.05rem] min-[900px]:text-[1.2rem]';
  return 'text-[0.9rem] min-[900px]:text-[1rem]';
}

const TITLE_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  lineHeight: 1.2,
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  color: 'var(--faint)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

/** Report en classes de `TITLE_SX` (la couleur du `sx` bat le prop `color`). */
const TITLE_CLASS =
  'cn-text-body2 text-[10.5px] font-bold leading-[1.2] tracking-[0.05em] uppercase text-[var(--faint)] truncate';

const GROWTH_SX = {
  fontSize: '0.5625rem',
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '0.01em',
} as const;

/** Report en classes de `GROWTH_SX`. */
const GROWTH_CLASS = 'text-[0.5625rem] font-semibold tabular-nums tracking-[0.01em]';

// ─── Component ──────────────────────────────────────────────────────────────

const AnalyticsWidgetCard: React.FC<AnalyticsWidgetCardProps> = React.memo(({
  title,
  value,
  valueText,
  subtitle,
  trend,
  icon,
  tooltip,
  loading = false,
  onClick,
  minWidth,
  children,
  height,
}) => {
  // La description vit dans le tooltip (jamais en double sur la carte).
  // Si aucun tooltip explicite, on y bascule le subtitle (ex. « X total »).
  const resolvedTooltip = tooltip || subtitle;
  // Texte de dimensionnement : la value si c'est une string, sinon le hint.
  const sizingText = typeof value === 'string' ? value : valueText;

  const cardContent = (
    // `--card-spacing` porte le p:1.25 d'origine : la Card du kit applique deja
    // le padding vertical, CardContent l'horizontal — inutile de le reposer.
    <Card
      className="w-full transition-[box-shadow] duration-150 hover:ring-[var(--line-2)] [--card-spacing:7.5px]"
      style={{ minWidth, height: height || '100%', cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <CardContent className="h-full flex flex-col min-h-0">
        {loading ? (
          <div>
            <div className="flex items-center gap-1 mb-0.5">
              <Skeleton className="w-[28px] h-[28px] rounded-lg" />
              <div className="flex-1">
                <Skeleton className="w-[60%] h-[14px]" />
                <Skeleton className="w-[40%] h-[20px] mt-0.5" />
              </div>
            </div>
            <Skeleton className="w-[50%] h-[10px] mt-0.5" />
          </div>
        ) : (
          <>
            {/* Header row with icon + title */}
            <div className="flex items-center gap-1 mb-0.5">
              {icon && (
                <div className="flex items-center justify-center min-w-[28px] h-[28px] rounded-[var(--radius-sm)] bg-[var(--accent-soft)] [&_.MuiSvgIcon-root]:text-[16px]">
                  {icon}
                </div>
              )}
              <p className={TITLE_CLASS}>
                {title}
              </p>
            </div>

            {/* Value — la taille passe AVANT VALUE_CLASS : tailwind-merge
                considere qu'une classe `text-[taille]` porte aussi la hauteur
                de ligne et supprimerait un `leading-*` qui la precede. */}
            {value != null && value !== '' && (
              <div className={cn(valueFontSizeClass(sizingText), VALUE_CLASS)} title={sizingText}>
                {value}
              </div>
            )}

            {/* La description (subtitle) n'est plus affichée dans la carte :
                elle est redondante avec le tooltip → on la bascule dans le
                tooltip (cf. resolvedTooltip) pour mettre le chiffre en avant. */}

            {/* Trend */}
            {trend && (
              <div className="flex items-center gap-0.5 mt-0.5">
                {trend.value > 0 ? (
                  <TrendingUp color="success" size={11} strokeWidth={1.75} />
                ) : trend.value < 0 ? (
                  <TrendingDown color="error" size={11} strokeWidth={1.75} />
                ) : (
                  <span className="inline-flex text-muted-foreground opacity-60"><Remove size={11} strokeWidth={1.75} /></span>
                )}
                <span className={cn(GROWTH_CLASS, 'cn-text-caption', trend.value > 0 ? 'text-[var(--ok)]' : trend.value < 0 ? 'text-[var(--err)]' : 'text-[var(--faint)]')}>
                  {trend.value > 0 ? '+' : ''}{trend.value}%
                  {trend.label ? ` ${trend.label}` : ''}
                </span>
              </div>
            )}

            {/* Custom content (charts, etc.) */}
            {children && (
              <div className="flex-1 min-h-0 mt-0.5">
                {children}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  if (resolvedTooltip) {
    return (
      <Tooltip>
        {/* Le <div> intermediaire porte la ref exigee par `asChild` : la Card du
            kit est une fonction simple et ne la transmet pas. */}
        <TooltipTrigger asChild>
          <div className="w-full h-full">{cardContent}</div>
        </TooltipTrigger>
        <TooltipContent side="top">{resolvedTooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return cardContent;
});

AnalyticsWidgetCard.displayName = 'AnalyticsWidgetCard';

export default AnalyticsWidgetCard;
