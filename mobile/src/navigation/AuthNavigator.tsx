import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { MarketplaceScreen } from '@/features/marketplace/MarketplaceScreen';
import { ProviderScreen } from '@/features/marketplace/ProviderScreen';
import { PublicClientProfileScreen } from '@/features/marketplace/PublicClientProfileScreen';
import { PublicPropertyScreen } from '@/features/conciergeries/PublicPropertyScreen';
import { ReelsScreen } from '@/features/reels/ReelsScreen';
import type { BaitlyStackParams } from './BaitlyNavigator';
import { useBaitlyTheme } from '@/design-system/theme';
import { useTranslation } from 'react-i18next';
import { createBottomTabNavigator, type BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Easing } from 'react-native';
import { BaitlyTabBar } from './BaitlyTabBar';
import { baitlyTabs, type BaitlyTabName } from './baitlyNavigationModel';
import { useBaitlyReducedMotion } from './useBaitlyMotion';
import { BaitlyButton, BaitlyScreen, BaitlyText } from '@/design-system/components';
import { BaitlyHeaderLogo } from '@/design-system/BaitlyHeader';
import { PublicPropertiesScreen, CompareConciergeriesScreen } from '@/features/conciergeries/ConciergeScreens';

import { MandateSignatureScreen } from "@/features/management/MandateScreens";

const Stack = createNativeStackNavigator<BaitlyStackParams>();
type GuestTabParams = Record<BaitlyTabName, undefined>;
const Tabs = createBottomTabNavigator<GuestTabParams>();

function GuestWorkspaceScreen() {
  const { t } = useTranslation('mobileV1');
  const route = useRoute();
  const navigation = useNavigation<BottomTabNavigationProp<GuestTabParams>>();
  return <BaitlyScreen title={t(route.name === 'Properties' ? 'properties' : 'tracking')}>
    <BaitlyText muted>{t(route.name === 'Properties' ? 'guestPropertiesHelp' : 'guestTrackingHelp')}</BaitlyText>
    <BaitlyButton title={t('login')} onPress={() => navigation.navigate('Profile')} />
  </BaitlyScreen>;
}

function GuestTabs({ route }: { route: { name: string } }) {
  const colors = useBaitlyTheme();
  const { t } = useTranslation('mobileV1');
  const reduced = useBaitlyReducedMotion();
  const menus = baitlyTabs('guest');
  return <Tabs.Navigator tabBar={props => <BaitlyTabBar {...props} />} initialRouteName={route.name === 'Login' ? 'Profile' : 'Marketplace'} screenOptions={{
    headerShown: false, tabBarActiveTintColor: colors.ink, tabBarInactiveTintColor: colors.secondary,
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
    tabBarLabelStyle: { fontSize: 12, fontWeight: '500' }, tabBarHideOnKeyboard: true,
    sceneStyle: { backgroundColor: colors.background },
    animation: reduced ? 'none' : 'shift',
    transitionSpec: { animation: 'timing', config: { duration: 240, easing: Easing.out(Easing.poly(4)) } },
  }}>
    {menus.map(menu => <Tabs.Screen key={menu.name} name={menu.name}
      component={menu.name === 'Marketplace' ? MarketplaceScreen : menu.name === 'Profile' ? LoginScreen : menu.name === 'Properties' ? PublicPropertiesScreen : menu.name === 'Reels' ? ReelsScreen : GuestWorkspaceScreen}
      options={{ tabBarLabel: t(menu.label), tabBarAccessibilityLabel: t(menu.label) }} />)}
  </Tabs.Navigator>;
}

export function AuthNavigator() {
  const colors = useBaitlyTheme();
  const { t } = useTranslation('mobileV1');
  return (
    <Stack.Navigator initialRouteName="Home" screenOptions={{ headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.ink, headerShadowVisible: false, headerTitle: BaitlyHeaderLogo, headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal', headerBackTitle: t('back'),
      contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="Home" component={GuestTabs} options={{ headerShown: false }} />
      <Stack.Screen name="MandateSignature" component={MandateSignatureScreen} />
      <Stack.Screen name="Provider" component={ProviderScreen} />
      <Stack.Screen name="PublicClientProfile" component={PublicClientProfileScreen} />
      <Stack.Screen name="PublicProperty" component={PublicPropertyScreen} options={{ headerTitle: '' }} />
      <Stack.Screen name="CompareConciergeries" component={CompareConciergeriesScreen} />
      <Stack.Screen name="Login" component={GuestTabs} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
