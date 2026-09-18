import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from './ui';
import {
  SIDEBAR_FLYOUT_SEAM_OFFSET,
  SIDEBAR_FLYOUT_SEAM_REACH,
  SidebarFlyoutGroup,
  SidebarFlyoutRow,
  sidebarFlyoutClass,
} from './SidebarFlyout';
import { cn } from '../utils/cn';
import type { ResolvedScreenTab } from '../hooks/useScreenTabs';

/**
 * Le TROISIÈME tiroir de la barre latérale — les onglets d'un écran.
 *
 * <p>La barre ouvrait deux niveaux : un hub, puis ses écrans. Elle s'arrêtait à
 * la porte de l'écran, alors que la moitié des écrans du produit sont eux-mêmes
 * une pile d'onglets — « Facturation » en porte sept. Atteindre « Versements
 * prestataires » demandait donc d'ouvrir Finances, de charger Facturation, puis
 * de déplier son sélecteur d'onglets : trois gestes et un écran chargé pour
 * rien. Survoler la ligne le donne en un seul.</p>
 *
 * <p><b>Ce n'est pas un menu de plus</b> : c'est le volet de la barre
 * ({@link sidebarFlyoutClass}) posé sur le bord du niveau précédent. Le fond, la
 * bordure et les congés du raccord sont les mêmes — le panneau de niveau 2 porte
 * le fond de la barre, donc la couture se lit à l'identique qu'elle tombe sur la
 * ligne de la barre (mode déplié) ou sur le bord d'un volet (mode replié). Les
 * lignes sont celles du volet, l'onglet courant porte l'aplat des entrées de
 * navigation.</p>
 *
 * <p><b>Ouverture au CLIC.</b> Le tiroir s'ouvrait au survol, et la barre
 * repliée montrait alors deux choses à la fois : l'infobulle du kit, que le
 * survol déclenche aussi en mode icônes, et le tiroir — deux panneaux ouverts
 * au même geste, qui se chevauchaient. Le clic tranche : l'infobulle reste au
 * survol, le tiroir répond au clic, et la ligne se comporte comme un hub de la
 * barre, qui n'a jamais navigué au clic non plus mais ouvert son niveau
 * suivant. On atteint l'écran par son premier onglet, qui est justement son
 * onglet d'entrée.</p>
 *
 * <p><b>Et au clavier</b> : la flèche vers l'extérieur (droite en LTR, gauche en
 * RTL) ouvre et donne le focus au tiroir, {@code Échap} le referme et rend le
 * focus à la ligne. Le focus n'est pris QUE dans ce cas — une ouverture qui le
 * volerait déplacerait le curseur de saisie de la page.</p>
 */

/**
 * Repli si l'animation d'ouverture ne rend pas la main — un mouvement coupé par
 * {@code prefers-reduced-motion} ne lève aucun {@code animationend}, et le
 * tiroir est alors en place dès la première image.
 */
const LANDED_FALLBACK = 400;

/**
 * Ce à quoi le tiroir est accolé : le volet du hub (barre repliée) ou le flanc
 * de la barre elle-même (barre dépliée). C'est cette BANDE qui porte la ligne
 * verticale dans laquelle les congés du raccord viennent se fondre.
 */
const SEAM_BAND_SELECTOR = '.bui-sidebar-flyout, [data-slot="sidebar-inner"]';

/**
 * Morsure du tiroir sur la bande, en pixels — il recouvre la ligne avec de la
 * marge plutôt que de se poser au pixel près dessus (cf.
 * {@link SIDEBAR_FLYOUT_SEAM_OFFSET}, qui vaut 8 moins cette morsure pour une
 * ancre en retrait de 8).
 */
const SEAM_BITE = 2;

/**
 * Panneaux dont le coin bas, côté couture, est équarri parce qu'un tiroir en
 * sort — et QUI le demande.
 *
 * <p>Le registre est indispensable : au survol on passe d'une ligne à l'autre,
 * et le tiroir qu'on quitte se referme APRÈS l'ouverture du suivant (180 ms
 * contre 120). Le dernier à parler effacerait la marque que le nouveau vient de
 * poser. On compte donc les demandeurs, et la marque ne tombe qu'avec le
 * dernier.</p>
 *
 * <p>C'est le seul endroit où ce module touche au DOM d'un autre : le panneau
 * porteur est rendu par {@code AppSidebar}, dans un autre portail, et ce coin
 * dépend de ce qui sort de lui — pas de ce qu'il est.</p>
 */
const SEAM_CUT_OWNERS = new WeakMap<HTMLElement, Map<symbol, SeamCut>>();

/** Quels coins du panneau porteur cessent d'être des coins libres. */
type SeamCut = 'top' | 'both';

function applySeamCut(panel: HTMLElement) {
  const owners = SEAM_CUT_OWNERS.get(panel);
  if (!owners || owners.size === 0) {
    SEAM_CUT_OWNERS.delete(panel);
    delete panel.dataset.seamCut;
    return;
  }
  panel.dataset.seamCut = [...owners.values()].includes('both') ? 'both' : 'top';
}

function markSeamCut(panel: HTMLElement, owner: symbol, cut: SeamCut) {
  const owners = SEAM_CUT_OWNERS.get(panel) ?? new Map<symbol, SeamCut>();
  owners.set(owner, cut);
  SEAM_CUT_OWNERS.set(panel, owners);
  applySeamCut(panel);
}

function clearSeamCut(panel: HTMLElement, owner: symbol) {
  const owners = SEAM_CUT_OWNERS.get(panel);
  if (!owners) return;
  owners.delete(owner);
  applySeamCut(panel);
}

/**
 * Ce que la mesure a trouvé du bord auquel le tiroir s'accroche — c'est-à-dire,
 * en pratique, ce qu'il y a (ou non) à raccorder EN BAS. En haut la question ne
 * se pose pas : le tiroir affleure, les deux bords sont colinéaires.
 */
type SeamMode =
  /** Le bord du volet court encore un rayon sous le tiroir : congé classique. */
  | 'full'
  /** Les deux bas se rejoignent, ou presque : rien à raccorder. */
  | 'butt'
  /** Le tiroir dépasse de peu : un bord lui faut, un congé n'y tient pas. */
  | 'overhang'
  /** Le tiroir dépasse franchement : congé inversé, porté par la bande. */
  | 'bounded'
  /** Aucun bord exploitable : panneau flottant ordinaire, sans raccord. */
  | 'free';

/** Tiroirs dont la bordure latérale doit être effacée sur la hauteur partagée. */
const SEAM_MODES_WITH_BAND: ReadonlySet<SeamMode> = new Set<SeamMode>([
  'full', 'butt', 'overhang', 'bounded',
]);

interface Seam {
  mode: SeamMode;
  /** Distance du haut du tiroir au bas de la bande, en px — hauteur partagée. */
  end?: number;
}

/**
 * Où s'arrête le bord dans lequel le raccord vient se fondre.
 *
 * <p>Un congé n'est pas dans la boîte du volet : il DÉBORDE de
 * {@link SIDEBAR_FLYOUT_SEAM_REACH} au-dessus et au-dessous. Accolé à la barre,
 * qui court sur toute la hauteur de l'écran, cela ne se voit jamais. Accolé au
 * volet d'un hub — souvent plus COURT que lui, un hub de trois écrans portant
 * des écrans de sept onglets —, le congé du bas tombait sous le bord du panneau
 * et se refermait dans le vide.</p>
 *
 * <p>On ne raccourcit pas le tiroir pour autant, et on ne le fait pas défiler :
 * on POSE la fin de la couture là où le panneau s'arrête. En dessous, le tiroir
 * redevient un panneau ordinaire et le congé du bas s'inverse — il ne raccorde
 * plus le bas du tiroir à la ligne, mais le bas du PANNEAU au flanc du tiroir.
 * Toute la peinture est dans {@code theme/baitly-nova.css}, sous
 * {@code [data-seam='bounded']}.</p>
 */
function useSeam(
  open: boolean,
  anchor: React.RefObject<HTMLElement | null>,
  flush: boolean,
) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [seam, setSeam] = useState<Seam>({ mode: 'full' });

  useLayoutEffect(() => {
    if (!open) {
      setSeam({ mode: 'full' });
      return undefined;
    }

    // Identité de CE tiroir dans le registre des équarrissages.
    const owner = Symbol('seam');
    let cut: HTMLElement | null = null;
    let cutKind: SeamCut | null = null;

    /** Les coins du panneau porteur deviennent (ou cessent d'être) des jonctions. */
    const setCut = (panel: HTMLElement | null, kind: SeamCut = 'top') => {
      if (cut === panel && cutKind === kind) return;
      if (cut) clearSeamCut(cut, owner);
      cut = panel;
      cutKind = panel ? kind : null;
      if (cut && cutKind) markSeamCut(cut, owner, cutKind);
    };

    const measure = () => {
      const panel = innerRef.current?.closest<HTMLElement>('[data-slot="popover-content"]');
      const band = anchor.current?.closest<HTMLElement>(SEAM_BAND_SELECTOR);
      if (!panel || !band) return;

      const box = panel.getBoundingClientRect();
      const bandBox = band.getBoundingClientRect();
      const radius =
        parseFloat(getComputedStyle(panel).getPropertyValue('--bui-flyout-radius')) || 14;

      // Le HAUT du tiroir doit lui aussi trouver du bord. Affleurant, il n'a
      // pas de coin à raccorder — les deux bords hauts sont alignés, la ligne
      // est continue. Sinon, il lui faut un rayon de bord au-dessus de lui :
      // Radix remonte le volet quand il déborde de l'écran, et il peut passer
      // au-dessus du panneau. Un raccord faux vaut moins qu'un panneau
      // franchement détaché.
      if (!flush && bandBox.top > box.top - SIDEBAR_FLYOUT_SEAM_REACH) {
        setCut(null);
        setSeam({ mode: 'free' });
        return;
      }

      // Repère de la bande de couture : elle est positionnée dans la boîte de
      // REMPLISSAGE du volet, d'où le retrait de la bordure haute.
      // Écart des deux bas : tout le choix du raccord en découle.
      const drop = box.bottom - bandBox.bottom;
      const mode: SeamMode =
        // De quoi loger l'arc inversé SOUS le bord du volet, dans le tiroir.
        drop >= radius + 1.5 ? 'bounded'
        // Il dépasse, mais l'arc n'y tiendrait pas : bordure seule.
        : drop > 1 ? 'overhang'
        // Le bord du volet court encore un rayon sous lui : congé classique.
        : drop <= -(radius + 1) ? 'full'
        // Les deux bas se rejoignent, ou presque : angle franc.
        : 'butt';

      // Seul un VOLET a des coins à équarrir ; le flanc de la barre n'en a pas.
      // Le haut dès que le tiroir affleure, le bas dès qu'il l'atteint.
      const carrier = band.classList.contains('bui-sidebar-flyout') ? band : null;
      setCut(flush ? carrier : null, drop >= -1 ? 'both' : 'top');
      setSeam({ mode, end: Math.round(bandBox.bottom - box.top - panel.clientTop) });
    };

    measure();
    // Radix peut remonter le volet au premier rendu s'il dépassait de l'écran :
    // la seconde mesure lit la position RETENUE, pas celle d'avant correction.
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      setCut(null);
    };
  }, [open, anchor, flush]);

  return { innerRef, seam };
}

function useClickDrawer(prepare: () => void) {
  const [open, setOpen] = useState(false);

  // `prepare` est relu au moment de l'ouverture, jamais comparé : il mesure le
  // DOM, et une lambda recréée à chaque rendu ne doit pas réinstaller de rappel.
  const prepareRef = useRef(prepare);
  prepareRef.current = prepare;

  const openNow = useCallback(() => {
    prepareRef.current();
    setOpen(true);
  }, []);
  const closeNow = useCallback(() => setOpen(false), []);

  /**
   * Tout passage à l'ouvert MESURE d'abord — que le geste vienne de la ligne,
   * du clavier ou de Radix (qui pilote lui-même l'ouverture du déclencheur).
   * Sans quoi le tiroir se placerait sur des cotes périmées.
   */
  const onOpenChange = useCallback(
    (next: boolean) => { if (next) openNow(); else setOpen(false); },
    [openNow],
  );

  return { open, onOpenChange, openNow, closeNow };
}

interface TabsDrawerProps {
  /** Intitulé du tiroir : le nom de l'écran dont on déplie les onglets. */
  screenLabel: string;
  /** Onglets VISIBLES de l'écran, dans l'ordre d'affichage. */
  tabs: ResolvedScreenTab[];
  /** Onglet courant — seulement quand l'écran survolé est celui qui est affiché. */
  activeKey?: string;
  side: 'left' | 'right';
  onSelect: (key: string) => void;
}

/** Contenu du tiroir — les primitives du volet, sans rien de neuf. */
function TabsDrawerContent({ screenLabel, tabs, activeKey, onSelect }: Omit<TabsDrawerProps, 'side'>) {
  return (
    <SidebarFlyoutGroup label={screenLabel}>
      {tabs.map((tab) => (
        <SidebarFlyoutRow
          key={tab.key}
          choice={false}
          selected={tab.key === activeKey}
          onSelect={() => onSelect(tab.key)}
        >
          {/* Icône rendue BRUTE, comme la barre rend celles de ses entrées : le
              `[&_svg]:size-4` du bouton lui donne ses 16 px, et son trait reste
              celui de la famille. Forcer un `strokeWidth` l'amincissait à 1,75
              quand la barre dessine à 2 — même boîte, dessin plus maigre, et
              l'œil y lit une autre taille. */}
          {tab.icon ?? <span aria-hidden className="size-4 shrink-0" />}
          <span className="truncate">{tab.label}</span>
        </SidebarFlyoutRow>
      ))}
    </SidebarFlyoutGroup>
  );
}

/**
 * Câblage commun aux deux lignes : temporisation, clavier, volet.
 *
 * <p>Les primitives du kit ({@code SidebarMenuButton},
 * {@code SidebarMenuSubButton}) ne transmettent pas de {@code ref} — ce sont des
 * composants fonction simples. L'ancre Radix et les gestes vivent donc sur une
 * enveloppe, comme pour le volet du hub dans {@code AppSidebar}, et le retour de
 * focus après {@code Échap} va rechercher la ligne par son {@code data-sidebar}
 * plutôt que par une référence directe.</p>
 */
function useTabsDrawerRow({ screenLabel, tabs, activeKey, side, onSelect }: TabsDrawerProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [seamOffset, setSeamOffset] = useState(SIDEBAR_FLYOUT_SEAM_OFFSET);
  const [topOffset, setTopOffset] = useState(0);
  /** Le tiroir sort d'un VOLET, et affleure donc son haut (cf. ci-dessous). */
  const [flush, setFlush] = useState(false);

  /**
   * Où poser le tiroir, mesuré à l'ouverture. Deux écarts, deux raisons.
   *
   * <p><b>De côté.</b> Un écart constant ne vaut que si l'ancre affleure le bord
   * de la bande. C'est le cas dans le volet d'un hub, dont les lignes sont en
   * retrait de 8 px — la valeur pour laquelle {@link SIDEBAR_FLYOUT_SEAM_OFFSET}
   * est réglé. Ce ne l'est PAS dans la barre dépliée : un sous-menu y est en
   * retrait de 32 px (le {@code p-2} du groupe, plus les {@code mx-3.5} /
   * {@code px-2.5} de la liste), et un tiroir posé à 6 px de cette ligne-là
   * s'ouvrirait au beau milieu de la barre. On vise le bord de la BANDE, d'où
   * qu'on parte.</p>
   *
   * <p><b>En hauteur.</b> Aligné sur sa ligne, le tiroir laissait paraître le
   * bord droit du volet au-dessus de lui — un bout de trait qui s'arrêtait net
   * là où le tiroir commençait, alors que les deux pièces sont censées n'en
   * faire qu'une. Sorti au RAS du haut du volet, le bord devient entièrement
   * commun : plus rien à raccorder en haut, les deux bords hauts sont alignés et
   * la ligne est continue.</p>
   *
   * <p>Cela ne vaut que pour un volet. Dans la barre dépliée, la bande est le
   * flanc de la barre — pleine hauteur d'écran : y affleurer enverrait le tiroir
   * en haut de l'écran, à des centaines de pixels de sa ligne. Le tiroir s'y
   * aligne donc sur sa ligne, comme avant.</p>
   */
  const measurePlacement = useCallback(() => {
    const anchor = anchorRef.current;
    const band = anchor?.closest<HTMLElement>(SEAM_BAND_SELECTOR);
    if (!anchor || !band) return;
    const from = anchor.getBoundingClientRect();
    const to = band.getBoundingClientRect();

    const gap = side === 'right' ? to.right - from.right : from.left - to.left;
    setSeamOffset(Math.round(gap) - SEAM_BITE);

    const onPanel = band.classList.contains('bui-sidebar-flyout');
    setFlush(onPanel);
    setTopOffset(onPanel ? Math.round(to.top - from.top) : 0);
  }, [side]);

  const drawer = useClickDrawer(measurePlacement);
  // Une ouverture au clavier prend le focus ; une ouverture au clic, jamais.
  const viaKeyboard = useRef(false);

  const focusRow = () => {
    anchorRef.current
      ?.querySelector<HTMLElement>('[data-sidebar="menu-button"], [data-sidebar="menu-sub-button"]')
      ?.focus();
  };

  const { innerRef, seam } = useSeam(drawer.open, anchorRef, flush);

  /**
   * Le tiroir a fini sa course.
   *
   * <p>Le congé inversé déborde de la boîte du côté de la couture, là même où la
   * fenêtre de découpe rogne pendant la course. Lui ouvrir le passage avant
   * l'arrivée, c'est laisser passer du corps du tiroir à gauche de la couture —
   * invisible sur le volet (même fond), mais bien visible EN DESSOUS, où le
   * tiroir dépasse : son coin y apparaissait en avance puis rejoignait le reste.
   * Le passage ne s'ouvre donc qu'une fois posé (cf. {@code data-seam-ready}).</p>
   */
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    if (!drawer.open) {
      setLanded(false);
      return undefined;
    }
    const timer = setTimeout(() => setLanded(true), LANDED_FALLBACK);
    return () => clearTimeout(timer);
  }, [drawer.open]);

  const outward = side === 'right' ? 'ArrowRight' : 'ArrowLeft';

  /** Posé sur l'enveloppe : les touches lui remontent de la ligne. */
  const anchorProps = {
    ref: anchorRef,
    className: 'w-full',
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === outward) {
        event.preventDefault();
        viaKeyboard.current = true;
        drawer.openNow();
      } else if (event.key === 'Escape' && drawer.open) {
        event.preventDefault();
        drawer.closeNow();
      }
    },
  };

  /**
   * Posé sur la LIGNE : c'est elle qui annonce le tiroir, pas l'enveloppe.
   * `aria-expanded`, lui, est posé par le déclencheur Radix.
   */
  const rowProps = { 'aria-haspopup': 'menu' as const };

  const content = (
    <PopoverContent
      side={side}
      align="start"
      alignOffset={topOffset}
      sideOffset={seamOffset}
      className={cn('w-56 gap-0 p-0', sidebarFlyoutClass)}
      data-seam={seam.mode}
      data-seam-top={flush ? 'flush' : undefined}
      data-seam-ready={landed ? '' : undefined}
      onAnimationEnd={() => setLanded(true)}
      style={
        seam.end != null
          ? ({ '--bui-flyout-seam-end': `${seam.end}px` } as React.CSSProperties)
          : undefined
      }
      onOpenAutoFocus={(event) => { if (!viaKeyboard.current) event.preventDefault(); }}
      // Un clic dehors referme déjà le tiroir ; rendre le focus au corps de la
      // page à ce moment-là ferait sauter la vue. Échap, lui, le rend à la ligne.
      onCloseAutoFocus={(event) => event.preventDefault()}
      onEscapeKeyDown={() => { drawer.closeNow(); focusRow(); }}
    >
      {/* La bande efface la bordure latérale sur la seule hauteur partagée avec
          le volet, et porte le congé inversé à son extrémité basse. */}
      {SEAM_MODES_WITH_BAND.has(seam.mode) && <span aria-hidden className="bui-flyout-seam" />}
      <div ref={innerRef}>
        <TabsDrawerContent
          screenLabel={screenLabel}
          tabs={tabs}
          activeKey={activeKey}
          onSelect={(key) => { drawer.closeNow(); onSelect(key); }}
        />
      </div>
    </PopoverContent>
  );

  const onOpenChange = (next: boolean) => {
    if (!next) viaKeyboard.current = false;
    drawer.onOpenChange(next);
  };

  return { open: drawer.open, onOpenChange, anchorProps, rowProps, content };
}

/** Chevron du niveau suivant — orienté par le sens de lecture, comme la barre. */
function DrawerChevron() {
  return (
    <ChevronRightIcon
      aria-hidden
      className="ms-auto size-4 shrink-0 text-sidebar-foreground/50 rtl:-scale-x-100"
    />
  );
}

interface SidebarTabsRowProps extends TabsDrawerProps {
  /** L'écran est la page courante. */
  isActive: boolean;
  /** Préchauffe la route de l'écran — le tiroir y mène toujours. */
  onPrefetch?: () => void;
  /** Infobulle de la ligne — la barre principale la montre quand elle est repliée. */
  tooltip?: React.ComponentProps<typeof SidebarMenuButton>['tooltip'];
  /** Classes de la ligne (hauteur tactile, par exemple). */
  className?: string;
  /** Posé entre le libellé et le chevron — un compteur, typiquement. */
  trailing?: React.ReactNode;
  /** Contenu de la ligne (le libellé de l'écran). */
  children: React.ReactNode;
}

/**
 * `SidebarMenuButton asChild` AUTOUR du déclencheur, et non l'inverse : Radix
 * pose sur son enfant la ref qui sert d'ancre, et les boutons du kit sont des
 * composants fonction sans `forwardRef` — en React 18 la ref se perdrait en
 * silence. Dans ce sens-là, c'est le `Slot` du kit qui la transmet au
 * déclencheur, qui lui est bien `forwardRef`. C'est aussi lui qui gère la
 * bascule ouvert/fermé : un `onClick` maison rouvrirait le tiroir que le clic
 * dehors vient de refermer.
 */

/**
 * Ligne d'écran de niveau MENU qui déplie ses onglets : dans le volet d'un hub
 * (barre repliée) comme dans la barre principale, pour un écran qui y figure
 * sans parent. Même ligne que {@link SidebarFlyoutRow}, plus le chevron et le
 * tiroir.
 */
export function SidebarTabsFlyoutRow({
  isActive, onPrefetch, tooltip, className, trailing, children, ...drawerProps
}: SidebarTabsRowProps) {
  const { open, onOpenChange, anchorProps, rowProps, content } = useTabsDrawerRow(drawerProps);

  return (
    <SidebarMenuItem>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverAnchor asChild>
          <div {...anchorProps}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={tooltip}
              className={className}
              {...rowProps}
            >
              <PopoverTrigger onMouseEnter={onPrefetch} onFocus={onPrefetch}>
                {children}
                {trailing}
                <DrawerChevron />
              </PopoverTrigger>
            </SidebarMenuButton>
          </div>
        </PopoverAnchor>
        {content}
      </Popover>
    </SidebarMenuItem>
  );
}

/**
 * Ligne d'écran du sous-menu DÉPLIÉ (barre ouverte) qui déplie ses onglets.
 *
 * <p>{@code SidebarMenuSubButton} rend une ancre sans {@code href}, que le
 * clavier n'atteint pas. Le déclencheur Radix qu'elle enveloppe est un vrai
 * bouton : il la remet dans l'ordre de tabulation, sans {@code role} ni
 * {@code tabIndex} postiches.</p>
 */
export function SidebarTabsSubRow({
  isActive, onPrefetch, children, ...drawerProps
}: SidebarTabsRowProps) {
  const { open, onOpenChange, anchorProps, rowProps, content } = useTabsDrawerRow(drawerProps);

  return (
    <SidebarMenuSubItem>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverAnchor asChild>
          <div {...anchorProps}>
            <SidebarMenuSubButton
              asChild
              isActive={isActive}
              className="max-lg:h-9"
              {...rowProps}
            >
              <PopoverTrigger onMouseEnter={onPrefetch} onFocus={onPrefetch}>
                {children}
                <DrawerChevron />
              </PopoverTrigger>
            </SidebarMenuSubButton>
          </div>
        </PopoverAnchor>
        {content}
      </Popover>
    </SidebarMenuSubItem>
  );
}
