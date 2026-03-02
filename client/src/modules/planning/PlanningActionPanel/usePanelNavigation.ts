import { useState, useCallback, useEffect, useMemo } from 'react';
import type { PanelView } from '../types';

export interface UsePanelNavigationReturn {
  currentView: PanelView;
  isSubView: boolean;
  pushView: (view: PanelView) => void;
  popView: () => void;
  resetToRoot: () => void;
}

/**
 * Manages a navigation stack for drill-down views within the panel.
 * Resets automatically when the selected event changes.
 */
export function usePanelNavigation(eventId: string | null): UsePanelNavigationReturn {
  const [viewStack, setViewStack] = useState<PanelView[]>([{ type: 'root' }]);

  // Reset to root whenever the selected event changes
  useEffect(() => {
    setViewStack([{ type: 'root' }]);
  }, [eventId]);

  const currentView = useMemo(
    () => viewStack[viewStack.length - 1],
    [viewStack],
  );

  const isSubView = viewStack.length > 1;

  const pushView = useCallback((view: PanelView) => {
    setViewStack((prev) => [...prev, view]);
  }, []);

  const popView = useCallback(() => {
    setViewStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const resetToRoot = useCallback(() => {
    setViewStack([{ type: 'root' }]);
  }, []);

  return { currentView, isSubView, pushView, popView, resetToRoot };
}
