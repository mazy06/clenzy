// ─── Barrel Export ─ API Services ────────────────────────────────────────────

export { authApi } from './authApi';
export type { AuthUser } from './authApi';

export { contactApi } from './contactApi';
export type { ContactMessage, ContactFormData, Recipient } from './contactApi';

export { interventionsApi } from './interventionsApi';
export type {
  Intervention,
  InterventionFormData,
  InterventionListParams,
} from './interventionsApi';

export { paymentsApi } from './paymentsApi';
export type { PaymentSession, PaymentSessionStatus, PaymentRecord, PaymentSummary, HostOption } from './paymentsApi';

export { permissionsApi } from './permissionsApi';
export type { RolePermissions } from './permissionsApi';

export { portfoliosApi, managersApi, portfoliosKeys } from './portfoliosApi';
export type {
  PortfolioStats,
  ManagerAssociations,
  Manager,
  HostClient,
  PortfolioTeam,
  OperationalUser,
  AssignmentProperty,
  AssignResult,
} from './portfoliosApi';

export { propertiesApi } from './propertiesApi';
export type { Property, PropertyFormData } from './propertiesApi';

export { serviceRequestsApi } from './serviceRequestsApi';
export type { ServiceRequest, ServiceRequestFormData } from './serviceRequestsApi';

export { teamsApi } from './teamsApi';
export type { TeamMember, Team, TeamFormData, CoverageZone } from './teamsApi';

export { banApi } from '../banApi';
export type { BanAddress, BanFeature, BanResponse } from '../banApi';

export { usersApi } from './usersApi';
export type { User, UserFormData } from './usersApi';

export { notificationsApi } from './notificationsApi';
export type { Notification, UnreadCountResponse } from './notificationsApi';

export { reservationsApi } from './reservationsApi';
export type {
  Reservation,
  ReservationStatus,
  ReservationSource,
  ReservationFilters,
  PlanningIntervention,
  PlanningInterventionType,
  PlanningInterventionStatus,
} from './reservationsApi';

export { reportsApi } from './reportsApi';
export type {
  ChartDataItem,
  MonthlyInterventionData,
  PropertyStatData,
  TeamPerformanceData,
  FinancialMonthlyData,
  InterventionReportData,
  PropertyReportData,
  TeamReportData,
  FinancialReportData,
} from './reportsApi';

export { pricingConfigApi } from './pricingConfigApi';
export type { PricingConfig, PricingConfigUpdate, SurfaceTier } from './pricingConfigApi';

export { iCalApi } from './iCalApi';
export type {
  ICalEventPreview,
  ICalPreviewRequest,
  ICalImportRequest,
  ICalPreviewResponse,
  ICalImportResponse,
  ICalFeed,
  ICalAccessCheck,
} from './iCalApi';

export { notificationPreferencesApi } from './notificationPreferencesApi';
export type { NotificationPreferencesMap } from './notificationPreferencesApi';

export { deferredPaymentsApi } from './deferredPaymentsApi';
export type {
  HostBalanceSummary,
  PropertyBalance,
  UnpaidIntervention,
  PaymentLinkResponse,
} from './deferredPaymentsApi';

export { documentsApi } from './documentsApi';
export type {
  DocumentTemplate,
  DocumentTemplateTag,
  DocumentGeneration,
  GenerateDocumentRequest,
  DocumentTypeOption,
  TagCategoryOption,
} from './documentsApi';

export { propertyTeamsApi, propertyTeamsKeys } from './propertyTeamsApi';
export type { PropertyTeamMapping } from './propertyTeamsApi';

export { noiseDevicesApi, minutApi, tuyaApi } from './noiseApi';
export type {
  NoiseDeviceDto,
  CreateNoiseDeviceDto,
  NoiseDataPointDto,
  DeviceSummary,
  NoiseChartDataDto,
  MinutConnectionStatus,
  TuyaConnectionStatus,
} from './noiseApi';
