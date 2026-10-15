import { managementScreens, conciergeScreens, providerScreens, adminScreens, commonScreens, type BaitlyManagementParams, type BaitlyConciergeParams, type BaitlyProviderParams, type BaitlyAdminParams, type BaitlyCommonParams } from './baitlyRoleRoutes';
import { ReservationCalendarScreen } from '@/screens/host/ReservationCalendarScreen';
import { baitlyPersona, isPlatformAdmin } from '@/features/roles/persona';
import { BusinessActionsScreen, type BusinessActionKind } from '@/features/owner/BusinessActionsScreen';
import { PaymentCheckoutScreen } from '@/screens/host/PaymentCheckoutScreen';
import { ReservationDetailScreen } from '@/screens/host/ReservationDetailScreen';
import { ReservationEditScreen } from '@/screens/host/ReservationEditScreen';
import { PdfViewerScreen } from '@/screens/shared/PdfViewerScreen';
import { useUnreadConversationCount } from '@/hooks/useConversations';
import { ConversationScreen } from '@/screens/shared/ConversationScreen';
import { ConversationDetailScreen } from '@/screens/shared/ConversationDetailScreen';
import { MessageTemplatesScreen } from '@/screens/shared/MessageTemplatesScreen';
import { ManagerNavigator } from './ManagerNavigator';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { consumeInvitation } from '@/features/network/pendingInvitation';
import { useBaitlyUser } from '@/config/baitlyDemoProfiles';
import { BaitlyNotificationsScreen } from '@/features/account/NotificationsScreen';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Easing, PanResponder, View } from 'react-native';
import { BaitlyTabBar } from './BaitlyTabBar';
import { baitlyTabs, type BaitlyTabName } from './baitlyNavigationModel';
import { useBaitlyReducedMotion } from './useBaitlyMotion';
import { useBaitlyTheme } from '@/design-system/theme';
import { BaitlyButton, BaitlyEmpty } from '@/design-system/components';
import { BaitlyHeaderLogo, BaitlyHeaderAction } from '@/design-system/BaitlyHeader';
import { MarketplaceScreen } from '@/features/marketplace/MarketplaceScreen';
import { ProviderScreen } from '@/features/marketplace/ProviderScreen';
import { PublicClientProfileScreen } from '@/features/marketplace/PublicClientProfileScreen';
import { PublicPropertyScreen } from '@/features/conciergeries/PublicPropertyScreen';
import { ReelsScreen } from '@/features/reels/ReelsScreen';
import { ReelSettingsScreen } from '@/features/reels/ReelSettingsScreen';
import { SectorMapScreen } from '@/screens/shared/SectorMapScreen';
import { CreateRequestScreen } from '@/features/marketplace/CreateRequestScreen';
import { QuoteScreen } from '@/features/marketplace/QuoteScreen';
import { ReceivedRequestsScreen, SentRequestsScreen } from '@/features/marketplace/RequestsScreen';
import { BaitlyPropertiesScreen, BaitlyPropertyScreen } from '@/features/owner/OwnerScreens';
import { OwnerHomeScreen } from '@/features/owner/OwnerHomeScreen';
import { OwnerPropertiesTab } from '@/features/owner/PropertiesTab';
import { BaitlyAccountScreen } from '@/features/account/AccountScreen';
import { AccountDetailsScreen } from '@/features/account/AccountDetailsScreen';
import { AccountPreferencesScreen } from '@/features/account/AccountPreferencesScreen';
import { type QuoteSide } from '@/features/marketplace/api';
import { useCapabilities } from '@/features/missions/queries';
import { OwnerMissionsScreen, MissionsScreen } from '@/features/missions/MissionsScreen';
import { NetworkScreen } from '@/features/network/NetworkScreen';
import { BaitlyMissionScreen } from '@/features/owner/MissionScreen';
import { MissionDamageScreen } from '@/features/missions/MissionDamageScreen';
import { consumeRequestIntent } from './baitlyGuestIntent';
import { PublicPropertiesScreen, CompareConciergeriesScreen, ConciergePublicationScreen } from '@/features/conciergeries/ConciergeScreens';
import { ProfilePublicationScreen, ManagementContactsScreen } from '@/features/conciergeries/ProfilePublicationScreen';

import { OwnerMandatesScreen, MandateSignatureScreen } from "@/features/management/MandateScreens";

export type BaitlyStackParams = BaitlyManagementParams & BaitlyConciergeParams & BaitlyProviderParams & BaitlyAdminParams & BaitlyCommonParams & {
  OwnerMandates: undefined;
  MandateSignature: { token: string };
  DiscoverConciergeries: undefined;
  CompareConciergeries: { providerIds: number[] };
  ConciergePublication: undefined;
  PublicProfilePublication: undefined;
  ManagementContacts: undefined;
  Home: undefined;
  Services: undefined;
  PublicHomes: undefined;
  Messages: undefined;
  Reels: undefined;
  Provider: { providerId: number; purpose?: 'management' };
  PublicClientProfile: { clientProfileId: string; contact?: boolean };
  PublicProperty: { clientProfileId: string; propertyId: string };
  ReelSettings: undefined;
  SectorMap: { scope: 'mine' | 'relevant' };
  CreateRequest: { providerId: number; purpose?: 'management' };
  Quote: { requestId: number; side: QuoteSide };
  Property: { propertyId: number };
  MyProperties: undefined;
  BusinessActions: { kind: BusinessActionKind };
  PaymentCheckout: { interventionId: number };
  ReservationDetail: { reservationId: number; initialTab?: 'paiement' };
  ReservationEdit: { reservationId: number };
  Mission: { interventionId: number };
  PdfViewer: { uri: string; title?: string };
  MissionDamage: { interventionId: number };
  SentRequests: undefined;
  ReceivedRequests: undefined;
  Account: undefined;
  AccountDetails: undefined;
  AccountPreferences: undefined;
  ExistingTools: undefined;
  Network: { token?: string } | undefined;
  Alerts: undefined;
  OwnerMissions: undefined;
  Login: undefined;
};
type Workspace = 'owner' | 'provider';
const WorkspaceContext = createContext<{
  workspace: Workspace; setWorkspace: (workspace: Workspace) => void; providerAvailable: boolean;
}>({ workspace: 'owner', setWorkspace: () => {}, providerAvailable: false });
function ExistingToolsScreen() {
  const user = useBaitlyUser();
  if (user?.roles.some(role => ['SUPER_ADMIN', 'SUPER_MANAGER', 'ADMIN'].includes(role))) return <ManagerNavigator />;
  if (user?.roles.includes('HOST')) return <OwnerMissionsScreen />;
  return <MissionsScreen />;
}
const Stack = createNativeStackNavigator<BaitlyStackParams>();
const Tabs = createBottomTabNavigator();

function TrackingScreen() {
  const { workspace } = useContext(WorkspaceContext);
  const capabilities = useCapabilities();
  return workspace === 'owner' ? <SentRequestsScreen /> : capabilities.data?.canQuote ? <ReceivedRequestsScreen /> : <NetworkScreen />;
}
function HomeScreen() {
  const { workspace } = useContext(WorkspaceContext);
  const navigation = useNavigation<NativeStackNavigationProp<BaitlyStackParams>>();
  const swipe = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => workspace === 'owner' && Math.abs(gesture.dx) > 28 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) < 72) return;
      navigation.navigate(gesture.dx > 0 ? 'Reels' : 'Messages');
    },
  }), [navigation, workspace]);
  return <View style={{ flex: 1 }} {...swipe.panHandlers}>{workspace === 'owner' ? <OwnerHomeScreen /> : <MissionsScreen />}</View>;
}
const MessagesStack = createNativeStackNavigator<{ ConversationList: undefined; ConversationDetail: { conversationId: number }; MessageTemplates: undefined }>();
function MyConversationList() { return <ConversationScreen mineOnly />; }
function BaitlyMessagesScreen() {
  return <MessagesStack.Navigator screenOptions={{ headerShown: false }}>
    <MessagesStack.Screen name="ConversationList" component={MyConversationList} />
    <MessagesStack.Screen name="ConversationDetail" component={ConversationDetailScreen} />
    <MessagesStack.Screen name="MessageTemplates" component={MessageTemplatesScreen} />
  </MessagesStack.Navigator>;
}
function BaitlyTabs() {
  const navigation = useNavigation<NativeStackNavigationProp<BaitlyStackParams>>();
  const capabilities = useCapabilities();
  useEffect(() => {
    const token = capabilities.data?.canManagePrivateNetwork ? consumeInvitation() : undefined;
    if (token) navigation.navigate('Network', { token });
    else {
      const intent = capabilities.data?.canViewOwnerSpace ? consumeRequestIntent() : undefined;
      if (intent) navigation.navigate('CreateRequest', intent);
    }
  }, [navigation, capabilities.data?.canManagePrivateNetwork, capabilities.data?.canViewOwnerSpace]);
  const { t } = useTranslation('mobileV1');
  const colors = useBaitlyTheme();
  const { workspace } = useContext(WorkspaceContext);
  const reduced = useBaitlyReducedMotion();

  const unread = useUnreadConversationCount();
  const user = useBaitlyUser();
  const persona = baitlyPersona(user, capabilities.data, workspace);
  const menus = baitlyTabs(persona === 'concierge' ? 'concierge' : persona === 'provider' ? 'provider' : 'owner', capabilities.data?.canQuote);
  const screens: Record<BaitlyTabName, React.ComponentType<{}>> = {
    Today: HomeScreen, Calendar: ReservationCalendarScreen, Properties: workspace === 'owner' ? OwnerPropertiesTab : PublicPropertiesScreen, Marketplace: MarketplaceScreen, Tracking: TrackingScreen, Profile: AccountWithSpaces, Reels: ReelsScreen, Messages: BaitlyMessagesScreen,
  };
  // Platform staff and supervisors run the planning space, not an owner space.
  if ((persona === 'admin' || persona === 'supervisor') && workspace === 'owner') return <ManagerNavigator />;
  return <Tabs.Navigator tabBar={props => <BaitlyTabBar {...props} artwork={Object.fromEntries(menus.map(menu => [menu.name, menu.artwork]))} />}
    initialRouteName="Today" screenOptions={{ headerShown: false,
    tabBarActiveTintColor: colors.ink, tabBarInactiveTintColor: colors.secondary,
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
    tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
    tabBarHideOnKeyboard: true,
    sceneStyle: { backgroundColor: colors.background },
    animation: reduced ? 'none' : 'shift',
    transitionSpec: { animation: 'timing', config: { duration: 240, easing: Easing.out(Easing.poly(4)) } },
  }}>
    {menus.map(menu => <Tabs.Screen key={menu.name} name={menu.name} component={screens[menu.name]}
      options={{ tabBarLabel: t(menu.label), tabBarAccessibilityLabel: t(menu.label), tabBarBadge: menu.name === 'Messages' && unread.data?.count ? (unread.data.count > 99 ? '99+' : unread.data.count) : undefined }} />)}
  </Tabs.Navigator>;
}

function AccountWithSpaces(props: React.ComponentProps<typeof BaitlyAccountScreen>) {
  return <BaitlyAccountScreen {...props} workspaceControl={<WorkspaceScreenContent />} />;
}
function WorkspaceScreenContent() {
  const { t } = useTranslation('mobileV1');
  const { workspace, setWorkspace, providerAvailable } = useContext(WorkspaceContext);
  const capabilities = useCapabilities();
  const user = useBaitlyUser();
  if (user?.organizationType === 'CONCIERGE') return null;
  return providerAvailable && capabilities.data?.canViewOwnerSpace ? <BaitlyButton title={t(workspace === 'owner' ? 'switchProvider' : 'switchOwner')} secondary
    onPress={() => setWorkspace(workspace === 'owner' ? 'provider' : 'owner')} /> : null;
}

export function BaitlyNavigator() {
  const { t } = useTranslation('mobileV1');
  const colors = useBaitlyTheme();
  const [workspace, setWorkspace] = useState<Workspace>('owner');
  const reduced = useBaitlyReducedMotion();
  const access = useCapabilities();
  const providerAvailable = access.data?.canExecuteAssignedMission === true;
  const effectiveWorkspace = access.data?.canViewOwnerSpace ? workspace : 'provider';
  const ownerAccess = access.data?.canViewOwnerSpace === true;
  const baitlyUser = useBaitlyUser();
  const platformAdmin = isPlatformAdmin(baitlyUser);
  const concierge = baitlyUser?.organizationType === 'CONCIERGE' || platformAdmin;
  if (access.isPending) return <BaitlyEmpty title={t('loading')} />;
  if (access.isError) return <BaitlyEmpty title={t('providerAccessFailed')} retry={() => { void access.refetch(); }} />;
  return <WorkspaceContext.Provider value={{ workspace: effectiveWorkspace, setWorkspace, providerAvailable }}>
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.ink,
      headerShadowVisible: false, headerTitle: BaitlyHeaderLogo, headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: colors.background }, headerBackTitle: t('back') }}>
      <Stack.Screen name="Home" component={BaitlyTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Messages" component={BaitlyMessagesScreen} options={{ animation: reduced ? 'none' : 'slide_from_left' }} />
      <Stack.Screen name="Reels" component={ReelsScreen} options={{ animation: reduced ? 'none' : 'slide_from_right' }} />
      <Stack.Screen name="Services" component={MarketplaceScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PublicHomes" component={PublicPropertiesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PublicClientProfile" component={PublicClientProfileScreen} />
      <Stack.Screen name="PublicProperty" component={PublicPropertyScreen} options={{ headerTitle: '' }} />
      <Stack.Screen name="ReelSettings" component={ReelSettingsScreen} />
      <Stack.Screen name="SectorMap" component={SectorMapScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CompareConciergeries" component={CompareConciergeriesScreen} />
      {ownerAccess ? <Stack.Group>
      <Stack.Screen name="OwnerMandates" component={OwnerMandatesScreen} />
      <Stack.Screen name="MandateSignature" component={MandateSignatureScreen} />
      <Stack.Screen name="DiscoverConciergeries" component={PublicPropertiesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ConciergePublication" component={ConciergePublicationScreen} />
      <Stack.Screen name="PublicProfilePublication" component={ProfilePublicationScreen} />
      <Stack.Screen name="ManagementContacts" component={ManagementContactsScreen} />
      <Stack.Screen name="CreateRequest" component={CreateRequestScreen} />
      </Stack.Group> : null}
      <Stack.Screen name="Provider" component={ProviderScreen} />
      <Stack.Screen name="Quote" component={QuoteScreen} />
      {access.data?.canQuote ? <Stack.Screen name="ReceivedRequests" component={ReceivedRequestsScreen} /> : null}
      {ownerAccess ? <Stack.Group>
      <Stack.Screen name="Property" component={BaitlyPropertyScreen} options={{ headerTitle: '' }} />
      <Stack.Screen name="MyProperties" component={BaitlyPropertiesScreen} />
      <Stack.Screen name="BusinessActions" component={BusinessActionsScreen} />
      <Stack.Screen name="PaymentCheckout" component={PaymentCheckoutScreen} />
      <Stack.Screen name="ReservationDetail" component={ReservationDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ReservationEdit" component={ReservationEditScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SentRequests" component={SentRequestsScreen} />
      <Stack.Screen name="OwnerMissions" component={OwnerMissionsScreen} options={({ navigation }) => ({ headerRight: () => <BaitlyHeaderAction icon="person-outline" label={t('account')} onPress={() => navigation.navigate('Account')} /> })} />
      <Stack.Screen name="ExistingTools" component={ExistingToolsScreen} />
      </Stack.Group> : null}
      <Stack.Screen name="PdfViewer" component={PdfViewerScreen} options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="Mission" component={BaitlyMissionScreen} />
      <Stack.Screen name="MissionDamage" component={MissionDamageScreen} />
      <Stack.Screen name="Account" component={AccountWithSpaces} options={({ navigation }) => ({ headerRight: () => <BaitlyHeaderAction icon="notifications-outline" label={t('notifications')} onPress={() => navigation.navigate('Alerts')} /> })} />
      <Stack.Screen name="AccountDetails" component={AccountDetailsScreen} options={{ headerTitle: '' }} />
      <Stack.Screen name="AccountPreferences" component={AccountPreferencesScreen} />
      <Stack.Screen name="Alerts" component={BaitlyNotificationsScreen} />
      {access.data?.canManagePrivateNetwork ? <Stack.Screen name="Network" component={NetworkScreen} /> : null}
      {/* Screens brought back from the former role navigators: each keeps its own header until redesigned. */}
      {ownerAccess ? <Stack.Group screenOptions={{ headerShown: false }}>
        {Object.entries(managementScreens).map(([name, component]) => <Stack.Screen key={name} name={name as keyof BaitlyStackParams} component={component} />)}
      </Stack.Group> : null}
      {ownerAccess && concierge ? <Stack.Group screenOptions={{ headerShown: false }}>
        {Object.entries(conciergeScreens).map(([name, component]) => <Stack.Screen key={name} name={name as keyof BaitlyStackParams} component={component} />)}
      </Stack.Group> : null}
      {platformAdmin ? <Stack.Group screenOptions={{ headerShown: false }}>
        {Object.entries(adminScreens).map(([name, component]) => <Stack.Screen key={name} name={name as keyof BaitlyStackParams} component={component} />)}
      </Stack.Group> : null}
      <Stack.Group screenOptions={{ headerShown: false }}>
        {Object.entries(commonScreens).map(([name, component]) => <Stack.Screen key={name} name={name as keyof BaitlyStackParams} component={component} />)}
      </Stack.Group>
      {providerAvailable ? <Stack.Group screenOptions={{ headerShown: false }}>
        {Object.entries(providerScreens).map(([name, component]) => <Stack.Screen key={name} name={name as keyof BaitlyStackParams} component={component} />)}
      </Stack.Group> : null}
    </Stack.Navigator>
  </WorkspaceContext.Provider>;
}
