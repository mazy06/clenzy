import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PanelInterventionRecap from '../PlanningActionPanel/PanelInterventionRecap';
import type { PlanningEvent } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const makeEvent = (overrides?: Partial<PlanningEvent['intervention']>): PlanningEvent => ({
  id: 'int-1',
  type: 'cleaning',
  propertyId: 10,
  startDate: '2025-06-01',
  endDate: '2025-06-01',
  label: 'Ménage Studio',
  status: 'in_progress',
  color: '#9B7FC4',
  intervention: {
    id: 1,
    title: 'Ménage Studio',
    type: 'cleaning',
    status: 'in_progress',
    propertyId: 10,
    propertyName: 'Studio Centre',
    startDate: '2025-06-01',
    endDate: '2025-06-01',
    estimatedDurationHours: 2,
    ...overrides,
  },
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PanelInterventionRecap', () => {
  // ── No intervention ────────────────────────────────────────────────────────
  describe('no intervention data', () => {
    it('should show alert when no intervention', () => {
      const event = { ...makeEvent(), intervention: undefined };
      render(<PanelInterventionRecap event={event} />);
      expect(screen.getByText(/Aucune donnée d'intervention/)).toBeInTheDocument();
    });
  });

  // ── Status + duration chips ────────────────────────────────────────────────
  describe('status and duration', () => {
    it('should display status chip', () => {
      render(<PanelInterventionRecap event={makeEvent()} />);
      expect(screen.getByText('in_progress')).toBeInTheDocument();
    });

    it('should display estimated duration', () => {
      render(<PanelInterventionRecap event={makeEvent({ estimatedDurationHours: 3 })} />);
      expect(screen.getByText('3h estimées')).toBeInTheDocument();
    });

    it('should display estimated cost', () => {
      render(<PanelInterventionRecap event={makeEvent({ estimatedDurationHours: 2 })} />);
      expect(screen.getByText('50 EUR')).toBeInTheDocument();
    });
  });

  // ── Photos ─────────────────────────────────────────────────────────────────
  describe('photos', () => {
    it('should render before photos gallery', () => {
      const event = makeEvent({
        beforePhotosUrls: ['https://example.com/before1.jpg', 'https://example.com/before2.jpg'],
      });
      render(<PanelInterventionRecap event={event} />);
      expect(screen.getByText('Photos avant')).toBeInTheDocument();
    });

    it('should render after photos gallery', () => {
      const event = makeEvent({
        afterPhotosUrls: ['https://example.com/after1.jpg'],
      });
      render(<PanelInterventionRecap event={event} />);
      expect(screen.getByText('Photos après')).toBeInTheDocument();
    });

    it('should handle beforePhotosUrls as comma-separated string', () => {
      const event = makeEvent({
        beforePhotosUrls: 'https://example.com/1.jpg,https://example.com/2.jpg' as any,
      });
      render(<PanelInterventionRecap event={event} />);
      expect(screen.getByText('Photos avant')).toBeInTheDocument();
    });

    it('should show empty photo messages when no photos', () => {
      render(<PanelInterventionRecap event={makeEvent()} />);
      const emptyMessages = screen.getAllByText(/Aucune photo/);
      expect(emptyMessages.length).toBeGreaterThanOrEqual(2); // both before and after galleries
    });
  });

  // ── Step notes ─────────────────────────────────────────────────────────────
  describe('notes parsing', () => {
    it('should show "Aucune note" when no notes', () => {
      render(<PanelInterventionRecap event={makeEvent({ notes: undefined })} />);
      expect(screen.getByText(/Aucune note enregistrée/)).toBeInTheDocument();
    });

    it('should render structured notes in accordions', () => {
      const event = makeEvent({
        notes: '--- Inspection\nRAS, logement propre\n--- Pieces\nToutes validées',
      });
      render(<PanelInterventionRecap event={event} />);
      expect(screen.getByText('Inspection')).toBeInTheDocument();
      expect(screen.getByText('Pièces')).toBeInTheDocument();
    });

    it('should show raw notes when no structured format detected', () => {
      const event = makeEvent({ notes: 'Simple note sans structure' });
      render(<PanelInterventionRecap event={event} />);
      expect(screen.getByText('Simple note sans structure')).toBeInTheDocument();
    });
  });

  // ── Signalements ───────────────────────────────────────────────────────────
  describe('signalements', () => {
    it('should show 0 signalements when none present', () => {
      render(<PanelInterventionRecap event={makeEvent()} />);
      expect(screen.getByText('Signalements (0)')).toBeInTheDocument();
      expect(screen.getByText('Aucun signalement')).toBeInTheDocument();
    });

    it('should parse signalements from notes', () => {
      const event = makeEvent({
        notes: '[SIGNALEMENT:haute] Tuyau cassé dans la salle de bain\n[SIGNALEMENT:basse] Ampoule grillée salon',
      });
      render(<PanelInterventionRecap event={event} />);
      expect(screen.getByText('Signalements (2)')).toBeInTheDocument();
      // Multiple elements may match the signalement text, use getAllByText
      const tuyauElements = screen.getAllByText(/Tuyau cassé/);
      expect(tuyauElements.length).toBeGreaterThanOrEqual(1);
      const ampouleElements = screen.getAllByText(/Ampoule grillée/);
      expect(ampouleElements.length).toBeGreaterThanOrEqual(1);
    });

    it('should display severity chip for signalements', () => {
      const event = makeEvent({
        notes: '[SIGNALEMENT:haute] Problème urgent',
      });
      render(<PanelInterventionRecap event={event} />);
      expect(screen.getByText('Haute')).toBeInTheDocument();
    });

    it('should show "Ajouter" button for signalements', () => {
      render(<PanelInterventionRecap event={makeEvent()} />);
      expect(screen.getByText('Ajouter')).toBeInTheDocument();
    });

    it('should open add signalement dialog', () => {
      render(<PanelInterventionRecap event={makeEvent()} />);
      fireEvent.click(screen.getByText('Ajouter'));
      expect(screen.getByText('Ajouter un signalement')).toBeInTheDocument();
      expect(screen.getByLabelText('Sévérité')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
    });

    it('should disable submit when description is empty', () => {
      render(<PanelInterventionRecap event={makeEvent()} />);
      fireEvent.click(screen.getByText('Ajouter'));
      const submitBtn = screen.getAllByText('Ajouter').find(
        (el) => el.closest('button')?.type !== 'button' || el.closest('.MuiDialogActions-root'),
      );
      // The second "Ajouter" inside the dialog should be disabled
      const dialogActions = screen.getByText('Annuler').parentElement;
      const addBtn = dialogActions?.querySelector('button:last-child');
      expect(addBtn).toBeDisabled();
    });

    it('should close dialog when Annuler is clicked', async () => {
      render(<PanelInterventionRecap event={makeEvent()} />);
      fireEvent.click(screen.getByText('Ajouter'));
      expect(screen.getByText('Ajouter un signalement')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Annuler'));
      // MUI Dialog has animation; wait for it to close
      await waitFor(() => {
        expect(screen.queryByText('Annuler')).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  // ── parseSignalements utility ──────────────────────────────────────────────
  describe('signalement severity mapping', () => {
    it('should handle mixed severity signalements', () => {
      const event = makeEvent({
        notes: [
          '[SIGNALEMENT:haute] Fuite eau',
          '[SIGNALEMENT:moyenne] Peinture écaillée',
          '[SIGNALEMENT:basse] Coussin manquant',
        ].join('\n'),
      });
      render(<PanelInterventionRecap event={event} />);
      expect(screen.getByText('Signalements (3)')).toBeInTheDocument();
      expect(screen.getByText('Haute')).toBeInTheDocument();
      expect(screen.getByText('Moyenne')).toBeInTheDocument();
      expect(screen.getByText('Basse')).toBeInTheDocument();
    });
  });
});
