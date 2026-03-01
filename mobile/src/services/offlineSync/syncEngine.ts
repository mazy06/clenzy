import NetInfo from '@react-native-community/netinfo';
import { useOfflineStore, OfflineAction } from '@/store/offlineStore';
import { apiClient } from '@/api/apiClient';

const MAX_CONCURRENT = 3;
const BASE_RETRY_DELAY = 2000; // 2s

function getRetryDelay(retryCount: number): number {
  return Math.min(BASE_RETRY_DELAY * Math.pow(2, retryCount), 30000);
}

async function executeAction(action: OfflineAction): Promise<boolean> {
  const store = useOfflineStore.getState();
  store.updateStatus(action.id, 'SYNCING');

  try {
    const method = action.method.toLowerCase() as 'post' | 'put' | 'patch';

    if (action.type === 'UPLOAD' && action.payload instanceof FormData) {
      await apiClient.upload(action.endpoint, action.payload as FormData);
    } else {
      await apiClient[method](action.endpoint, action.payload);
    }

    store.dequeue(action.id);
    return true;
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status;

    // Client errors (4xx) except 408/429 are not retryable
    if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
      store.updateStatus(action.id, 'FAILED');
      return false;
    }

    // Retryable error
    store.incrementRetry(action.id);
    const updated = useOfflineStore.getState().pendingActions.find((a) => a.id === action.id);

    if (updated && updated.retryCount >= updated.maxRetries) {
      store.updateStatus(action.id, 'FAILED');
      return false;
    }

    store.updateStatus(action.id, 'PENDING');
    return false;
  }
}

function areDependenciesMet(action: OfflineAction, completedIds: Set<string>): boolean {
  if (action.dependencies.length === 0) return true;
  return action.dependencies.every((depId) => completedIds.has(depId));
}

export async function processSyncQueue(): Promise<{ synced: number; failed: number }> {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    return { synced: 0, failed: 0 };
  }

  const store = useOfflineStore.getState();
  if (store.isSyncing) {
    return { synced: 0, failed: 0 };
  }

  store.setSyncing(true);

  let synced = 0;
  let failed = 0;
  const completedIds = new Set<string>();

  try {
    let pending = store.getPending();

    while (pending.length > 0) {
      // Get actions whose dependencies are met
      const ready = pending.filter((a) => areDependenciesMet(a, completedIds));

      if (ready.length === 0) {
        // Remaining actions have unmet dependencies — likely failed deps
        break;
      }

      // Process in batches
      const batch = ready.slice(0, MAX_CONCURRENT);
      const results = await Promise.allSettled(batch.map((a) => executeAction(a)));

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'fulfilled' && result.value) {
          synced++;
          completedIds.add(batch[i].id);
        } else {
          failed++;
        }
      }

      // Re-fetch pending (some may have been dequeued or failed)
      pending = useOfflineStore.getState().getPending();
    }
  } finally {
    store.setSyncing(false);
    store.setLastSync(Date.now());
  }

  return { synced, failed };
}

let unsubscribeNetInfo: (() => void) | null = null;

export function startSyncListener(): void {
  if (unsubscribeNetInfo) return;

  unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      const store = useOfflineStore.getState();
      if (store.getPending().length > 0 && !store.isSyncing) {
        processSyncQueue();
      }
    }
  });
}

export function stopSyncListener(): void {
  unsubscribeNetInfo?.();
  unsubscribeNetInfo = null;
}
