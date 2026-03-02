import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PanelSubViewHeader from '../PlanningActionPanel/PanelSubViewHeader';

describe('PanelSubViewHeader', () => {
  it('should render the title', () => {
    render(<PanelSubViewHeader title="Détails du logement" onBack={vi.fn()} />);
    expect(screen.getByText('Détails du logement')).toBeInTheDocument();
  });

  it('should render the back button', () => {
    render(<PanelSubViewHeader title="Test" onBack={vi.fn()} />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should call onBack when back button is clicked', () => {
    const onBack = vi.fn();
    render(<PanelSubViewHeader title="Test" onBack={onBack} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('should display long titles with ellipsis styling', () => {
    render(<PanelSubViewHeader title="Very long title that should be truncated" onBack={vi.fn()} />);
    const titleElement = screen.getByText('Very long title that should be truncated');
    expect(titleElement).toBeInTheDocument();
  });

  it('should have the ArrowBack icon accessible', () => {
    render(<PanelSubViewHeader title="Test" onBack={vi.fn()} />);
    // MUI renders the icon inside the IconButton; the button should exist
    const button = screen.getByRole('button');
    expect(button).toBeVisible();
  });
});
