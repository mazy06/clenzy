import { BaitlyTabBar } from "./BaitlyTabBar";
import { useBaitlyTabOptions } from "./useBaitlyMotion";
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useBaitlyTheme } from '@/design-system/theme';
import { BaitlyHeaderLogo } from '@/design-system/BaitlyHeader';

/** Header with a back button, for pushed Baitly screens that do not draw their own. */
function usePushedHeader(): NativeStackNavigationOptions {
  const colors = useBaitlyTheme();
  const { t } = useTranslation('mobileV1');
  return { headerShown: true, headerTitle: BaitlyHeaderLogo, headerTitleAlign: 'center', headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal', headerBackTitle: t('back'), headerTintColor: colors.ink,
    headerStyle: { backgroundColor: colors.background }, contentStyle: { backgroundColor: colors.background } };
}
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useUnreadConversationCount } from '@/hooks/useConversations';

import { PlanningDashboardScreen } from '@/screens/manager/PlanningDashboardScreen';
import { InterventionListScreen } from '@/screens/manager/InterventionListScreen';
import { InterventionDetailScreen } from '@/screens/manager/InterventionDetailScreen';
import { TaskValidationScreen } from '@/screens/manager/TaskValidationScreen';
import { TeamListScreen } from '@/screens/manager/TeamListScreen';
import { TeamAssignmentScreen } from '@/screens/manager/TeamAssignmentScreen';
import { AdminIncidentsScreen as IncidentListScreen, AdminRequestsScreen as ServiceRequestListScreen } from '@/screens/manager/AdminRequestsScreen';
import { ManagerMoreScreen } from '@/screens/manager/ManagerMoreScreen';
import { ProfileDetailScreen } from '@/screens/common/ProfileDetailScreen';
import { SubscriptionScreen } from '@/screens/common/SubscriptionScreen';
import { SubscriptionCheckoutScreen } from '@/screens/common/SubscriptionCheckoutScreen';
import { DocumentsScreen } from '@/screens/host/DocumentsScreen';
import { DocumentDetailScreen } from '@/screens/host/DocumentDetailScreen';
import { DocumentGenerateScreen } from '@/screens/host/DocumentGenerateScreen';
import { PdfViewerScreen } from '@/screens/shared/PdfViewerScreen';
import { DeleteAccountScreen } from '@/screens/common/DeleteAccountScreen';
import { ConversationScreen } from '@/screens/shared/ConversationScreen';
import { ConversationDetailScreen } from '@/screens/shared/ConversationDetailScreen';
import { CreateInterventionScreen } from '@/screens/manager/CreateInterventionScreen';
import { MessageTemplatesScreen } from '@/screens/shared/MessageTemplatesScreen';

export type InterventionsStackParamList = {
  InterventionList: undefined;
  InterventionDetail: { interventionId: number };
  TaskValidation: { interventionId: number };
  CreateIntervention: undefined;
};

export type MessagesStackParamList = {
  ConversationList: undefined;
  ConversationDetail: { conversationId: number };
  MessageTemplates: undefined;
};

export type MoreStackParamList = {
  MoreMenu: undefined;
  Teams: undefined;
  TeamAssignment: { teamId: number };
  ProfileDetail: undefined;
  Subscription: undefined;
  SubscriptionCheckout: { forfait: string };
  ServiceRequests: undefined;
  Incidents: undefined;
  Documents: undefined;
  DocumentDetail: { documentId: number };
  DocumentGenerate: undefined;
  PdfViewer: { uri: string; title?: string };
  DeleteAccount: undefined;
};

const InterventionsStack = createNativeStackNavigator<InterventionsStackParamList>();
function InterventionsStackNavigator() {
  const pushed = usePushedHeader();
  return (
    <InterventionsStack.Navigator screenOptions={{ headerShown: false }}>
      <InterventionsStack.Screen name="InterventionList" component={InterventionListScreen} />
      <InterventionsStack.Screen name="InterventionDetail" options={pushed} component={InterventionDetailScreen} />
      <InterventionsStack.Screen name="TaskValidation" options={pushed} component={TaskValidationScreen} />
      <InterventionsStack.Screen name="CreateIntervention" component={CreateInterventionScreen} />
    </InterventionsStack.Navigator>
  );
}

const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();
function MessagesStackNavigator() {
  return (
    <MessagesStack.Navigator screenOptions={{ headerShown: false }}>
      <MessagesStack.Screen name="ConversationList">
        {() => (
          <ConversationScreen
            title="Messages"
            showHeader
          />
        )}
      </MessagesStack.Screen>
      <MessagesStack.Screen name="ConversationDetail" component={ConversationDetailScreen} />
      <MessagesStack.Screen name="MessageTemplates" component={MessageTemplatesScreen} />
    </MessagesStack.Navigator>
  );
}

const MoreStack = createNativeStackNavigator<MoreStackParamList>();
function MoreStackNavigator() {
  const pushed = usePushedHeader();
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false }}>
      <MoreStack.Screen name="MoreMenu" component={ManagerMoreScreen} />
      <MoreStack.Screen name="Teams" options={pushed} component={TeamListScreen} />
      <MoreStack.Screen name="TeamAssignment" options={pushed} component={TeamAssignmentScreen} />
      <MoreStack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
      <MoreStack.Screen name="Subscription" component={SubscriptionScreen} />
      <MoreStack.Screen name="SubscriptionCheckout" component={SubscriptionCheckoutScreen} />
      <MoreStack.Screen name="ServiceRequests" options={pushed} component={ServiceRequestListScreen} />
      <MoreStack.Screen name="Incidents" options={pushed} component={IncidentListScreen} />
      <MoreStack.Screen name="Documents" component={DocumentsScreen} />
      <MoreStack.Screen name="DocumentDetail" component={DocumentDetailScreen} />
      <MoreStack.Screen name="DocumentGenerate" component={DocumentGenerateScreen} />
      <MoreStack.Screen name="PdfViewer" component={PdfViewerScreen} />
      <MoreStack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
    </MoreStack.Navigator>
  );
}

const Tab = createBottomTabNavigator();

export function ManagerNavigator() {
  const options = useBaitlyTabOptions();
  const { data: unreadData } = useUnreadConversationCount();
  const unreadCount = unreadData?.count ?? 0;
  return (
    <Tab.Navigator tabBar={props => <BaitlyTabBar {...props} />} screenOptions={options}>
      <Tab.Screen name="Planning" component={PlanningDashboardScreen} options={{ tabBarLabel: "Planning" }} />
      <Tab.Screen name="Interventions" component={InterventionsStackNavigator} options={{ tabBarLabel: "Missions" }} />
      <Tab.Screen name="Messages" component={MessagesStackNavigator} options={{ tabBarLabel: "Messages", tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : undefined }} />
      <Tab.Screen name="More" component={MoreStackNavigator} options={{ tabBarLabel: "Plus" }} />
    </Tab.Navigator>
  );
}
