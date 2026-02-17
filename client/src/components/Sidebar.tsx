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
  Badge,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Logout,
  Notifications,
  NotificationsNone,
  Language as LanguageIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { authApi, notificationsApi } from '../services/api';
import keycloak from '../keycloak';
import { clearTokens } from '../services/storageService';
import { SIDEBAR_WIDTH_EXPANDED, SIDEBAR_WIDTH_COLLAPSED } from '../hooks/useSidebarState';
import { groupMenuItems, NAV_GROUP_LABELS } from '../hooks/useNavigationMenu';
import type { MenuItem, NavGroup } from '../hooks/useNavigationMenu';
import SidebarNavItem from './SidebarNavItem';
import clenzyLogo from '../assets/Clenzy_logo.png';

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
  const [langAnchorEl, setLangAnchorEl] = useState<null | HTMLElement>(null);
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

  const handleLangOpen = (e: React.MouseEvent<HTMLElement>) => {
    setLangAnchorEl(e.currentTarget);
  };

  const handleLangClose = () => {
    setLangAnchorEl(null);
  };

  const handleLangChange = (lang: 'fr' | 'en') => {
    changeLanguage(lang);
    handleLangClose();
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
      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          height: 56,
          px: collapsed ? 1 : 2,
          flexShrink: 0,
          cursor: 'pointer',
          borderBottom: '1px solid',
          borderColor: 'divider',
          '&:hover': { opacity: 0.8 },
          transition: 'opacity 150ms',
        }}
        onClick={() => handleNavigation('/dashboard')}
      >
        <img
          src={clenzyLogo}
          alt="Clenzy"
          style={{
            height: collapsed ? 24 : 28,
            width: 'auto',
            maxWidth: collapsed ? 40 : 140,
            objectFit: 'contain',
            objectPosition: 'left center',
            transition: 'all 200ms',
          }}
        />
      </Box>

      {/* ── Navigation groups ────────────────────────────────────────── */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          py: 1,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.15)',
            borderRadius: 2,
          },
        }}
      >
        {GROUP_ORDER.map((groupKey, groupIndex) => {
          const items = grouped[groupKey];
          if (!items || items.length === 0) return null;

          return (
            <React.Fragment key={groupKey}>
              {/* Group separator */}
              {groupIndex > 0 && (
                collapsed ? (
                  <Divider sx={{ my: 1, mx: 1.5 }} />
                ) : (
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      px: 2.5,
                      pt: groupIndex === 0 ? 0.5 : 2,
                      pb: 0.5,
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: 'text.disabled',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      userSelect: 'none',
                    }}
                  >
                    {NAV_GROUP_LABELS[groupKey]}
                  </Typography>
                )
              )}

              {/* Group items */}
              <List disablePadding sx={{ py: 0.25 }}>
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
      <Box
        sx={{
          flexShrink: 0,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        {/* User badge — cliquable vers /profile */}
        <Box
          onClick={() => handleNavigation('/profile')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: collapsed ? 0 : 2,
            py: 1.5,
            cursor: 'pointer',
            justifyContent: collapsed ? 'center' : 'flex-start',
            '&:hover': { backgroundColor: 'rgba(107, 138, 154, 0.04)' },
            transition: 'background-color 150ms',
          }}
        >
          <Tooltip title={collapsed ? (user?.firstName || user?.username || '') : ''} placement="right">
            <Avatar
              sx={{
                width: collapsed ? 32 : 36,
                height: collapsed ? 32 : 36,
                bgcolor: 'secondary.main',
                fontSize: collapsed ? '0.75rem' : '0.875rem',
                fontWeight: 700,
                border: '2px solid',
                borderColor: 'secondary.light',
                flexShrink: 0,
                transition: 'all 200ms',
              }}
            >
              {user?.firstName?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || 'U'}
            </Avatar>
          </Tooltip>
          {!collapsed && (
            <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{
                  color: 'text.primary',
                  fontSize: '0.8125rem',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.firstName || user?.username || 'Utilisateur'}
              </Typography>
              {user?.email && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.6875rem',
                    lineHeight: 1.2,
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user.email}
                </Typography>
              )}
              {user?.roles && user.roles.length > 0 && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'secondary.main',
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}
                >
                  {t(`navigation.roles.${user.roles[0]}`) || user.roles[0]}
                </Typography>
              )}
            </Box>
          )}
        </Box>

        {/* Action icons row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-evenly',
            flexDirection: collapsed ? 'column' : 'row',
            gap: collapsed ? 0.5 : 0,
            px: 1,
            pb: 1,
            pt: 0.5,
          }}
        >
          {/* Language */}
          <Tooltip title={t('navigation.language') || 'Langue'} placement={collapsed ? 'right' : 'top'}>
            <IconButton
              size="small"
              onClick={handleLangOpen}
              sx={{
                color: 'text.secondary',
                '&:hover': { backgroundColor: 'rgba(107, 138, 154, 0.08)' },
              }}
            >
              <LanguageIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>

          {/* Notifications */}
          <Tooltip title="Notifications" placement={collapsed ? 'right' : 'top'}>
            <IconButton
              size="small"
              onClick={() => handleNavigation('/notifications')}
              sx={{
                color: 'text.secondary',
                '&:hover': { backgroundColor: 'rgba(107, 138, 154, 0.08)' },
              }}
            >
              <Badge
                badgeContent={unreadCount}
                color="error"
                max={99}
                sx={{
                  '& .MuiBadge-badge': {
                    fontSize: '0.6rem',
                    height: 14,
                    minWidth: 14,
                    padding: '0 3px',
                  },
                }}
              >
                {unreadCount > 0 ? (
                  <Notifications sx={{ fontSize: 18 }} />
                ) : (
                  <NotificationsNone sx={{ fontSize: 18 }} />
                )}
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Logout */}
          <Tooltip title={t('navigation.logout') || 'Deconnexion'} placement={collapsed ? 'right' : 'top'}>
            <IconButton
              size="small"
              onClick={handleLogout}
              sx={{
                color: 'error.main',
                '&:hover': { backgroundColor: 'rgba(201, 122, 122, 0.08)' },
              }}
            >
              <Logout sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Language menu popup */}
        <Menu
          anchorEl={langAnchorEl}
          open={Boolean(langAnchorEl)}
          onClose={handleLangClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          slotProps={{
            paper: {
              elevation: 0,
              sx: {
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '6px',
                minWidth: 140,
                boxShadow: (theme) =>
                  theme.palette.mode === 'dark'
                    ? '0 4px 12px rgba(0,0,0,0.3)'
                    : '0 4px 12px rgba(0,0,0,0.08)',
              },
            },
          }}
        >
          <MuiMenuItem
            onClick={() => handleLangChange('fr')}
            selected={currentLanguage === 'fr'}
            sx={{ fontSize: '0.8125rem' }}
          >
            Francais
          </MuiMenuItem>
          <MuiMenuItem
            onClick={() => handleLangChange('en')}
            selected={currentLanguage === 'en'}
            sx={{ fontSize: '0.8125rem' }}
          >
            English
          </MuiMenuItem>
        </Menu>

        {/* ── Collapse toggle (desktop only) ─────────────────────────── */}
        {!isMobile && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-end',
              px: 1,
              pb: 1,
            }}
          >
            <Tooltip
              title={collapsed ? 'Ouvrir le menu' : 'Reduire le menu'}
              placement="right"
            >
              <IconButton
                onClick={onToggleCollapsed}
                size="small"
                sx={{
                  color: 'text.secondary',
                  '&:hover': { backgroundColor: 'rgba(107, 138, 154, 0.08)' },
                }}
              >
                {collapsed ? <ChevronRight fontSize="small" /> : <ChevronLeft fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
        )}
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
            width: SIDEBAR_WIDTH_EXPANDED,
            backgroundColor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
            boxShadow: 'none',
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
          transition: 'width 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          overflowX: 'hidden',
          borderRight: '1px solid',
          borderColor: 'divider',
          boxShadow: 'none',
          backgroundColor: 'background.paper',
        },
      }}
    >
      {sidebarContent}
    </Drawer>
  );
}
