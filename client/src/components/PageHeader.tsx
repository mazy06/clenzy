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
  /**
   * Commandes de l'ecran rendues EN CLAIR dans la barre, juste avant la
   * recherche — typiquement une navigation de periode, dont le sens se perd
   * derriere un declencheur unique : on ne lit plus quel mois est affiche sans
   * ouvrir le menu.
   *
   * Elles ne restent en clair que tant que la barre a la place : sous `xl`
   * (1280 px, cf. `canInlineControls`) elles rejoignent le repli du header — le
   * popover de filtres, puis le menu d'actions sous `lg` — au lieu d'ecraser le
   * titre.
   */
  inlineControls?: React.ReactNode;
  showBackButton?: boolean;
  showBackButtonWithActions?: boolean;
  className?: string;
}

/**
 * Header de page standardise du PMS Baitly (kit Baitly UI).
 *
 * Structure — UNE seule ligne :
 *   [icône] Titre │ Onglet ⌄  [puce]   [commandes] [recherche] [filtres] [actions] [retour]
 *
 * Le fil d'Ariane a été retiré : il coûtait une ligne pour redire ce que la
 * barre latérale montre déjà (où l'on est) et ce que le titre porte désormais
 * (l'onglet actif). La navigation entre écrans passe par la barre latérale.
 *
 * Quatre invariants produits :
 *   - le TITRE dit l'écran ET l'endroit où l'on se trouve dedans : l'onglet
 *     actif y est accolé derrière un filet, sous forme de SÉLECTEUR — c'est de
 *     là qu'on change d'onglet, la bande d'onglets n'existe plus. L'écran n'a
 *     pas à recomposer son titre (cf. PageTitle, PageTabs) ;
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
  inlineControls,
  showBackButton = true,
  showBackButtonWithActions = false,
  className,
}: PageHeaderProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { setTabsSlot } = useScreenChrome();
  // `lg` de Tailwind (1024 px) — le MEME seuil que toutes les autres bascules de
  // cette barre : declencheur de sidebar (`lg:hidden`), repli des actions.
  //
  // Il valait 767,98 px, ce que son commentaire decrivait deja — a tort — comme
  // aligne sur le reste. Entre 768 et 1023 px la barre portait donc d'un coup le
  // declencheur de sidebar, le titre, le MENU D'ONGLETS, la recherche, toutes les
  // actions et le retour : c'est la largeur ou l'espace manque le plus, et la
  // seule ou rien ne se repliait.
  const isCompact = useMediaQuery('(max-width: 1023.98px)');

  // Seuil PROPRE aux commandes en clair, plus haut que `lg` : le groupe type
  // (navigation de periode + selecteur d'echelle) pese ~530 px et la barre
  // porte deja la recherche (256 px) et ses icones. Sous `xl`, le titre — seul
  // element elastique de la ligne — serait ecrase avant que le groupe ne cede.
  const canInlineControls = useMediaQuery('(min-width: 1280px)');

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

  // Repliees, les commandes en clair ouvrent la meme couche que les filtres —
  // elles y arrivent EN TETE, avant eux : ce sont des commandes de navigation,
  // on les cherche en haut du panneau. Le ternaire garde `undefined` quand il
  // n'y a rien a replier, sans quoi le fragment vide rendrait le declencheur
  // « Filtres » sur un panneau vide.
  const foldedFilters =
    !canInlineControls && inlineControls ? (
      <>
        {inlineControls}
        {filters}
      </>
    ) : (
      filters
    );

  return (
    <header className={cn('mb-1.5 flex flex-col gap-1.5 lg:mb-3', className)}>
      {/* UNE ligne, jamais deux. `flex-wrap` + `justify-between` faisait passer
          les commandes a la ligne des 375 px, et `justify-between` poussait
          alors le titre contre le bord DROIT : le regard partait a droite pour
          lire ou il etait, puis revenait a gauche pour agir. Le titre absorbe
          desormais l'espace et se tronque ; les commandes ne se compriment
          jamais — ce sont deja des icones. */}
      <div className="flex items-center gap-2">
        {/* Le bouton de la sidebar occupait une bande de 48 px a lui seul sous
            1024 px. Il rejoint la ligne du titre : le seuil du kit sidebar
            (SIDEBAR_SHEET_BREAKPOINT) vaut deja lg, les deux coincident. */}
        <SidebarTrigger className="-ml-1 shrink-0 lg:hidden" />

        {/* `flex-1` a TOUTES les largeurs : le selecteur d'onglet ayant rejoint
            le titre, il n'y a plus deux blocs a rapprocher — il y a une ligne
            qui commence a gauche et des commandes qui finissent a droite. */}
        <PageTitle
          className="flex-1"
          title={title}
          description={subtitle}
          adornment={titleAdornment}
          /* Accueille le sélecteur d'onglet de `PageTabs`, accolé au titre.
             Les classes de fonte sont posées ICI et pas dans le portail : le
             filet du séparateur est dimensionné en `em`, il doit hériter de la
             taille du titre pour tomber à la même hauteur que celui du h1. */
          segmentSlot={
            <div
              ref={setTabsSlot}
              /* `shrink-0` + plafond : toute la compression tombait sur le
                 selecteur (le titre a un `flex-1`, donc une base nulle, donc un
                 poids de retrecissement nul). « Vue d'ensemble » se reduisait a
                 « Vu… » sur une fiche au nom long — un onglet qu'on ne peut plus
                 lire ne sert plus a se reperer. */
              className="cn-font-heading flex min-w-0 max-w-[50%] shrink-0 items-center gap-2 text-lg tracking-tight lg:text-xl"
            />
          }
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

        <div className="flex shrink-0 items-center gap-2">
          {/* Commandes en clair — AVANT la recherche : elles portent l'etat de
              l'ecran (la periode affichee), la recherche n'est qu'un point
              d'entree. Sous `xl` elles rejoignent le repli (cf. foldedFilters). */}
          {canInlineControls && inlineControls}

          <GlobalSearchField />

          <PageHeaderActions filters={foldedFilters} actions={actions} narrow={isCompact} />

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
