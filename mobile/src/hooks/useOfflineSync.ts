import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useNetworkStatus } from './useNetworkStatus';
import { useOfflineStore } from '@/store/offlineStore';
import { processSyncQueue, startSyncListener, stopSyncListener } from '@/services/offlineSync/syncEngine';

export function useOfflineSync() {
  const { isConnected } = useNetworkStatus();
  const pendingCount = useOfflineStore((s) => s.pendingActions.filter((a) => a.status === 'PENDING').length);
  const isSyncing = useOfflineStore((s) => s.isSyncing);
  const appState = useRef(AppState.currentState);

  // Start network listener for auto-sync on reconnect
  useEffect(() => {
    startSyncListener();
    return () => stopSyncListener();
  }, []);

  // Sync when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        if (isConnected && pendingCount > 0) {
          processSyncQueue();
        }
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [isConnected, pendingCount]);

  // Trigger sync when coming back online with pending actions
  useEffect(() => {
    if (isConnected && pendingCount > 0) {
      processSyncQueue();
    }
  }, [isConnected, pendingCount]);

  return { pendingCount, isSyncing, isConnected, sync: processSyncQueue };
}
