import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import BaitlyCrmFollowUp, { crmFollowUpState } from './BaitlyCrmFollowUp';
import { baitlyCrmDetailsApi } from '../../services/api/baitlyCrmDetailsApi';
import type { BaitlyCrmContact } from './baitlyCrmWorkspace';

vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ currentLanguage: 'fr' }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const contact: BaitlyCrmContact = { id: 7, name: 'Atlas', category: 'PROVIDERS', status: 'TO_CONTACT',
  contactType: 'PROVIDER', contactNature: 'PROFESSIONAL', sourceType: 'OPEN_DATA', archived: false,
  crm: { prospect_id: 7, qualification: 'TO_QUALIFY', score: 2, updated_at: '2026-01-15' } };
function setup(value = contact, canManage = true) {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    <BaitlyCrmFollowUp contact={value} canManage={canManage} />
  </QueryClientProvider>);
}
it('does not mistake an import or record update for a real exchange', () => {
  setup();
  expect(screen.getByText('Aucun échange')).toBeVisible();
  expect(screen.getByText('Planifier une action')).toBeVisible();
  expect(screen.queryByText(/15 janv/)).not.toBeInTheDocument();
});
it('distinguishes overdue, today, future and unplanned dates without UTC conversion', () => {
  expect(crmFollowUpState('2026-10-20', '2026-10-21')).toBe('overdue');
  expect(crmFollowUpState('2026-10-21', '2026-10-21')).toBe('today');
  expect(crmFollowUpState('2026-10-22', '2026-10-21')).toBe('planned');
  expect(crmFollowUpState(null, '2026-10-21')).toBe('unplanned');
});
it('persists the exchange date and the dated action together, without changing company facts', async () => {
  const save = vi.spyOn(baitlyCrmDetailsApi, 'saveFollowUp').mockResolvedValue();
  setup(); fireEvent.click(screen.getByRole('button', { name: 'Mettre à jour le suivi : Atlas' }));
  fireEvent.change(screen.getByLabelText('Dernier échange'), { target: { value: '2026-01-10' } });
  fireEvent.change(screen.getByLabelText('Prochaine action'), { target: { value: ' Appeler pour confirmer les tarifs ' } });
  fireEvent.change(screen.getByLabelText('Échéance'), { target: { value: '2026-10-22' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(7, { lastExchangeOn: '2026-01-10', nextAction: 'Appeler pour confirmer les tarifs', nextActionOn: '2026-10-22' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
it('keeps a failed draft editable and lets the user clear the next action explicitly', async () => {
  const save = vi.spyOn(baitlyCrmDetailsApi, 'saveFollowUp').mockRejectedValue(new Error('Unavailable'));
  setup({ ...contact, crm: { ...contact.crm!, next_action: 'Appeler', next_action_on: '2026-10-22' } });
  fireEvent.click(screen.getByRole('button', { name: 'Mettre à jour le suivi : Atlas' }));
  fireEvent.click(screen.getByRole('button', { name: 'Retirer l’action prévue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Le suivi n’a pas été enregistré');
  expect(save).toHaveBeenCalledWith(7, { lastExchangeOn: null, nextAction: null, nextActionOn: null });
  expect(screen.getByRole('dialog')).toBeVisible();
});
it('does not expose editing for read-only users or archived prospects', () => {
  setup(contact, false);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  cleanup(); setup({ ...contact, archived: true });
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
