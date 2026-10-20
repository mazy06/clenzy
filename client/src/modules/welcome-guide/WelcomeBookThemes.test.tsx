import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WelcomeBookView, { type WelcomeBookModel } from './WelcomeBookView';
import { GUIDE_LABELS } from './guideLabels';
import { WELCOME_BOOK_THEMES } from './welcomeBookThemes';
import { buildBaitlyPropertyGuideDraft } from './baitlyGuideStructures';
import type { GuideSection } from '../../services/api/welcomeGuideApi';

vi.mock('./GuideMap', () => ({ GuideMap: () => null }));

const model: WelcomeBookModel = {
  ...buildBaitlyPropertyGuideDraft('fr', 'essentiel', {}),
  title: 'Maison du Canal', structure: 'essentiel',
  property: { name: 'Maison du Canal', city: 'Paris', address: null, postalCode: null, country: null, latitude: null, longitude: null },
  practical: null, stay: null, checkIn: null, accessPhotos: [], upsells: [],
};

describe('Baitly guest theme compositions', () => {
  it.each(WELCOME_BOOK_THEMES)('$id retains one title, real photos and working chapter navigation', ({ id }) => {
    const { container } = render(<WelcomeBookView model={model} theme={id} lang="fr" labels={GUIDE_LABELS.fr}
      heroImages={['/property/front.jpg', '/property/terrace.jpg', '/property/bedroom.jpg']} showMap={false} />);
    expect(screen.getAllByRole('heading', { name: model.title })).toHaveLength(1);
    expect(screen.getAllByAltText(model.title)[0]).toHaveAttribute('src', '/property/front.jpg');
    expect(container.querySelectorAll('.wb-cover__contact-sheet img')).toHaveLength(['atelier', 'corail'].includes(id) ? 2 : 0);
    const section = model.sections[0];
    fireEvent.click(screen.getByRole('button', { name: new RegExp(section.title) }));
    expect(screen.getByRole('heading', { name: section.title })).toBeInTheDocument();
  });

  it('keeps a usable single-photo cover without a decorative empty collage', () => {
    const { container, rerender } = render(<WelcomeBookView model={model} theme="atelier" lang="fr" labels={GUIDE_LABELS.fr}
      heroImages={['/property/front.jpg']} interactive={false} showMap={false} />);
    expect(container.querySelector('.wb-cover')).toHaveAttribute('data-collage', 'false');
    expect(container.querySelector('.wb-cover__contact-sheet')).toBeNull();
    rerender(<WelcomeBookView model={model} theme="atelier" lang="ar" labels={GUIDE_LABELS.ar}
      heroImages={[]} interactive={false} showMap={false} />);
    expect(container.querySelector('.wb')).toHaveAttribute('dir', 'rtl');
    expect(container.querySelector('.wb-cover')).toHaveAttribute('data-photo', 'false');
    expect(screen.getByRole('heading', { name: model.title })).toBeInTheDocument();
  });

  it.each(WELCOME_BOOK_THEMES)('$id retains full equipment details and long instructions in its own reading mode', ({ id }) => {
    const longInstruction = 'Traversez la cour, puis utilisez la porte au fond à gauche. '.repeat(12) + 'Dernière instruction à conserver.';
    const section: GuideSection = { id: 'equipment', icon: 'coffee', title: 'Les équipements', subtitle: '', layout: 'steps', body: '',
      items: [{ id: 'coffee', icon: 'coffee', label: 'Machine à café', detail: 'Capsules dans le placard.', steps: ['Remplissez le réservoir.'] },
        { id: 'heating', icon: 'thermometer', label: 'Chauffage', detail: 'Le thermostat est près de la porte.', steps: [longInstruction] }] };
    render(<WelcomeBookView model={{ ...model, sections: [section] }} theme={id} lang="fr" labels={GUIDE_LABELS.fr} heroImages={[]} showMap={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Les équipements' }));
    const disclosure = ['noir', 'azur', 'minuit'].includes(id);
    if (disclosure) {
      const toggle = screen.getByRole('button', { name: 'Chauffage' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
    }
    expect(screen.getByText('Le thermostat est près de la porte.')).toBeVisible();
    expect(screen.getByText(longInstruction)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Chauffage' })).toBeInTheDocument();
  });

  it('changes the real reading order while preserving journey priorities', () => {
    const richModel = { ...model, welcomeMessage: 'Bienvenue dans notre maison.', practical: { wifiName: 'Canal' } as never };
    const { container, rerender } = render(<WelcomeBookView model={richModel} theme="atelier" lang="fr" labels={GUIDE_LABELS.fr} heroImages={[]} showMap={false} />);
    const firstRegion = () => container.querySelector('.wb-home__content > :first-child')?.getAttribute('data-book-region');
    expect(firstRegion()).toBe('welcome');
    rerender(<WelcomeBookView model={richModel} theme="azur" lang="fr" labels={GUIDE_LABELS.fr} heroImages={[]} showMap={false} />);
    expect(firstRegion()).toBe('essentials');
    rerender(<WelcomeBookView model={richModel} theme="corail" lang="fr" labels={GUIDE_LABELS.fr} heroImages={[]} showMap={false} />);
    expect(firstRegion()).toBe('navigation');
    rerender(<WelcomeBookView model={{ ...richModel, structure: 'conciergerie' }} theme="corail" lang="fr" labels={GUIDE_LABELS.fr} heroImages={[]} showMap={false} />);
    expect(firstRegion()).toBe('journey');
    rerender(<WelcomeBookView model={{ ...richModel, structure: 'cityguide' }} theme="corail" lang="fr" labels={GUIDE_LABELS.fr} heroImages={[]} showMap={false} />);
    expect(container.querySelector('.wb-home__content > :first-child')).toHaveClass('wb-home__neighbourhood');
  });

  it('gives the arrival page a theme-specific order and preserves complete instructions', () => {
    const instructions = 'Traversez la cour et utilisez la porte à gauche. '.repeat(12);
    const practical = { wifiName: null, wifiPassword: null, accessCode: '123456789012345678901234567890', parkingInfo: null,
      arrivalInstructions: instructions, departureInstructions: null, houseRules: null, emergencyContact: null,
      additionalNotes: null, arrivalPhotos: null, extraCodes: null, accessCodeLocked: false, guestUnlockAvailable: false };
    const richModel = { ...model, practical };
    const { container, rerender } = render(<WelcomeBookView model={richModel} theme="jardin" lang="fr" labels={GUIDE_LABELS.fr} heroImages={[]} showMap={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Arrivée & Départ/ }));
    expect(container.querySelector('.wb-arrival > :first-child')).toHaveClass('wb-info-block');
    expect(screen.getByText(instructions.trim())).toBeInTheDocument();
    rerender(<WelcomeBookView model={richModel} theme="minuit" lang="fr" labels={GUIDE_LABELS.fr} heroImages={[]} showMap={false} />);
    expect(container.querySelector('.wb-arrival > :first-child')).toHaveClass('wb-arrival__code');
    expect(screen.getByText(practical.accessCode)).toBeInTheDocument();
  });
});
