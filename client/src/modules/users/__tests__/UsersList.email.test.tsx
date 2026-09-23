import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UsersList from '../UsersList';

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  update: vi.fn(),
  hasPermissionAsync: vi.fn().mockResolvedValue(true),
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('../../../services/api/usersApi', () => ({
  usersApi: { getAll: mocks.getAll, update: mocks.update },
  userAvatarSrc: () => undefined,
}));
vi.mock('../../../services/apiClient', () => ({ default: {} }));
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 1, role: 'SUPER_ADMIN' },
    hasPermissionAsync: mocks.hasPermissionAsync,
    hasAnyRole: () => true,
  }),
}));
vi.mock('../../../hooks/useNotification', () => ({ useNotification: () => ({ notify: mocks.notify }) }));
vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../../components/PageHeader', () => ({ default: () => null }));
vi.mock('../../../components/FilterSearchBar', () => ({ default: () => null }));
vi.mock('../../../components/ExportButton', () => ({ default: () => null }));
vi.mock('../components/HousekeeperRatesDialog', () => ({ default: () => null }));

const original = {
  id: 1,
  firstName: 'Jean',
  lastName: 'Dupont',
  email: 'old@example.com',
  role: 'SUPER_ADMIN',
  organizationRole: 'ADMIN',
  status: 'ACTIVE',
  createdAt: '2026-09-22T10:00:00',
};

async function editEmail(value: string) {
  await screen.findAllByText('old@example.com');
  fireEvent.keyDown(screen.getByRole('button', { name: 'Options' }), { key: 'Enter' });
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Modifier' }));
  fireEvent.change(screen.getByLabelText('Email *'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));
}

function mountList() {
  return render(<MemoryRouter><UsersList embedded /></MemoryRouter>);
}

describe('Baitly user email persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAll.mockResolvedValue([original]);
  });

  it('shows the saved server email immediately and after remounting', async () => {
    const saved = { ...original, email: 'new@example.com' };
    mocks.update.mockImplementation(async () => {
      mocks.getAll.mockResolvedValue([saved]);
      return saved;
    });
    const view = mountList();

    await editEmail('NEW@example.com');

    await waitFor(() => expect(mocks.notify.success).toHaveBeenCalled());
    expect(screen.queryByText('NEW@example.com')).toBeNull();
    expect(screen.getAllByText('new@example.com')).toHaveLength(2);
    expect(screen.queryByText('old@example.com')).toBeNull();
    view.unmount();
    mountList();
    expect(await screen.findAllByText('new@example.com')).toHaveLength(2);
  });

  it('does not pretend to save an email the server did not persist', async () => {
    mocks.update.mockResolvedValue(original);
    mountList();

    await editEmail('new@example.com');

    await waitFor(() => expect(mocks.notify.success).toHaveBeenCalled());
    expect(screen.queryByText('new@example.com')).toBeNull();
    expect(screen.getAllByText('old@example.com')).toHaveLength(2);
  });

  it('keeps the form open and the previous email when saving fails', async () => {
    mocks.update.mockRejectedValue(new Error('Keycloak unavailable'));
    mountList();

    await editEmail('new@example.com');

    await waitFor(() => expect(mocks.notify.error).toHaveBeenCalledWith('Keycloak unavailable'));
    expect(mocks.notify.success).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Email *')).toHaveValue('new@example.com');
    expect(screen.getAllByText('old@example.com')).toHaveLength(2);
  });
});
