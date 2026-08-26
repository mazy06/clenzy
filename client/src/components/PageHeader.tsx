import React from 'react';
import { useMediaQuery } from '../hooks/use-media-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from 'lucide-react';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from './ui';
import { screenIconFor, sizedIcon } from '../config/navigationIcons';
import PageTitle from './PageTitle';
import { useScreenChrome } from './ScreenChrome';
import { SidebarTrigger } from './ui/sidebar';
import GlobalSearchField from './GlobalSearchField';
import PageHeaderActions from './PageHeaderActions';
import { cn } from '../utils/cn';

interface PageHeaderProps {
  title: string;
  /**
   * Description de l'ecran. N'occupe plus une ligne sous le titre : elle est
   * rendue en INFOBULLE au survol du titre (cf. PageTitle).
   */
  subtitle?: string;
  /**
   * Icone optionnelle affichee dans une pastille arrondie a gauche du titre.
   * Par defaut : l'icone de l'ecran courant (cf. config/navigationIcons).
   */
  iconBadge?: React.ReactNode;
  /** Couleur du badge icone. Default : primaire Baitly. */
  iconBadgeColor?: string;
  /**
   * Element optionnel rendu inline a droite du titre (meme ligne que le h1).
   * Typiquement une puce de statut decrivant l'entite (Actif/Inactif, Brouillon).
   * Separe ce que l'entite EST (titre + adornment) de ce qu'on peut FAIRE (actions).
   */
  titleAdornment?: React.ReactNode;
  backPath?: string;
  backLabel?: string;
  /** Callback invoked when the back button is clicked. Takes priority over backPath. */
  onBack?: () => void;
  actions?: React.ReactNode;
  /** Slot pour les filtres, rendu avec les actions sur la ligne du titre. */
  filters?: React.ReactNode;
  showBackButton?: boolean;
  showBackButtonWithActions?: boolean;
  className?: string;
}

/**
 * Header de page standardise du PMS Baitly (kit Baitly UI).
 *
 * Structure — UNE seule ligne :
 *   [icône] Titre │ Onglet  [puce]   [recherche] [filtres] [actions] [retour]
 *
 * Le fil d'Ariane a été retiré : il coûtait une ligne pour redire ce que la
 * barre latérale montre déjà (où l'on est) et ce que le titre porte désormais
 * (l'onglet actif). La navigation entre écrans passe par la barre latérale.
 *
 * Quatre invariants produits :
 *   - le TITRE dit l'écran ET l'endroit où l'on se trouve dedans : l'onglet
 *     actif y est accolé derrière un filet, et suit les changements d'onglet
 *     sans que l'écran recompose son titre (cf. PageTitle) ;
 *   - la DESCRIPTION de l'écran ne prend plus une ligne sous le titre : elle
 *     est rendue en infobulle au survol du titre ;
 *   - la PASTILLE d'icone est deduite de la route quand la page n'en fournit
 *     pas, pour que chaque ecran ait son marqueur visuel ;
 *   - la RECHERCHE est unique et toujours visible (cf. GlobalSearchField).
 *
 * Tout ce qui est posé à droite est réduit à une icône expliquée par une
 * infobulle : les actions par `compactHeaderActions`, les filtres derrière un
 * déclencheur unique (cf. PageHeaderActions). Mode compact (lg-) : le tout se
 * replie dans un menu ⋯.
 */
export default function PageHeader({
  title,
  subtitle,
  iconBadge,
  iconBadgeColor,
  titleAdornment,
  backPath,
  backLabel = 'Retour',
  onBack,
  actions,
  filters,
  showBackButton = true,
  showBackButtonWithActions = false,
  className,
}: PageHeaderProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { setTabsSlot } = useScreenChrome();
  // `lg` de Tailwind (1024 px) — le MEME seuil que toutes les autres bascules de
  // cette barre : fil d'Ariane (`hidden lg:block`), sous-titre, declencheur de
  // sidebar (`lg:hidden`) et rangee d'onglets, qui vient justement se poser DANS
  // la barre sous ce seuil (cf. PageTabs, `max-width: 1023.98px`).
  //
  // Il valait 767,98 px, ce que son commentaire decrivait deja — a tort — comme
  // aligne sur le reste. Entre 768 et 1023 px la barre portait donc d'un coup le
  // declencheur de sidebar, le titre, le MENU D'ONGLETS, la recherche, toutes les
  // actions et le retour : c'est la largeur ou l'espace manque le plus, et la
  // seule ou rien ne se repliait.
  const isCompact = useMediaQuery('(max-width: 1023.98px)');

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (!backPath) return;
    // Retour contextuel : si on vient d'une autre page de l'app, on revient sur
    // l'entree d'historique precedente (qui porte deja l'onglet actif via ?tab=N
    // et la position de scroll) plutot que sur un chemin parent fige qui reset
    // l'onglet. React Router stocke l'index de l'entree courante dans
    // window.history.state.idx : > 0 => il existe une entree precedente DANS
    // l'app, donc navigate(-1) est sur. Sinon (acces direct, refresh, nouvel
    // onglet) on retombe sur le chemin parent.
    const historyIdx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (historyIdx > 0) navigate(-1);
    else navigate(backPath);
  };

  const icon = iconBadge ?? screenIconFor(pathname);
  const showBack = (showBackButton || showBackButtonWithActions) && (onBack || backPath);

  return (
    <header className={cn('mb-1.5 flex flex-col gap-1.5 lg:mb-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Le bouton de la sidebar occupait une bande de 48 px a lui seul sous
            1024 px. Il rejoint la ligne du titre : le seuil du kit sidebar
            (SIDEBAR_SHEET_BREAKPOINT) vaut deja lg, les deux coincident. */}
        <SidebarTrigger className="-ml-1 shrink-0 lg:hidden" />

        {/* Sous lg, le titre ne prend que sa largeur : `flex-1` lui donnait la
            moitie de la barre et repoussait les onglets contre les actions, ce
            qui se lisait comme deux blocs plutot qu'une ligne continue. */}
        <PageTitle
          className="lg:flex-1"
          title={title}
          description={subtitle}
          adornment={titleAdornment}
          icon={
            icon && (
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-primary/10 text-primary"
                style={
                  iconBadgeColor
                    ? {
                        backgroundColor: `color-mix(in srgb, ${iconBadgeColor} 12%, transparent)`,
                        color: iconBadgeColor,
                      }
                    : undefined
                }
              >
                {sizedIcon(icon, 17)}
              </span>
            )
          }
        />

        <div className="flex min-w-0 shrink items-center justify-end gap-2">
          {/* Les onglets viennent se poser ici sous 1024 px, sous forme de menu,
              range avec les autres commandes de la barre : la navigation de
              l'ecran est une commande, pas une extension du titre. `min-w-0`
              laisse le libelle de l'onglet actif se tronquer plutot que pousser
              les icones hors de l'ecran. */}
          <div ref={setTabsSlot} className="flex min-w-0 items-center lg:hidden" />

          <GlobalSearchField />

          <PageHeaderActions filters={filters} actions={actions} narrow={isCompact} />

          {showBack && (
            <Tooltip>
              {/* Le trigger enveloppe un <span> (élément hôte) : Radix y pose sa
                  ref d'ancrage, ce qu'un composant fonction React 18 ne peut pas
                  recevoir. */}
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBack}
                    aria-label={backLabel}
                  >
                    <ArrowLeftIcon className="cn-rtl-flip" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{backLabel}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </header>
  );
}
