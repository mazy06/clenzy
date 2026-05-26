import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Stub AssistantMarkdown : on n'a pas besoin de tester le renderer ici.
vi.mock('../../components/AssistantMarkdown', () => ({
  AssistantMarkdown: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));

import { WorkflowWidget, ASSISTANT_QUICK_REPLY_EVENT } from '../WorkflowWidget';

describe('WorkflowWidget (smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders active step with title + prompt + stepper labels', () => {
    render(<WorkflowWidget data={{
      runId: 42,
      workflowId: 'onboard_property',
      title: 'Onboarding nouvelle propriete',
      estimatedDuration: 15,
      totalSteps: 3,
      currentStepIdx: 1,
      status: 'ACTIVE',
      currentStep: {
        id: 'pricing',
        title: 'Tarification',
        prompt: 'Quel est ton tarif ?',
        expectsData: { basePrice: 'number' },
      },
      steps: [
        { id: 'basic', title: 'Infos' },
        { id: 'pricing', title: 'Tarification' },
        { id: 'confirm', title: 'Confirmer' },
      ],
    }} />);

    expect(screen.getByText('Onboarding nouvelle propriete')).toBeInTheDocument();
    expect(screen.getByText('≈ 15 min')).toBeInTheDocument();
    expect(screen.getByText('Etape 2/3 · Tarification')).toBeInTheDocument();
    expect(screen.getByTestId('md')).toHaveTextContent('Quel est ton tarif ?');
    // Stepper labels
    expect(screen.getByText('Infos')).toBeInTheDocument();
    expect(screen.getByText('Tarification')).toBeInTheDocument();
    expect(screen.getByText('Confirmer')).toBeInTheDocument();
    // Field non boolean → message d'invite a taper
    expect(screen.getByText(/Reponds dans le chat/i)).toBeInTheDocument();
  });

  it('renders Oui/Non quick reply buttons for boolean steps + dispatches event', () => {
    const listener = vi.fn();
    window.addEventListener(ASSISTANT_QUICK_REPLY_EVENT, listener);

    render(<WorkflowWidget data={{
      runId: 1,
      totalSteps: 1,
      currentStepIdx: 0,
      status: 'ACTIVE',
      currentStep: {
        id: 'confirm',
        prompt: 'On y va ?',
        expectsData: { confirm: 'boolean' },
      },
      steps: [{ id: 'confirm', title: 'Confirmer' }],
    }} />);

    const oui = screen.getByRole('button', { name: 'Oui' });
    const non = screen.getByRole('button', { name: 'Non' });
    expect(oui).toBeInTheDocument();
    expect(non).toBeInTheDocument();

    fireEvent.click(oui);
    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent<{ text: string }>;
    expect(event.detail.text).toBe('Oui');

    fireEvent.click(non);
    expect(listener).toHaveBeenCalledTimes(2);

    window.removeEventListener(ASSISTANT_QUICK_REPLY_EVENT, listener);
  });

  it('renders completed state + suggested action hint', () => {
    render(<WorkflowWidget data={{
      runId: 1,
      title: 'Workflow',
      totalSteps: 2,
      currentStepIdx: 1,
      status: 'COMPLETED',
      steps: [
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
      ],
      suggestedAction: {
        toolName: 'create_property',
        reason: 'Etape confirmee',
      },
    }} />);

    expect(screen.getByText('Workflow termine.')).toBeInTheDocument();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText(/create_property/)).toBeInTheDocument();
  });

  it('shows suggestTool hint when present', () => {
    render(<WorkflowWidget data={{
      runId: 1,
      totalSteps: 1,
      currentStepIdx: 0,
      status: 'ACTIVE',
      currentStep: {
        id: 'pricing',
        prompt: 'Tarif ?',
        suggestTool: { name: 'suggest_navigation', args: { path: '/tarification' } },
      },
      steps: [{ id: 'pricing', title: 'Pricing' }],
    }} />);

    expect(screen.getByText(/suggest_navigation/)).toBeInTheDocument();
  });
});
