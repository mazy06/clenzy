import { useState, useCallback } from 'react';
import { useTheme, useMediaQuery } from '@mui/material';

const SIDEBAR_KEY = 'clenzy_sidebar_collapsed';

function getSavedCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === 'true';
  } catch {
    return false;
  }
}

export const SIDEBAR_WIDTH_EXPANDED = 240;
export const SIDEBAR_WIDTH_COLLAPSED = 64;

export function useSidebarState() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  // Medium screens (md–lg): auto-collapse for better space usage
  const isMediumScreen = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const [userCollapsed, setUserCollapsed] = useState(getSavedCollapsed);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // On medium screens, always collapsed; on large+, respect user preference
  const isCollapsed = isMediumScreen || userCollapsed;

  const toggleCollapsed = useCallback(() => {
    setUserCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const openMobile = useCallback(() => setIsMobileOpen(true), []);
  const closeMobile = useCallback(() => setIsMobileOpen(false), []);

  const sidebarWidth = isMobile
    ? 0
    : isCollapsed
      ? SIDEBAR_WIDTH_COLLAPSED
      : SIDEBAR_WIDTH_EXPANDED;

  return {
    isCollapsed,
    isMobileOpen,
    isMobile,
    isMediumScreen,
    sidebarWidth,
    toggleCollapsed,
    openMobile,
    closeMobile,
  };
}
