import { useState } from 'react';
import { fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssistantSurface } from '../AssistantSurface';
import { AssistantComposer } from '../AssistantComposer';
import { AssistantMessage } from '../AssistantMessage';
import { AssistantContextChips } from '../AssistantContextChips';
import i18n from '../../../../i18n/config';
import type { AgentStatus } from '../../../../hooks/useAgent';

vi.mock('../../../supervision/useCanSuperviseAgents', () => ({ useCanSuperviseAgents: () => ({ canView: false }) }));
vi.mock('../../../supervision/useSupervisionPendingCounts', () => ({ useSupervisionPendingCounts: () => ({ total: 190 }) }));
vi.mock('../../widgets/ToolResultWidget', () => ({ ToolResultWidget: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function ComposerHarness({ send, status = 'idle', abort }: { send: (text: string) => void; status?: AgentStatus; abort?: () => void }) {
  const [draft, setDraft] = useState('');
  return <AssistantComposer status={status} value={draft} onChange={setDraft} onSend={send} onAbort={abort} />;
}

describe('Baitly assistant composer', () => {
  it('sends trimmed text on Enter, clears it, and rejects empty messages', () => {
    const send = vi.fn();
    render(<ComposerHarness send={send} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '  Les arrivées de demain  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(send).toHaveBeenCalledWith('Les arrivées de demain');
    expect(input).toHaveValue('');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not send while composing with an IME or pressing Shift+Enter', () => {
    const send = vi.fn();
    render(<ComposerHarness send={send} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Bonjour' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    fireEvent.keyDown(input, { key: 'k', metaKey: true });
    expect(send).not.toHaveBeenCalled();
    expect(input).toHaveValue('Bonjour');
  });

  it.each(['streaming', 'awaiting_confirmation'] as AgentStatus[])('preserves the next draft while %s and prevents a second submission', (status) => {
    const send = vi.fn();
    const abort = vi.fn();
    render(<ComposerHarness send={send} status={status} abort={abort} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Ma prochaine question' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(send).not.toHaveBeenCalled();
    expect(input).toHaveValue('Ma prochaine question');
    if (status === 'streaming') {
      fireEvent.click(screen.getByRole('button', { name: 'Arrêter' }));
      expect(abort).toHaveBeenCalledOnce();
    }
  });
});

describe('Assistant replies', () => {
  it('copies a completed reply and confirms the action accessibly', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<MemoryRouter><AssistantMessage message={{ role: 'assistant', content: '## Vos priorités\n\n1. Vérifier les arrivées.' }} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Copier la réponse' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Réponse copiée' })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith('## Vos priorités\n\n1. Vérifier les arrivées.');
  });

  it('explains a denied clipboard action instead of reporting success', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    render(<MemoryRouter><AssistantMessage message={{ role: 'assistant', content: 'Votre bilan.' }} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Copier la réponse' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copie indisponible' })).toBeInTheDocument());
  });

  it('renders the Arabic plural and localized count without exposing a translation key', async () => {
    await i18n.changeLanguage('ar');
    render(<AssistantContextChips />);
    expect(screen.getByText(/اقتراحًا بانتظار الموافقة/)).toHaveTextContent('١٩٠');
    expect(screen.queryByText('assistant.context.pending')).not.toBeInTheDocument();
  });
});

describe('Baitly assistant starting suggestions', () => {
  it('prefills and focuses the draft without sending, preserving it across view remounts', () => {
    const send = vi.fn();
    function Harness() {
      const [draft, setDraft] = useState('');
      const [expanded, setExpanded] = useState(false);
      return <><button onClick={() => setExpanded(!expanded)}>Basculer</button><AssistantSurface key={String(expanded)} draft={draft} onDraftChange={setDraft} messages={[]} status="idle" error={null} onSend={send} /></>;
    }
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Préparer les prochaines arrivées/ }));
    expect(send).not.toHaveBeenCalled();
    const input = screen.getByRole('textbox');
    expect(input).toHaveFocus();
    expect((input as HTMLTextAreaElement).value).toContain('7 prochains jours');
    const value = (input as HTMLTextAreaElement).value;
    fireEvent.click(screen.getByRole('button', { name: 'Basculer' }));
    expect(screen.getByRole('textbox')).toHaveValue(value);
    expect(container.querySelector('video, canvas')).toBeNull();
  });
});
