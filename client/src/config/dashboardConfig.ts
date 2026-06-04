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
  // Les services « objets connectés » (bruit, serrures, clés) ont migré vers le
  // Hub /connected-objects (écran unique groupé par logement). Les vues riches
  // restent accessibles via /connected-objects/{noise,locks,keys}.
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
