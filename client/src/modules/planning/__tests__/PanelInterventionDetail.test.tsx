import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PanelInterventionDetail from '../PlanningActionPanel/PanelInterventionDetail';
import type { PlanningEvent } from '../types';
import type { PlanningIntervention } from '../../../services/api';

// ─── Helpers ────────────────────────────────────────────────────────────────

const makeIntervention = (overrides?: Partial<PlanningIntervention>): PlanningIntervention => ({
  id: 5,
  title: 'Ménage Studio Centre',
  type: 'cleaning',
  status: 'scheduled',
  propertyId: 10,
  propertyName: 'Studio Centre',
  startDate: '2025-06-01',
  endDate: '2025-06-01',
  startTime: '09:00',
  endTime: '11:00',
  estimatedDurationHours: 2,
  assigneeName: 'Marie D.',
  completedSteps: '',
  notes: 'Attention au parquet',
  ...overrides,
});

const makeEvent = (): PlanningEvent => ({
  id: 'int-5',
  type: 'cleaning',
  propertyId: 10,
  startDate: '2025-06-01',
  endDate: '2025-06-01',
  label: 'Ménage Studio Centre',
  status: 'scheduled',
  color: '#9B7FC4',
  intervention: makeIntervention(),
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PanelInterventionDetail', () => {
  // ── Not found ──────────────────────────────────────────────────────────────
  describe('intervention not found', () => {
    it('should show warning when intervention ID does not match', () => {
      render(
        <PanelInterventionDetail
          interventionId={999}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[]}
        />,
      );
      expect(screen.getByText(/Intervention #999 introuvable/)).toBeInTheDocument();
    });
  });

  // ── Header ─────────────────────────────────────────────────────────────────
  describe('header', () => {
    it('should display intervention title', () => {
      render(
        <PanelInterventionDetail
          interventionId={5}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[makeIntervention()]}
        />,
      );
      expect(screen.getByText('Ménage Studio Centre')).toBeInTheDocument();
    });

    it('should display property name', () => {
      render(
        <PanelInterventionDetail
          interventionId={5}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[makeIntervention()]}
        />,
      );
      expect(screen.getByText('Studio Centre')).toBeInTheDocument();
    });
  });

  // ── Chips ──────────────────────────────────────────────────────────────────
  describe('chips', () => {
    it('should display status chip', () => {
      render(
        <PanelInterventionDetail
          interventionId={5}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[makeIntervention()]}
        />,
      );
      expect(screen.getByText('scheduled')).toBeInTheDocument();
    });

    it('should display assignee chip', () => {
      render(
        <PanelInterventionDetail
          interventionId={5}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[makeIntervention()]}
        />,
      );
      expect(screen.getByText('Marie D.')).toBeInTheDocument();
    });

    it('should display duration chip', () => {
      render(
        <PanelInterventionDetail
          interventionId={5}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[makeIntervention()]}
        />,
      );
      expect(screen.getByText('2h')).toBeInTheDocument();
    });

    it('should display cost chip', () => {
      render(
        <PanelInterventionDetail
          interventionId={5}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[makeIntervention()]}
        />,
      );
      expect(screen.getByText('50 €')).toBeInTheDocument();
    });
  });

  // ── Dates ──────────────────────────────────────────────────────────────────
  describe('dates', () => {
    it('should display start and end dates with times', () => {
      render(
        <PanelInterventionDetail
          interventionId={5}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[makeIntervention()]}
        />,
      );
      // Multiple elements may contain the date, so use getAllByText
      const dateElements = screen.getAllByText(/2025-06-01/);
      expect(dateElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/09:00/)).toBeInTheDocument();
    });
  });

  // ── Progress ───────────────────────────────────────────────────────────────
  describe('progress', () => {
    it('should show 0% when no steps completed', () => {
      render(
        <PanelInterventionDetail
          interventionId={5}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[makeIntervention()]}
        />,
      );
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should show correct progress with completed steps', () => {
      const intv = makeIntervention({ completedSteps: 'inspection,rooms' });
      render(
        <PanelInterventionDetail
          interventionId={5}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[intv]}
        />,
      );
      expect(screen.getByText('66%')).toBeInTheDocument();
    });

    it('should show step chips', () => {
      render(
        <PanelInterventionDetail
          interventionId={5}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[makeIntervention()]}
        />,
      );
      expect(screen.getByText('Inspection')).toBeInTheDocument();
      expect(screen.getByText('Pièces')).toBeInTheDocument();
      expect(screen.getByText('Photos')).toBeInTheDocument();
    });
  });

  // ── Action buttons ─────────────────────────────────────────────────────────
  describe('action buttons', () => {
    it('should show start button for scheduled intervention', () => {
      const onStart = vi.fn();
      render(
        <PanelInterventionDetail
          interventionId={5}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[makeIntervention()]}
          onStartIntervention={onStart}
        />,
      );
      expect(screen.getByText("Démarrer l'intervention")).toBeInTheDocument();
    });

    it('should call onStartIntervention when start button is clicked', async () => {
      const onStart = vi.fn().mockResolvedValue({ success: true, error: null });
      render(
        <PanelInterventionDetail
          interventionId={5}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[makeIntervention()]}
          onStartIntervention={onStart}
        />,
      );

      fireEvent.click(screen.getByText("Démarrer l'intervention"));

      await waitFor(() => {
        expect(onStart).toHaveBeenCalledWith(5);
      });
    });

    it('should show complete button for in-progress intervention', () => {
      const intv = makeIntervention({ status: 'in_progress' });
      const onComplete = vi.fn();
      render(
        <PanelInterventionDetail
          interventionId={5}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[intv]}
          onCompleteIntervention={onComplete}
        />,
      );
      expect(screen.getByText("Terminer l'intervention")).toBeInTheDocument();
    });

    it('should NOT show start button for in-progress intervention', () => {
      const intv = makeIntervention({ status: 'in_progress' });
      render(
        <PanelInterventionDetail
          interventionId={5}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[intv]}
          onStartIntervention={vi.fn()}
        />,
      );
      expect(screen.queryByText("Démarrer l'intervention")).not.toBeInTheDocument();
    });

    it('should NOT show complete button for completed intervention', () => {
      const intv = makeIntervention({ status: 'completed' });
      render(
        <PanelInterventionDetail
          interventionId={5}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[intv]}
          onCompleteIntervention={vi.fn()}
        />,
      );
      expect(screen.queryByText("Terminer l'intervention")).not.toBeInTheDocument();
    });

    it('should display error when start fails', async () => {
      const onStart = vi.fn().mockResolvedValue({ success: false, error: 'Erreur serveur' });
      render(
        <PanelInterventionDetail
          interventionId={5}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[makeIntervention()]}
          onStartIntervention={onStart}
        />,
      );

      fireEvent.click(screen.getByText("Démarrer l'intervention"));

      await waitFor(() => {
        expect(screen.getByText('Erreur serveur')).toBeInTheDocument();
      });
    });
  });

  // ── Photos accordion ───────────────────────────────────────────────────────
  describe('photos', () => {
    it('should show photos accordion with count', () => {
      render(
        <PanelInterventionDetail
          interventionId={5}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[makeIntervention()]}
        />,
      );
      expect(screen.getByText('Photos (0)')).toBeInTheDocument();
    });

    it('should show "Aucune photo" when no photos available', () => {
      render(
        <PanelInterventionDetail
          interventionId={5}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[makeIntervention()]}
        />,
      );
      expect(screen.getByText('Aucune photo')).toBeInTheDocument();
    });

    it('should count photos from both before and after', () => {
      const intv = makeIntervention({
        beforePhotosUrls: ['url1', 'url2'],
        afterPhotosUrls: ['url3'],
      });
      render(
        <PanelInterventionDetail
          interventionId={5}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[intv]}
        />,
      );
      expect(screen.getByText('Photos (3)')).toBeInTheDocument();
    });
  });

  // ── Notes accordion ────────────────────────────────────────────────────────
  describe('notes', () => {
    it('should display notes in accordion', () => {
      render(
        <PanelInterventionDetail
          interventionId={5}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[makeIntervention()]}
        />,
      );
      expect(screen.getByText('Notes')).toBeInTheDocument();
      expect(screen.getByText('Attention au parquet')).toBeInTheDocument();
    });

    it('should NOT render notes accordion when no notes', () => {
      const intv = makeIntervention({ notes: undefined });
      render(
        <PanelInterventionDetail
          interventionId={5}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[intv]}
        />,
      );
      // Notes accordion title should not be present (but Photos title still is)
      const notesElements = screen.queryAllByText('Notes');
      // There should be 0 Notes accordions (Photos accordion is different)
      expect(notesElements.length).toBe(0);
    });
  });

  // ── Fallback to event.intervention ─────────────────────────────────────────
  describe('intervention lookup fallback', () => {
    it('should fall back to event.intervention when interventions array is empty', () => {
      render(
        <PanelInterventionDetail
          interventionId={5}
          event={makeEvent()}
          allEvents={[makeEvent()]}
          interventions={[]}
        />,
      );
      // Should find the intervention from event.intervention
      expect(screen.getByText('Ménage Studio Centre')).toBeInTheDocument();
    });
  });
});
