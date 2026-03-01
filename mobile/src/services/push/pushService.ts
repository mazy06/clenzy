import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiClient } from '@/api/apiClient';
import { useNotificationStore } from '@/store/notificationStore';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission not granted');
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn('Missing EAS project ID for push notifications');
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenData.data;
}

export async function registerForPushNotifications(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('interventions', {
      name: 'Interventions',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('service_requests', {
      name: 'Demandes de service',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('payments', {
      name: 'Paiements',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('system', {
      name: 'Systeme',
      importance: Notifications.AndroidImportance.LOW,
    });
  }

  const token = await getExpoPushToken();
  if (!token) return;

  useNotificationStore.getState().setFcmToken(token);

  try {
    await apiClient.post('/devices/register', {
      token,
      platform: Platform.OS,
    });
  } catch (error) {
    console.warn('Failed to register push token with backend:', error);
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  const token = useNotificationStore.getState().fcmToken;
  if (!token) return;

  try {
    await apiClient.delete(`/devices/${encodeURIComponent(token)}`);
  } catch {
    // Best effort on logout
  }

  useNotificationStore.getState().setFcmToken(null);
}
