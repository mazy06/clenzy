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
// `gap-y-3` et non 2 : sur une rangee qui s'enroule, la variation de la ligne du
// bas remonte au-dessus de son chiffre et frolerait les jambages de la ligne du
// haut. Sans enroulement — le cas de bureau — l'ecart vertical ne sert a rien et
// la hauteur reste identique.
const FIGURES_ROW_CLASS = 'flex flex-row flex-wrap items-baseline gap-x-6 gap-y-3';

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
    <span className="relative inline-flex items-baseline">
      <b
        className={cn(
          'font-[family-name:var(--font-display)] text-lg font-bold tabular-nums',
          muted ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {value}
      </b>
      {delta === null || delta === undefined ? null : (
        <Delta value={delta} inverted={deltaInverted} />
      )}
    </span>
    <span className="text-xs text-muted-foreground">{label}</span>
  </span>
);

/**
 * Variation d'un chiffre.
 *
 * <p>Encre `-ink` : la valeur est du TEXTE, la teinte vive n'y tient pas le
 * contraste AA. Une variation nulle reste neutre — la colorer donnerait à lire
 * un mouvement qui n'a pas eu lieu.</p>
 *
 * <p>Une hausse se pose en EXPOSANT du chiffre auquel elle se rapporte, une
 * baisse en INDICE : le sens du mouvement se lit alors a la position, et plus
 * seulement a la teinte.</p>
 *
 * <p>Elle est sortie du flux (`position: absolute`) : elle ne s'intercale plus
 * entre le nombre et son libelle, qui se lisent d'un trait, et elle ne pese sur
 * aucune dimension — la hauteur de la rangee ne bouge pas d'un pixel, la ou un
 * `vertical-align: super` gonflerait la boite de ligne.</p>
 */
export const Delta: React.FC<{
  value: number;
  inverted?: boolean;
  unit?: string;
  /**
   * Decalage exposant / indice. A couper quand la variation occupe sa PROPRE
   * ligne : il n'y a alors aucun chiffre auquel s'accrocher.
   */
  offset?: boolean;
}> = ({ value, inverted, unit = '%', offset = true }) => {
  const favorable = inverted ? value < 0 : value > 0;
  const tone =
    value === 0
      ? 'text-muted-foreground'
      : favorable
        ? 'text-success-ink'
        : 'text-warning-ink';
  // Hors flux et ENTIEREMENT au-dessus (ou en dessous) de la ligne : c'est ce
  // qui rend la position sure. Glissee a cote du chiffre, la variation devait
  // se faufiler entre les capitales du libelle et sa ligne de base — quelques
  // pixels, qui dependent de la fonte et de l'echelle du theme : elle finissait
  // par mordre le mot. Au-dessus du nombre, la bande est vide, et le nombre est
  // le seul texte dont elle s'approche.
  //
  // L'alignement sur le bord GAUCHE du chiffre met la variation dans sa colonne
  // plutot que dans celle du libelle : on lit « 44,7 % » et sa variation d'un
  // bloc. Et `position: absolute` ne pese sur aucune dimension — la variation
  // se loge dans le rembourrage de la carte, la hauteur ne bouge pas.
  const placement =
    !offset
      ? null
      : value < 0
        ? 'absolute start-0 top-full -mt-0.5 whitespace-nowrap leading-none'
        : 'absolute start-0 bottom-full -mb-0.5 whitespace-nowrap leading-none';
  return (
    <span className={cn('text-2xs font-semibold tabular-nums', tone, placement)}>
      {value > 0 ? '+' : ''}
      {/* `{886.7}` rend « 886.7 » : le point decimal anglais. */}
      {value.toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit}
    </span>
  );
};
