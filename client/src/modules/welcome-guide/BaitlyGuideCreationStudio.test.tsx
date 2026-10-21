import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BaitlyGuideCreationStudio from './BaitlyGuideCreationStudio';
import type { WelcomeBookViewProps } from './WelcomeBookView';
import type { PropertyListItem } from '../../hooks/usePropertiesList';

vi.mock('./WelcomeBookView', () => ({ default: ({ model, theme, heroImages, previewFocus }: WelcomeBookViewProps) => (
  <div data-testid="guest-renderer" data-theme={theme} data-focus={previewFocus}>
    {model.sections[0]?.title}<span>{model.property?.name}</span><span>{model.practical?.wifiName}</span>
    <span>{heroImages.join(',')}</span>
  </div>
) }));

const guestRenderer = () => within(document.querySelector('.baitly-guide-studio__device') as HTMLElement).getByTestId('guest-renderer');

const props = () => ({
  structureId: 'essentiel' as const, themeId: 'atelier' as const,
  onStructureChange: vi.fn(), onThemeChange: vi.fn(), prompt: '', onPromptChange: vi.fn(),
  aiEnabled: true, generating: false, onCreate: vi.fn(), onBlank: vi.fn(),
  properties: [{ id: '7', name: 'Villa Atlas', city: 'Marrakech' }, { id: '8', name: 'Studio Azur', city: 'Tanger' }] as PropertyListItem[],
  selectedPropertyId: '7', onPropertyChange: vi.fn(), heroImages: ['/villa.jpg'], upsells: [],
  loadingPreview: false, previewError: false, onRetryPreview: vi.fn(),
});

describe('Baitly guide creation workspace', () => {
  it('keeps all structures and themes available as native radio controls', () => {
    const callbacks = props();
    render(<BaitlyGuideCreationStudio {...callbacks} />);
    expect(screen.getAllByRole('radio')).toHaveLength(12);
    fireEvent.click(screen.getByRole('radio', { name: /City Guide/ }));
    expect(callbacks.onStructureChange).toHaveBeenCalledWith('cityguide');
    fireEvent.click(screen.getByRole('radio', { name: /Minuit/ }));
    expect(callbacks.onThemeChange).toHaveBeenCalledWith('minuit');
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser ce livret' }));
    expect(callbacks.onCreate).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Créer un livret vierge' }));
    expect(callbacks.onBlank).toHaveBeenCalledOnce();
  });

  it('updates the guest renderer when the structure or theme changes', () => {
    const callbacks = props();
    const { rerender } = render(<BaitlyGuideCreationStudio {...callbacks} />);
    expect(guestRenderer()).toHaveTextContent('Bon à savoir');
    expect(guestRenderer()).toHaveAttribute('data-focus', 'home');
    rerender(<BaitlyGuideCreationStudio {...callbacks} structureId="conciergerie" themeId="noir" />);
    expect(guestRenderer()).toHaveAttribute('data-theme', 'noir');
    expect(guestRenderer()).toHaveTextContent('Votre conciergerie');
    expect(screen.queryByText('Dans cette structure')).not.toBeInTheDocument();
    expect(screen.queryByText('Vous pourrez modifier les textes, les photos et les options avant de publier.')).not.toBeInTheDocument();
  });

  it('selects a property and uses its current photos and practical values', () => {
    const callbacks = props();
    const { rerender } = render(<BaitlyGuideCreationStudio {...callbacks} />);
    expect(guestRenderer()).toHaveTextContent('Villa Atlas');
    expect(guestRenderer()).toHaveTextContent('/villa.jpg');
    fireEvent.change(screen.getByRole('combobox', { name: 'Logement' }), { target: { value: '8' } });
    expect(callbacks.onPropertyChange).toHaveBeenCalledWith('8');
    rerender(<BaitlyGuideCreationStudio {...callbacks} selectedPropertyId="8" heroImages={['/studio.jpg']}
      previewData={{ property: null, practical: { wifiName: 'Studio-Wifi' } as never, stay: null, currentReservation: null }} />);
    expect(guestRenderer()).toHaveTextContent('Studio Azur');
    expect(guestRenderer()).toHaveTextContent('Studio-Wifi');
    expect(guestRenderer()).toHaveTextContent('/studio.jpg');
    expect(guestRenderer()).not.toHaveTextContent('Villa Atlas');
  });

  it('shows loading and retry states instead of old property values', () => {
    const callbacks = props();
    const { rerender } = render(<BaitlyGuideCreationStudio {...callbacks} loadingPreview />);
    expect(within(document.querySelector('.baitly-guide-studio__device') as HTMLElement).queryByTestId('guest-renderer')).toBeNull();
    rerender(<BaitlyGuideCreationStudio {...callbacks} previewError />);
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(callbacks.onRetryPreview).toHaveBeenCalledOnce();
  });

  it('uses the selected property photo spread in the theme thumbnails as well as the main preview', () => {
    render(<BaitlyGuideCreationStudio {...props()} heroImages={['/front.jpg', '/terrace.jpg', '/bedroom.jpg']} />);
    const thumbnails = document.querySelectorAll('.baitly-guide-theme__sample [data-testid="guest-renderer"]');
    expect(thumbnails).toHaveLength(7);
    for (const thumbnail of thumbnails) expect(thumbnail).toHaveTextContent('/front.jpg,/terrace.jpg,/bedroom.jpg');
    expect(guestRenderer()).toHaveTextContent('/front.jpg,/terrace.jpg,/bedroom.jpg');
  });

  it('disables creation and selection while a draft is being generated', () => {
    render(<BaitlyGuideCreationStudio {...props()} generating />);
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(screen.getByRole('button', { name: /Préparation du brouillon/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Créer un livret vierge' })).toBeDisabled();
  });

  it('exposes the optional AI prompt and removes it when the feature is disabled', () => {
    const callbacks = props();
    const { rerender } = render(<BaitlyGuideCreationStudio {...callbacks} />);
    fireEvent.click(screen.getByText('Créer avec l’IA'));
    const textbox = screen.getByRole('textbox');
    fireEvent.change(textbox, { target: { value: 'Mon logement' } });
    expect(callbacks.onPromptChange).toHaveBeenCalledWith('Mon logement');
    fireEvent.keyDown(textbox, { key: 'Enter', ctrlKey: true });
    expect(callbacks.onCreate).toHaveBeenCalledOnce();
    rerender(<BaitlyGuideCreationStudio {...callbacks} aiEnabled={false} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
