import React from 'react';
import { Platform, StyleSheet, View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useUnreadConversationCount } from '@/hooks/useConversations';

import { PlanningDashboardScreen } from '@/screens/manager/PlanningDashboardScreen';
import { InterventionListScreen } from '@/screens/manager/InterventionListScreen';
import { InterventionDetailScreen } from '@/screens/manager/InterventionDetailScreen';
import { TaskValidationScreen } from '@/screens/manager/TaskValidationScreen';
import { TeamListScreen } from '@/screens/manager/TeamListScreen';
import { TeamAssignmentScreen } from '@/screens/manager/TeamAssignmentScreen';
import { IncidentListScreen } from '@/screens/manager/IncidentListScreen';
import { ServiceRequestListScreen } from '@/screens/manager/ServiceRequestListScreen';
import { ProfileScreen } from '@/screens/common/ProfileScreen';
import { ProfileDetailScreen } from '@/screens/common/ProfileDetailScreen';
import { SubscriptionScreen } from '@/screens/common/SubscriptionScreen';
import { SubscriptionCheckoutScreen } from '@/screens/common/SubscriptionCheckoutScreen';
import { DeleteAccountScreen } from '@/screens/common/DeleteAccountScreen';
import { ConversationScreen } from '@/screens/shared/ConversationScreen';
import { ConversationDetailScreen } from '@/screens/shared/ConversationDetailScreen';

export type InterventionsStackParamList = {
  InterventionList: undefined;
  InterventionDetail: { interventionId: number };
  TaskValidation: { interventionId: number };
};

export type TeamsStackParamList = {
  TeamList: undefined;
  TeamAssignment: { teamId: number };
};

export type MessagesStackParamList = {
  ConversationList: undefined;
  ConversationDetail: { conversationId: number };
};

export type MoreStackParamList = {
  MoreMenu: undefined;
  ProfileDetail: undefined;
  Subscription: undefined;
  SubscriptionCheckout: { forfait: string };
  ServiceRequests: undefined;
  Incidents: undefined;
  DeleteAccount: undefined;
};

const InterventionsStack = createNativeStackNavigator<InterventionsStackParamList>();
function InterventionsStackNavigator() {
  return (
    <InterventionsStack.Navigator screenOptions={{ headerShown: false }}>
      <InterventionsStack.Screen name="InterventionList" component={InterventionListScreen} />
      <InterventionsStack.Screen name="InterventionDetail" component={InterventionDetailScreen} />
      <InterventionsStack.Screen name="TaskValidation" component={TaskValidationScreen} />
    </InterventionsStack.Navigator>
  );
}

const TeamsStack = createNativeStackNavigator<TeamsStackParamList>();
function TeamsStackNavigator() {
  return (
    <TeamsStack.Navigator screenOptions={{ headerShown: false }}>
      <TeamsStack.Screen name="TeamList" component={TeamListScreen} />
      <TeamsStack.Screen name="TeamAssignment" component={TeamAssignmentScreen} />
    </TeamsStack.Navigator>
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
    </MessagesStack.Navigator>
  );
}

const MoreStack = createNativeStackNavigator<MoreStackParamList>();
function MoreStackNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false }}>
      <MoreStack.Screen name="MoreMenu" component={ProfileScreen} />
      <MoreStack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
      <MoreStack.Screen name="Subscription" component={SubscriptionScreen} />
      <MoreStack.Screen name="SubscriptionCheckout" component={SubscriptionCheckoutScreen} />
      <MoreStack.Screen name="ServiceRequests" component={ServiceRequestListScreen} />
      <MoreStack.Screen name="Incidents" component={IncidentListScreen} />
      <MoreStack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
    </MoreStack.Navigator>
  );
}

const Tab = createBottomTabNavigator();

export function ManagerNavigator() {
  const theme = useTheme();
  const { data: unreadData } = useUnreadConversationCount();
  const unreadCount = unreadData?.count ?? 0;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary.main,
        tabBarInactiveTintColor: theme.colors.text.secondary,
        tabBarStyle: {
          backgroundColor: theme.colors.background.paper,
          borderTopColor: theme.colors.border.light,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          ...theme.shadows.md,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
      }}
    >
      <Tab.Screen
        name="Planning"
        component={PlanningDashboardScreen}
        options={{
          tabBarLabel: 'Planning',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="clipboard-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Interventions"
        component={InterventionsStackNavigator}
        options={{
          tabBarLabel: 'Interventions',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="construct-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesStackNavigator}
        options={{
          tabBarLabel: 'Messages',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="chatbubbles-outline" size={size} color={color} />
              {unreadCount > 0 && (
                <View style={{
                  position: 'absolute',
                  top: -4,
                  right: -8,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: theme.colors.error.main,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 3,
                }}>
                  <Text style={{ fontSize: 9, color: '#fff', fontWeight: '800' }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Teams"
        component={TeamsStackNavigator}
        options={{
          tabBarLabel: 'Equipes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreStackNavigator}
        options={{
          tabBarLabel: 'Plus',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
