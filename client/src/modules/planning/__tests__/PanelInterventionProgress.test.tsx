import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PanelInterventionProgress from '../PlanningActionPanel/PanelInterventionProgress';
import type { PlanningEvent } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const makeEvent = (overrides?: Partial<PlanningEvent['intervention']>): PlanningEvent => ({
  id: 'int-1',
  type: 'cleaning',
  propertyId: 10,
  startDate: '2025-06-01',
  endDate: '2025-06-01',
  label: 'Ménage Studio',
  status: 'scheduled',
  color: '#9B7FC4',
  intervention: {
    id: 1,
    title: 'Ménage Studio',
    type: 'cleaning',
    status: 'scheduled',
    propertyId: 10,
    propertyName: 'Studio Centre',
    startDate: '2025-06-01',
    endDate: '2025-06-01',
    estimatedDurationHours: 2,
    completedSteps: '',
    validatedRooms: '',
    ...overrides,
  },
});

const makeStartedEvent = (completedSteps = ''): PlanningEvent =>
  makeEvent({ status: 'in_progress', completedSteps });

const makeCompletedEvent = (): PlanningEvent =>
  makeEvent({
    status: 'completed',
    completedSteps: 'inspection,rooms,after_photos',
    validatedRooms: '0,1,2,3,4',
  });

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PanelInterventionProgress', () => {
  // ── Empty state ────────────────────────────────────────────────────────────
  describe('no intervention data', () => {
    it('should show info alert when no intervention', () => {
      const event = { ...makeEvent(), intervention: undefined };
      render(<PanelInterventionProgress event={event} />);
      expect(screen.getByText(/Aucune donnée d'intervention/)).toBeInTheDocument();
    });
  });

  // ── Progress display ───────────────────────────────────────────────────────
  describe('progress display', () => {
    it('should show 0% progress when no steps completed', () => {
      render(<PanelInterventionProgress event={makeEvent()} />);
      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText('Progression')).toBeInTheDocument();
    });

    it('should show 33% when inspection is done', () => {
      render(<PanelInterventionProgress event={makeStartedEvent('inspection')} />);
      expect(screen.getByText('33%')).toBeInTheDocument();
    });

    it('should show 66% when inspection and rooms are done', () => {
      render(<PanelInterventionProgress event={makeStartedEvent('inspection,rooms')} />);
      expect(screen.getByText('66%')).toBeInTheDocument();
    });

    it('should show 100% when all steps are done', () => {
      render(<PanelInterventionProgress event={makeCompletedEvent()} />);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  // ── Start button ───────────────────────────────────────────────────────────
  describe('start button', () => {
    it('should show start button when intervention is not started', () => {
      render(<PanelInterventionProgress event={makeEvent()} onStartIntervention={vi.fn()} />);
      expect(screen.getByText("Démarrer l'intervention")).toBeInTheDocument();
    });

    it('should NOT show start button when intervention is in progress', () => {
      render(<PanelInterventionProgress event={makeStartedEvent()} onStartIntervention={vi.fn()} />);
      expect(screen.queryByText("Démarrer l'intervention")).not.toBeInTheDocument();
    });

    it('should call onStartIntervention when clicked', async () => {
      const onStart = vi.fn().mockResolvedValue({ success: true, error: null });
      render(<PanelInterventionProgress event={makeEvent()} onStartIntervention={onStart} />);

      fireEvent.click(screen.getByText("Démarrer l'intervention"));

      await waitFor(() => {
        expect(onStart).toHaveBeenCalledWith(1);
      });
    });

    it('should display error if start fails', async () => {
      const onStart = vi.fn().mockResolvedValue({ success: false, error: 'Erreur réseau' });
      render(<PanelInterventionProgress event={makeEvent()} onStartIntervention={onStart} />);

      fireEvent.click(screen.getByText("Démarrer l'intervention"));

      await waitFor(() => {
        expect(screen.getByText('Erreur réseau')).toBeInTheDocument();
      });
    });

    it('should be disabled when onStartIntervention is not provided', () => {
      render(<PanelInterventionProgress event={makeEvent()} />);
      const btn = screen.getByText("Démarrer l'intervention").closest('button');
      expect(btn).toBeDisabled();
    });
  });

  // ── Stepper ────────────────────────────────────────────────────────────────
  describe('stepper steps', () => {
    it('should show all 3 step labels', () => {
      render(<PanelInterventionProgress event={makeEvent()} />);
      expect(screen.getByText('Inspection')).toBeInTheDocument();
      expect(screen.getByText(/Validation pièces/)).toBeInTheDocument();
      expect(screen.getByText(/Photos après & finalisation/)).toBeInTheDocument();
    });

    it('should show room validation count chip', () => {
      render(<PanelInterventionProgress event={makeStartedEvent()} />);
      expect(screen.getByText('0/5')).toBeInTheDocument();
    });

    it('should show room validation count when some rooms validated', () => {
      const event = makeEvent({ status: 'in_progress', validatedRooms: '0,2,3' });
      render(<PanelInterventionProgress event={event} />);
      expect(screen.getByText('3/5')).toBeInTheDocument();
    });

    it('should render room checkboxes with names when step 2 is active', () => {
      // activeStep=1 (inspection done) → Step 2 content is visible
      const event = makeStartedEvent('inspection');
      render(<PanelInterventionProgress event={event} />);
      expect(screen.getByText('Salon / Séjour')).toBeInTheDocument();
      expect(screen.getByText('Chambre 1')).toBeInTheDocument();
      expect(screen.getByText('Cuisine')).toBeInTheDocument();
    });
  });

  // ── Photo upload buttons ───────────────────────────────────────────────────
  describe('photo upload', () => {
    it('should show before photos button', () => {
      render(<PanelInterventionProgress event={makeEvent()} onUploadPhotos={vi.fn()} />);
      expect(screen.getByText('Photos avant')).toBeInTheDocument();
    });

    it('should show after photos button when step 3 is active', () => {
      // activeStep=2 (inspection+rooms done) → Step 3 content is visible
      const event = makeStartedEvent('inspection,rooms');
      render(<PanelInterventionProgress event={event} onUploadPhotos={vi.fn()} />);
      expect(screen.getByText('Photos après')).toBeInTheDocument();
    });
  });

  // ── Complete button ────────────────────────────────────────────────────────
  describe('complete button', () => {
    it('should show Terminer button when step 3 is active', () => {
      // activeStep=2 → Step 3 content is visible
      const event = makeStartedEvent('inspection,rooms');
      render(<PanelInterventionProgress event={event} onCompleteIntervention={vi.fn()} />);
      expect(screen.getByText('Terminer')).toBeInTheDocument();
    });

    it('should call onCompleteIntervention when clicked', async () => {
      const event = makeStartedEvent('inspection,rooms');
      const onComplete = vi.fn().mockResolvedValue({ success: true, error: null });
      render(<PanelInterventionProgress event={event} onCompleteIntervention={onComplete} />);

      fireEvent.click(screen.getByText('Terminer'));

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith(1);
      });
    });

    it('should show completed banner instead of active step for completed intervention', () => {
      // completed event has all steps done, activeStep=3 → all StepContent collapsed
      // So Terminer button is not accessible, but the completed banner IS visible
      render(<PanelInterventionProgress event={makeCompletedEvent()} onCompleteIntervention={vi.fn()} />);
      expect(screen.getByText(/Intervention terminée/)).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  // ── Completed banner ───────────────────────────────────────────────────────
  describe('completed banner', () => {
    it('should show completion banner when intervention is completed', () => {
      render(<PanelInterventionProgress event={makeCompletedEvent()} />);
      expect(screen.getByText(/Intervention terminée/)).toBeInTheDocument();
    });

    it('should NOT show completion banner when intervention is in progress', () => {
      render(<PanelInterventionProgress event={makeStartedEvent()} />);
      expect(screen.queryByText(/Intervention terminée/)).not.toBeInTheDocument();
    });
  });
});
