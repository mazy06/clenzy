import { useQuery } from '@tanstack/react-query';
import { useBaitlyScope } from '@/features/marketplace/queries';
import { workApi } from './api';
import { useAuthStore } from '@/store/authStore';
import { demoProfileCapabilities } from '@/config/baitlyDemoProfiles';
export function useCapabilities() {
  const scope = useBaitlyScope();
  const authenticated = useAuthStore(s => s.isAuthenticated);
  return useQuery({ queryKey: [...scope, 'capabilities'], queryFn: ({ signal }) => {
    const demo = demoProfileCapabilities();
    return demo ? Promise.resolve(demo) : workApi.capabilities(signal);
  }, retry: false, enabled: authenticated });
}
