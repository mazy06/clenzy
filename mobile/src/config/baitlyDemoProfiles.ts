import { useBaitlyDemoProfile } from './baitlyDemoProfileState';
export { useBaitlyDemoProfile } from './baitlyDemoProfileState';
export type { BaitlyDemoProfileKey } from './baitlyDemoProfileState';
import { useAuthStore, type AuthUser } from '@/store/authStore';
import { canUseBaitlyDemo, useBaitlyDataMode, baitlyDataMode } from './baitlyDataMode';
import type { MobileCapabilities } from '@/features/missions/api';

export const baitlyDemoProfiles = [
  { key: 'concierge', label: 'Conciergerie', firstName: 'Nadia', lastName: 'Benali', organizationName: 'Maison Safran · Démo', role: 'HOST', organizationType: 'CONCIERGE', owner: true, quote: true, execute: true, network: true },
  { key: 'owner', label: 'Propriétaire', firstName: 'Lina', lastName: 'Martin', organizationName: 'Les logements de Lina · Démo', role: 'HOST', organizationType: 'INDIVIDUAL', owner: true, quote: false, execute: false, network: false },
  { key: 'cleaning', label: 'Prestataire ménage', firstName: 'Salma', lastName: 'Amrani', organizationName: 'Ménage Médina · Démo', role: 'HOUSEKEEPER', organizationType: 'CLEANING_COMPANY', owner: false, quote: true, execute: true, network: false },
  { key: 'maintenance', label: 'Prestataire maintenance', firstName: 'Amine', lastName: 'Idrissi', organizationName: 'Riad Services · Démo', role: 'TECHNICIAN', organizationType: 'SERVICE_PROVIDER', owner: false, quote: true, execute: true, network: false },
  { key: 'laundry', label: 'Prestataire blanchisserie', firstName: 'Inès', lastName: 'Haddad', organizationName: 'Linge Atlas · Démo', role: 'LAUNDRY', organizationType: 'SERVICE_PROVIDER', owner: false, quote: true, execute: true, network: false },
  { key: 'exterior', label: 'Prestataire jardin et piscine', firstName: 'Youssef', lastName: 'Alaoui', organizationName: 'Jardins de l’Atlas · Démo', role: 'EXTERIOR_TECH', organizationType: 'SERVICE_PROVIDER', owner: false, quote: true, execute: true, network: false },
] as const;
export function selectedDemoProfile() {
  if (baitlyDataMode() !== 'demo') return undefined;
  return baitlyDemoProfiles.find(profile => profile.key === useBaitlyDemoProfile.getState().key);
}
export function demoProfileCapabilities(): MobileCapabilities | undefined {
  const profile = selectedDemoProfile();
  return profile ? { canViewOwnerSpace: profile.owner, canQuote: profile.quote, canExecuteAssignedMission: profile.execute, canManagePrivateNetwork: profile.network } : undefined;
}
/** Visual preview only: never modifies credentials or the authenticated user. */
export function useBaitlyUser(): AuthUser | null {
  const real = useAuthStore(state => state.user);
  const mode = useBaitlyDataMode(state => state.mode);
  const key = useBaitlyDemoProfile(state => state.key);
  const profile = canUseBaitlyDemo() && mode === 'demo' ? baitlyDemoProfiles.find(item => item.key === key) : undefined;
  return profile ? { id: `demo-${profile.key}`, username: profile.firstName, firstName: profile.firstName, lastName: profile.lastName,
    fullName: `${profile.firstName} ${profile.lastName}`, email: `${profile.key}@demo.example`, roles: [profile.role], permissions: [],
    organizationId: -200 - baitlyDemoProfiles.indexOf(profile), organizationName: profile.organizationName, organizationType: profile.organizationType } : real;
}
