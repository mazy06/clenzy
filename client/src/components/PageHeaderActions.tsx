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
 * Comportement unifié (demande produit) :
 *   - À toute taille : les boutons d'action sont rendus ICON-ONLY (le libellé
 *     est masqué visuellement mais conservé comme nom accessible).
 *   - En responsive (< md) : tous les icônes sont repliés dans UN SEUL bouton
 *     overflow (⋯) ouvrant un dropdown où les actions réapparaissent AVEC leur
 *     libellé (pleine largeur, empilées).
 *
 * Générique : fonctionne pour les actions passées en JSX inline ET pour celles
 * portalées via PageHeaderActionsContext (le portail se re-render au montage du
 * slot, donc le contenu apparaît à l'ouverture du dropdown).
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
  /** Forcer le repli overflow (sinon : auto < md). */
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
