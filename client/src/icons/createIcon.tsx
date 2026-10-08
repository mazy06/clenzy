/**
 * Fabrique des composants d'icônes Reicon (https://reicon.dev).
 *
 * Les glyphes viennent de `@iconify-icons/reicon` (données SVG brutes, un module
 * par glyphe → tree-shaking natif). Chaque composant connaît jusqu'à trois
 * variantes du même pictogramme :
 *   - `duotone` : graisse PRIVILÉGIÉE de Baitly (aplat à 50 % + trait plein) ;
 *   - `outline` : repli quand Reicon n'a pas de duotone pour ce glyphe ;
 *   - `filled`  : servie quand l'appelant passe `fill` (étoiles de notation…).
 *
 * L'API reste compatible avec celle de Lucide (`size`, `color`, `strokeWidth`,
 * `fill`, `className`, props SVG) pour que les 500 écrans migrés n'aient rien
 * à changer. Les glyphes Reicon sont dessinés en surfaces, pas en traits :
 * `strokeWidth` / `absoluteStrokeWidth` sont acceptés mais sans effet.
 */
import { forwardRef, type ForwardRefExoticComponent, type RefAttributes, type SVGProps } from 'react';

/** Données d'un glyphe au format Iconify (viewBox 24 par défaut). */
export interface IconData {
  body: string;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
}

export type IconWeight = 'duotone' | 'outline' | 'filled';

export type IconVariants = Partial<Record<IconWeight, IconData>>;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  /** Largeur et hauteur (px ou unité CSS). Défaut 24. */
  size?: number | string;
  /** Teinte du glyphe (défaut `currentColor`). */
  color?: string;
  /** Graisse explicite. Sans elle : duotone, ou `filled`/`outline` selon `fill`. */
  weight?: IconWeight;
  /** Compat Lucide — sans effet sur les glyphes Reicon (dessinés en surfaces). */
  strokeWidth?: number | string;
  /** Compat Lucide — sans effet. */
  absoluteStrokeWidth?: boolean;
}

export type IconComponent = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

/** Graisse servie quand l'appelant n'exprime aucune préférence. */
export const DEFAULT_ICON_WEIGHT: IconWeight = 'duotone';

const FALLBACK_ORDER: IconWeight[] = ['duotone', 'outline', 'filled'];

const isEmptyFill = (fill: string) => fill === 'none' || fill === 'transparent';

const toKebab = (name: string) =>
  name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Za-z])(\d)/g, '$1-$2').toLowerCase();

/**
 * Résout la graisse et la teinte à partir des props façon Lucide : `fill="none"`
 * ou `"transparent"` demande le contour, toute autre valeur l'aplat plein — teinté
 * de cette valeur quand elle n'est pas `currentColor` et qu'aucune `color` n'est donnée.
 */
function resolveAppearance(weight: IconWeight | undefined, fill: string | undefined, color: string | undefined) {
  if (weight || fill === undefined) return { weight: weight ?? DEFAULT_ICON_WEIGHT, tint: color };
  if (isEmptyFill(fill)) return { weight: 'outline' as const, tint: color };
  return { weight: 'filled' as const, tint: color ?? (fill === 'currentColor' ? undefined : fill) };
}

export function createIcon(name: string, variants: IconVariants): IconComponent {
  const baseClass = `reicon reicon-${toKebab(name)}`;

  const Icon = forwardRef<SVGSVGElement, IconProps>(function ReiconIcon(
    {
      size = 24,
      color,
      weight,
      fill,
      strokeWidth: _strokeWidth,
      absoluteStrokeWidth: _absoluteStrokeWidth,
      width,
      height,
      className,
      style,
      children,
      ...rest
    },
    ref,
  ) {
    const appearance = resolveAppearance(weight, fill, color);
    const data =
      variants[appearance.weight] ??
      FALLBACK_ORDER.map((w) => variants[w]).find((v): v is IconData => v !== undefined)!;
    const labelled = rest['aria-label'] !== undefined || rest['aria-labelledby'] !== undefined;

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={width ?? size}
        height={height ?? size}
        viewBox={`${data.left ?? 0} ${data.top ?? 0} ${data.width ?? 24} ${data.height ?? 24}`}
        aria-hidden={labelled ? undefined : true}
        className={className ? `${baseClass} ${className}` : baseClass}
        style={appearance.tint ? { ...style, color: appearance.tint } : style}
        {...rest}
      >
        {/* `stroke="none"` : neutralise les règles CSS héritées de l'ère Lucide
            (`svg { stroke: currentColor }`) qui épaissiraient les aplats Reicon. */}
        <g stroke="none" dangerouslySetInnerHTML={{ __html: data.body }} />
        {children}
      </svg>
    );
  });
  Icon.displayName = name;
  return Icon;
}
