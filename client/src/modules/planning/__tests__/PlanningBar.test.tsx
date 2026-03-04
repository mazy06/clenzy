import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import PlanningBar from '../PlanningBar';
import type { BarLayout, PlanningEvent } from '../types';

// ─── Mock @dnd-kit ──────────────────────────────────────────────────────────

const mockSetNodeRef = vi.fn();

vi.mock('@dnd-kit/core', () => ({
  useDraggable: vi.fn(() => ({
    attributes: { role: 'button', tabIndex: 0 },
    listeners: {
      onPointerDown: vi.fn(),
    },
    setNodeRef: mockSetNodeRef,
    isDragging: false,
  })),
}));

// ─── Mock useAuth ───────────────────────────────────────────────────────────

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { roles: ['SUPER_ADMIN'], orgRole: 'ADMIN' },
  }),
}));

// ─── Test fixtures ──────────────────────────────────────────────────────────

const theme = createTheme();

const baseEvent: PlanningEvent = {
  id: 'res-1',
  type: 'reservation',
  propertyId: 1,
  startDate: '2026-03-01',
  endDate: '2026-03-05',
  label: 'John Doe',
  status: 'confirmed',
  color: '#4CAF50',
};

const baseLayout: BarLayout = {
  event: baseEvent,
  left: 100,
  width: 200,
  top: 4,
  height: 34,
  layer: 'primary',
};

function renderBar(props?: Partial<React.ComponentProps<typeof PlanningBar>>) {
  return render(
    <ThemeProvider theme={theme}>
      <PlanningBar
        layout={baseLayout}
        zoom="week"
        isSelected={false}
        isConflict={false}
        isDragActive={false}
        resizeWidth={null}
        resizeConflict={false}
        onClick={vi.fn()}
        {...props}
      />
    </ThemeProvider>,
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PlanningBar', () => {
  it('renders with data-planning-bar attribute for drag detection', () => {
    const { container } = renderBar();
    const barElement = container.querySelector('[data-planning-bar]');
    expect(barElement).toBeTruthy();
  });

  it('has touch-action: none for @dnd-kit touch support', () => {
    const { container } = renderBar();
    const barElement = container.querySelector('[data-planning-bar]') as HTMLElement;
    expect(barElement).toBeTruthy();
    // MUI sx applies styles as inline or class-based — check computed style
    const style = window.getComputedStyle(barElement);
    expect(style.touchAction).toBe('none');
  });

  it('shows grab cursor for draggable reservation', () => {
    const { container } = renderBar();
    const barElement = container.querySelector('[data-planning-bar]') as HTMLElement;
    expect(barElement).toBeTruthy();
    expect(window.getComputedStyle(barElement).cursor).toBe('grab');
  });

  it('displays the event label when bar is wide enough', () => {
    renderBar();
    expect(screen.getByText('John Doe')).toBeTruthy();
  });

  it('calls onClick when clicked and no drag is active', () => {
    const handleClick = vi.fn();
    const { container } = renderBar({ onClick: handleClick });
    const barElement = container.querySelector('[data-planning-bar]') as HTMLElement;
    fireEvent.click(barElement);
    expect(handleClick).toHaveBeenCalledWith(baseEvent);
  });

  it('does NOT call onClick when drag is active', () => {
    const handleClick = vi.fn();
    const { container } = renderBar({ onClick: handleClick, isDragActive: true });
    const barElement = container.querySelector('[data-planning-bar]') as HTMLElement;
    fireEvent.click(barElement);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders with position: absolute for absolute positioning in row', () => {
    const { container } = renderBar();
    const barElement = container.querySelector('[data-planning-bar]') as HTMLElement;
    expect(window.getComputedStyle(barElement).position).toBe('absolute');
  });
});
