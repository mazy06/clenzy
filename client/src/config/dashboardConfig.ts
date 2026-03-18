/**
 * Dashboard tab visibility per role.
 * Each tab defines which roles can see it.
 */

export interface DashboardTabConfig {
  key: string;
  labelKey: string;
  iconName: string; // MUI icon name as string — resolved in Dashboard.tsx
  roles: string[];
}

export const DASHBOARD_TABS: DashboardTabConfig[] = [
  {
    key: 'overview',
    labelKey: 'dashboard.tabs.overview',
    iconName: 'Dashboard',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST', 'SUPERVISOR', 'TECHNICIAN', 'HOUSEKEEPER', 'LAUNDRY', 'EXTERIOR_TECH'],
  },
  {
    key: 'noise',
    labelKey: 'dashboard.tabs.noise',
    iconName: 'VolumeUp',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST'],
  },
  {
    key: 'smartlock',
    labelKey: 'dashboard.tabs.smartLock',
    iconName: 'Lock',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST'],
  },
  {
    key: 'keyexchange',
    labelKey: 'dashboard.tabs.keyExchange',
    iconName: 'Key',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST'],
  },
  {
    key: 'simulator',
    labelKey: 'dashboard.tabs.simulator',
    iconName: 'Analytics',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST', 'SUPERVISOR'],
  },
];

/** Filter tabs visible for a given role */
export function getVisibleTabs(role: string): DashboardTabConfig[] {
  return DASHBOARD_TABS.filter((tab) => tab.roles.includes(role));
}
