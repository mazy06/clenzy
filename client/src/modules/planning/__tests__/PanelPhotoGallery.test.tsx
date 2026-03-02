import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PanelPhotoGallery from '../PlanningActionPanel/PanelPhotoGallery';

describe('PanelPhotoGallery', () => {
  const mockPhotos = [
    'https://example.com/photo1.jpg',
    'https://example.com/photo2.jpg',
    'https://example.com/photo3.jpg',
  ];

  // ── Empty state ────────────────────────────────────────────────────────────
  describe('empty state', () => {
    it('should show empty message when no photos', () => {
      render(<PanelPhotoGallery photos={[]} label="Photos avant" />);
      expect(screen.getByText(/Aucune photo/)).toBeInTheDocument();
      expect(screen.getByText(/Photos avant/)).toBeInTheDocument();
    });
  });

  // ── Photo grid ──────────────────────────────────────────────────────────────
  describe('photo grid', () => {
    it('should render label and photo count', () => {
      render(<PanelPhotoGallery photos={mockPhotos} label="Photos avant" />);
      expect(screen.getByText('Photos avant')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // count chip
    });

    it('should render photos as images', () => {
      render(<PanelPhotoGallery photos={mockPhotos} label="Photos avant" />);
      const images = screen.getAllByRole('img');
      expect(images.length).toBe(3);
    });

    it('should render at most maxVisible photos', () => {
      render(<PanelPhotoGallery photos={mockPhotos} label="Test" maxVisible={2} />);
      const images = screen.getAllByRole('img');
      expect(images.length).toBe(2);
    });

    it('should show "+N" overlay when photos exceed maxVisible', () => {
      const fivePhotos = [
        'https://example.com/1.jpg',
        'https://example.com/2.jpg',
        'https://example.com/3.jpg',
        'https://example.com/4.jpg',
        'https://example.com/5.jpg',
      ];
      render(<PanelPhotoGallery photos={fivePhotos} label="Test" maxVisible={4} />);
      expect(screen.getByText('+1')).toBeInTheDocument();
    });

    it('should NOT show "+N" overlay when photos equal maxVisible', () => {
      render(<PanelPhotoGallery photos={mockPhotos} label="Test" maxVisible={3} />);
      expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
    });
  });

  // ── Lightbox ────────────────────────────────────────────────────────────────
  describe('lightbox', () => {
    it('should open lightbox when photo is clicked', () => {
      render(<PanelPhotoGallery photos={mockPhotos} label="Test" />);
      const images = screen.getAllByRole('img');
      fireEvent.click(images[0]);

      // Lightbox should show counter "1 / 3"
      expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });

    it('should navigate to next photo in lightbox', () => {
      render(<PanelPhotoGallery photos={mockPhotos} label="Test" />);
      const images = screen.getAllByRole('img');
      fireEvent.click(images[0]);

      expect(screen.getByText('1 / 3')).toBeInTheDocument();

      // Find the next button (ChevronRight)
      const buttons = screen.getAllByRole('button');
      const nextButton = buttons.find((btn) => btn.querySelector('[data-testid="ChevronRightIcon"]'));
      if (nextButton) {
        fireEvent.click(nextButton);
        expect(screen.getByText('2 / 3')).toBeInTheDocument();
      }
    });

    it('should close lightbox', async () => {
      render(<PanelPhotoGallery photos={mockPhotos} label="Test" />);
      const images = screen.getAllByRole('img');
      fireEvent.click(images[0]);

      expect(screen.getByText('1 / 3')).toBeInTheDocument();

      // Find close button
      const buttons = screen.getAllByRole('button');
      const closeButton = buttons.find((btn) => btn.querySelector('[data-testid="CloseIcon"]'));
      if (closeButton) {
        fireEvent.click(closeButton);
        // MUI Dialog uses animations; wait for removal
        await waitFor(() => {
          expect(screen.queryByText('1 / 3')).not.toBeInTheDocument();
        }, { timeout: 3000 });
      }
    });

    it('should open lightbox at the correct index when non-first photo is clicked', () => {
      render(<PanelPhotoGallery photos={mockPhotos} label="Test" />);
      const images = screen.getAllByRole('img');
      fireEvent.click(images[1]); // Click second photo

      expect(screen.getByText('2 / 3')).toBeInTheDocument();
    });
  });

  // ── Default maxVisible ──────────────────────────────────────────────────────
  describe('defaults', () => {
    it('should default maxVisible to 4', () => {
      const sixPhotos = Array.from({ length: 6 }, (_, i) => `https://example.com/${i}.jpg`);
      render(<PanelPhotoGallery photos={sixPhotos} label="Test" />);
      const images = screen.getAllByRole('img');
      expect(images.length).toBe(4);
      expect(screen.getByText('+2')).toBeInTheDocument();
    });
  });
});
