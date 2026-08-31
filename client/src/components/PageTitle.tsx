import React, { useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui';
import { useScreenChrome } from './ScreenChrome';
import { cn } from '../utils/cn';

/**
 * Titre d'écran Baitly — « Titre │ Onglet ».
 *
 * <p>Le h1 ne dit plus seulement SUR QUEL ÉCRAN on est, mais OÙ on est dedans :
 * le libellé de l'onglet actif est accolé au titre, derrière un filet vertical.
 * Il suit l'onglet, sans que l'écran ait à recomposer son titre — `PageTabs`
 * publie déjà l'onglet actif dans le chrome d'écran (`useScreenTrailSegment`),
 * c'est cette source qui est lue ici.</p>
 *
 * <pre>
 *   Configuration tarifaire │ Abonnement PMS ⌄
 *   └ titre (encre pleine)    └ onglet actif (encre douce), DÉROULANT
 * </pre>
 *
 * <p>Ce second segment n'est plus un simple libellé : `PageTabs` y porte son
 * sélecteur (`segmentSlot`), qui déplie la liste des onglets de l'écran. La
 * bande d'onglets a disparu — le titre EST la navigation interne.</p>
 *
 * <p>La DESCRIPTION de l'écran n'est plus une ligne sous le titre : elle est
 * rendue en infobulle au survol du titre. Une phrase d'explication lue une fois
 * n'a pas à occuper une ligne à chaque visite.</p>
 */

/**
 * Segments internes à afficher après le titre : on retire les vides et ceux qui
 * répètent le titre (une fiche dont l'onglet porte le même nom qu'elle).
 */
export function composeTitleSegments(
  title: string,
  segments: ReadonlyArray<string>,
): string[] {
  const seen = new Set([title.trim().toLowerCase()]);
  const result: string[] = [];
  segments.forEach((segment) => {
    const key = segment?.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(segment.trim());
  });
  return result;
}

interface PageTitleProps {
  title: string;
  /** Description de l'écran — rendue en INFOBULLE, jamais sous le titre. */
  description?: string;
  /**
   * Segments internes (onglet actif, sous-onglet…). Par défaut : ceux publiés
   * par `PageTabs` via le chrome d'écran.
   */
  segments?: ReadonlyArray<string>;
  /** Pastille d'icône rendue à gauche du titre. */
  icon?: React.ReactNode;
  /** Élément inline à droite du titre (puce de statut de l'entité). */
  adornment?: React.ReactNode;
  /**
   * Emplacement rendu APRÈS le titre, sur la même ligne : c'est là que
   * `PageTabs` porte son sélecteur d'onglet (« Paramètres │ Général ⌄ »).
   * Hors du déclencheur d'infobulle : le survol du titre ne doit pas ouvrir une
   * bulle par-dessus le menu qu'on vient de déplier.
   */
  segmentSlot?: React.ReactNode;
  className?: string;
}

export default function PageTitle({
  title,
  description,
  segments,
  icon,
  adornment,
  segmentSlot,
  className,
}: PageTitleProps) {
  const { trail } = useScreenChrome();
  const source = segments ?? trail;
  const parts = useMemo(() => composeTitleSegments(title, source), [title, source]);

  const heading = (
    <div className="flex min-w-0 items-center gap-2.5">
      {icon}
      {/* 20 px de titre sur 375 px de large ne laissaient de place ni a l'onglet
          ni aux commandes : la barre debordait, donc passait a la ligne. */}
      <h1 className="cn-font-heading m-0 flex min-w-0 items-center gap-2 text-lg tracking-tight lg:text-xl">
        <span className="truncate font-semibold text-foreground">{title}</span>
        {parts.map((part) => (
          <React.Fragment key={part}>
            {/* Le filet est la version dessinée du « | » : il garde la même
                hauteur quelle que soit la fonte, là où le glyphe varie. */}
            <span aria-hidden className="h-[1.1em] w-px shrink-0 bg-border" />
            <span className="truncate font-normal text-muted-foreground">{part}</span>
          </React.Fragment>
        ))}
      </h1>
      {adornment && <span className="flex shrink-0 items-center">{adornment}</span>}
    </div>
  );

  const titled = description ? (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* `tabIndex` : sans lui, la description ne serait atteignable qu'à la
            souris — elle n'existe plus nulle part ailleurs sur l'écran. */}
        <div
          tabIndex={0}
          className="flex min-w-0 cursor-help items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {heading}
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">{description}</TooltipContent>
    </Tooltip>
  ) : (
    heading
  );

  // Le titre ne prend plus toute la ligne : il cède la place au sélecteur
  // d'onglet, qui doit lui être ACCOLÉ et non repoussé à l'autre bout de la
  // barre. C'est l'enveloppe qui porte la croissance (`className`).
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      {titled}
      {segmentSlot}
    </div>
  );
}
