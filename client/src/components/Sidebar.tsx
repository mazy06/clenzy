import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Drawer,
  List,
  Typography,
  IconButton,
  Divider,
  Tooltip,
  Avatar,
  Menu,
  MenuItem as MuiMenuItem,
  useTheme,
} from '@mui/material';
import {
  ChevronsLeft,
  ChevronsRight,
  Logout,
  Notifications,
  Language as LanguageIcon,
  Check as CheckIcon,
} from '../icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { useThemeMode, type ThemeMode } from '../hooks/useThemeMode';
import { ACCENT_OPTIONS, getSavedAccent, setAccent, type AccentName } from '../theme/signature/accent';
import { useCurrency } from '../hooks/useCurrency';
import { CURRENCY_OPTIONS } from '../utils/currencyUtils';
import type { CurrencyCode } from '../hooks/useCurrency';
import { authApi, notificationsApi } from '../services/api';
import { userAvatarSrc } from '../services/api/usersApi';
import keycloak from '../keycloak';
import { clearTokens } from '../services/storageService';
import { SIDEBAR_WIDTH_EXPANDED, SIDEBAR_WIDTH_COLLAPSED } from '../hooks/useSidebarState';
import { groupMenuItems, NAV_GROUP_TRANSLATION_KEYS } from '../hooks/useNavigationMenu';
import type { MenuItem, NavGroup } from '../hooks/useNavigationMenu';
import SidebarNavItem from './SidebarNavItem';
import BaitlyMarkLogo from './BaitlyMarkLogo';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SidebarProps {
  menuItems: MenuItem[];
  isCollapsed: boolean;
  isMobileOpen: boolean;
  isMobile: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
}

// ─── Group order ─────────────────────────────────────────────────────────────

const GROUP_ORDER: NavGroup[] = ['main', 'management', 'admin'];

// ─── Component ───────────────────────────────────────────────────────────────

export default function Sidebar({
  menuItems,
  isCollapsed,
  isMobileOpen,
  isMobile,
  onToggleCollapsed,
  onCloseMobile,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clearUser } = useAuth();
  const { t, changeLanguage, currentLanguage } = useTranslation();
  const { currency, setCurrency, rateDate, ratesLoading } = useCurrency();
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();
  const [accent, setAccentState] = useState<AccentName>(getSavedAccent);
  const theme = useTheme();
  const isRtl = theme.direction === 'rtl';
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<null | HTMLElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Poll unread notification count ──────────────────────────────────
  const fetchUnreadCount = useCallback(async () => {
    const result = await notificationsApi.getUnreadCount();
    setUnreadCount(result.count);
    if (!notificationsApi._endpointAvailable && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    intervalRef.current = setInterval(fetchUnreadCount, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchUnreadCount]);

  const grouped = useMemo(() => groupMenuItems(menuItems), [menuItems]);
  const collapsed = isCollapsed && !isMobile;

  // Peau « référence sidebar » : valeurs FIXES issues de la référence
  // utilisateur (plus de paliers responsive — la réf est à tailles fixes).
  const footerIconSize = 16;

  // Carte utilisateur : nom affiché + initiales (réf : 2 lettres, ex. « TM »)
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.username ||
    t('navigation.defaultUser');
  const userInitials =
    `${user?.firstName?.charAt(0) ?? ''}${user?.lastName?.charAt(0) ?? ''}`.toUpperCase() ||
    user?.username?.charAt(0)?.toUpperCase() ||
    'U';

  // Bouton de footer (.s-fbtn) : height 32, radius 8, faint → hover strong.
  // En réduit : colonne, boutons 40px de large.
  const footBtnSx = {
    flex: collapsed ? 'none' : 1,
    width: collapsed ? 40 : 'auto',
    height: 32,
    borderRadius: '8px',
    color: 'var(--nav-faint)',
    position: 'relative' as const,
    transition: 'background .14s, color .14s',
    '&:hover': { backgroundColor: 'var(--nav-hover)', color: 'var(--nav-strong)' },
    '&.Mui-focusVisible': {
      outline: '2px solid var(--accent)',
      outlineOffset: '2px',
      backgroundColor: 'var(--nav-hover)',
      color: 'var(--nav-strong)',
    },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  };

  // Tooltips latéraux : la sidebar est ancrée à droite en RTL (MUI flippe
  // l'anchor du Drawer) → le popper doit s'ouvrir vers l'intérieur.
  const sidePlacement = isRtl ? ('left' as const) : ('right' as const);

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) onCloseMobile();
  };

  const isActive = (path: string) => location.pathname === path;

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
      // silent
    }
  };

  const handleSettingsOpen = (e: React.MouseEvent<HTMLElement>) => {
    setSettingsAnchorEl(e.currentTarget);
  };

  const handleSettingsClose = () => {
    setSettingsAnchorEl(null);
  };

  const handleLangChange = (lang: 'fr' | 'en' | 'ar') => {
    changeLanguage(lang);
  };

  const handleCurrencyChange = (code: CurrencyCode) => {
    setCurrency(code);
  };

  // ── Apparence Signature : teinte d'accent + mode clair/sombre ──────────
  const handleAccentChange = (name: AccentName) => {
    setAccent(name);          // persiste (clenzy_accent) + pose data-accent
    setAccentState(name);     // re-render local (coche du sélecteur)
  };

  const handleModeChange = (newMode: ThemeMode) => {
    setThemeMode(newMode);    // useThemeMode : optimistic + sync backend
  };

  // ─── Sidebar content (shared between permanent and temporary) ──────────

  const sidebarContent = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* ── Logo (.s-logo) : hauteur 62, padding 0 18, gap 11 ──────────── */}
      <Box
        role="button"
        tabIndex={0}
        aria-label={t('navigation.dashboard')}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: '11px',
          height: 62,
          px: collapsed ? 0 : '18px',
          flexShrink: 0,
          cursor: 'pointer',
          '&:hover': { opacity: 0.8 },
          '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '-2px' },
          transition: 'opacity 150ms',
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        }}
        onClick={() => handleNavigation('/dashboard')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleNavigation('/dashboard');
          }
        }}
      >
        {/* Référence : mark 26px + wordmark Space Grotesk 600 20px.
            BaitlyMarkLogo couple mark et wordmark (fontSize = 32×size/56) :
            on rend donc 2 instances — mark size=26 (26px exact) et
            wordmark size=35 (32×35/56 = 20px exact), gap 11px via le parent.
            Réduit = mark seul centré (idle animation conservée). */}
        {collapsed ? (
          <BaitlyMarkLogo variant="mark" size={26} />
        ) : (
          <>
            <BaitlyMarkLogo variant="mark" size={26} idleAnimation={false} />
            <BaitlyMarkLogo variant="wordmark" size={35} />
          </>
        )}
      </Box>

      {/* ── Navigation (.s-nav) : padding 8 12 (réduit 8 10) ───────────── */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          p: collapsed ? '8px 10px' : '8px 12px',
          scrollbarWidth: 'none',           // Firefox
          '&::-webkit-scrollbar': { display: 'none' },  // Chrome/Safari
        }}
      >
        {GROUP_ORDER.map((groupKey) => {
          const items = grouped[groupKey];
          if (!items || items.length === 0) return null;

          return (
            <React.Fragment key={groupKey}>
              {/* Label de groupe (.s-grp) — en réduit : point médian centré */}
              {collapsed ? (
                <Typography
                  sx={{
                    p: '10px 0 4px',
                    textAlign: 'center',
                    fontSize: '15px',
                    lineHeight: 1,
                    color: 'var(--nav-faint)',
                    userSelect: 'none',
                  }}
                >
                  ·
                </Typography>
              ) : (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    p: '15px 10px 6px',
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--nav-faint)',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                  }}
                >
                  {t(NAV_GROUP_TRANSLATION_KEYS[groupKey])}
                </Typography>
              )}

              {/* Group items */}
              <List disablePadding>
                {items.map((item) => (
                  <SidebarNavItem
                    key={item.id}
                    item={item}
                    isActive={isActive(item.path)}
                    isCollapsed={collapsed}
                    onClick={handleNavigation}
                  />
                ))}
              </List>
            </React.Fragment>
          );
        })}
      </Box>

      {/* ── User profile + actions ───────────────────────────────────── */}
      <Box sx={{ flexShrink: 0 }}>
        {/* Carte utilisateur (.s-user) — cliquable vers /settings.
            Réf = nom + rôle ; l'email est conservé dans le Tooltip. */}
        <Tooltip
          title={
            collapsed
              ? [displayName, user?.email].filter(Boolean).join(' — ')
              : (user?.email ?? '')
          }
          placement={sidePlacement}
        >
          <Box
            role="button"
            tabIndex={0}
            aria-label={displayName}
            onClick={() => handleNavigation('/settings')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleNavigation('/settings');
              }
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '11px',
              m: collapsed ? '8px' : '8px 12px 10px',
              p: collapsed ? '5px' : '10px',
              borderRadius: '12px',
              backgroundColor: collapsed ? 'transparent' : 'var(--nav-userbg)',
              border: collapsed ? 'none' : '1px solid var(--nav-line)',
              justifyContent: collapsed ? 'center' : 'flex-start',
              flexShrink: 0,
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'var(--nav-hover)' },
              '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
              transition: 'background-color 150ms',
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
          >
            {/* Avatar (.s-av) : 34px, radius 10, bg accent, initiales
                Space Grotesk 600 13px — la photo garde le même cadre. */}
            <Avatar
              src={userAvatarSrc(user)}
              sx={{
                width: 34,
                height: 34,
                borderRadius: '10px',
                bgcolor: 'var(--accent)',
                color: 'var(--on-accent)',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '13px',
                flexShrink: 0,
              }}
            >
              {userInitials}
            </Avatar>
            {!collapsed && (
              <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <Typography
                  sx={{
                    fontWeight: 600,
                    color: 'var(--nav-strong)',
                    fontSize: '13px',
                    lineHeight: 1.2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {displayName}
                </Typography>
                {user?.roles && user.roles.length > 0 && (
                  <Typography
                    sx={{
                      fontSize: '10.5px',
                      color: 'var(--nav-faint)',
                      letterSpacing: '0.02em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t(`navigation.roles.${user.roles[0]}`) || user.roles[0]}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </Tooltip>

        {/* Footer d'actions (.s-foot) : 4 boutons — globe, cloche,
            déconnexion, réduire. Réduit : colonne, boutons 40px. */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexDirection: collapsed ? 'column' : 'row',
            gap: '4px',
            p: collapsed ? '0 0 10px' : '0 14px 12px',
            flexShrink: 0,
          }}
        >
          {/* Langue / devise / Apparence — menu existant conservé */}
          <Tooltip title={t('navigation.languageAndCurrency')} placement={collapsed ? sidePlacement : 'top'}>
            <IconButton size="small" onClick={handleSettingsOpen} sx={footBtnSx}>
              <LanguageIcon size={footerIconSize} strokeWidth={1.75} />
            </IconButton>
          </Tooltip>

          {/* Cloche — point 7px var(--err) si non-lus (remplace le compteur) */}
          <Tooltip title={t('notifications.title')} placement={collapsed ? sidePlacement : 'top'}>
            <IconButton size="small" onClick={() => handleNavigation('/notifications')} sx={footBtnSx}>
              <Notifications size={footerIconSize} strokeWidth={1.75} />
              {unreadCount > 0 && (
                <Box
                  component="span"
                  sx={{
                    position: 'absolute',
                    top: 5,
                    insetInlineEnd: 8,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: 'var(--err)',
                    boxShadow: '0 0 0 2px var(--nav-bg)',
                  }}
                />
              )}
            </IconButton>
          </Tooltip>

          {/* Déconnexion */}
          <Tooltip title={t('navigation.logout')} placement={collapsed ? sidePlacement : 'top'}>
            <IconButton size="small" onClick={handleLogout} sx={footBtnSx}>
              <Logout size={footerIconSize} strokeWidth={1.75} />
            </IconButton>
          </Tooltip>

          {/* Réduire / étendre (desktop only) — chevrons doubles (réf) */}
          {!isMobile && (
            <Tooltip
              title={collapsed ? t('common.expandMenu') : t('common.collapseMenu')}
              placement={collapsed ? sidePlacement : 'top'}
            >
              <IconButton size="small" onClick={onToggleCollapsed} sx={footBtnSx}>
                {collapsed
                  ? (isRtl ? <ChevronsLeft size={footerIconSize} strokeWidth={1.75} /> : <ChevronsRight size={footerIconSize} strokeWidth={1.75} />)
                  : (isRtl ? <ChevronsRight size={footerIconSize} strokeWidth={1.75} /> : <ChevronsLeft size={footerIconSize} strokeWidth={1.75} />)
                }
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Language & Currency unified menu */}
        <Menu
          anchorEl={settingsAnchorEl}
          open={Boolean(settingsAnchorEl)}
          onClose={handleSettingsClose}
          anchorOrigin={{ vertical: 'top', horizontal: isRtl ? 'left' : 'right' }}
          transformOrigin={{ vertical: 'bottom', horizontal: isRtl ? 'right' : 'left' }}
          slotProps={{
            // Peau menu = thème global Signature (hairline --line, r12,
            // --shadow-pop) — aucun override local.
            paper: { elevation: 0, sx: { minWidth: 200 } },
          }}
        >
          {/* ── Section: Apparence (Signature — teinte d'accent + mode) ── */}
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              px: 2,
              pt: 1,
              pb: 0.5,
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: 'text.disabled',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              userSelect: 'none',
            }}
          >
            {t('navigation.appearance', 'Apparence')}
          </Typography>
          {/* Teinte d'accent : 7 pastilles (handoff §1 — couleur paramétrable).
              data-accent est posé sur <html> → toute l'UI se reteinte en CSS pur. */}
          <Box sx={{ display: 'flex', gap: 0.75, px: 2, py: 0.5 }}>
            {ACCENT_OPTIONS.map((opt) => (
              <Tooltip key={opt.value} title={opt.label} placement="top">
                <Box
                  onClick={() => handleAccentChange(opt.value)}
                  sx={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    backgroundColor: opt.swatch,
                    cursor: 'pointer',
                    flexShrink: 0,
                    border: accent === opt.value ? '2px solid var(--ink)' : '2px solid transparent',
                    boxShadow: accent === opt.value ? '0 0 0 1.5px var(--card) inset' : 'none',
                    transition: 'transform 120ms, border-color 120ms',
                    '&:hover': { transform: 'scale(1.15)' },
                    '@media (prefers-reduced-motion: reduce)': {
                      transition: 'none',
                      '&:hover': { transform: 'none' },
                    },
                  }}
                />
              </Tooltip>
            ))}
          </Box>
          {/* Mode clair / sombre / auto (réutilise useThemeMode existant) */}
          {([
            { value: 'light' as const, label: t('navigation.themeLight', 'Clair') },
            { value: 'dark' as const, label: t('navigation.themeDark', 'Sombre') },
            { value: 'auto' as const, label: t('navigation.themeAuto', 'Auto') },
          ]).map((opt) => (
            <MuiMenuItem
              key={opt.value}
              onClick={() => handleModeChange(opt.value)}
              selected={themeMode === opt.value}
              sx={{ fontSize: '0.8125rem', py: 0.75, minHeight: 0 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span>{opt.label}</span>
                {themeMode === opt.value && <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main', ml: 1 }}><CheckIcon size={16} strokeWidth={2} /></Box>}
              </Box>
            </MuiMenuItem>
          ))}

          <Divider sx={{ my: 0.5 }} />

          {/* ── Section: Langue ── */}
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              px: 2,
              pt: 0.5,
              pb: 0.5,
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: 'text.disabled',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              userSelect: 'none',
            }}
          >
            {t('navigation.language')}
          </Typography>
          <MuiMenuItem
            onClick={() => handleLangChange('fr')}
            selected={currentLanguage === 'fr'}
            sx={{ fontSize: '0.8125rem', py: 0.75, minHeight: 0 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span>{t('navigation.languages.fr')}</span>
              {currentLanguage === 'fr' && <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main', ml: 1 }}><CheckIcon size={16} strokeWidth={2} /></Box>}
            </Box>
          </MuiMenuItem>
          <MuiMenuItem
            onClick={() => handleLangChange('en')}
            selected={currentLanguage === 'en'}
            sx={{ fontSize: '0.8125rem', py: 0.75, minHeight: 0 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span>{t('navigation.languages.en')}</span>
              {currentLanguage === 'en' && <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main', ml: 1 }}><CheckIcon size={16} strokeWidth={2} /></Box>}
            </Box>
          </MuiMenuItem>
          <MuiMenuItem
            onClick={() => handleLangChange('ar')}
            selected={currentLanguage === 'ar'}
            sx={{ fontSize: '0.8125rem', py: 0.75, minHeight: 0 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span>{t('navigation.languages.ar')}</span>
              {currentLanguage === 'ar' && <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main', ml: 1 }}><CheckIcon size={16} strokeWidth={2} /></Box>}
            </Box>
          </MuiMenuItem>

          <Divider sx={{ my: 0.5 }} />

          {/* ── Section: Devise ── */}
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              px: 2,
              pt: 0.5,
              pb: 0.5,
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: 'text.disabled',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              userSelect: 'none',
            }}
          >
            {t('navigation.currency')}
          </Typography>
          {CURRENCY_OPTIONS.map((opt) => (
            <MuiMenuItem
              key={opt.code}
              onClick={() => handleCurrencyChange(opt.code as CurrencyCode)}
              selected={currency === opt.code}
              sx={{ fontSize: '0.8125rem', py: 0.75, minHeight: 0 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    component="span"
                    sx={{ fontSize: '0.8125rem', fontWeight: 600, minWidth: 28, textAlign: 'center' }}
                  >
                    {opt.symbol}
                  </Typography>
                  <span>{opt.label}</span>
                </Box>
                {currency === opt.code && <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main', ml: 1 }}><CheckIcon size={16} strokeWidth={2} /></Box>}
              </Box>
            </MuiMenuItem>
          ))}
          {rateDate && currency !== 'EUR' && (
            <Typography
              sx={{
                fontSize: '0.6875rem',
                color: 'text.disabled',
                px: 2,
                py: 0.5,
                fontStyle: 'italic',
              }}
            >
              {ratesLoading ? t('common.loading') : `${t('common.ratesAt')} ${rateDate}`}
            </Typography>
          )}
        </Menu>

      </Box>
    </Box>
  );

  // ─── Mobile: temporary drawer ──────────────────────────────────────────

  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={isMobileOpen}
        onClose={onCloseMobile}
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': {
            width: Math.min(SIDEBAR_WIDTH_EXPANDED, 280),
            maxWidth: '80vw',
            background: 'linear-gradient(180deg, var(--nav-bg), var(--nav-bg2))',
            borderRight: '1px solid var(--nav-line)',
            boxShadow: 'none',
            borderRadius: 0,
          },
        }}
      >
        {sidebarContent}
      </Drawer>
    );
  }

  // ─── Desktop: permanent drawer ─────────────────────────────────────────

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
          transition: 'width .2s ease',
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          overflowX: 'hidden',
          background: 'linear-gradient(180deg, var(--nav-bg), var(--nav-bg2))',
          borderRight: '1px solid var(--nav-line)',
          boxShadow: 'none',
          borderRadius: 0,
        },
      }}
    >
      {sidebarContent}
    </Drawer>
  );
}
