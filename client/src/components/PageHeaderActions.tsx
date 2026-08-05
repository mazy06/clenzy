import React, { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui';
import { useTranslation } from '../hooks/useTranslation';

/**
 * Conteneur des actions du PageHeader (slot droit).
 *
 * <p>C'est le SEUL endroit où ce repli est implémenté : `PageHeader` l'utilise
 * pour ses deux slots, donc les écrans n'ont rien à faire — ils passent leurs
 * filtres et leurs actions comme d'habitude et héritent du comportement.</p>
 *
 * Comportement :
 *   - Au-dessus du seuil : filtres et actions sont rendus tels quels, en ligne.
 *   - En dessous : ils sont TOUS repliés dans un unique bouton ⋯ ouvrant un menu
 *     où ils réapparaissent empilés, pleine largeur, libellé visible.
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

/** Dans le dropdown : boutons pleine largeur, libellé visible, alignés au début. */
const LABELED_ITEM_CLASS =
  '[&_button]:w-full [&_button]:min-w-0 [&_button]:justify-start [&_button]:text-[13px]';

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

  // Pas d'actions → rien (évite un bouton overflow vide sur les pages sans action).
  if (!filters && !actions) return null;

  if (!narrow) {
    // gap: 1 MUI = 6 px (theme.spacing vaut 6).
    return (
      <div className="flex items-center gap-1.5">
        {filters}
        {actions}
      </div>
    );
  }

  // Le <span> hôte est indispensable : le trigger du menu ET celui de l'infobulle
  // y posent leur ref d'ancrage, qu'un composant fonction React 18 (le Button du
  // kit) ne peut pas recevoir. Les attributs aria restent doublés sur le bouton
  // pour qu'il s'annonce lui-même comme ouvrant un menu.
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <span className="inline-flex">
              <Button
                variant="outline"
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
      {/* `w-auto` annule le calage sur la largeur du déclencheur que pose le
          primitif : le déclencheur est un carré de 32 px, le menu doit respirer. */}
      <DropdownMenuContent align="end" className="w-auto min-w-[200px] p-1.5">
        {/* Le contenu n'est pas fait de DropdownMenuItem (ce sont les boutons
            arbitraires des écrans) : la fermeture au clic est donc portée ici,
            comme le faisait le onClick du Popover MUI. */}
        <div
          className={`flex flex-col items-stretch gap-1 ${LABELED_ITEM_CLASS}`}
          onClick={() => setOpen(false)}
        >
          {filters}
          {actions}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
