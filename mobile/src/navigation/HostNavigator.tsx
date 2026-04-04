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
import { SmartLockScreen } from '@/screens/host/SmartLockScreen';
import { RatePlanManagementScreen } from '@/screens/host/RatePlanManagementScreen';
import { ReservationDetailScreen } from '@/screens/host/ReservationDetailScreen';
import { ReservationEditScreen } from '@/screens/host/ReservationEditScreen';
import { InternalChatScreen } from '@/screens/host/InternalChatScreen';
import { PropertyEditScreen } from '@/screens/host/PropertyEditScreen';
import { PropertyPhotosManageScreen } from '@/screens/host/PropertyPhotosManageScreen';
import { PropertyAmenitiesEditScreen } from '@/screens/host/PropertyAmenitiesEditScreen';
import { PropertyInstructionsEditScreen } from '@/screens/host/PropertyInstructionsEditScreen';
import { DocumentsScreen } from '@/screens/host/DocumentsScreen';
import { DocumentDetailScreen } from '@/screens/host/DocumentDetailScreen';
import { DocumentGenerateScreen } from '@/screens/host/DocumentGenerateScreen';
import { PdfViewerScreen } from '@/screens/shared/PdfViewerScreen';
import { BillingDashboardScreen } from '@/screens/host/BillingDashboardScreen';
import { PaymentDetailScreen } from '@/screens/host/PaymentDetailScreen';
import { InvoiceListScreen } from '@/screens/host/InvoiceListScreen';
import { InvoiceDetailScreen } from '@/screens/host/InvoiceDetailScreen';
import { AnalyticsExportScreen } from '@/screens/host/AnalyticsExportScreen';
import { MessageTemplatesScreen } from '@/screens/shared/MessageTemplatesScreen';
import { UserListScreen } from '@/screens/admin/UserListScreen';
import { UserDetailScreen } from '@/screens/admin/UserDetailScreen';
import { UserEditScreen } from '@/screens/admin/UserEditScreen';
import { InviteMemberScreen } from '@/screens/admin/InviteMemberScreen';
import type { ContactMessage, ContactThreadSummary } from '@/api/endpoints/contactApi';
import type { PaymentRecord } from '@/api/endpoints/paymentsApi';
import type { Invoice } from '@/screens/host/InvoiceListScreen';

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
  ReservationDetail: { reservationId: number };
  ReservationEdit: { reservationId: number };
  InterventionsList: undefined;
  PaymentCheckout: { interventionId: number };
  Analytics: undefined;
  AnalyticsExport: undefined;
  Reviews: undefined;
  SmartLocks: undefined;
  RatePlanManagement: { propertyId: number; propertyName: string };
};

export type PropertiesStackParamList = {
  PropertyList: undefined;
  PropertyDetail: { propertyId: number };
  PropertyOverview: { propertyId: number };
  PropertyInterventions: { propertyId: number };
  PropertyChannels: { propertyId: number };
  PropertyInstructions: { propertyId: number };
  PropertyRatePlans: { propertyId: number; propertyName: string };
  PropertyEdit: { propertyId: number };
  PropertyPhotosManage: { propertyId: number };
  PropertyAmenitiesEdit: { propertyId: number };
  PropertyInstructionsEdit: { propertyId: number };
};

export type MessagingStackParamList = {
  MessageList: undefined;
  MessageDetail: { message: ContactMessage; isSent: boolean };
  InternalChat: { thread: ContactThreadSummary };
  ConversationDetail: { conversationId: number };
  MessageTemplates: undefined;
};

export type CalendarStackParamList = {
  CalendarHome: undefined;
  ReservationDetail: { reservationId: number };
  ReservationEdit: { reservationId: number };
};

export type MoreStackParamList = {
  MoreMenu: undefined;
  ProfileDetail: undefined;
  Subscription: undefined;
  SubscriptionCheckout: { forfait: string };
  Reports: undefined;
  PaymentHistory: undefined;
  BillingDashboard: undefined;
  PaymentDetail: { paymentId: number; payment: PaymentRecord };
  InvoiceList: undefined;
  InvoiceDetail: { invoiceId: number; invoice: Invoice };
  Documents: undefined;
  DocumentDetail: { documentId: number };
  DocumentGenerate: undefined;
  PdfViewer: { uri: string; title?: string };
  DeleteAccount: undefined;
  Settings: undefined;
  TeamManagement: undefined;
  UserList: undefined;
  UserDetail: { userId: number };
  UserEdit: { userId: number };
  InviteMember: undefined;
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
      <DashboardStack.Screen name="ReservationDetail" component={ReservationDetailScreen} />
      <DashboardStack.Screen name="ReservationEdit" component={ReservationEditScreen} />
      <DashboardStack.Screen name="InterventionsList" component={InterventionsListScreen} />
      <DashboardStack.Screen name="PaymentCheckout" component={PaymentCheckoutScreen} />
      <DashboardStack.Screen name="Analytics" component={AnalyticsScreen} />
      <DashboardStack.Screen name="AnalyticsExport" component={AnalyticsExportScreen} />
      <DashboardStack.Screen name="Reviews" component={ReviewsScreen} />
      <DashboardStack.Screen name="SmartLocks" component={SmartLockScreen} />
      <DashboardStack.Screen name="RatePlanManagement" component={RatePlanManagementScreen} />
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
      <PropertiesStack.Screen name="PropertyRatePlans" component={RatePlanManagementScreen} />
      <PropertiesStack.Screen name="PropertyEdit" component={PropertyEditScreen} />
      <PropertiesStack.Screen name="PropertyPhotosManage" component={PropertyPhotosManageScreen} />
      <PropertiesStack.Screen name="PropertyAmenitiesEdit" component={PropertyAmenitiesEditScreen} />
      <PropertiesStack.Screen name="PropertyInstructionsEdit" component={PropertyInstructionsEditScreen} />
    </PropertiesStack.Navigator>
  );
}

const CalendarStack = createNativeStackNavigator<CalendarStackParamList>();
function CalendarStackNavigator() {
  return (
    <CalendarStack.Navigator screenOptions={{ headerShown: false }}>
      <CalendarStack.Screen name="CalendarHome" component={ReservationCalendarScreen} />
      <CalendarStack.Screen name="ReservationDetail" component={ReservationDetailScreen} />
      <CalendarStack.Screen name="ReservationEdit" component={ReservationEditScreen} />
    </CalendarStack.Navigator>
  );
}

const MessagingStack = createNativeStackNavigator<MessagingStackParamList>();
function MessagingStackNavigator() {
  return (
    <MessagingStack.Navigator screenOptions={{ headerShown: false }}>
      <MessagingStack.Screen name="MessageList" component={MessagingScreen} />
      <MessagingStack.Screen name="MessageDetail" component={MessageDetailScreen} />
      <MessagingStack.Screen name="InternalChat" component={InternalChatScreen} />
      <MessagingStack.Screen name="ConversationDetail" component={ConversationDetailScreen} />
      <MessagingStack.Screen name="MessageTemplates" component={MessageTemplatesScreen} />
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
      <MoreStack.Screen name="BillingDashboard" component={BillingDashboardScreen} />
      <MoreStack.Screen name="PaymentDetail" component={PaymentDetailScreen} />
      <MoreStack.Screen name="InvoiceList" component={InvoiceListScreen} />
      <MoreStack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />
      <MoreStack.Screen name="Documents" component={DocumentsScreen} />
      <MoreStack.Screen name="DocumentDetail" component={DocumentDetailScreen} />
      <MoreStack.Screen name="DocumentGenerate" component={DocumentGenerateScreen} />
      <MoreStack.Screen name="PdfViewer" component={PdfViewerScreen} />
      <MoreStack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <MoreStack.Screen name="Settings" component={HostSettingsScreen} />
      <MoreStack.Screen name="TeamManagement" component={TeamManagementScreen} />
      <MoreStack.Screen name="UserList" component={UserListScreen} />
      <MoreStack.Screen name="UserDetail" component={UserDetailScreen} />
      <MoreStack.Screen name="UserEdit" component={UserEditScreen} />
      <MoreStack.Screen name="InviteMember" component={InviteMemberScreen} />
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
        component={CalendarStackNavigator}
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
