import { fireEvent, render as renderUi, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from 'vitest';
import type { WelcomeGuide } from '../../services/api/welcomeGuideApi';
import { BaitlyGuideCard } from './BaitlyGuideCard';

vi.mock('./WelcomeBookView', () => ({ default: ({ model, theme, heroImages }: any) => <div data-testid="guest-renderer" data-theme={theme} data-title={model.title} data-images={JSON.stringify(heroImages)} /> }));
function render(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['property-photos', 7], [{ id: 2, sortOrder: 0 }, { id: 1, sortOrder: 1 }]);
  return renderUi(ui, { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
}

const guide = { id: 1, title: 'Bienvenue au duplex', propertyId: 7, propertyName: 'Duplex Hivernage',
  theme: 'atelier', language: 'fr', published: true, heroPhotoIds: '[1,2]' } as WelcomeGuide;

describe('Baitly guide library card', () => {
  it('opens editing from the title and keeps the menu action independent', () => {
    const onEdit = vi.fn(), onAction = vi.fn();
    render(<BaitlyGuideCard guide={guide} city="Marrakech" ownerInitials="AU" onEdit={onEdit}
      actions={<button onClick={onAction}>Actions</button>} />);
    fireEvent.click(screen.getByRole('button', { name: guide.title }));
    expect(onEdit).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
    expect(screen.getByText('Duplex Hivernage · Marrakech')).toBeInTheDocument();
  });

  it('renders the saved guide with its theme and prioritised property photos', () => {
    const { container } = render(<BaitlyGuideCard guide={guide} ownerInitials="AU" onEdit={vi.fn()} actions={null} />);
    const preview = screen.getByTestId('guest-renderer');
    expect(preview).toHaveAttribute('data-theme', 'atelier');
    expect(preview).toHaveAttribute('data-title', guide.title);
    const images = JSON.parse(preview.getAttribute('data-images')!);
    expect(images).toHaveLength(2);
    expect(images[0]).toContain('/7/');
    expect(images[0]).toContain('/1');
    expect(container.querySelector('button button')).toBeNull();
  });

  it('reflects the actual publication state, language and theme', () => {
    const { rerender } = render(<BaitlyGuideCard guide={guide} ownerInitials="AU" onEdit={vi.fn()} actions={null} />);
    expect(screen.getByText('Publié')).toBeInTheDocument();
    expect(screen.getByText('FR')).toBeInTheDocument();
    rerender(<BaitlyGuideCard guide={{ ...guide, published: false, language: 'en', theme: 'noir' }} ownerInitials="AU" onEdit={vi.fn()} actions={null} />);
    expect(screen.getByText('Brouillon')).toBeInTheDocument();
    expect(screen.getByText('EN')).toBeInTheDocument();
    expect(screen.getByText('Noir')).toBeInTheDocument();
  });
});
