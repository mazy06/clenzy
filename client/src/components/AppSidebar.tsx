import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronRightIcon } from 'lucide-react';
import NavCountBadge, { NavCornerCountBadge } from './NavCountBadge';
import {
  ChevronsLeft,
  ChevronsRight,
  Logout,
  Notifications,
  Faders as PreferencesIcon,
} from '../icons';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useSidebar,
} from './ui';
import { CurrencySymbol } from './Money';
import { useAuth } from '../hooks/useAuth';
import { FIELD_ROLES } from '../utils/fieldRoles';
import { useTranslation } from '../hooks/useTranslation';
import { useThemeMode, type ThemeMode } from '../hooks/useThemeMode';
import { useCurrency, type CurrencyCode } from '../hooks/useCurrency';
import { CURRENCY_OPTIONS } from '../utils/currencyUtils';
import { authApi } from '../services/api/authApi';
import { notificationsApi } from '../services/api/notificationsApi';
import { userAvatarSrc } from '../services/api/usersApi';
import keycloak from '../keycloak';
import { clearTokens } from '../services/storageService';
import { groupMenuItems, NAV_GROUP_TRANSLATION_KEYS } from '../hooks/useNavigationMenu';
import type { MenuItem, MenuSubItem, NavGroup } from '../hooks/useNavigationMenu';
import { useVisibleScreenTabs, type ResolvedScreenTab } from '../hooks/useScreenTabs';
import { prefetchRoute } from '../modules/routePrefetch';
import SidebarAssistantLauncher from './SidebarAssistantLauncher';
import {
  SIDEBAR_FLYOUT_ALIGN_OFFSET,
  SIDEBAR_FLYOUT_SEAM_OFFSET,
  SidebarFlyoutGroup,
  SidebarFlyoutNote,
  SidebarFlyoutRow,
  SidebarFlyoutSeparator,
  sidebarFlyoutClass,
} from './SidebarFlyout';
import { SidebarTabsFlyoutRow, SidebarTabsSubRow } from './SidebarTabsDrawer';
import { cn } from '../utils/cn';

/**
 * Navigation principale, portée sur le kit Baitly UI.
 *
 * Contrat de non-régression : `components/SIDEBAR-PARITY.md`. Toute
 * fonctionnalité de l'ancienne sidebar MUI y est listée — notamment les
 * **quatre boutons du pied** (préférences, notifications, déconnexion, repli),
 * absents de la projection de galerie.
 *
 * Trois choix arbitrés à la migration :
 *  - coquille shadcn complète (`SidebarProvider` dans `MainLayoutFull`) ;
 *  - palette `--bui-sidebar-*` en remplacement des `--nav-*` ;
 *  - un clic sur une entrée de hub **déplie** son sous-menu, la navigation se
 *    fait par les onglets. Exception en mode icônes, où le sous-menu est masqué
 *    par le kit : le hub ouvre alors ses onglets dans un VOLET accolé à la barre
 *    (cf. `SidebarFlyout`), le même que les préférences du pied.
 */

const GROUP_ORDER: NavGroup[] = ['main', 'management', 'admin'];


/**
 * Pastille « non lus » de la cloche, isolée pour que le tick du poll ne re-rende
 * que ce composant. React Query met le `refetchInterval` en pause quand l'onglet
 * est caché, et le poll s'arrête si le backend signale l'endpoint indisponible.
 *
 * Rend la MÊME pastille que la navigation repliée ({@link NavCornerCountBadge}) :
 * la cloche est un bouton icône, donc c'est la variante « coin d'icône » qui
 * s'applique, pas la pilule pleine largeur des lignes de menu. Elle affiche le
 * NOMBRE de non-lus, comme le compteur de Planning — un simple point perdrait
 * l'information alors que le backend la fournit déjà.
 */
function UnreadNotificationsBadge() {
  const { data } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
    refetchInterval: () => (notificationsApi._endpointAvailable ? 30_000 : false),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  return <NavCornerCountBadge count={data?.count} tone="error" />;
}

function NavBadge({ item }: { item: MenuItem }) {
  return (
    <NavCountBadge count={item.badge} tone={item.badgeColor} className="ms-auto" />
  );
}

/**
 * Compteur ancré au coin de l'icône — n'apparaît QU'EN mode icônes (sidebar
 * repliée), où le compteur de fin de ligne n'a plus de place. Même pastille du
 * kit, réduite à 16 px : replier la sidebar ne coûte pas le chiffre.
 */
function NavBadgeDot({ item }: { item: MenuItem }) {
  return (
    <NavCornerCountBadge
      count={item.badge}
      tone={item.badgeColor}
      className="hidden group-data-[collapsible=icon]:inline-flex"
    />
  );
}

/**
 * Onglet courant d'un écran — `undefined` si ce n'est pas l'écran affiché.
 *
 * <p>Même résolution que `tabIndexFromKey` : une clé d'URL inconnue replie sur
 * l'onglet d'entrée, sans quoi la barre ne marquerait aucune ligne là où la
 * page en marque une.</p>
 */
function activeTabKey(
  location: ReturnType<typeof useLocation>,
  path: string,
  tabs: ResolvedScreenTab[],
): string | undefined {
  if (location.pathname !== path) return undefined;
  const raw = new URLSearchParams(location.search).get('tab');
  return tabs.some((tab) => tab.key === raw) ? (raw as string) : tabs[0].key;
}

/**
 * Une ligne d'ÉCRAN du sous-menu d'un hub — dans le volet (barre repliée) ou
 * dans le sous-menu déplié.
 *
 * <p>Quand l'écran porte lui-même des onglets, la ligne devient le seuil d'un
 * TROISIÈME tiroir qui les déplie au survol (cf. {@code SidebarTabsDrawer}).
 * Sinon, c'est exactement la ligne d'avant : un écran sans onglets — ou dont un
 * seul onglet est accessible, auquel cas la page ne dessine même pas de barre
 * d'onglets — n'a rien à déplier.</p>
 */
function NavScreenRow({
  child,
  variant,
  isActive,
  onNavigate,
  onDone,
  side,
}: {
  child: MenuSubItem;
  /** Où vit la ligne : dans le volet du hub, ou dans le sous-menu déplié. */
  variant: 'flyout' | 'sub';
  isActive: boolean;
  onNavigate: (path: string) => void;
  /** Referme le volet du hub après un choix (mode replié). */
  onDone?: () => void;
  side: 'left' | 'right';
}) {
  const location = useLocation();
  const tabs = useVisibleScreenTabs(child.path);

  const prefetch = () => prefetchRoute(child.path);
  const go = (path: string) => {
    onNavigate(path);
    onDone?.();
  };

  if (tabs.length < 2) {
    if (variant === 'flyout') {
      return (
        <SidebarFlyoutRow choice={false} selected={isActive} onSelect={() => go(child.path)}>
          <span className="truncate">{child.text}</span>
        </SidebarFlyoutRow>
      );
    }
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          isActive={isActive}
          onClick={() => go(child.path)}
          onMouseEnter={prefetch}
          onFocus={prefetch}
          className="max-lg:h-9"
        >
          <span className="truncate">{child.text}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  }

  const activeKey = activeTabKey(location, child.path, tabs);

  const Row = variant === 'flyout' ? SidebarTabsFlyoutRow : SidebarTabsSubRow;

  return (
    <Row
      screenLabel={child.text}
      tabs={tabs}
      activeKey={activeKey}
      side={side}
      isActive={isActive}
      onPrefetch={prefetch}
      onSelect={(key) => go(`${child.path}?tab=${key}`)}
    >
      <span className="truncate">{child.text}</span>
    </Row>
  );
}

interface NavEntryProps {
  item: MenuItem;
  isActive: boolean;
  isSubActive: (paths: string[], path: string) => boolean;
  onNavigate: (path: string) => void;
  tooltipSide: 'left' | 'right';
}

function NavEntry({ item, isActive, isSubActive, onNavigate, tooltipSide }: NavEntryProps) {
  const { state, isMobile } = useSidebar();
  const location = useLocation();
  const iconOnly = state === 'collapsed' && !isMobile;
  const hasChildren = (item.children?.length ?? 0) > 0;
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  // Les onglets de l'écran, pour une entrée SANS parent : elle est alors le
  // seuil du tiroir d'onglets, exactement comme la ligne d'écran d'un hub.
  // Appelé sans condition — un hub le laisse simplement de côté.
  const screenTabs = useVisibleScreenTabs(item.path);

  const prefetch = () => prefetchRoute(item.path);

  const label = (
    <>
      <span className="relative inline-flex shrink-0">
        {item.icon}
        <NavBadgeDot item={item} />
      </span>
      <span className="truncate">{item.text}</span>
    </>
  );

  // Entrée sans parent qui porte ses PROPRES onglets : la ligne les déplie au
  // clic, comme le faisait la ligne d'écran quand elle vivait sous un hub, et
  // comme un hub déplie ses écrans. Sans cela, remonter un écran au premier
  // niveau lui coûtait son tiroir.
  if (!hasChildren && screenTabs.length >= 2) {
    return (
      <SidebarTabsFlyoutRow
        screenLabel={item.text}
        tabs={screenTabs}
        activeKey={activeTabKey(location, item.path, screenTabs)}
        side={tooltipSide}
        isActive={isActive}
        onSelect={(key) => onNavigate(`${item.path}?tab=${key}`)}
        onPrefetch={prefetch}
        tooltip={{ children: item.text, side: tooltipSide }}
        className="max-lg:h-10"
        trailing={<NavBadge item={item} />}
      >
        {label}
      </SidebarTabsFlyoutRow>
    );
  }

  // Entrée simple : le clic navigue.
  if (!hasChildren) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={isActive}
          tooltip={{ children: item.text, side: tooltipSide }}
          onClick={() => onNavigate(item.path)}
          onMouseEnter={prefetch}
          onFocus={prefetch}
          className="max-lg:h-10"
        >
          {label}
          <NavBadge item={item} />
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  /* ── Hub en mode icônes : ses onglets dans un VOLET ────────────────────────
     Le kit masque les sous-menus dans le rail : déplier n'y aurait aucun effet
     visible. Le clic envoyait donc vers le premier onglet, ce qui faisait
     disparaître les autres du rail — on ne pouvait plus atteindre « Propriétés »
     sans passer par « Exploitation » puis ses onglets. Le hub ouvre maintenant
     ses onglets dans le même volet que les préférences (cf. `SidebarFlyout`).

     L'ANCRE est le `div` pleine largeur, pas le bouton : dans le rail le kit
     réduit celui-ci à un carré de 32 px, alors que le `div` occupe la boîte de
     contenu du groupe — son bord est donc à 8 px de la ligne de la barre, comme
     la rangée du pied, et `SIDEBAR_FLYOUT_SEAM_OFFSET` vaut pour les deux.

     `SidebarMenuButton asChild` autour du `PopoverTrigger`, et non l'inverse :
     Radix pose sur son enfant la ref qui sert d'ancre, et `SidebarMenuButton`
     est un composant fonction sans `forwardRef` — en React 18 la ref se perd en
     silence. Dans ce sens-là c'est le `Slot` du kit qui la transmet au trigger,
     qui lui est bien `forwardRef`. */
  if (iconOnly) {
    return (
      <SidebarMenuItem>
        <Popover open={flyoutOpen} onOpenChange={setFlyoutOpen}>
          <PopoverAnchor asChild>
            <div className="w-full">
              <SidebarMenuButton
                asChild
                isActive={isActive}
                tooltip={{ children: item.text, side: tooltipSide }}
                className={cn(flyoutOpen && 'bg-sidebar-accent text-sidebar-accent-foreground')}
              >
                <PopoverTrigger onMouseEnter={prefetch} onFocus={prefetch}>
                  {label}
                  <NavBadge item={item} />
                </PopoverTrigger>
              </SidebarMenuButton>
            </div>
          </PopoverAnchor>
          <PopoverContent
            side={tooltipSide}
            align="start"
            sideOffset={SIDEBAR_FLYOUT_SEAM_OFFSET}
            className={cn('w-56 gap-0 p-0', sidebarFlyoutClass)}
          >
            <SidebarFlyoutGroup label={item.text}>
              {item.children!.map((child) => (
                <NavScreenRow
                  key={child.path}
                  child={child}
                  variant="flyout"
                  isActive={isSubActive(child.matchPaths, child.path)}
                  onNavigate={onNavigate}
                  onDone={() => setFlyoutOpen(false)}
                  side={tooltipSide}
                />
              ))}
            </SidebarFlyoutGroup>
          </PopoverContent>
        </Popover>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible asChild defaultOpen={isActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={isActive}
            tooltip={{ children: item.text, side: tooltipSide }}
            onMouseEnter={prefetch}
            onFocus={prefetch}
            className="max-lg:h-10"
          >
            {label}
            <NavBadge item={item} />
            <ChevronRightIcon
              className={cn(
                'size-4 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 rtl:-scale-x-100',
                item.badge == null || item.badge <= 0 ? 'ms-auto' : ''
              )}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children!.map((child) => (
              <NavScreenRow
                key={child.path}
                child={child}
                variant="sub"
                isActive={isSubActive(child.matchPaths, child.path)}
                onNavigate={onNavigate}
                side={tooltipSide}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

interface AppSidebarProps {
  menuItems: MenuItem[];
  /** Repli piloté par `useSidebarState` (persisté en localStorage). */
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function AppSidebar({
  menuItems,
  isCollapsed,
  onToggleCollapsed,
}: AppSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clearUser } = useAuth();
  const { t, changeLanguage, currentLanguage, isArabic } = useTranslation();
  const { currency, setCurrency, rateDate, ratesLoading } = useCurrency();
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();
  const { isMobile, setOpenMobile } = useSidebar();
  const [prefsOpen, setPrefsOpen] = useState(false);

  /**
   * La barre est-elle une CLOISON — un rail fixe bordant le contenu ? C'est la
   * condition du volet (cf. `SidebarFlyout`). Sous 1024 px elle devient une
   * feuille latérale posée sur un voile : il n'y a plus de couture à raccorder,
   * et un volet ouvert sur le côté sortirait de l'écran.
   */
  const flyoutAttached = !isMobile;

  // La langue, pas `document.documentElement.dir` : cette lecture-là se faisait
  // une fois au rendu et ne rebasculait pas quand l'utilisateur changeait de
  // langue sans recharger la page.
  const isRtl = isArabic;
  const tooltipSide = isRtl ? ('left' as const) : ('right' as const);

  const grouped = useMemo(() => groupMenuItems(menuItems), [menuItems]);

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.username ||
    t('navigation.defaultUser');
  const userInitials =
    `${user?.firstName?.charAt(0) ?? ''}${user?.lastName?.charAt(0) ?? ''}`.toUpperCase() ||
    user?.username?.charAt(0)?.toUpperCase() ||
    'U';

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) setOpenMobile(false);
  };

  /**
   * Destination de la carte utilisateur du pied.
   *
   * <p>Elle pointait sur `/settings`, dont la route exige `settings:view` —
   * permission absente des roles operationnels. Une gouvernante qui cliquait
   * sur son propre nom tombait sur « Acces restreint ».</p>
   *
   * <p>Le ROLE prime sur la permission : `settings:view` avait ete accordee a
   * la main a un compte technicien, qui se retrouvait donc envoye sur les
   * reglages de l'ORGANISATION en cliquant son propre nom. Un intervenant va
   * toujours sur « Mon compte » — ses conditions, ses justificatifs, sa zone,
   * ses notifications.</p>
   */
  const isFieldWorker = FIELD_ROLES.some((role) => user?.roles?.includes(role));
  const accountPath = !isFieldWorker && user?.permissions?.includes('settings:view')
    ? '/settings'
    : '/account';

  /** Un hub reste actif sur toutes les routes couvertes par ses onglets. */
  const matches = (paths: string[], exact: string) =>
    location.pathname === exact
    || paths.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`));

  const isActive = (item: MenuItem) => matches(item.matchPaths ?? [], item.path);

  const handleLogout = async () => {
    try {
      await authApi.logout();
      clearTokens();
      keycloak.token = undefined;
      keycloak.refreshToken = undefined;
      keycloak.authenticated = false;
      clearUser();
      window.dispatchEvent(new CustomEvent('keycloak-auth-logout'));
    } catch {
      // silencieux — l'utilisateur est déconnecté côté client quoi qu'il arrive
    }
  };

  // `max-lg:h-11` — sous 768 px la sidebar est une feuille tactile : 32 px de
  // haut est sous le seuil confortable au doigt.
  const footerButtonClass = cn(
    'flex h-8 flex-1 cursor-pointer items-center justify-center rounded-lg text-sidebar-foreground/60 max-lg:h-11',
    'outline-none transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
    'focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50',
    'disabled:pointer-events-none disabled:opacity-40',
    'group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex-none'
  );

  return (
    // En arabe, la barre passe à droite : elle est le point de départ de la
    // lecture, et la laisser à gauche coupait le sens de parcours de l'écran.
    <Sidebar collapsible="icon" side={isRtl ? 'right' : 'left'}>
      {/* ── Logo → assistant Baitly ────────────────────────────────────────
          Le logo menait au tableau de bord ; celui-ci a son entrée dans la
          navigation ci-dessous, alors que l'assistant n'en avait pas d'autre
          que l'encoche flottante, supprimée. Cf. SidebarAssistantLauncher. */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarAssistantLauncher side={tooltipSide} />
        </SidebarMenu>
      </SidebarHeader>

      {/* ── Navigation par groupes ─────────────────────────────────────── */}
      <SidebarContent>
        {GROUP_ORDER.map((groupKey) => {
          const items = grouped[groupKey];
          if (!items || items.length === 0) return null;
          return (
            <SidebarGroup key={groupKey}>
              <SidebarGroupLabel>{t(NAV_GROUP_TRANSLATION_KEYS[groupKey])}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <NavEntry
                      key={item.id}
                      item={item}
                      isActive={isActive(item)}
                      isSubActive={matches}
                      onNavigate={handleNavigation}
                      tooltipSide={tooltipSide}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      {/* ── Carte utilisateur + quatre actions ─────────────────────────── */}
      <SidebarFooter>
        {/* Sur la feuille laterale (mobile), l'identite et les actions tiennent
            sur UNE ligne : la feuille est plus large que le rail de bureau, et
            deux rangees y empilaient de l'air en bas d'ecran. Sur le rail
            (~256 px) elles restent superposees — un avatar, un nom, un role et
            quatre icones n'y tiennent pas cote a cote. */}
        <div className={cn(isMobile && 'flex items-center gap-1')}>
        <SidebarMenu className={cn(isMobile && 'min-w-0 flex-1')}>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={{
                children: [displayName, user?.email].filter(Boolean).join(' — '),
                side: tooltipSide,
              }}
              aria-label={displayName}
              onClick={() => handleNavigation(accountPath)}
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarImage src={userAvatarSrc(user)} alt="" />
                <AvatarFallback className="rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 text-start leading-tight">
                <span className="truncate text-[13px] font-semibold">{displayName}</span>
                {user?.roles && user.roles.length > 0 && (
                  // `/70` et non `/60` : a 60 % l'encre de la sidebar tombait a
                  // 4,03:1 sur son fond clair, sous le seuil AA — mesure au
                  // navigateur. A 70 % elle vaut 5,47:1 et reste nettement
                  // secondaire face au nom. Le mode sombre passait deja (5,61).
                  <span className="truncate text-[10.5px] text-sidebar-foreground/70">
                    {t(`navigation.roles.${user.roles[0]}`) || user.roles[0]}
                  </span>
                )}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Le panneau apparence / langue / devise est RACCORDÉ à la barre par
            deux congés concaves (cf. `SidebarFlyout`), et son ANCRE est la
            RANGÉE d'actions, pas le bouton : le côté d'ouverture se mesure au
            bord de l'ancre, et ce bouton est le premier de quatre — le panneau se
            serait ouvert au tiers de la barre. La rangée, elle, occupe exactement
            la boîte de contenu du pied : son bord est à 8 px de la ligne de la
            barre, dépliée comme repliée, sur une ligne comme en colonne. C'est ce
            8 que rattrape le décalage, au pixel près — le congé cale son arc sur
            la médiane de la ligne. */}
        <Popover open={prefsOpen} onOpenChange={setPrefsOpen}>
        <PopoverAnchor asChild>
        <div className={cn(
          'flex items-center gap-1 px-1 pb-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-0',
          isMobile && 'shrink-0 pb-0',
        )}>
          {/* Apparence / langue / devise */}
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger
                aria-label={t('navigation.languageAndCurrency')}
                className={cn(
                  footerButtonClass,
                  // Le bouton reste allumé tant que le panneau est ouvert : le
                  // raccord se fait au bord de la barre, pas au bouton, et en
                  // mode icônes les quatre boutons sont empilés — c'est donc
                  // cette encre qui dit lequel a ouvert le panneau.
                  'data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground',
                )}
              >
                <PreferencesIcon size={16} />
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side={isCollapsed ? tooltipSide : 'top'}>
              {t('navigation.languageAndCurrency')}
            </TooltipContent>
          </Tooltip>
          {/* `align="end"` : le volet part du bas de la barre, du côté des
              boutons qui l'ouvrent. `alignOffset` l'en recule : les congés
              débordent du volet, et celui du bas serait passé sous le bord de la
              fenêtre. */}
          <PopoverContent
            side={flyoutAttached ? tooltipSide : 'top'}
            align={flyoutAttached ? 'end' : isRtl ? 'end' : 'start'}
            sideOffset={flyoutAttached ? SIDEBAR_FLYOUT_SEAM_OFFSET : undefined}
            alignOffset={flyoutAttached ? SIDEBAR_FLYOUT_ALIGN_OFFSET : undefined}
            className={cn(
              // `gap-0 p-0` : le rythme intérieur vient des groupes, comme dans
              // la barre — 8 px de groupe, intitulés et lignes à 16 px du bord.
              'w-56 gap-0 p-0',
              flyoutAttached && sidebarFlyoutClass,
              !flyoutAttached && 'p-1',
            )}
          >
            <SidebarFlyoutGroup label={t('navigation.appearance', 'Apparence')}>
              {/* Le sélecteur de teinte d'accent a été retiré : l'identité Baitly
                  est MONOCHROME (bleu nuit du wordmark). Aucune surface ne lit
                  plus `--accent`, un sélecteur n'aurait donc plus rien reteint.
                  Reste le mode clair/sombre. */}
              {(
                [
                  { value: 'light', label: t('navigation.themeLight', 'Clair') },
                  { value: 'dark', label: t('navigation.themeDark', 'Sombre') },
                  { value: 'auto', label: t('navigation.themeAuto', 'Auto') },
                ] as Array<{ value: ThemeMode; label: string }>
              ).map((opt) => (
                <SidebarFlyoutRow
                  key={opt.value}
                  selected={themeMode === opt.value}
                  onSelect={() => setThemeMode(opt.value)}
                >
                  <span className="truncate">{opt.label}</span>
                </SidebarFlyoutRow>
              ))}
            </SidebarFlyoutGroup>

            <SidebarFlyoutSeparator />

            <SidebarFlyoutGroup label={t('navigation.language')}>
              {(['fr', 'en', 'ar'] as const).map((lang) => (
                <SidebarFlyoutRow
                  key={lang}
                  selected={currentLanguage === lang}
                  onSelect={() => changeLanguage(lang)}
                >
                  <span className="truncate">{t(`navigation.languages.${lang}`)}</span>
                </SidebarFlyoutRow>
              ))}
            </SidebarFlyoutGroup>

            <SidebarFlyoutSeparator />

            <SidebarFlyoutGroup label={t('navigation.currency')}>
              {CURRENCY_OPTIONS.map((opt) => (
                <SidebarFlyoutRow
                  key={opt.code}
                  selected={currency === opt.code}
                  onSelect={() => setCurrency(opt.code as CurrencyCode)}
                >
                  {/* MAD/SAR n'ont pas de glyphe Unicode rendu → icône, alors
                      que l'euro est un simple caractère. D'où la case de 16 px,
                      qui leur donne la MÊME emprise : sans elle les libellés ne
                      s'alignaient plus d'une devise à l'autre. 16 px, soit la
                      case d'une icône de navigation — et le kit y cale de toute
                      façon tout SVG d'une ligne de menu, la taille propre du
                      symbole n'a donc plus cours ici. */}
                  <span className="flex size-4 shrink-0 items-center justify-center text-sm font-semibold">
                    <CurrencySymbol code={opt.code} />
                  </span>
                  <span className="truncate">{opt.label}</span>
                </SidebarFlyoutRow>
              ))}
            </SidebarFlyoutGroup>

            {rateDate && currency !== 'EUR' && (
              <SidebarFlyoutNote>
                {ratesLoading ? t('common.loading') : `${t('common.ratesAt')} ${rateDate}`}
              </SidebarFlyoutNote>
            )}
          </PopoverContent>

          {/* Notifications */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t('notifications.title')}
                onClick={() => handleNavigation('/notifications')}
                className={footerButtonClass}
              >
                <span className="relative inline-flex">
                  <Notifications size={16} strokeWidth={1.75} />
                  <UnreadNotificationsBadge />
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side={isCollapsed ? tooltipSide : 'top'}>
              {t('notifications.title')}
            </TooltipContent>
          </Tooltip>

          {/* Déconnexion */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t('navigation.logout')}
                onClick={handleLogout}
                className={footerButtonClass}
              >
                <Logout size={16} strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent side={isCollapsed ? tooltipSide : 'top'}>
              {t('navigation.logout')}
            </TooltipContent>
          </Tooltip>

          {/* Réduire / étendre — desktop uniquement (sous 1024 px la sidebar
              est une feuille latérale, où le repli n'a pas de sens). */}
          {!isMobile && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={isCollapsed ? t('common.expandMenu') : t('common.collapseMenu')}
                  onClick={onToggleCollapsed}
                  className={footerButtonClass}
                >
                  {/* Replié : le chevron pointe vers l'extérieur (déployer) ;
                      déployé : vers l'intérieur (replier). Les deux s'inversent
                      en RTL — d'où la comparaison des deux booléens. */}
                  {isCollapsed === isRtl ? (
                    <ChevronsLeft size={16} strokeWidth={1.75} />
                  ) : (
                    <ChevronsRight size={16} strokeWidth={1.75} />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side={isCollapsed ? tooltipSide : 'top'}>
                {isCollapsed ? t('common.expandMenu') : t('common.collapseMenu')}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        </PopoverAnchor>
        </Popover>
        </div>
      </SidebarFooter>

      {!isMobile && <SidebarRail />}
    </Sidebar>
  );
}
