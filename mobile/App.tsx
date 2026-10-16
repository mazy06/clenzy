import React, { useCallback, useEffect } from 'react';
import { AppState, StatusBar, View, Text } from 'react-native';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Constants from 'expo-constants';

// Stripe native module only works with dev client / standalone builds, not Expo Go
let StripeProvider: React.ComponentType<any> | null = null;
try {
  if (Constants.appOwnership !== 'expo') {
    StripeProvider = require('@stripe/stripe-react-native').StripeProvider;
  }
} catch {
  // Module not available (Expo Go) — skip Stripe provider
}
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
import { useTranslation } from 'react-i18next';
import { useAuthStore } from './src/store/authStore';
import { clearBaitlySessionCache, shouldPersistMobileQuery } from './src/config/baitlyCache';
import { useBaitlyTheme } from './src/design-system/theme';
import { useAccountPreferences } from './src/features/account/useAccountPreferences';
import { useBaitlyDataMode } from './src/config/baitlyDataMode';

SplashScreen.preventAutoHideAsync();

function AppContent() {
  useAccountPreferences();
  const { t } = useTranslation('mobileV1');
  const baitly = useBaitlyTheme();
  const theme = useTheme();
  const { isConnected } = useNetworkStatus();
  const { toast, hideToast } = useUiStore();
  const hydrateOffline = useOfflineStore((s) => s.hydrate);
  const { pendingCount, isSyncing } = useOfflineSync();

  useEffect(() => {
    hydrateOffline();
    // Purge old snapshots that were not bound to an account or an organization.
    void queryPersister.removeClient();
  }, []);
  useEffect(()=>{onlineManager.setOnline(isConnected);},[isConnected]);
  useEffect(()=>{focusManager.setFocused(AppState.currentState==='active');const listener=AppState.addEventListener('change',state=>focusManager.setFocused(state==='active'));return()=>listener.remove();},[]);
  useEffect(()=>useBaitlyDataMode.subscribe((state,previous)=>{if(state.mode!==previous.mode)clearBaitlySessionCache(queryClient);}),[]);

  useEffect(() => useAuthStore.subscribe((state, previous) => {
    if (state.user?.id !== previous.user?.id || state.user?.organizationId !== previous.user?.organizationId) {
      clearBaitlySessionCache(queryClient);
    }
  }), []);

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
            backgroundColor: baitly.warningSoft,
            paddingVertical: 6,
            paddingHorizontal: 16,
            alignItems: 'center',
          }}
          accessibilityRole="alert"
          accessibilityLabel={t('offline')}
        >
          <Text
            style={{
              ...theme.typography.caption,
              color: baitly.warning,
              fontWeight: '600',
            }}
          >
            {t('offline')}
          </Text>
        </View>
      )}

      {/* Sync indicator */}
      {isConnected && isSyncing && pendingCount > 0 && (
        <View
          style={{
            backgroundColor: baitly.muted,
            paddingVertical: 4,
            paddingHorizontal: 16,
            alignItems: 'center',
          }}
          accessibilityRole="alert"
          accessibilityLabel={t('syncCount', { count: pendingCount })}
        >
          <Text
            style={{
              ...theme.typography.caption,
              color: baitly.ink,
              fontWeight: '600',
            }}
          >
            {t('syncCount', { count: pendingCount })}
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

function MaybeStripeProvider({ children }: { children: React.ReactNode }) {
  if (StripeProvider) {
    return (
      <StripeProvider
        publishableKey={STRIPE_CONFIG.publishableKey}
        merchantIdentifier={STRIPE_CONFIG.merchantIdentifier}
      >
        {children}
      </StripeProvider>
    );
  }
  return <>{children}</>;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    BaitlyWordmark: require('./assets/fonts/baitly-wordmark-600.ttf'),
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
          <MaybeStripeProvider>
            <PersistQueryClientProvider
              client={queryClient}
              persistOptions={{ persister: queryPersister, dehydrateOptions: { shouldDehydrateQuery: shouldPersistMobileQuery } }}
            >
              <AppContent />
            </PersistQueryClientProvider>
          </MaybeStripeProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
