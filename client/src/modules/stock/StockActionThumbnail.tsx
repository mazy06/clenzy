import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { propertyStockApi } from '../../services/api/propertyStockApi';
import { StockThumbnail } from './StockThumbnail';

export function StockActionThumbnail({ stockItemId, name, size = 80 }: { stockItemId?: unknown; name: string; size?: number }) {
  return typeof stockItemId === 'number' && Number.isSafeInteger(stockItemId) && stockItemId > 0
    ? <ConnectedStockThumbnail stockItemId={stockItemId} name={name} size={size} />
    : <StockThumbnail name={name} size={size} />;
}

function ConnectedStockThumbnail({ stockItemId, name, size }: { stockItemId: number; name: string; size: number }) {
  const { user, loading } = useAuth();
  const { data } = useQuery({
    queryKey: ['stock-visual', user?.id, user?.organizationId, stockItemId],
    queryFn: () => propertyStockApi.visual(stockItemId),
    enabled: !!user && !loading,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return <StockThumbnail name={data?.name ?? name} catalogKey={data?.catalogKey} photoUrl={data?.photoUrl} size={size} />;
}
