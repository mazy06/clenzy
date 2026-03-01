import React, { useCallback, useEffect } from 'react';
import { StatusBar, View, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StripeProvider } from '@stripe/stripe-react-native';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold';
import { queryClient, queryPersister } from './src/config/queryClient';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { useOfflineStore } from './src/store/offlineStore';
import { useUiStore } from './src/store/uiStore';
import { Toast } from './src/components/ui';
import { useNetworkStatus } from './src/hooks/useNetworkStatus';
import { useOfflineSync } from './src/hooks/useOfflineSync';
import { useTheme } from './src/theme';
import { STRIPE_CONFIG } from './src/config/stripe';
import './src/i18n/config';

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const theme = useTheme();
  const { isConnected } = useNetworkStatus();
  const { toast, hideToast } = useUiStore();
  const hydrateOffline = useOfflineStore((s) => s.hydrate);
  const { pendingCount, isSyncing } = useOfflineSync();

  useEffect(() => {
    hydrateOffline();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background.default }}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background.default}
      />

      {/* Offline banner */}
      {!isConnected && (
        <View
          style={{
            backgroundColor: theme.colors.warning.main,
            paddingVertical: 6,
            paddingHorizontal: 16,
            alignItems: 'center',
          }}
          accessibilityRole="alert"
          accessibilityLabel="Vous etes hors ligne. Les modifications seront synchronisees automatiquement."
        >
          <Text
            style={{
              ...theme.typography.caption,
              color: theme.colors.warning.contrastText,
              fontWeight: '600',
            }}
          >
            Hors ligne - les modifications seront synchronisees
          </Text>
        </View>
      )}

      {/* Sync indicator */}
      {isConnected && isSyncing && pendingCount > 0 && (
        <View
          style={{
            backgroundColor: theme.colors.info.main,
            paddingVertical: 4,
            paddingHorizontal: 16,
            alignItems: 'center',
          }}
          accessibilityRole="alert"
          accessibilityLabel={`Synchronisation de ${pendingCount} element${pendingCount > 1 ? 's' : ''} en cours`}
        >
          <Text
            style={{
              ...theme.typography.caption,
              color: '#fff',
              fontWeight: '600',
            }}
          >
            Synchronisation ({pendingCount})...
          </Text>
        </View>
      )}

      <RootNavigator />

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={hideToast}
      />
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <StripeProvider
            publishableKey={STRIPE_CONFIG.publishableKey}
            merchantIdentifier={STRIPE_CONFIG.merchantIdentifier}
          >
            <PersistQueryClientProvider
              client={queryClient}
              persistOptions={{ persister: queryPersister }}
            >
              <AppContent />
            </PersistQueryClientProvider>
          </StripeProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
