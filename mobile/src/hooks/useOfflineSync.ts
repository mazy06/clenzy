import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useNetworkStatus } from './useNetworkStatus';
import { useOfflineStore } from '@/store/offlineStore';
import { useAuthStore } from '@/store/authStore';
import { processSyncQueue, startSyncListener, stopSyncListener } from '@/services/offlineSync/syncEngine';

export function useOfflineSync() {
  const { isConnected } = useNetworkStatus();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated && Boolean(s.user));
  const pendingCount = useOfflineStore((s) => s.pendingActions.filter((a) => a.status === 'PENDING').length);
  const isSyncing = useOfflineStore((s) => s.isSyncing);
  const appState = useRef(AppState.currentState);

  // Start network listener for auto-sync on reconnect
  useEffect(() => {
    if (!isAuthenticated) return;
    startSyncListener();
    return () => stopSyncListener();
  }, [isAuthenticated]);

  // Sync when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        if (isAuthenticated && isConnected && pendingCount > 0) {
          processSyncQueue();
        }
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [isAuthenticated, isConnected, pendingCount]);

  // Trigger sync when coming back online with pending actions
  useEffect(() => {
    if (isAuthenticated && isConnected && pendingCount > 0) {
      processSyncQueue();
    }
  }, [isAuthenticated, isConnected, pendingCount]);

  return { pendingCount, isSyncing, isConnected, sync: processSyncQueue };
}
