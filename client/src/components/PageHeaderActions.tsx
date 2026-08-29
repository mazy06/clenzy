import React, { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui';
import { useTranslation } from '../hooks/useTranslation';
import compactHeaderActions from './compactHeaderActions';
import { headerActionIcon } from './headerActionIcons';

/**
 * Conteneur des actions du PageHeader (slot droit).
 *
 * <p>C'est le SEUL endroit où ce repli est implémenté : `PageHeader` l'utilise
 * pour ses deux slots, donc les écrans n'ont rien à faire — ils passent leurs
 * filtres et leurs actions comme d'habitude et héritent du comportement.</p>
 *
 * Comportement :
 *   - Au-dessus du seuil : les actions sont réduites à leur icône (cf.
 *     `compactHeaderActions`) et alignées ; les filtres passent derrière un
 *     unique déclencheur « Filtres » qui les déplie sans les amputer — un
 *     sélecteur réduit à une icône n'annoncerait plus sur quoi il porte.
 *   - En dessous : filtres et actions sont TOUS repliés dans un unique bouton ⋯
 *     ouvrant un menu où ils réapparaissent empilés, pleine largeur, libellé
 *     visible (le libellé revient de l'`aria-label`, cf. MENU_LAYOUT_CLASS).
 *
 * <p>La recherche de l'écran n'entre JAMAIS ici : `GlobalSearchField` est un
 * frère de ce composant dans `PageHeader` et reste visible à toute largeur.
 * Une recherche repliée derrière un menu cesse d'être une recherche.</p>
 *
 * Générique : fonctionne pour les actions passées en JSX inline ET pour celles
 * portalées via PageHeaderActionsContext. Nuance à connaître dans ce second cas :
 * tant que le menu est fermé, Radix ne monte pas son contenu, donc le conteneur
 * de portail n'existe pas encore et les actions d'onglet y arrivent au premier
 * rendu qui suit l'ouverture.
 *
 * <h2>Disparition de la normalisation MUI</h2>
 * <p>Ce fichier portait deux blocs `sx` (ICON_ONLY_SX / LABELED_SX) dont les
 * sélecteurs ne visaient QUE des descendants MUI (`.MuiButton-root`,
 * `.MuiIconButton-root`) : ils remettaient au gabarit Baitly les boutons
 * d'action encore écrits en MUI. Plus aucun écran ne pousse de `Button` ou
 * d'`IconButton` MUI dans ce slot (les quatre fichiers qui en importent encore
 * ne branchent pas le PageHeader), donc ces sélecteurs ne trouvaient plus de
 * cible : ils sont supprimés avec le `Box` qui les portait. Les boutons du kit
 * arrivent déjà au bon gabarit.</p>
 */

/**
 * Mise en page du contenu replié.
 *
 * <p>Le menu reçoit les slots `filters` et `actions` TELS QUELS : ce sont des
 * groupes pensés pour une barre horizontale, avec leur propre alignement. Posés
 * sans retouche dans un menu vertical, ils y gardaient leur disposition — d'où
 * une ligne « 10 demandes + filtre » calée à droite, puis une ligne « export +
 * ajouter » calée à gauche, et des boutons icône muets.</p>
 *
 * <p>Ces règles remettent donc TOUT à plat : chaque groupe redevient une pile,
 * chaque bouton une ligne pleine largeur alignée au début. Les compteurs et
 * mentions qui accompagnent les filtres restent lisibles, alignés comme le
 * reste.</p>
 */
const MENU_LAYOUT_CLASS = [
  // Chaque groupe passé en slot redevient une colonne.
  //
  // Les DEUX niveaux sont visés à dessein : les slots arrivent souvent enveloppés
  // d'un conteneur en `display: contents`, transparent à la mise en page. Viser
  // le seul enfant direct ne touchait alors rien du tout, et les groupes
  // restaient des rangées horizontales — « Exporter » et « Nouvelle demande »
  // côte à côte, « Affichage et filtres » calé à droite sur sa propre ligne.
  // `:not([data-inline-panel])` : un contrôle qui sait déjà se rendre en colonne
  // dans ce menu — le panneau de filtres — garde SA mise en page. Ces règles ne
  // servent qu'aux groupes qui arrivent tels quels d'une barre horizontale.
  '[&>*:not([data-inline-panel])]:flex [&>*:not([data-inline-panel])]:min-w-0',
  '[&>*:not([data-inline-panel])]:flex-col [&>*:not([data-inline-panel])]:items-stretch [&>*:not([data-inline-panel])]:gap-1',
  '[&>*>div:not([data-inline-panel])]:flex [&>*>div:not([data-inline-panel])]:min-w-0',
  '[&>*>div:not([data-inline-panel])]:flex-col [&>*>div:not([data-inline-panel])]:items-stretch [&>*>div:not([data-inline-panel])]:gap-1',
  // Les boutons sont souvent enveloppés d'un `<span inline-flex>` — l'ancre que
  // Radix exige pour ses infobulles. Ce span se dimensionne au contenu, si bien
  // que le `w-full` du bouton ne valait que la largeur de son propre libellé :
  // les lignes finissaient en escalier (158, 97, 161 px). On étire l'ancre.
  '[&_span:has(>button)]:flex [&_span:has(>button)]:w-full',
  // Un bouton = une ligne, jamais un carré d'icône.
  '[&_button]:h-8 [&_button]:w-full [&_button]:min-w-0 [&_button]:justify-start',
  '[&_button]:gap-2 [&_button]:px-2 [&_button]:text-[13px]',
  // Un bouton dont le seul enfant est une icône n'a pas de libellé visible :
  // on affiche son nom accessible, sans quoi le menu est une rangée de
  // pictogrammes sans texte.
  "[&_button:has(>svg:only-child)]:after:content-[attr(aria-label)]",
  // Textes d'accompagnement (compteurs, mentions) : même gouttière que les boutons.
  '[&>*>p]:px-2 [&>*>span]:px-2 [&>*>p]:text-xs [&>*>span]:text-xs',
].join(' ');

/* Le menu ne publie plus de contexte : les slots arrivent souvent par portail,
   et le contexte React suivrait alors l.arbre de l.ecran, pas celui du menu.
   Le controle qui doit s.adapter lit donc le meme seuil (cf. FilterSearchBar). */

interface PageHeaderActionsProps {
  /** Recherche / filtres (slot gauche du groupe d'actions). */
  filters?: React.ReactNode;
  /** Boutons d'action. */
  actions?: React.ReactNode;
  /**
   * Replier filtres et actions dans le menu ⋯. Le seuil n'est PAS decide ici :
   * `PageHeader` le calcule (lg, 1024 px) pour rester aligne sur les autres
   * bascules de la barre.
   */
  narrow: boolean;
}

export default function PageHeaderActions({ filters, actions, narrow }: PageHeaderActionsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  if (!filters && !actions) return null;

  // La barre de titre n'admet qu'une forme de bouton : icone + infobulle.
  // Repli comme deploiement partent du meme arbre reduit — le menu ⋯ redonne
  // le libelle via `aria-label` (cf. MENU_LAYOUT_CLASS).
  const compactActions = compactHeaderActions(actions);
  const filtersLabel = t('common.filters', 'Filtres');

  if (!narrow) {
    return (
      <div className="flex items-center gap-1.5">
        {filters && (
          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={filtersLabel}
                      aria-expanded={filtersOpen}
                    >
                      {headerActionIcon('filter')}
                    </Button>
                  </span>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>{filtersLabel}</TooltipContent>
            </Tooltip>
            {/* Les filtres gardent leurs libelles : un selecteur reduit a une
                icone cesse d'annoncer sur quoi il porte. C'est le DECLENCHEUR
                qui est reduit, pas son contenu. */}
            <PopoverContent
              align="end"
              className={`max-h-[70dvh] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto p-2 ${MENU_LAYOUT_CLASS}`}
            >
              {filters}
            </PopoverContent>
          </Popover>
        )}
        {compactActions}
      </div>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <span className="inline-flex">
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('common.actions', 'Actions')}
                aria-haspopup="menu"
                aria-expanded={open}
              >
                <MoreHorizontal />
              </Button>
            </span>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t('common.actions', 'Actions')}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="end"
        className="max-h-[70dvh] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto p-1.5"
      >
          <div
            className={`flex flex-col items-stretch gap-1 ${MENU_LAYOUT_CLASS}`}
            onClick={(e) => {
              const el = e.target as HTMLElement;
              if (el.closest('[data-inline-panel]') || el.closest('[aria-haspopup]')) return;
              setOpen(false);
            }}
          >
            {filters}
            {filters && actions && <div className="my-0.5 h-px shrink-0 bg-border" />}
            {compactActions}
          </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
