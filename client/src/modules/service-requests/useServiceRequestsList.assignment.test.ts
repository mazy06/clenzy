import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useServiceRequestsList } from './useServiceRequestsList';
import type { ServiceRequest } from './serviceRequestsUtils';

const mocks = vi.hoisted(() => ({
  assign: vi.fn(), unassign: vi.fn(), update: vi.fn(), changeStatus: vi.fn(), invalidate: vi.fn(),
}));
vi.mock('../../services/api/serviceRequestsApi', () => ({ serviceRequestsApi: {
  manualAssign: mocks.assign, unassign: mocks.unassign, update: mocks.update, changeStatus: mocks.changeStatus,
} }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useSearchParams: () => [new URLSearchParams()] }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidate }) }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({}) }));
vi.mock('../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../hooks/useWorkflowSettings', () => ({ useWorkflowSettings: () => ({ settings: {} }) }));
vi.mock('../../hooks/useServiceRequestsList', () => ({
  useServiceRequestsListQuery: () => ({ serviceRequests: [], isLoading: false }),
  serviceRequestsListKeys: { all: ['serviceRequests'] },
}));
vi.mock('../../services/api/teamsApi', () => ({ teamsApi: { getAll: async () => [] } }));
vi.mock('../../services/api/usersApi', () => ({ usersApi: { getAll: async () => [] } }));

async function openAssignment() {
  const hook = renderHook(() => useServiceRequestsList());
  act(() => hook.result.current.handleAssignServiceRequest({
    id: '42', title: 'Old snapshot', assignedToId: 9, assignedToType: 'team',
  } as ServiceRequest));
  await waitFor(() => expect(hook.result.current.loadingAssignData).toBe(false));
  return hook;
}

describe('assignment commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.assign.mockResolvedValue({});
    mocks.unassign.mockResolvedValue({});
    mocks.invalidate.mockResolvedValue(undefined);
  });

  it('uses the selected user despite a previous hidden team selection', async () => {
    const { result } = await openAssignment();
    act(() => {
      result.current.setAssignAssignmentType('user');
      result.current.setAssignSelectedUserId(27);
    });
    await act(async () => { await result.current.confirmAssignment(); });
    expect(mocks.assign).toHaveBeenCalledWith(42, 27, 'user');
    expect(mocks.update).not.toHaveBeenCalled();
    expect(result.current.assignDialogOpen).toBe(false);
  });

  it('removes assignment without sending a stale request snapshot', async () => {
    const { result } = await openAssignment();
    act(() => result.current.setAssignAssignmentType('none'));
    await act(async () => { await result.current.confirmAssignment(); });
    expect(mocks.unassign).toHaveBeenCalledWith(42);
    expect(mocks.assign).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('blocks repeated confirmation and closing while pending', async () => {
    let resolve!: () => void;
    mocks.assign.mockReturnValue(new Promise<void>(done => { resolve = done; }));
    const { result } = await openAssignment();
    let pending!: Promise<void>;
    act(() => { pending = result.current.confirmAssignment(); });
    act(() => {
      void result.current.confirmAssignment();
      result.current.closeAssignDialog();
    });
    expect(mocks.assign).toHaveBeenCalledTimes(1);
    expect(result.current.assignDialogOpen).toBe(true);
    await act(async () => { resolve(); await pending; });
    expect(result.current.assigning).toBe(false);
  });

  it('refreshes workflow state after a rejected command and keeps the dialog open', async () => {
    mocks.assign.mockRejectedValue(new Error('Conflict'));
    const { result } = await openAssignment();
    await act(async () => { await result.current.confirmAssignment(); });
    expect(result.current.errorDialogOpen).toBe(true);
    expect(result.current.errorMessage).toBe('Conflict');
    expect(result.current.assignDialogOpen).toBe(true);
    expect(result.current.assigning).toBe(false);
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ['serviceRequests'] });
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ['interventions'] });
  });
});

describe("status command", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.changeStatus.mockResolvedValue({});
    mocks.invalidate.mockResolvedValue(undefined);
  });

  it("sends only the original version and chosen status", async () => {
    const { result } = renderHook(() => useServiceRequestsList());
    act(() => result.current.handleStatusChange({
      id: "42", version: 3, title: "Old title", status: "PENDING",
    } as ServiceRequest));
    act(() => result.current.setNewStatus("REJECTED"));
    await act(async () => { await result.current.confirmStatusChange(); });
    expect(mocks.changeStatus).toHaveBeenCalledWith(42, 3, "REJECTED");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("keeps a rejected stale decision visible and does not retry it", async () => {
    mocks.changeStatus.mockRejectedValue({ status: 409, message: "Reload the request" });
    const { result } = renderHook(() => useServiceRequestsList());
    act(() => result.current.handleStatusChange({ id: "42", version: 1, status: "PENDING" } as ServiceRequest));
    act(() => result.current.setNewStatus("CANCELLED"));
    await act(async () => { await result.current.confirmStatusChange(); });
    expect(mocks.changeStatus).toHaveBeenCalledTimes(1);
    expect(result.current.statusChangeDialogOpen).toBe(true);
    expect(result.current.errorMessage).toBe("Reload the request");
    expect(result.current.changingStatus).toBe(false);
  });
});
