import { useAuth } from './useAuth';

/** Les données commerciales ne sont jamais réutilisées entre deux sessions ou organisations. */
export function useCommerceScope() {
  const { user } = useAuth();
  return user?.id && user.organizationId ? `${user.id}:${user.organizationId}` : null;
}
