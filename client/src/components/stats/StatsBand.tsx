import React from 'react';
import { Card } from '../ui';
import { cn } from '../../utils/cn';

/**
 * Bandeau de synthèse d'un écran de statistiques.
 *
 * <p>Une seule carte, des chiffres alignés sur leur ligne de base : le regard
 * balaie une rangée au lieu de sauter de tuile en tuile. Quatre grosses cartes
 * KPI côte à côte occupent le tiers haut de l'écran pour dire ce que six
 * chiffres tiennent sur une ligne.</p>
 */
export interface StatFigure {
  key: string;
  value: React.ReactNode;
  label: string;
  /** Chiffre de contexte (ratio, moyenne) : encre secondaire. */
  muted?: boolean;
  /** Variation vs période précédente, en pourcentage. */
  delta?: number | null;
  /** Inverse la lecture du delta : une hausse des coûts n'est pas une bonne nouvelle. */
  deltaInverted?: boolean;
}

/**
 * Coque du bandeau : la carte, la rangée qui s'enroule, la ligne de base
 * commune.
 *
 * <p>Extraite pour que les écrans de LISTE puissent adopter exactement le même
 * bandeau que les Rapports, sans en recopier les classes — deux copies d'un
 * contrat visuel finissent toujours par diverger. `StatTileRow` en mode
 * compact s'appuie dessus (cf. `components/baitly/StatTileRow`).</p>
 */
const FIGURES_ROW_CLASS = 'flex flex-row flex-wrap items-baseline gap-x-6 gap-y-2';

export const StatsBandShell: React.FC<{
  children: React.ReactNode;
  /** Ligne complémentaire sous les chiffres (jauge, alerte, période). */
  footer?: React.ReactNode;
  className?: string;
}> = ({ children, footer, className }) => (
  <Card className={cn('flex flex-col gap-2.5 border-border p-3', className)}>
    <div className={FIGURES_ROW_CLASS}>{children}</div>
    {footer}
  </Card>
);

/**
 * Rangée de chiffres SANS carte.
 *
 * <p>Le bandeau porte sa propre carte, ce qui convient à un écran de rapport
 * mais pas à une tuile du tableau de bord : la tuile est déjà une carte, et
 * une carte dans une carte double les bordures pour rien.</p>
 */
export const FiguresRow: React.FC<{ figures: StatFigure[] }> = ({ figures }) => (
  <div className={FIGURES_ROW_CLASS}>
    {figures.map(({ key, ...figure }) => (
      <Figure key={key} {...figure} />
    ))}
  </div>
);

export const StatsBand: React.FC<{
  figures: StatFigure[];
  /** Ligne complémentaire sous les chiffres (jauge, alerte, période). */
  footer?: React.ReactNode;
}> = ({ figures, footer }) => (
  <StatsBandShell footer={footer}>
    {figures.map(({ key, ...figure }) => (
      <Figure key={key} {...figure} />
    ))}
  </StatsBandShell>
);

export const Figure: React.FC<Omit<StatFigure, 'key'>> = ({
  value,
  label,
  muted,
  delta,
  deltaInverted,
}) => (
  <span className="flex items-baseline gap-1.5">
    <b
      className={cn(
        'font-[family-name:var(--font-display)] text-lg font-bold tabular-nums',
        muted ? 'text-muted-foreground' : 'text-foreground',
      )}
    >
      {value}
    </b>
    <span className="text-xs text-muted-foreground">{label}</span>
    {delta === null || delta === undefined ? null : (
      <Delta value={delta} inverted={deltaInverted} />
    )}
  </span>
);

/**
 * Variation d'un chiffre.
 *
 * <p>Encre `-ink` : la valeur est du TEXTE, la teinte vive n'y tient pas le
 * contraste AA. Une variation nulle reste neutre — la colorer donnerait à lire
 * un mouvement qui n'a pas eu lieu.</p>
 */
export const Delta: React.FC<{ value: number; inverted?: boolean; unit?: string }> = ({
  value,
  inverted,
  unit = '%',
}) => {
  const favorable = inverted ? value < 0 : value > 0;
  const tone =
    value === 0
      ? 'text-muted-foreground'
      : favorable
        ? 'text-success-ink'
        : 'text-warning-ink';
  return (
    <span className={cn('text-2xs font-semibold tabular-nums', tone)}>
      {value > 0 ? '+' : ''}
      {/* `{886.7}` rend « 886.7 » : le point decimal anglais. */}
      {value.toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit}
    </span>
  );
};
