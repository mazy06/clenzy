import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import fr from '../../../public/locales/fr.json';
import { getOnboardingSteps } from '../../config/onboardingConfig';

import OnboardingDockMount from '../OnboardingDockMount';
import type { OnboardingStepWithStatus } from '../../hooks/useOnboarding';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockUseOnboarding = vi.fn();
vi.mock('../../hooks/useOnboarding', () => ({
  useOnboarding: () => mockUseOnboarding(),
}));
vi.mock('../onboarding/OnboardingStepContent', () => ({
  default: ({ stepKey, onSaved }: { stepKey: string; onSaved: () => void }) => <form aria-label={`Configurer ${stepKey}`} onSubmit={e => {e.preventDefault();onSaved();}}><input aria-label="Champ de l’étape"/><button type="submit">Enregistrer</button></form>,
}));

let mockPathname = '/planning';
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: mockPathname }),
  useNavigate: () => mockNavigate,
}));

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    currentLanguage: 'fr',
    t: (key: string, fallback?: string | Record<string, string>) => {
      const value = key.split('.').reduce<unknown>((current, part) =>
        (current as Record<string, unknown> | undefined)?.[part], fr);
      const text = typeof value === 'string' ? value : typeof fallback === 'string' ? fallback : key;
      return typeof fallback === 'object'
        ? text.replace(/{{(\w+)}}/g, (_, part: string) => fallback[part] ?? '') : text;
    },
  }),
}));

const makeStep = (
  key: string,
  overrides: Partial<OnboardingStepWithStatus> = {},
): OnboardingStepWithStatus => ({
  key,
  labelKey: `label.${key}`,
  descriptionKey: `description.${key}`,
  navigationPath: `/settings?tab=${key}`,
  completed: false,
  completedAt: null,
  locked: false,
  ...overrides,
});

const baseState = () => ({
  steps: [
    makeStep('configure_org', { completed: true }),
    makeStep('setup_fiscal'),
    makeStep('setup_general', { locked: true }),
  ],
  completedCount: 1,
  totalCount: 3,
  isAllCompleted: false,
  isDismissed: false,
  progressPercent: 33,
  activeStep: null,
  isLoading: false,
  userRole: 'SUPER_ADMIN',
  completeStep: vi.fn(),
  checkStep: vi.fn().mockResolvedValue(false),
  dismiss: vi.fn(),
  reset: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
  mockPathname = '/planning';
  mockUseOnboarding.mockReturnValue(baseState());
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('OnboardingDockMount', () => {
  it('opens the migration inside the guide and keeps a persistent skip action', async () => {
    const migration = getOnboardingSteps('HOST').find(step => step.key === 'migrate_pms')!;
    const state = {
      ...baseState(),
      steps: [makeStep('complete_profile', { completed: true }), makeStep('migrate_pms', migration),
        makeStep('create_property', { locked: true })],
    };
    mockUseOnboarding.mockReturnValue(state);
    render(<OnboardingDockMount />);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le guide de démarrage' }));

    expect(screen.getAllByText('Facultatif').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Importer mes données' }));
    expect(await screen.findByRole('form', {name:'Configurer migrate_pms'})).toBeVisible();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(state.completeStep).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Continuer sans migrer' }));
    expect(state.completeStep).toHaveBeenCalledWith('migrate_pms');
  });

  it('whenOffDashboardWithPendingSteps_thenDockRendersWithGlobalProgress', () => {
    render(<OnboardingDockMount />);

    expect(screen.getByText('Guide de démarrage')).toBeInTheDocument();
    // Progression globale du primitive : « fait/total terminées ».
    expect(screen.getByText('1/3 terminées')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes with Escape without dismissing progress and can be reopened', async () => {
    const state = baseState();
    mockUseOnboarding.mockReturnValue(state);
    render(<OnboardingDockMount />);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le guide de démarrage' }));
    expect(screen.getByRole('dialog', { name: 'label.setup_fiscal' })).toBeVisible();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(state.dismiss).not.toHaveBeenCalled();
    expect(state.completeStep).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le guide de démarrage' }));
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('lets users understand locked steps without starting them', () => {
    render(<OnboardingDockMount />);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le guide de démarrage' }));
    fireEvent.click(screen.getByRole('button', { name: /label.setup_general/ }));
    expect(screen.getByText('Terminez l’étape précédente pour continuer.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Configurer cette étape' })).toBeDisabled();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('does not complete a step just because its form is opened or checked', async () => {
    const state = baseState(); mockUseOnboarding.mockReturnValue(state);
    render(<OnboardingDockMount/>);
    fireEvent.click(screen.getByRole('button',{name:fr.onboarding.guide.open}));
    fireEvent.click(screen.getByRole('button',{name:fr.onboarding.guide.start}));
    await screen.findByRole('form');
    fireEvent.click(screen.getByRole('button',{name:fr.onboarding.guide.check}));
    expect(await screen.findByText(fr.onboarding.guide.incomplete)).toBeVisible();
    expect(state.checkStep).toHaveBeenCalledWith('setup_fiscal');
    expect(state.completeStep).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Enregistrer',exact:true}));
    expect(state.completeStep).toHaveBeenCalledWith('setup_fiscal');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('whenOnDashboard_thenVisible_becauseTheDockIsNowTheOnlyGuide', () => {
    // La checklist du tableau de bord a ete supprimee — c'etait un doublon du
    // dock. `/dashboard` a donc quitte les prefixes masques : le dock y est
    // desormais la SEULE surface du guide, le cacher la reviendrait a le
    // rendre introuvable depuis l'ecran d'arrivee.
    mockPathname = '/dashboard';

    render(<OnboardingDockMount />);

    expect(screen.getByText('Guide de démarrage')).toBeInTheDocument();
  });

  it('whenOnFullBleedEditor_thenHidden', () => {
    // Le studio prend tout l'ecran : un dock flottant s'y poserait par-dessus
    // le canevas.
    mockPathname = '/booking-engine/studio/42';

    const { container } = render(<OnboardingDockMount />);

    expect(container).toBeEmptyDOMElement();
  });

  it('whenDismissed_thenHidden', () => {
    mockUseOnboarding.mockReturnValue({ ...baseState(), isDismissed: true });

    const { container } = render(<OnboardingDockMount />);

    expect(container).toBeEmptyDOMElement();
  });

  it('whenAllCompleted_thenHidden', () => {
    mockUseOnboarding.mockReturnValue({ ...baseState(), isAllCompleted: true });

    const { container } = render(<OnboardingDockMount />);

    expect(container).toBeEmptyDOMElement();
  });

  it('whenRoleHasNoSteps_thenHidden', () => {
    mockUseOnboarding.mockReturnValue({ ...baseState(), steps: [], totalCount: 0 });

    const { container } = render(<OnboardingDockMount />);

    expect(container).toBeEmptyDOMElement();
  });
});
