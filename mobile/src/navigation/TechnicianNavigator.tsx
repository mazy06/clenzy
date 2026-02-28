import React from 'react';
import { Platform, StyleSheet, View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useUnreadConversationCount } from '@/hooks/useConversations';

import { TicketQueueScreen } from '@/screens/technician/TicketQueueScreen';
import { DiagnosticFormScreen } from '@/screens/technician/DiagnosticFormScreen';
import { PhotoDocScreen } from '@/screens/technician/PhotoDocScreen';
import { TechReportScreen } from '@/screens/technician/TechReportScreen';
import { HistoryScreen } from '@/screens/housekeeper/HistoryScreen';
import { ProfileScreen } from '@/screens/common/ProfileScreen';
import { ProfileDetailScreen } from '@/screens/common/ProfileDetailScreen';
import { SubscriptionScreen } from '@/screens/common/SubscriptionScreen';
import { SubscriptionCheckoutScreen } from '@/screens/common/SubscriptionCheckoutScreen';
import { DeleteAccountScreen } from '@/screens/common/DeleteAccountScreen';
import { ConversationScreen } from '@/screens/shared/ConversationScreen';
import { ConversationDetailScreen } from '@/screens/shared/ConversationDetailScreen';

export type TicketsStackParamList = {
  TicketQueue: undefined;
  DiagnosticForm: { interventionId: number };
  PhotoDoc: { interventionId: number };
  TechReport: { interventionId: number };
};

export type MessagesStackParamList = {
  ConversationList: undefined;
  ConversationDetail: { conversationId: number };
};

const TicketsStack = createNativeStackNavigator<TicketsStackParamList>();
function TicketsStackNavigator() {
  return (
    <TicketsStack.Navigator screenOptions={{ headerShown: false }}>
      <TicketsStack.Screen name="TicketQueue" component={TicketQueueScreen} />
      <TicketsStack.Screen name="DiagnosticForm" component={DiagnosticFormScreen} />
      <TicketsStack.Screen name="PhotoDoc" component={PhotoDocScreen} />
      <TicketsStack.Screen name="TechReport" component={TechReportScreen} />
    </TicketsStack.Navigator>
  );
}

const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();
function MessagesStackNavigator() {
  return (
    <MessagesStack.Navigator screenOptions={{ headerShown: false }}>
      <MessagesStack.Screen name="ConversationList">
        {() => (
          <ConversationScreen
            mineOnly
            channelFilter="INTERNAL"
            title="Messages"
            showHeader
          />
        )}
      </MessagesStack.Screen>
      <MessagesStack.Screen name="ConversationDetail" component={ConversationDetailScreen} />
    </MessagesStack.Navigator>
  );
}

const ProfileStack = createNativeStackNavigator();
function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
      <ProfileStack.Screen name="Subscription" component={SubscriptionScreen} />
      <ProfileStack.Screen name="SubscriptionCheckout" component={SubscriptionCheckoutScreen} />
      <ProfileStack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
    </ProfileStack.Navigator>
  );
}

const Tab = createBottomTabNavigator();

export function TechnicianNavigator() {
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
        name="Tickets"
        component={TicketsStackNavigator}
        options={{
          tabBarLabel: 'Tickets',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ticket-outline" size={size} color={color} />
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
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'Historique',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
