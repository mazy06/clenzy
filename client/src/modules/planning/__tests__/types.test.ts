import { describe, it, expect } from 'vitest';
import type {
  PanelTab,
  ReservationPanelTab,
  InterventionPanelTab,
  PanelView,
  PlanningEvent,
  PlanningEventType,
} from '../types';

/**
 * Type-level tests ensuring the extended types are correct
 * and contextual tab configurations are properly structured.
 */

describe('Planning panel types', () => {
  // ── PanelTab union ─────────────────────────────────────────────────────────
  describe('PanelTab', () => {
    it('ReservationPanelTab should have 4 valid values', () => {
      const tabs: ReservationPanelTab[] = ['info', 'property', 'operations', 'financial'];
      expect(tabs).toHaveLength(4);
      expect(tabs).toContain('info');
      expect(tabs).toContain('property');
      expect(tabs).toContain('operations');
      expect(tabs).toContain('financial');
    });

    it('InterventionPanelTab should have 4 valid values', () => {
      const tabs: InterventionPanelTab[] = ['info', 'progress', 'recap', 'payment'];
      expect(tabs).toHaveLength(4);
      expect(tabs).toContain('info');
      expect(tabs).toContain('progress');
      expect(tabs).toContain('recap');
      expect(tabs).toContain('payment');
    });

    it('PanelTab union should accept all reservation tabs', () => {
      const reservationTabs: PanelTab[] = ['info', 'property', 'operations', 'financial'];
      expect(reservationTabs).toHaveLength(4);
    });

    it('PanelTab union should accept all intervention tabs', () => {
      const interventionTabs: PanelTab[] = ['info', 'progress', 'recap', 'payment'];
      expect(interventionTabs).toHaveLength(4);
    });

    it('"info" tab should be shared between reservation and intervention', () => {
      const resTab: ReservationPanelTab = 'info';
      const intTab: InterventionPanelTab = 'info';
      const panelTab: PanelTab = 'info';
      expect(resTab).toBe(intTab);
      expect(panelTab).toBe('info');
    });
  });

  // ── PanelView ──────────────────────────────────────────────────────────────
  describe('PanelView', () => {
    it('should support root view', () => {
      const view: PanelView = { type: 'root' };
      expect(view.type).toBe('root');
    });

    it('should support property-details view with propertyId', () => {
      const view: PanelView = { type: 'property-details', propertyId: 42 };
      expect(view.type).toBe('property-details');
      expect(view.propertyId).toBe(42);
    });

    it('should support intervention-detail view with interventionId', () => {
      const view: PanelView = { type: 'intervention-detail', interventionId: 77 };
      expect(view.type).toBe('intervention-detail');
      expect(view.interventionId).toBe(77);
    });

    it('should discriminate via type field', () => {
      const views: PanelView[] = [
        { type: 'root' },
        { type: 'property-details', propertyId: 1 },
        { type: 'intervention-detail', interventionId: 2 },
      ];

      for (const view of views) {
        switch (view.type) {
          case 'root':
            expect(view).toEqual({ type: 'root' });
            break;
          case 'property-details':
            expect(view.propertyId).toBe(1);
            break;
          case 'intervention-detail':
            expect(view.interventionId).toBe(2);
            break;
        }
      }
    });
  });

  // ── PlanningEventType ──────────────────────────────────────────────────────
  describe('PlanningEventType', () => {
    it('should include all valid event types', () => {
      const types: PlanningEventType[] = ['reservation', 'cleaning', 'maintenance', 'blocked'];
      expect(types).toHaveLength(4);
    });
  });

  // ── PlanningEvent intervention field ───────────────────────────────────────
  describe('PlanningEvent.intervention', () => {
    it('should accept extended PlanningIntervention fields', () => {
      const event: PlanningEvent = {
        id: 'test-1',
        type: 'cleaning',
        propertyId: 1,
        startDate: '2025-01-01',
        endDate: '2025-01-01',
        label: 'Test',
        status: 'scheduled',
        color: '#000',
        intervention: {
          id: 1,
          title: 'Test',
          type: 'cleaning',
          status: 'scheduled',
          propertyId: 1,
          propertyName: 'Test Prop',
          startDate: '2025-01-01',
          endDate: '2025-01-01',
          estimatedDurationHours: 2,
          // Extended fields
          progressPercentage: 50,
          completedSteps: 'inspection,rooms',
          validatedRooms: '0,1,2',
          beforePhotosUrls: ['url1', 'url2'],
          afterPhotosUrls: 'url3,url4',
          paymentStatus: 'PENDING',
          estimatedCost: 50,
          actualCost: 45,
        },
      };

      expect(event.intervention?.completedSteps).toBe('inspection,rooms');
      expect(event.intervention?.validatedRooms).toBe('0,1,2');
      expect(event.intervention?.paymentStatus).toBe('PENDING');
      expect(event.intervention?.estimatedCost).toBe(50);
    });
  });
});
