import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '@/store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { getMobileLinkingConfig } from './linking';
import { baitlyLight } from '@/design-system/theme';

const Stack = createNativeStackNavigator();

const INIT_TIMEOUT_MS = 8000; // 8s safety net

export function RootNavigator() {
  const { isAuthenticated, isLoading, isInitialized, initialize, isHost, isHousekeeper, isTechnician, isSupervisor, isPlatformStaff } = useAuthStore();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    console.log('[ROOT] RootNavigator mounted, calling initialize()');
    initialize();

    // Safety timeout: if init takes too long, force past the spinner
    const timer = setTimeout(() => {
      const state = useAuthStore.getState();
      console.warn('[ROOT] Init timeout! isInitialized:', state.isInitialized, 'isLoading:', state.isLoading);
      if (!state.isInitialized || state.isLoading) {
        console.warn('[ROOT] Forcing past loading screen');
        setTimedOut(true);
      }
    }, INIT_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, []);

  const showLoading = !isInitialized && !timedOut;

  if (showLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: baitlyLight.ink,
        }}
      >
        <ActivityIndicator size="large" color={baitlyLight.onPrimary} />
      </View>
    );
  }

  return (
    <NavigationContainer linking={getMobileLinkingConfig(true, !isAuthenticated)}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
