import type React from 'react';
import type { PaymentRecord } from '@/api/endpoints/paymentsApi';
import type { Invoice } from '@/screens/host/InvoiceListScreen';
import { ReservationsListScreen } from '@/screens/host/ReservationsListScreen';
import { PropertyDetailScreen } from '@/screens/host/PropertyDetailScreen';
import { PropertyOverviewScreen } from '@/screens/host/PropertyOverviewScreen';
import { PropertyInterventionsScreen } from '@/screens/host/PropertyInterventionsScreen';
import { PropertyChannelsScreen } from '@/screens/host/PropertyChannelsScreen';
import { PropertyInstructionsScreen } from '@/screens/host/PropertyInstructionsScreen';
import { PropertyInstructionsEditScreen } from '@/screens/host/PropertyInstructionsEditScreen';
import { PropertyEditScreen } from '@/screens/host/PropertyEditScreen';
import { PropertyPhotosManageScreen } from '@/screens/host/PropertyPhotosManageScreen';
import { PropertyAmenitiesEditScreen } from '@/screens/host/PropertyAmenitiesEditScreen';
import { RatePlanManagementScreen } from '@/screens/host/RatePlanManagementScreen';
import { PricingScreen } from '@/screens/host/PricingScreen';
import { SmartLockScreen } from '@/screens/host/SmartLockScreen';
import TuyaPairingScreen from '@/screens/host/TuyaPairingScreen';
import { NoiseMonitoringScreen } from '@/screens/host/NoiseMonitoringScreen';
import { AddNoiseDeviceScreen } from '@/screens/host/AddNoiseDeviceScreen';
import { NoiseDeviceDetailScreen } from '@/screens/host/NoiseDeviceDetailScreen';
import { NoiseAlertConfigScreen } from '@/screens/host/NoiseAlertConfigScreen';
import { ReviewsScreen } from '@/screens/host/ReviewsScreen';
import { AnalyticsScreen } from '@/screens/host/AnalyticsScreen';
import { AnalyticsExportScreen } from '@/screens/host/AnalyticsExportScreen';
import { PaymentHistoryScreen } from '@/screens/host/PaymentHistoryScreen';
import { PaymentDetailScreen } from '@/screens/host/PaymentDetailScreen';
import { BillingDashboardScreen } from '@/screens/host/BillingDashboardScreen';
import { InvoiceListScreen } from '@/screens/host/InvoiceListScreen';
import { InvoiceDetailScreen } from '@/screens/host/InvoiceDetailScreen';
import { OwnerPayoutsScreen } from '@/screens/host/OwnerPayoutsScreen';
import { OwnerPayoutDetailScreen } from '@/screens/host/OwnerPayoutDetailScreen';
import { GeneratePayoutScreen } from '@/screens/host/GeneratePayoutScreen';
import { PayoutStatsScreen } from '@/screens/host/PayoutStatsScreen';
import { SendOwnerStatementScreen } from '@/screens/host/SendOwnerStatementScreen';
import { DocumentsScreen } from '@/screens/host/DocumentsScreen';
import { DocumentDetailScreen } from '@/screens/host/DocumentDetailScreen';
import { DocumentGenerateScreen } from '@/screens/host/DocumentGenerateScreen';
import { HostSettingsScreen } from '@/screens/host/HostSettingsScreen';
import { TeamManagementScreen } from '@/screens/host/TeamManagementScreen';
import { UserListScreen } from '@/screens/admin/UserListScreen';
import { UserDetailScreen } from '@/screens/admin/UserDetailScreen';
import { UserEditScreen } from '@/screens/admin/UserEditScreen';
import { InviteMemberScreen } from '@/screens/admin/InviteMemberScreen';
import { SubscriptionScreen } from '@/screens/common/SubscriptionScreen';
import { SubscriptionCheckoutScreen } from '@/screens/common/SubscriptionCheckoutScreen';
import { DeleteAccountScreen } from '@/screens/common/DeleteAccountScreen';
import { MyRatesScreen } from '@/screens/shared/MyRatesScreen';
import { MyPayoutsScreen } from '@/screens/shared/MyPayoutsScreen';
import { MyIssuesScreen } from '@/screens/shared/MyIssuesScreen';

/** Routes of the management space (owners and concierges). Names are kept from the former host navigator. */
export type BaitlyManagementParams = {
  ReservationsList: undefined;
  PropertyDetail: { propertyId: number };
  PropertyOverview: { propertyId: number };
  PropertyInterventions: { propertyId: number };
  PropertyChannels: { propertyId: number };
  PropertyInstructions: { propertyId: number };
  PropertyInstructionsEdit: { propertyId: number };
  PropertyEdit: { propertyId: number };
  PropertyPhotosManage: { propertyId: number };
  PropertyAmenitiesEdit: { propertyId: number };
  PropertyRatePlans: { propertyId: number; propertyName: string };
  RatePlanManagement: { propertyId: number; propertyName: string };
  Pricing: undefined;
  SmartLocks: undefined;
  TuyaPairing: undefined;
  NoiseMonitoring: undefined;
  AddNoiseDevice: undefined;
  NoiseDeviceDetail: { deviceId: number; deviceName: string; deviceType: string; deviceStatus: string; propertyId: number; propertyName: string; roomName: string | null };
  NoiseAlertConfig: { propertyId: number; propertyName: string };
  Reviews: undefined;
  Analytics: undefined;
  AnalyticsExport: undefined;
  PaymentHistory: undefined;
  PaymentDetail: { paymentId: number; payment: PaymentRecord };
  BillingDashboard: undefined;
  InvoiceList: undefined;
  InvoiceDetail: { invoiceId: number; invoice: Invoice };
  Documents: undefined;
  DocumentDetail: { documentId: number };
  DocumentGenerate: undefined;
  Subscription: undefined;
  SubscriptionCheckout: { forfait: string };
};
/** Concierge-only routes: the business run for other owners. */
export type BaitlyConciergeParams = {
  OwnerPayouts: undefined;
  OwnerPayoutDetail: { id: number };
  GeneratePayout: undefined;
  PayoutStats: undefined;
  SendOwnerStatement: { ownerId: number; ownerName?: string; ownerEmail?: string };
  Settings: undefined;
  TeamManagement: undefined;
};
/** Platform administration: the server restricts users and invitations to platform staff. */
export type BaitlyAdminParams = { UserList: undefined; UserDetail: { userId: number }; UserEdit: { userId: number }; InviteMember: undefined };
/** Field routes: what a provider earns and reports. */
export type BaitlyProviderParams = { MyRates: undefined; MyPayouts: undefined; MyIssues: undefined };
/** Every signed-in person can close their account. */
export type BaitlyCommonParams = { DeleteAccount: undefined };
export const commonScreens: Screens<BaitlyCommonParams> = { DeleteAccount: DeleteAccountScreen };

type Screens<T> = Record<keyof T, React.ComponentType<any>>;
export const managementScreens: Screens<BaitlyManagementParams> = {
  ReservationsList: ReservationsListScreen,
  PropertyDetail: PropertyDetailScreen, PropertyOverview: PropertyOverviewScreen, PropertyInterventions: PropertyInterventionsScreen,
  PropertyChannels: PropertyChannelsScreen, PropertyInstructions: PropertyInstructionsScreen, PropertyInstructionsEdit: PropertyInstructionsEditScreen,
  PropertyEdit: PropertyEditScreen, PropertyPhotosManage: PropertyPhotosManageScreen, PropertyAmenitiesEdit: PropertyAmenitiesEditScreen,
  PropertyRatePlans: RatePlanManagementScreen, RatePlanManagement: RatePlanManagementScreen, Pricing: PricingScreen,
  SmartLocks: SmartLockScreen, TuyaPairing: TuyaPairingScreen,
  NoiseMonitoring: NoiseMonitoringScreen, AddNoiseDevice: AddNoiseDeviceScreen, NoiseDeviceDetail: NoiseDeviceDetailScreen, NoiseAlertConfig: NoiseAlertConfigScreen,
  Reviews: ReviewsScreen, Analytics: AnalyticsScreen, AnalyticsExport: AnalyticsExportScreen,
  PaymentHistory: PaymentHistoryScreen, PaymentDetail: PaymentDetailScreen, BillingDashboard: BillingDashboardScreen,
  InvoiceList: InvoiceListScreen, InvoiceDetail: InvoiceDetailScreen,
  Documents: DocumentsScreen, DocumentDetail: DocumentDetailScreen, DocumentGenerate: DocumentGenerateScreen,
  Subscription: SubscriptionScreen, SubscriptionCheckout: SubscriptionCheckoutScreen,
};
export const conciergeScreens: Screens<BaitlyConciergeParams> = {
  OwnerPayouts: OwnerPayoutsScreen, OwnerPayoutDetail: OwnerPayoutDetailScreen, GeneratePayout: GeneratePayoutScreen,
  PayoutStats: PayoutStatsScreen, SendOwnerStatement: SendOwnerStatementScreen, Settings: HostSettingsScreen,
  TeamManagement: TeamManagementScreen,
};
export const adminScreens: Screens<BaitlyAdminParams> = { UserList: UserListScreen, UserDetail: UserDetailScreen, UserEdit: UserEditScreen, InviteMember: InviteMemberScreen };
export const providerScreens: Screens<BaitlyProviderParams> = { MyRates: MyRatesScreen, MyPayouts: MyPayoutsScreen, MyIssues: MyIssuesScreen };
