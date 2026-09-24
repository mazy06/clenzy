import type { ReactNode } from 'react';
import EmptyState from '../../components/EmptyState';
import PagePagination from '../../components/PagePagination';
import { Alert, AlertDescription } from '../../components/ui';
import { DirectoryResults } from '../../components/catalog/DirectoryCard';
import { PersonSearch } from '../../icons';

export const PROVIDERS_PAGE_SIZE = 24;
export default function ProviderDirectoryResults<T extends { id: number }>({
  items, loading, fetching, error, errorLabel, emptyTitle, emptyDescription, emptyAction,
  page, total, onPageChange, renderItem,
}: {
  items: T[]; loading: boolean; fetching?: boolean; error: boolean; errorLabel: string;
  emptyTitle: string; emptyDescription: string; emptyAction?: ReactNode;
  page: number; total: number; onPageChange: (page: number) => void; renderItem: (item: T) => ReactNode;
}) {
  if (error) return <Alert variant="destructive"><AlertDescription>{errorLabel}</AlertDescription></Alert>;
  if (loading) return <DirectoryResults loading />;
  if (!items.length) return <EmptyState icon={<PersonSearch />} title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  return <div aria-busy={fetching || undefined}>
    <DirectoryResults>{items.map(renderItem)}</DirectoryResults>
    {total > PROVIDERS_PAGE_SIZE && <PagePagination className="mt-4" page={page} count={total}
      rowsPerPage={PROVIDERS_PAGE_SIZE} onPageChange={onPageChange} />}
  </div>;
}
