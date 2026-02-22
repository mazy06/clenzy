import type { ChipColor } from '../../../types';
import type { HostBalanceSummary, LockoutStatus } from '../../../services/api';

export interface UserDetailsData {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
  // Profil host
  companyName?: string;
  forfait?: string;
  city?: string;
  postalCode?: string;
  propertyType?: string;
  propertyCount?: number;
  surface?: number;
  guestCapacity?: number;
  // Donnees supplementaires du formulaire de devis
  bookingFrequency?: string;
  cleaningSchedule?: string;
  calendarSync?: string;
  services?: string;
  servicesDevis?: string;
  deferredPayment?: boolean;
  // Organisation
  organizationId?: number;
  organizationName?: string;
}

export interface RoleInfo {
  value: string;
  label: string;
  icon: React.ReactElement;
  color: ChipColor;
}

export interface StatusInfo {
  value: string;
  label: string;
  color: ChipColor;
}

export interface UseUserDetailsReturn {
  user: UserDetailsData | null;
  loading: boolean;
  error: string | null;
  canManageUsers: boolean;
  // Deferred payment state
  balance: HostBalanceSummary | null;
  balanceLoading: boolean;
  deferredToggling: boolean;
  paymentLinkLoading: boolean;
  expandedProperty: number | null;
  setExpandedProperty: (id: number | null) => void;
  // Lockout state
  lockoutStatus: LockoutStatus | null;
  lockoutLoading: boolean;
  unlocking: boolean;
  // Snackbar
  snackMessage: string;
  setSnackMessage: (msg: string) => void;
  // Handlers
  handleToggleDeferredPayment: () => Promise<void>;
  handleSendPaymentLink: () => Promise<void>;
  handleUnlockUser: () => Promise<void>;
}

export function getRoleInfo(role: string, roles: RoleInfo[]): RoleInfo {
  return roles.find(r => r.value === role) || roles[0];
}

export function getStatusInfo(status: string, statuses: StatusInfo[]): StatusInfo {
  return statuses.find(s => s.value === status) || statuses[0];
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
