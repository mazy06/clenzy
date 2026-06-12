import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Skeleton,
  Alert,
  TablePagination,
} from '@mui/material';
import { syncAdminApi, MappingSummary } from '../../../services/api/syncAdminApi';

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

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={36} sx={{ borderRadius: '9px' }} />
        ))}
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>;
  }

  return (
    <Box>
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ borderRadius: '14px', borderColor: 'var(--line)' }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Channel</TableCell>
              <TableCell>Entity Type</TableCell>
              <TableCell>Internal ID</TableCell>
              <TableCell>External ID</TableCell>
              <TableCell>Sync Enabled</TableCell>
              <TableCell>Last Sync</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mappings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ color: 'var(--muted)', py: 3 }}>
                  Aucun mapping
                </TableCell>
              </TableRow>
            ) : (
              mappings.map((m) => (
                <TableRow key={m.id}>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{m.id}</TableCell>
                  <TableCell>{m.channel || '—'}</TableCell>
                  <TableCell>{m.entityType}</TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{m.internalId}</TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{m.externalId}</TableCell>
                  <TableCell>
                    {/* Chip -soft : actif --ok, désactivé neutre muted */}
                    <Chip
                      label={m.syncEnabled ? 'Active' : 'Disabled'}
                      size="small"
                      sx={
                        m.syncEnabled
                          ? { color: 'var(--ok)', backgroundColor: 'var(--ok-soft)' }
                          : { color: 'var(--muted)', backgroundColor: 'var(--hover)' }
                      }
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
      </TableContainer>
      <TablePagination
        component="div"
        count={totalElements}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[10, 20, 50]}
      />
    </Box>
  );
};

export default MappingsTab;
