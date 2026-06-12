import React from 'react';
import { Box, ListItemButton, Tooltip, useTheme } from '@mui/material';
import type { MenuItem } from '../hooks/useNavigationMenu';

interface SidebarNavItemProps {
  item: MenuItem;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: (path: string) => void;
}

// Couleur de la pastille de compteur — référence sidebar : var(--warn) par
// défaut. Les badgeColor existants (MenuItem.badgeColor) sont mappés sur les
// tokens sémantiques pour ne rien perdre fonctionnellement.
const BADGE_BG: Record<NonNullable<MenuItem['badgeColor']>, string> = {
  warning: 'var(--warn)',
  error: 'var(--err)',
  success: 'var(--ok)',
  info: 'var(--info)',
  primary: 'var(--accent)',
};

/**
 * Item de navigation — peau EXACTE de la référence utilisateur
 * « Référence de la barre latérale.html » (.s-item / .ct) :
 * hauteur 36, padding 0 12, radius 9, gap 11, 13px fw500 var(--nav-txt),
 * icône 17px var(--nav-faint) ; actif = bg var(--accent) + glow ;
 * compteur .ct (18px, var(--warn)) → point 8px en mode réduit.
 */
function SidebarNavItem({ item, isActive, isCollapsed, onClick }: SidebarNavItemProps) {
  // Sidebar ancrée à droite en RTL → le tooltip s'ouvre vers l'intérieur.
  const isRtl = useTheme().direction === 'rtl';
  const hasBadge = item.badge != null && item.badge > 0;
  const badgeBg = isActive
    ? 'rgba(255,255,255,.25)'
    : BADGE_BG[item.badgeColor ?? 'warning'];

  const icon = React.isValidElement(item.icon)
    ? React.cloneElement(item.icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
        size: 17,
        strokeWidth: isActive ? 2 : 1.75,
      })
    : item.icon;

  const content = (
    <ListItemButton
      onClick={() => onClick(item.path)}
      sx={{
        height: 36,
        minHeight: 36,
        px: isCollapsed ? 0 : '12px',
        py: 0,
        gap: '11px',
        borderRadius: '9px',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        whiteSpace: 'nowrap',
        color: isActive ? 'var(--on-accent)' : 'var(--nav-txt)',
        fontWeight: isActive ? 600 : 500,
        fontSize: '13px',
        backgroundColor: isActive ? 'var(--accent)' : 'transparent',
        boxShadow: isActive
          ? '0 6px 18px -6px color-mix(in srgb, var(--accent) 55%, transparent)'
          : 'none',
        transition: 'background .14s, color .14s',
        '& > svg': {
          width: 17,
          height: 17,
          flexShrink: 0,
          color: isActive ? 'var(--on-accent)' : 'var(--nav-faint)',
          transition: 'color .14s',
        },
        '&:hover': {
          backgroundColor: isActive ? 'var(--accent)' : 'var(--nav-hover)',
          color: isActive ? 'var(--on-accent)' : 'var(--nav-strong)',
          '& > svg': { color: isActive ? 'var(--on-accent)' : 'var(--nav-strong)' },
        },
        '&.Mui-focusVisible': {
          outline: '2px solid var(--accent)',
          outlineOffset: '2px',
          backgroundColor: isActive ? 'var(--accent)' : 'var(--nav-hover)',
        },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
          '& > svg': { transition: 'none' },
        },
      }}
    >
      {icon}
      {!isCollapsed && (
        <Box
          component="span"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontSize: 'inherit',
            fontWeight: 'inherit',
            color: 'inherit',
          }}
        >
          {item.text}
        </Box>
      )}
      {/* Pastille compteur (.ct) — en réduit : point 8px sans chiffre */}
      {hasBadge && (
        isCollapsed ? (
          <Box
            component="span"
            sx={{
              position: 'absolute',
              top: 3,
              insetInlineEnd: 10,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: badgeBg,
              border: '1.5px solid var(--nav-bg)',
            }}
          />
        ) : (
          <Box
            component="span"
            sx={{
              marginInlineStart: 'auto',
              minWidth: 18,
              height: 18,
              px: '5px',
              borderRadius: '9px',
              fontSize: '10.5px',
              fontWeight: 700,
              color: '#fff',
              backgroundColor: badgeBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {item.badge! > 99 ? '99+' : item.badge}
          </Box>
        )
      )}
    </ListItemButton>
  );

  if (isCollapsed) {
    return (
      <Tooltip title={item.text} placement={isRtl ? 'left' : 'right'} arrow>
        {content}
      </Tooltip>
    );
  }

  return content;
}

export default React.memo(SidebarNavItem);
