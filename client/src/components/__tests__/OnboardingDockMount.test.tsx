import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import OnboardingDockMount from '../OnboardingDockMount';
import type { OnboardingStepWithStatus } from '../../hooks/useOnboarding';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockUseOnboarding = vi.fn();
vi.mock('../../hooks/useOnboarding', () => ({
  useOnboarding: () => mockUseOnboarding(),
}));

let mockPathname = '/planning';
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: mockPathname }),
  useNavigate: () => vi.fn(),
}));

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    // Repli inline : le libellé rendu est la clé quand aucun fallback n'est fourni.
    t: (_key: string, fallback?: string) => fallback ?? _key,
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
    makeStep('setup_payment', { locked: true }),
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
  dismiss: vi.fn(),
  reset: vi.fn(),
});

beforeEach(() => {
  mockPathname = '/planning';
  mockUseOnboarding.mockReturnValue(baseState());
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('OnboardingDockMount', () => {
  it('whenOffDashboardWithPendingSteps_thenDockRendersWithGlobalProgress', () => {
    render(<OnboardingDockMount />);

    expect(screen.getByText('Guide de démarrage')).toBeInTheDocument();
    // Progression globale du primitive : « fait/total terminées ».
    expect(screen.getByText('1/3 terminées')).toBeInTheDocument();
    expect(screen.getByText('Masquer')).toBeInTheDocument();
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
