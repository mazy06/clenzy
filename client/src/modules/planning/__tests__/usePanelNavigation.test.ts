import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePanelNavigation } from '../PlanningActionPanel/usePanelNavigation';
import type { PanelView } from '../types';

describe('usePanelNavigation', () => {
  // ── Initial state ──────────────────────────────────────────────────────────
  describe('initial state', () => {
    it('should start at root view', () => {
      const { result } = renderHook(() => usePanelNavigation('evt-1'));
      expect(result.current.currentView).toEqual({ type: 'root' });
    });

    it('should not be a sub-view initially', () => {
      const { result } = renderHook(() => usePanelNavigation('evt-1'));
      expect(result.current.isSubView).toBe(false);
    });

    it('should handle null eventId', () => {
      const { result } = renderHook(() => usePanelNavigation(null));
      expect(result.current.currentView).toEqual({ type: 'root' });
      expect(result.current.isSubView).toBe(false);
    });
  });

  // ── pushView ────────────────────────────────────────────────────────────────
  describe('pushView', () => {
    it('should navigate to property-details sub-view', () => {
      const { result } = renderHook(() => usePanelNavigation('evt-1'));

      act(() => {
        result.current.pushView({ type: 'property-details', propertyId: 42 });
      });

      expect(result.current.currentView).toEqual({ type: 'property-details', propertyId: 42 });
      expect(result.current.isSubView).toBe(true);
    });

    it('should navigate to intervention-detail sub-view', () => {
      const { result } = renderHook(() => usePanelNavigation('evt-1'));

      act(() => {
        result.current.pushView({ type: 'intervention-detail', interventionId: 77 });
      });

      expect(result.current.currentView).toEqual({ type: 'intervention-detail', interventionId: 77 });
      expect(result.current.isSubView).toBe(true);
    });

    it('should support deep navigation (multiple pushes)', () => {
      const { result } = renderHook(() => usePanelNavigation('evt-1'));

      act(() => {
        result.current.pushView({ type: 'property-details', propertyId: 42 });
      });
      act(() => {
        result.current.pushView({ type: 'intervention-detail', interventionId: 99 });
      });

      expect(result.current.currentView).toEqual({ type: 'intervention-detail', interventionId: 99 });
      expect(result.current.isSubView).toBe(true);
    });
  });

  // ── popView ─────────────────────────────────────────────────────────────────
  describe('popView', () => {
    it('should go back to root from one level deep', () => {
      const { result } = renderHook(() => usePanelNavigation('evt-1'));

      act(() => {
        result.current.pushView({ type: 'property-details', propertyId: 42 });
      });
      expect(result.current.isSubView).toBe(true);

      act(() => {
        result.current.popView();
      });

      expect(result.current.currentView).toEqual({ type: 'root' });
      expect(result.current.isSubView).toBe(false);
    });

    it('should go back one level from two levels deep', () => {
      const { result } = renderHook(() => usePanelNavigation('evt-1'));

      act(() => {
        result.current.pushView({ type: 'property-details', propertyId: 42 });
      });
      act(() => {
        result.current.pushView({ type: 'intervention-detail', interventionId: 99 });
      });
      act(() => {
        result.current.popView();
      });

      expect(result.current.currentView).toEqual({ type: 'property-details', propertyId: 42 });
      expect(result.current.isSubView).toBe(true);
    });

    it('should not pop below root level', () => {
      const { result } = renderHook(() => usePanelNavigation('evt-1'));

      act(() => {
        result.current.popView();
      });

      expect(result.current.currentView).toEqual({ type: 'root' });
      expect(result.current.isSubView).toBe(false);
    });

    it('should not pop below root when called multiple times', () => {
      const { result } = renderHook(() => usePanelNavigation('evt-1'));

      act(() => {
        result.current.popView();
        result.current.popView();
        result.current.popView();
      });

      expect(result.current.currentView).toEqual({ type: 'root' });
    });
  });

  // ── resetToRoot ────────────────────────────────────────────────────────────
  describe('resetToRoot', () => {
    it('should reset from deep navigation to root', () => {
      const { result } = renderHook(() => usePanelNavigation('evt-1'));

      act(() => {
        result.current.pushView({ type: 'property-details', propertyId: 42 });
        result.current.pushView({ type: 'intervention-detail', interventionId: 77 });
      });

      act(() => {
        result.current.resetToRoot();
      });

      expect(result.current.currentView).toEqual({ type: 'root' });
      expect(result.current.isSubView).toBe(false);
    });

    it('should be idempotent when already at root', () => {
      const { result } = renderHook(() => usePanelNavigation('evt-1'));

      act(() => {
        result.current.resetToRoot();
      });

      expect(result.current.currentView).toEqual({ type: 'root' });
    });
  });

  // ── Event change auto-reset ─────────────────────────────────────────────────
  describe('auto-reset on event change', () => {
    it('should reset to root when eventId changes', () => {
      const { result, rerender } = renderHook(
        ({ eventId }) => usePanelNavigation(eventId),
        { initialProps: { eventId: 'evt-1' as string | null } },
      );

      act(() => {
        result.current.pushView({ type: 'property-details', propertyId: 42 });
      });
      expect(result.current.isSubView).toBe(true);

      // Change event
      rerender({ eventId: 'evt-2' });

      expect(result.current.currentView).toEqual({ type: 'root' });
      expect(result.current.isSubView).toBe(false);
    });

    it('should reset to root when eventId changes from non-null to null', () => {
      const { result, rerender } = renderHook(
        ({ eventId }) => usePanelNavigation(eventId),
        { initialProps: { eventId: 'evt-1' as string | null } },
      );

      act(() => {
        result.current.pushView({ type: 'intervention-detail', interventionId: 5 });
      });

      rerender({ eventId: null });

      expect(result.current.currentView).toEqual({ type: 'root' });
      expect(result.current.isSubView).toBe(false);
    });

    it('should NOT reset when eventId stays the same', () => {
      const { result, rerender } = renderHook(
        ({ eventId }) => usePanelNavigation(eventId),
        { initialProps: { eventId: 'evt-1' as string | null } },
      );

      act(() => {
        result.current.pushView({ type: 'property-details', propertyId: 42 });
      });

      // Re-render with same eventId
      rerender({ eventId: 'evt-1' });

      expect(result.current.isSubView).toBe(true);
      expect(result.current.currentView).toEqual({ type: 'property-details', propertyId: 42 });
    });
  });

  // ── Return types ────────────────────────────────────────────────────────────
  describe('return type completeness', () => {
    it('should return all expected properties', () => {
      const { result } = renderHook(() => usePanelNavigation('evt-1'));

      expect(result.current).toHaveProperty('currentView');
      expect(result.current).toHaveProperty('isSubView');
      expect(typeof result.current.pushView).toBe('function');
      expect(typeof result.current.popView).toBe('function');
      expect(typeof result.current.resetToRoot).toBe('function');
    });
  });
});
