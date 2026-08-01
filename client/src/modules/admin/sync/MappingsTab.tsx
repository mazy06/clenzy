import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AlertDescription } from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Skeleton } from '@mui/material';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui';
import StatusChip from '../../../components/StatusChip';
import { syncAdminApi, MappingSummary } from '../../../services/api/syncAdminApi';
import PagePagination from '../../../components/PagePagination';

const MappingsTab: React.FC = () => {
  const [mappings, setMappings] = useState<MappingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const fetchMappings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await syncAdminApi.getMappings({ page, size: rowsPerPage });
      setMappings(data.content);
      setTotalElements(data.totalElements);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des mappings');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage]);

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  const handleChangePage = (newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (rows: number) => {
    setRowsPerPage(rows);
    setPage(0);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={36} sx={{ borderRadius: '9px' }} />
        ))}
      </div>
    );
  }

  if (error) {
    return <Alert variant="destructive" className="mb-3">
      <TriangleAlert />
      <AlertDescription>{error}</AlertDescription>
    </Alert>;
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-[14px] border border-solid border-[var(--line)] bg-[var(--card)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Entity Type</TableHead>
              <TableHead>Internal ID</TableHead>
              <TableHead>External ID</TableHead>
              <TableHead>Sync Enabled</TableHead>
              <TableHead>Last Sync</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-[var(--muted)] py-[18px]">
                  Aucun mapping
                </TableCell>
              </TableRow>
            ) : (
              mappings.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="tabular-nums">{m.id}</TableCell>
                  <TableCell>{m.channel || '—'}</TableCell>
                  <TableCell>{m.entityType}</TableCell>
                  <TableCell className="tabular-nums">{m.internalId}</TableCell>
                  <TableCell className="tabular-nums">{m.externalId}</TableCell>
                  <TableCell>
                    <StatusChip
                      tone={m.syncEnabled ? 'ok' : 'neutral'}
                      label={m.syncEnabled ? 'Active' : 'Disabled'}
                    />
                  </TableCell>
                  <TableCell>
                    {m.lastSyncAt ? new Date(m.lastSyncAt).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell>{m.lastSyncStatus || '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <PagePagination
        count={totalElements}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[10, 20, 50]}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </div>
  );
};

export default MappingsTab;
