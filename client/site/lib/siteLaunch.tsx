import { createContext, useContext, type ReactNode } from 'react';
import { usePublicLaunchStatus } from '../../src/hooks/usePublicLaunchStatus';

const SiteLaunchContext = createContext<ReturnType<
  typeof usePublicLaunchStatus
> | null>(null);

export function SiteLaunchProvider({ children }: { children: ReactNode }) {
  const launch = usePublicLaunchStatus();
  return (
    <SiteLaunchContext.Provider value={launch}>
      {children}
    </SiteLaunchContext.Provider>
  );
}

export function useSiteLaunch() {
  const launch = useContext(SiteLaunchContext);
  if (!launch) throw new Error('useSiteLaunch requires SiteLaunchProvider');
  return launch;
}
