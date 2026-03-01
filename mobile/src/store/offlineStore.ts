import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'offline-store' });

export interface OfflineAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'UPLOAD';
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH';
  payload: unknown;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
  dependencies: string[];
  status: 'PENDING' | 'SYNCING' | 'FAILED';
}

interface OfflineState {
  pendingActions: OfflineAction[];
  lastSyncTimestamp: number;
  isSyncing: boolean;

  enqueue: (action: Omit<OfflineAction, 'id' | 'createdAt' | 'retryCount' | 'status'>) => string;
  dequeue: (id: string) => void;
  updateStatus: (id: string, status: OfflineAction['status']) => void;
  incrementRetry: (id: string) => void;
  getPending: () => OfflineAction[];
  setLastSync: (timestamp: number) => void;
  setSyncing: (syncing: boolean) => void;
  clearCompleted: () => void;
  hydrate: () => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function persist(actions: OfflineAction[]) {
  storage.set('pending_actions', JSON.stringify(actions));
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  pendingActions: [],
  lastSyncTimestamp: 0,
  isSyncing: false,

  enqueue: (action) => {
    const id = generateId();
    const newAction: OfflineAction = {
      ...action,
      id,
      createdAt: Date.now(),
      retryCount: 0,
      status: 'PENDING',
    };

    set((state) => {
      const updated = [...state.pendingActions, newAction];
      persist(updated);
      return { pendingActions: updated };
    });

    return id;
  },

  dequeue: (id) => {
    set((state) => {
      const updated = state.pendingActions.filter((a) => a.id !== id);
      persist(updated);
      return { pendingActions: updated };
    });
  },

  updateStatus: (id, status) => {
    set((state) => {
      const updated = state.pendingActions.map((a) =>
        a.id === id ? { ...a, status } : a
      );
      persist(updated);
      return { pendingActions: updated };
    });
  },

  incrementRetry: (id) => {
    set((state) => {
      const updated = state.pendingActions.map((a) =>
        a.id === id ? { ...a, retryCount: a.retryCount + 1 } : a
      );
      persist(updated);
      return { pendingActions: updated };
    });
  },

  getPending: () => {
    return get().pendingActions.filter((a) => a.status === 'PENDING');
  },

  setLastSync: (timestamp) => {
    storage.set('last_sync', timestamp);
    set({ lastSyncTimestamp: timestamp });
  },

  setSyncing: (syncing) => set({ isSyncing: syncing }),

  clearCompleted: () => {
    set((state) => {
      const updated = state.pendingActions.filter((a) => a.status !== 'PENDING');
      persist(updated);
      return { pendingActions: updated };
    });
  },

  hydrate: () => {
    try {
      const stored = storage.getString('pending_actions');
      const lastSync = storage.getNumber('last_sync') ?? 0;
      if (stored) {
        set({ pendingActions: JSON.parse(stored), lastSyncTimestamp: lastSync });
      }
    } catch {
      // Corrupted storage, start fresh
    }
  },
}));
