import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronRightIcon } from 'lucide-react';
import {
  ChevronsLeft,
  ChevronsRight,
  Logout,
  Notifications,
  Faders as PreferencesIcon,
  Check as CheckIcon,
} from '../icons';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
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
import { useTranslation } from '../hooks/useTranslation';
import { useThemeMode, type ThemeMode } from '../hooks/useThemeMode';
import { ACCENT_OPTIONS, type AccentName } from '../theme/signature/accent';
import { useAccent } from '../hooks/useAccent';
import { useCurrency, type CurrencyCode } from '../hooks/useCurrency';
import { CURRENCY_OPTIONS } from '../utils/currencyUtils';
import { authApi } from '../services/api/authApi';
import { notificationsApi } from '../services/api/notificationsApi';
import { userAvatarSrc } from '../services/api/usersApi';
import keycloak from '../keycloak';
import { clearTokens } from '../services/storageService';
import { groupMenuItems, NAV_GROUP_TRANSLATION_KEYS } from '../hooks/useNavigationMenu';
import type { MenuItem, NavGroup } from '../hooks/useNavigationMenu';
import { prefetchRoute } from '../modules/routePrefetch';
import BaitlyMarkLogo from './BaitlyMarkLogo';
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
 *    par le kit : le clic navigue alors vers le premier onglet, sinon il ne
 *    ferait rien.
 */

const GROUP_ORDER: NavGroup[] = ['main', 'management', 'admin'];

/** Couleur de pastille par sévérité — les cinq tons de l'ancienne sidebar. */
const BADGE_TONE: Record<NonNullable<MenuItem['badgeColor']>, string> = {
  warning: 'bg-warning text-primary-foreground',
  error: 'bg-destructive text-destructive-foreground',
  success: 'bg-success text-primary-foreground',
  info: 'bg-info text-primary-foreground',
  primary: 'bg-primary text-primary-foreground',
};

/**
 * Pastille « non lus » de la cloche, isolée pour que le tick du poll ne re-rende
 * que ce composant. React Query met le `refetchInterval` en pause quand l'onglet
 * est caché, et le poll s'arrête si le backend signale l'endpoint indisponible.
 */
function UnreadNotificationsDot() {
  const { data } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
    refetchInterval: () => (notificationsApi._endpointAvailable ? 30_000 : false),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  if (!data || data.count === 0) return null;

  return (
    <span className="pointer-events-none absolute -top-0.5 -end-0.5 size-[7px] rounded-full bg-destructive ring-2 ring-sidebar" />
  );
}

function NavBadge({ item }: { item: MenuItem }) {
  if (item.badge == null || item.badge <= 0) return null;
  return (
    <span
      className={cn(
        'ms-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-bold tabular-nums',
        BADGE_TONE[item.badgeColor ?? 'warning'],
        // Sur l'item actif, la pastille se fond dans le fond d'accent.
        'group-data-[active=true]/menu-button:bg-sidebar-accent-foreground/25'
      )}
    >
      {item.badge > 99 ? '99+' : item.badge}
    </span>
  );
}

/** Point de badge ancré au coin de l'icône — utilisé en mode icônes. */
function NavBadgeDot({ item }: { item: MenuItem }) {
  if (item.badge == null || item.badge <= 0) return null;
  return (
    <span
      className={cn(
        'pointer-events-none absolute -top-0.5 -end-0.5 hidden size-2 rounded-full ring-[1.5px] ring-sidebar group-data-[collapsible=icon]:block',
        BADGE_TONE[item.badgeColor ?? 'warning']
      )}
    />
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
  const iconOnly = state === 'collapsed' && !isMobile;
  const hasChildren = (item.children?.length ?? 0) > 0;

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

  // Entrée simple, ou mode icônes : le clic navigue. En mode icônes le
  // sous-menu est masqué par le kit — déplier n'aurait aucun effet visible.
  if (!hasChildren || iconOnly) {
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
              <SidebarMenuSubItem key={child.path}>
                <SidebarMenuSubButton
                  isActive={isSubActive(child.matchPaths, child.path)}
                  onClick={() => onNavigate(child.path)}
                  onMouseEnter={() => prefetchRoute(child.path)}
                  onFocus={() => prefetchRoute(child.path)}
                  className="max-lg:h-9"
                >
                  <span className="truncate">{child.text}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

/** Ligne d'option du panneau de préférences : libellé + coche si active. */
function PreferenceRow({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-start text-[13px]',
        'outline-none transition-colors duration-150 hover:bg-accent',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50'
      )}
    >
      <span className="flex min-w-0 items-center gap-2">{children}</span>
      {selected && <CheckIcon size={16} strokeWidth={2} className="shrink-0 text-primary" />}
    </button>
  );
}

function PreferenceSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-2 pb-1 text-[11px] font-bold tracking-wider text-muted-foreground uppercase select-none">
      {children}
    </div>
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
  const { t, changeLanguage, currentLanguage } = useTranslation();
  const { currency, setCurrency, rateDate, ratesLoading } = useCurrency();
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();
  const { accent, setAccent } = useAccent();
  const { isMobile, setOpenMobile } = useSidebar();
  const [prefsOpen, setPrefsOpen] = useState(false);

  const isRtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
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
    <Sidebar collapsible="icon">
      {/* ── Logo → tableau de bord ─────────────────────────────────────── */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={{ children: t('navigation.dashboard'), side: tooltipSide }}
              aria-label={t('navigation.dashboard')}
              onClick={() => handleNavigation('/dashboard')}
            >
              {/* Disposition reprise de la projection : mark carré, puis le nom
                  du produit sur deux lignes. En mode icônes le texte est rogné
                  par le bouton, comme dans le kit.

                  ⚠️ `SidebarMenuButton` force TOUS ses SVG descendants à 16 px
                  (`[&_svg]:size-4`) — la prop `size` du logo était donc écrasée,
                  y compris dans la projection. D'où le `!` qui rétablit la
                  taille voulue, et sa réduction en mode icônes où le bouton
                  n'est plus qu'un carré de 32 px. */}
              <span className="flex size-10 shrink-0 items-center justify-center [&_svg]:size-10! group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:[&_svg]:size-8!">
                <BaitlyMarkLogo variant="mark" size={40} />
              </span>
              <span className="grid flex-1 text-start leading-tight">
                <span className="truncate text-sm font-semibold">Baitly</span>
                <span className="truncate text-xs text-muted-foreground">
                  {t('navigation.productTagline', 'Property Management')}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={{
                children: [displayName, user?.email].filter(Boolean).join(' — '),
                side: tooltipSide,
              }}
              aria-label={displayName}
              onClick={() => handleNavigation('/settings')}
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
                  <span className="truncate text-[10.5px] text-sidebar-foreground/60">
                    {t(`navigation.roles.${user.roles[0]}`) || user.roles[0]}
                  </span>
                )}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="flex items-center gap-1 px-1 pb-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-0">
          {/* Apparence / langue / devise */}
          <Popover open={prefsOpen} onOpenChange={setPrefsOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger
                  aria-label={t('navigation.languageAndCurrency')}
                  className={footerButtonClass}
                >
                  <PreferencesIcon size={16} />
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side={isCollapsed ? tooltipSide : 'top'}>
                {t('navigation.languageAndCurrency')}
              </TooltipContent>
            </Tooltip>
            <PopoverContent
              side="top"
              align={isRtl ? 'end' : 'start'}
              className="w-56 p-1"
            >
              <PreferenceSectionLabel>
                {t('navigation.appearance', 'Apparence')}
              </PreferenceSectionLabel>
              {/* Teinte d'accent : `data-accent` sur <html> reteinte toute l'UI. */}
              <div className="flex flex-wrap gap-1.5 px-2 py-1.5">
                {ACCENT_OPTIONS.map((opt) => (
                  <Tooltip key={opt.value}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={opt.label}
                        aria-pressed={accent === opt.value}
                        onClick={() => setAccent(opt.value as AccentName)}
                        style={{ backgroundColor: opt.swatch }}
                        className={cn(
                          'size-[18px] shrink-0 cursor-pointer rounded-full border-2 outline-none',
                          'transition-transform duration-150 hover:scale-110',
                          'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                          'motion-reduce:transition-none motion-reduce:hover:scale-100',
                          accent === opt.value ? 'border-foreground' : 'border-transparent'
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top">{opt.label}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
              {(
                [
                  { value: 'light', label: t('navigation.themeLight', 'Clair') },
                  { value: 'dark', label: t('navigation.themeDark', 'Sombre') },
                  { value: 'auto', label: t('navigation.themeAuto', 'Auto') },
                ] as Array<{ value: ThemeMode; label: string }>
              ).map((opt) => (
                <PreferenceRow
                  key={opt.value}
                  selected={themeMode === opt.value}
                  onSelect={() => setThemeMode(opt.value)}
                >
                  {opt.label}
                </PreferenceRow>
              ))}

              <Separator className="my-1" />

              <PreferenceSectionLabel>{t('navigation.language')}</PreferenceSectionLabel>
              {(['fr', 'en', 'ar'] as const).map((lang) => (
                <PreferenceRow
                  key={lang}
                  selected={currentLanguage === lang}
                  onSelect={() => changeLanguage(lang)}
                >
                  {t(`navigation.languages.${lang}`)}
                </PreferenceRow>
              ))}

              <Separator className="my-1" />

              <PreferenceSectionLabel>{t('navigation.currency')}</PreferenceSectionLabel>
              {CURRENCY_OPTIONS.map((opt) => (
                <PreferenceRow
                  key={opt.code}
                  selected={currency === opt.code}
                  onSelect={() => setCurrency(opt.code as CurrencyCode)}
                >
                  <span className="inline-flex min-w-7 items-center justify-center text-[13px] font-semibold">
                    {/* MAD/SAR n'ont pas de glyphe Unicode rendu → icône. */}
                    <CurrencySymbol code={opt.code} size={15} />
                  </span>
                  <span className="truncate">{opt.label}</span>
                </PreferenceRow>
              ))}
              {rateDate && currency !== 'EUR' && (
                <p className="m-0 px-2 py-1 text-[11px] text-muted-foreground italic">
                  {ratesLoading ? t('common.loading') : `${t('common.ratesAt')} ${rateDate}`}
                </p>
              )}
            </PopoverContent>
          </Popover>

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
                  <UnreadNotificationsDot />
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
      </SidebarFooter>

      {!isMobile && <SidebarRail />}
    </Sidebar>
  );
}
