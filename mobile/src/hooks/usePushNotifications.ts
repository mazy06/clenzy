import { useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import { useNotificationStore } from '@/store/notificationStore';
import { registerForPushNotifications } from '@/services/push/pushService';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Map notification data to a deep link URL.
 * Backend sends { type, entityId } in notification data payload.
 */
function buildDeepLink(data: Record<string, unknown>): string | null {
  // Direct URL override from backend
  if (data?.url && typeof data.url === 'string' && data.url.startsWith('clenzy://')) {
    return data.url;
  }

  const type = data?.type as string | undefined;
  const entityId = data?.entityId as string | undefined;

  if (!type) return null;

  switch (type) {
    case 'INTERVENTION_ASSIGNED':
    case 'INTERVENTION_STATUS_CHANGED':
      return entityId ? `clenzy://interventions/${entityId}` : 'clenzy://interventions';
    case 'SERVICE_REQUEST_NEW':
    case 'SERVICE_REQUEST_STATUS':
      return 'clenzy://notifications';
    case 'MESSAGE_NEW':
      return 'clenzy://notifications';
    case 'PAYMENT_RECEIVED':
      return 'clenzy://notifications';
    default:
      return 'clenzy://notifications';
  }
}

/**
 * Map notification type to TanStack Query keys that need invalidation.
 */
function getInvalidationKeys(type: string | undefined): string[][] {
  if (!type) return [];

  if (type.startsWith('INTERVENTION_')) {
    return [['interventions'], ['dashboard-kpis'], ['calendar']];
  }
  if (type.startsWith('SERVICE_REQUEST_')) {
    return [['serviceRequests']];
  }
  if (type === 'MESSAGE_NEW') {
    return [['messages']];
  }
  if (type === 'PAYMENT_RECEIVED') {
    return [['revenue-kpis'], ['dashboard-kpis']];
  }
  return [];
}

export function usePushNotifications() {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const queryClient = useQueryClient();

  const handleForegroundNotification = useCallback(
    (notification: Notifications.Notification) => {
      // Increment unread count
      const store = useNotificationStore.getState();
      store.setUnreadCount(store.unreadCount + 1);

      // Invalidate relevant queries so data refreshes
      const data = notification.request.content.data;
      const type = data?.type as string | undefined;
      const keys = getInvalidationKeys(type);
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
    [queryClient],
  );

  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      const deepLink = buildDeepLink(data as Record<string, unknown>);
      if (deepLink) {
        Linking.openURL(deepLink);
      }
    },
    [],
  );

  useEffect(() => {
    registerForPushNotifications();

    // Foreground notification received
    notificationListener.current = Notifications.addNotificationReceivedListener(
      handleForegroundNotification,
    );

    // User tapped notification — deep link
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse,
    );

    // Handle cold start: check if app was opened via a notification tap
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationResponse(response);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [handleForegroundNotification, handleNotificationResponse]);
}
