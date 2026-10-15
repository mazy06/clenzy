import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BaitlyNotificationsScreen as NotificationsScreen } from '@/features/account/NotificationsScreen';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { BaitlyNavigator } from './BaitlyNavigator';
import { useBaitlyUser } from '@/config/baitlyDemoProfiles';
import { useBaitlyDataMode } from '@/config/baitlyDataMode';
import { useBaitlyTheme } from '@/design-system/theme';
import { BaitlyHeaderLogo } from '@/design-system/BaitlyHeader';

export type MainStackParamList = {
  Tabs: undefined;
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainNavigator() {
  // Push mobile (MM-2B P4) : MainNavigator n'est monté QUE authentifié →
  // enregistre le token Expo au login + branche les listeners (deep-links).
  usePushNotifications();

  const user = useBaitlyUser();
  const mode = useBaitlyDataMode(s=>s.mode);
  // Every role uses the Baitly navigator; the persona inside it decides tabs and screens.
  const RoleNavigator: React.ComponentType = BaitlyNavigator;
  const colors = useBaitlyTheme();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={RoleNavigator} navigationKey={`${user?.id}:${user?.organizationId}:${mode}`} />
      {/* Opened by push notifications: same look as every Baitly screen, with a way back. */}
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: true, headerTitle: BaitlyHeaderLogo, headerTitleAlign: 'center',
        headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.ink }} />
    </Stack.Navigator>
  );
}
