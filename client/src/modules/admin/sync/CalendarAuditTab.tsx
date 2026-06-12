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
  Typography,
  TextField,
  TablePagination,
} from '@mui/material';
import { syncAdminApi, CalendarCommand, CalendarConflict } from '../../../services/api/syncAdminApi';
import { useSyncAdminHeader } from '../SyncAdminPage';

// Types de commande → tokens sémantiques (chips -soft : texte couleur + fond -soft)
const COMMAND_TOKEN: Record<string, { fg: string; bg: string }> = {
  BOOK: { fg: 'var(--ok)', bg: 'var(--ok-soft)' },
  CANCEL: { fg: 'var(--err)', bg: 'var(--err-soft)' },
  BLOCK: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
  UNBLOCK: { fg: 'var(--info)', bg: 'var(--info-soft)' },
  UPDATE_PRICE: { fg: 'var(--accent)', bg: 'var(--accent-soft)' },
};

const NEUTRAL_TOKEN = { fg: 'var(--muted)', bg: 'var(--hover)' };

const CalendarAuditTab: React.FC = () => {
  const [commands, setCommands] = useState<CalendarCommand[]>([]);
  const [conflicts, setConflicts] = useState<CalendarConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Filters
  const [propertyId, setPropertyId] = useState('');
  const { setHeaderFilters } = useSyncAdminHeader();

  const fetchConflicts = async () => {
    try {
      const data = await syncAdminApi.getCalendarConflicts();
      setConflicts(data);
    } catch {
      // Non-critical
    }
  };

  const fetchCommands = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await syncAdminApi.getCalendarCommands({
        propertyId: propertyId ? Number(propertyId) : undefined,
        page,
        size: rowsPerPage,
      });
      setCommands(data.content);
      setTotalElements(data.totalElements);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des commandes calendrier');
    } finally {
      setLoading(false);
    }
  }, [propertyId, page, rowsPerPage]);

  useEffect(() => {
    fetchConflicts();
  }, []);

  useEffect(() => {
    fetchCommands();
  }, [fetchCommands]);

  // Register Property ID filter into the page header.
  useEffect(() => {
    setHeaderFilters(
      <TextField
        size="small"
        label="Property ID"
        type="number"
        value={propertyId}
        onChange={(e) => { setPropertyId(e.target.value); setPage(0); }}
        sx={{ width: 160 }}
      />,
    );
    return () => setHeaderFilters(null);
  }, [setHeaderFilters, propertyId]);

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box>
      {/* Conflicts Alert */}
      {conflicts.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            {conflicts.length} conflit(s) calendrier detecte(s)
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Property ID</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Organization</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {conflicts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.id}</TableCell>
                    <TableCell>{c.propertyId ?? '—'}</TableCell>
                    <TableCell>{c.date ? new Date(c.date).toLocaleDateString() : '—'}</TableCell>
                    <TableCell>{c.status ?? '—'}</TableCell>
                    <TableCell>{c.organizationId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={36} sx={{ borderRadius: '9px' }} />
          ))}
        </Box>
      ) : (
        <>
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ borderRadius: '14px', borderColor: 'var(--line)' }}
          >
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Property ID</TableCell>
                  <TableCell>Command Type</TableCell>
                  <TableCell>From</TableCell>
                  <TableCell>To</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Reservation ID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Executed At</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {commands.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ color: 'var(--muted)', py: 3 }}>
                      Aucune commande
                    </TableCell>
                  </TableRow>
                ) : (
                  commands.map((cmd) => (
                    <TableRow key={cmd.id}>
                      <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{cmd.id}</TableCell>
                      <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{cmd.propertyId}</TableCell>
                      <TableCell>
                        <Chip
                          label={cmd.commandType}
                          size="small"
                          sx={(() => {
                            const tk = COMMAND_TOKEN[cmd.commandType] ?? NEUTRAL_TOKEN;
                            return { color: tk.fg, backgroundColor: tk.bg };
                          })()}
                        />
                      </TableCell>
                      <TableCell>
                        {cmd.dateFrom ? new Date(cmd.dateFrom).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell>
                        {cmd.dateTo ? new Date(cmd.dateTo).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell>{cmd.source}</TableCell>
                      <TableCell>{cmd.reservationId ?? '—'}</TableCell>
                      <TableCell>{cmd.status}</TableCell>
                      <TableCell>
                        {cmd.executedAt ? new Date(cmd.executedAt).toLocaleString() : '—'}
                      </TableCell>
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
        </>
      )}
    </Box>
  );
};

export default CalendarAuditTab;
