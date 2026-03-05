import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PanelPropertyDetails from '../PlanningActionPanel/PanelPropertyDetails';

// ─── Mock usePropertyDetails ─────────────────────────────────────────────────

const mockPropertyData = {
  id: 42,
  name: 'Appartement Haussmann',
  address: '15 Rue de Rivoli',
  city: 'Paris',
  postalCode: '75001',
  status: 'active',
  bedrooms: 3,
  bathrooms: 2,
  surfaceArea: 85,
  maxGuests: 6,
  numberOfFloors: 2,
  amenities: ['WIFI', 'EQUIPPED_KITCHEN', 'WASHING_MACHINE', 'PARKING'],
  cleaningFrequency: 'AFTER_EACH_STAY',
  cleaningBasePrice: 60,
  cleaningDurationMinutes: 120,
  defaultCheckInTime: '15:00',
  defaultCheckOutTime: '11:00',
  cleaningNotes: 'Utiliser les produits bio',
  hasExterior: true,
  hasLaundry: true,
  hasIroning: false,
  hasDeepKitchen: false,
  hasDisinfection: false,
};

const mockInterventions = [
  { id: '1', type: 'cleaning', status: 'completed', description: 'Ménage 01/06', scheduledDate: '2025-06-01', assignedTo: 'Marie' },
  { id: '2', type: 'maintenance', status: 'in_progress', description: 'Réparation plomberie', scheduledDate: '2025-06-03', assignedTo: null },
];

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../../hooks/usePropertyDetails', () => ({
  usePropertyDetails: vi.fn(() => ({
    property: mockPropertyData,
    interventions: mockInterventions,
    serviceRequests: [],
    isLoading: false,
    isError: false,
    error: null,
  })),
}));

describe('PanelPropertyDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Header ─────────────────────────────────────────────────────────────────
  describe('header', () => {
    it('should display property name', () => {
      render(<PanelPropertyDetails propertyId={42} />);
      expect(screen.getByText('Appartement Haussmann')).toBeInTheDocument();
    });

    it('should display status chip', () => {
      render(<PanelPropertyDetails propertyId={42} />);
      expect(screen.getByText('active')).toBeInTheDocument();
    });

    it('should display address', () => {
      render(<PanelPropertyDetails propertyId={42} />);
      expect(screen.getByText(/15 Rue de Rivoli/)).toBeInTheDocument();
      expect(screen.getByText(/Paris/)).toBeInTheDocument();
      expect(screen.getByText(/75001/)).toBeInTheDocument();
    });
  });

  // ── Metrics ────────────────────────────────────────────────────────────────
  describe('metrics grid', () => {
    it('should display bedrooms', () => {
      render(<PanelPropertyDetails propertyId={42} />);
      expect(screen.getByText('Chambres')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should display bathrooms', () => {
      render(<PanelPropertyDetails propertyId={42} />);
      expect(screen.getByText('SDB')).toBeInTheDocument();
      // '2' may match multiple elements (bathrooms, floors); use getAllByText
      const matches = screen.getAllByText('2');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it('should display surface area', () => {
      render(<PanelPropertyDetails propertyId={42} />);
      expect(screen.getByText('m²')).toBeInTheDocument();
      expect(screen.getByText('85')).toBeInTheDocument();
    });

    it('should display capacity', () => {
      render(<PanelPropertyDetails propertyId={42} />);
      expect(screen.getByText('Capacité')).toBeInTheDocument();
      expect(screen.getByText('6')).toBeInTheDocument();
    });

    it('should display floors when present', () => {
      render(<PanelPropertyDetails propertyId={42} />);
      expect(screen.getByText('Étages')).toBeInTheDocument();
    });
  });

  // ── Amenities ──────────────────────────────────────────────────────────────
  describe('amenities', () => {
    it('should display amenity chips', () => {
      render(<PanelPropertyDetails propertyId={42} />);
      expect(screen.getByText('Équipements')).toBeInTheDocument();
      // formatAmenity replaces _ with space and uppercases word starts
      // 'WIFI' → 'WIFI', 'EQUIPPED_KITCHEN' → 'EQUIPPED KITCHEN', etc.
      expect(screen.getByText('WIFI')).toBeInTheDocument();
      expect(screen.getByText('EQUIPPED KITCHEN')).toBeInTheDocument();
      expect(screen.getByText('WASHING MACHINE')).toBeInTheDocument();
      expect(screen.getByText('PARKING')).toBeInTheDocument();
    });
  });

  // ── Cleaning config ────────────────────────────────────────────────────────
  describe('cleaning config', () => {
    it('should display cleaning config accordion', () => {
      render(<PanelPropertyDetails propertyId={42} />);
      expect(screen.getByText('Configuration ménage')).toBeInTheDocument();
    });

    it('should display cleaning base price', () => {
      render(<PanelPropertyDetails propertyId={42} />);
      expect(screen.getByText('60 EUR')).toBeInTheDocument();
    });

    it('should display cleaning duration', () => {
      render(<PanelPropertyDetails propertyId={42} />);
      expect(screen.getByText('120 min')).toBeInTheDocument();
    });

    it('should display check-in/out times', () => {
      render(<PanelPropertyDetails propertyId={42} />);
      expect(screen.getByText('15:00')).toBeInTheDocument();
      expect(screen.getByText('11:00')).toBeInTheDocument();
    });

    it('should display cleaning features', () => {
      render(<PanelPropertyDetails propertyId={42} />);
      expect(screen.getByText('Extérieur')).toBeInTheDocument();
      expect(screen.getByText('Linge')).toBeInTheDocument();
    });
  });

  // ── Cleaning notes ─────────────────────────────────────────────────────────
  describe('cleaning notes', () => {
    it('should display cleaning notes in accordion', () => {
      render(<PanelPropertyDetails propertyId={42} />);
      expect(screen.getByText('Notes ménage')).toBeInTheDocument();
      expect(screen.getByText('Utiliser les produits bio')).toBeInTheDocument();
    });
  });

  // ── Interventions ──────────────────────────────────────────────────────────
  describe('interventions list', () => {
    it('should display interventions count', () => {
      render(<PanelPropertyDetails propertyId={42} />);
      expect(screen.getByText('Interventions (2)')).toBeInTheDocument();
    });

    it('should display intervention descriptions', () => {
      render(<PanelPropertyDetails propertyId={42} />);
      expect(screen.getByText('Ménage 01/06')).toBeInTheDocument();
      expect(screen.getByText('Réparation plomberie')).toBeInTheDocument();
    });

    it('should call onDrillDown when intervention is clicked', () => {
      const onDrillDown = vi.fn();
      render(<PanelPropertyDetails propertyId={42} onDrillDown={onDrillDown} />);

      fireEvent.click(screen.getByText('Ménage 01/06'));
      expect(onDrillDown).toHaveBeenCalledWith({ type: 'intervention-detail', interventionId: 1 });
    });
  });

  // ── External link ──────────────────────────────────────────────────────────
  describe('external link', () => {
    it('should display "Voir page complète" button', () => {
      render(<PanelPropertyDetails propertyId={42} />);
      expect(screen.getByText('Voir page complète')).toBeInTheDocument();
    });

    it('should navigate to property page when clicked', () => {
      render(<PanelPropertyDetails propertyId={42} />);

      fireEvent.click(screen.getByText('Voir page complète'));
      expect(mockNavigate).toHaveBeenCalledWith('/properties/42');
    });
  });

  // ── Loading state ──────────────────────────────────────────────────────────
  describe('loading state', () => {
    it('should show spinner when loading', async () => {
      const { usePropertyDetails } = await import('../../../hooks/usePropertyDetails');
      (usePropertyDetails as any).mockReturnValueOnce({
        property: null,
        interventions: [],
        isLoading: true,
        isError: false,
        error: null,
      });

      render(<PanelPropertyDetails propertyId={42} />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  // ── Error state ────────────────────────────────────────────────────────────
  describe('error state', () => {
    it('should show error alert on error', async () => {
      const { usePropertyDetails } = await import('../../../hooks/usePropertyDetails');
      (usePropertyDetails as any).mockReturnValueOnce({
        property: null,
        interventions: [],
        isLoading: false,
        isError: true,
        error: 'Network error',
      });

      render(<PanelPropertyDetails propertyId={42} />);
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });
});
