import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

import { DashboardScreen } from '@/screens/host/DashboardScreen';
import { NoiseMonitoringScreen } from '@/screens/host/NoiseMonitoringScreen';
import { AddNoiseDeviceScreen } from '@/screens/host/AddNoiseDeviceScreen';
import { NoiseAlertConfigScreen } from '@/screens/host/NoiseAlertConfigScreen';
import { NoiseDeviceDetailScreen } from '@/screens/host/NoiseDeviceDetailScreen';
import { PricingScreen } from '@/screens/host/PricingScreen';
import { ServiceRequestScreen } from '@/screens/host/ServiceRequestScreen';
import { AnalyticsScreen } from '@/screens/host/AnalyticsScreen';
import { ReservationsListScreen } from '@/screens/host/ReservationsListScreen';
import { InterventionsListScreen } from '@/screens/host/InterventionsListScreen';
import { PropertyListScreen } from '@/screens/host/PropertyListScreen';
import { PropertyDetailScreen } from '@/screens/host/PropertyDetailScreen';
import { PropertyOverviewScreen } from '@/screens/host/PropertyOverviewScreen';
import { PropertyInterventionsScreen } from '@/screens/host/PropertyInterventionsScreen';
import { PropertyChannelsScreen } from '@/screens/host/PropertyChannelsScreen';
import { PropertyInstructionsScreen } from '@/screens/host/PropertyInstructionsScreen';
import { ReservationCalendarScreen } from '@/screens/host/ReservationCalendarScreen';
import { RevenueReportsScreen } from '@/screens/host/RevenueReportsScreen';
import { PaymentHistoryScreen } from '@/screens/host/PaymentHistoryScreen';
import { PaymentCheckoutScreen } from '@/screens/host/PaymentCheckoutScreen';
import { MessagingScreen } from '@/screens/host/MessagingScreen';
import { MessageDetailScreen } from '@/screens/host/MessageDetailScreen';
import { ProfileScreen } from '@/screens/common/ProfileScreen';
import { ProfileDetailScreen } from '@/screens/common/ProfileDetailScreen';
import { SubscriptionScreen } from '@/screens/common/SubscriptionScreen';
import { SubscriptionCheckoutScreen } from '@/screens/common/SubscriptionCheckoutScreen';
import { DeleteAccountScreen } from '@/screens/common/DeleteAccountScreen';
import { ConversationDetailScreen } from '@/screens/shared/ConversationDetailScreen';
import { HostSettingsScreen } from '@/screens/host/HostSettingsScreen';
import { TeamManagementScreen } from '@/screens/host/TeamManagementScreen';
import { ReviewsScreen } from '@/screens/host/ReviewsScreen';
import type { ContactMessage } from '@/api/endpoints/contactApi';

export type DashboardStackParamList = {
  DashboardHome: undefined;
  NoiseMonitoring: undefined;
  AddNoiseDevice: undefined;
  NoiseDeviceDetail: {
    deviceId: number;
    deviceName: string;
    deviceType: string;
    deviceStatus: string;
    propertyId: number;
    propertyName: string;
    roomName: string | null;
  };
  NoiseAlertConfig: { propertyId: number; propertyName: string };
  Pricing: undefined;
  ServiceRequests: undefined;
  ReservationsList: undefined;
  InterventionsList: undefined;
  PaymentCheckout: { interventionId: number };
  Analytics: undefined;
  Reviews: undefined;
};

export type PropertiesStackParamList = {
  PropertyList: undefined;
  PropertyDetail: { propertyId: number };
  PropertyOverview: { propertyId: number };
  PropertyInterventions: { propertyId: number };
  PropertyChannels: { propertyId: number };
  PropertyInstructions: { propertyId: number };
};

export type MessagingStackParamList = {
  MessageList: undefined;
  MessageDetail: { message: ContactMessage; isSent: boolean };
  ConversationDetail: { conversationId: number };
};

export type MoreStackParamList = {
  MoreMenu: undefined;
  ProfileDetail: undefined;
  Subscription: undefined;
  SubscriptionCheckout: { forfait: string };
  Reports: undefined;
  PaymentHistory: undefined;
  DeleteAccount: undefined;
  Settings: undefined;
  TeamManagement: undefined;
};

const DashboardStack = createNativeStackNavigator<DashboardStackParamList>();
function DashboardStackNavigator() {
  return (
    <DashboardStack.Navigator screenOptions={{ headerShown: false }}>
      <DashboardStack.Screen name="DashboardHome" component={DashboardScreen} />
      <DashboardStack.Screen name="NoiseMonitoring" component={NoiseMonitoringScreen} />
      <DashboardStack.Screen name="AddNoiseDevice" component={AddNoiseDeviceScreen} />
      <DashboardStack.Screen name="NoiseDeviceDetail" component={NoiseDeviceDetailScreen} />
      <DashboardStack.Screen name="NoiseAlertConfig" component={NoiseAlertConfigScreen} />
      <DashboardStack.Screen name="Pricing" component={PricingScreen} />
      <DashboardStack.Screen name="ServiceRequests" component={ServiceRequestScreen} />
      <DashboardStack.Screen name="ReservationsList" component={ReservationsListScreen} />
      <DashboardStack.Screen name="InterventionsList" component={InterventionsListScreen} />
      <DashboardStack.Screen name="PaymentCheckout" component={PaymentCheckoutScreen} />
      <DashboardStack.Screen name="Analytics" component={AnalyticsScreen} />
      <DashboardStack.Screen name="Reviews" component={ReviewsScreen} />
    </DashboardStack.Navigator>
  );
}

const PropertiesStack = createNativeStackNavigator<PropertiesStackParamList>();
function PropertiesStackNavigator() {
  return (
    <PropertiesStack.Navigator screenOptions={{ headerShown: false }}>
      <PropertiesStack.Screen name="PropertyList" component={PropertyListScreen} />
      <PropertiesStack.Screen name="PropertyDetail" component={PropertyDetailScreen} />
      <PropertiesStack.Screen name="PropertyOverview" component={PropertyOverviewScreen} />
      <PropertiesStack.Screen name="PropertyInterventions" component={PropertyInterventionsScreen} />
      <PropertiesStack.Screen name="PropertyChannels" component={PropertyChannelsScreen} />
      <PropertiesStack.Screen name="PropertyInstructions" component={PropertyInstructionsScreen} />
    </PropertiesStack.Navigator>
  );
}

const MessagingStack = createNativeStackNavigator<MessagingStackParamList>();
function MessagingStackNavigator() {
  return (
    <MessagingStack.Navigator screenOptions={{ headerShown: false }}>
      <MessagingStack.Screen name="MessageList" component={MessagingScreen} />
      <MessagingStack.Screen name="MessageDetail" component={MessageDetailScreen} />
      <MessagingStack.Screen name="ConversationDetail" component={ConversationDetailScreen} />
    </MessagingStack.Navigator>
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
      <MoreStack.Screen name="Reports" component={RevenueReportsScreen} />
      <MoreStack.Screen name="PaymentHistory" component={PaymentHistoryScreen} />
      <MoreStack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <MoreStack.Screen name="Settings" component={HostSettingsScreen} />
      <MoreStack.Screen name="TeamManagement" component={TeamManagementScreen} />
    </MoreStack.Navigator>
  );
}

const Tab = createBottomTabNavigator();

export function HostNavigator() {
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary.main,
        tabBarInactiveTintColor: theme.colors.text.disabled,
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
        name="Dashboard"
        component={DashboardStackNavigator}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Properties"
        component={PropertiesStackNavigator}
        options={{
          tabBarLabel: 'Proprietes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={ReservationCalendarScreen}
        options={{
          tabBarLabel: 'Calendrier',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Messaging"
        component={MessagingStackNavigator}
        options={{
          tabBarLabel: 'Messages',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size} color={color} />
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
