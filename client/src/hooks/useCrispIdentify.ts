import { useEffect } from 'react';
import { useAuth } from './useAuth';

/**
 * Crisp chat widget user identification hook.
 * Pushes user metadata to the Crisp widget for contextual support.
 *
 * Call this once in App.tsx after authentication.
 * Requires VITE_CRISP_WEBSITE_ID to be set.
 */
export function useCrispIdentify() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;

    const $crisp = (window as any).$crisp;
    if (!$crisp) return;

    // Identify user in Crisp
    $crisp.push(['set', 'user:email', [user.email]]);
    $crisp.push(['set', 'user:nickname', [user.fullName || user.username]]);

    // Set session data for support context
    const sessionData: [string, string][] = [
      ['role', user.platformRole || user.roles?.[0] || 'unknown'],
      ['plan', user.forfait || 'unknown'],
    ];

    if (user.organizationName) {
      sessionData.push(['organization', user.organizationName]);
    }
    if (user.organizationId) {
      sessionData.push(['organization_id', String(user.organizationId)]);
    }

    $crisp.push(['set', 'session:data', sessionData]);
  }, [user, loading]);
}
