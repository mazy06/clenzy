import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useCommerceScope } from '../../hooks/useCommerceScope';
import { upsellApi } from '../../services/api/upsellApi';

/** Le catalogue et les réservations partagent les ventes du seul contexte commercial courant. */
export function usePaidServiceOrders() {
  const scope = useCommerceScope();
  const { hasAnyRole } = useAuth();
  const available = !!scope && hasAnyRole(['HOST', 'SUPER_ADMIN', 'SUPER_MANAGER']);
  const query = useQuery({
    queryKey: ['upsell-orders', scope],
    queryFn: () => upsellApi.listOrders(),
    enabled: available,
  });
  return { ...query, data: available ? query.data : undefined, available };
}
