import { useState, useCallback } from 'react';
import type { PlanningSelection, PanelTab, PlanningEvent, QuickCreateData } from '../types';

export interface UsePlanningSelectionReturn {
  selection: PlanningSelection;
  selectedEvent: PlanningEvent | null;
  selectEvent: (event: PlanningEvent) => void;
  closePanel: () => void;
  setPanelTab: (tab: PanelTab) => void;
  // Quick create
  quickCreateData: QuickCreateData | null;
  openQuickCreate: (data: QuickCreateData) => void;
  closeQuickCreate: () => void;
}

export function usePlanningSelection(
  events: PlanningEvent[],
): UsePlanningSelectionReturn {
  const [selection, setSelection] = useState<PlanningSelection>({
    selectedEventId: null,
    panelOpen: false,
    panelTab: 'info',
  });

  const [quickCreateData, setQuickCreateData] = useState<QuickCreateData | null>(null);

  const selectedEvent = selection.selectedEventId
    ? events.find((e) => e.id === selection.selectedEventId) ?? null
    : null;

  const selectEvent = useCallback((event: PlanningEvent) => {
    setSelection({
      selectedEventId: event.id,
      panelOpen: true,
      panelTab: 'info',
    });
  }, []);

  const closePanel = useCallback(() => {
    setSelection((prev) => ({
      ...prev,
      selectedEventId: null,
      panelOpen: false,
    }));
  }, []);

  const setPanelTab = useCallback((tab: PanelTab) => {
    setSelection((prev) => ({ ...prev, panelTab: tab }));
  }, []);

  const openQuickCreate = useCallback((data: QuickCreateData) => {
    setQuickCreateData(data);
  }, []);

  const closeQuickCreate = useCallback(() => {
    setQuickCreateData(null);
  }, []);

  return {
    selection,
    selectedEvent,
    selectEvent,
    closePanel,
    setPanelTab,
    quickCreateData,
    openQuickCreate,
    closeQuickCreate,
  };
}
