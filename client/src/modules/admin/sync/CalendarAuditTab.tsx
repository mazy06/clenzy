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
  CircularProgress,
  Alert,
  Typography,
  TextField,
  TablePagination,
} from '@mui/material';
import { syncAdminApi, CalendarCommand, CalendarConflict } from '../../../services/api/syncAdminApi';

const commandTypeColor = (type: string): 'success' | 'error' | 'warning' | 'info' | 'secondary' | 'default' => {
  switch (type) {
    case 'BOOK': return 'success';
    case 'CANCEL': return 'error';
    case 'BLOCK': return 'warning';
    case 'UNBLOCK': return 'info';
    case 'UPDATE_PRICE': return 'secondary';
    default: return 'default';
  }
};

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

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          size="small"
          label="Property ID"
          type="number"
          value={propertyId}
          onChange={(e) => { setPropertyId(e.target.value); setPage(0); }}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined">
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
                    <TableCell colSpan={9} align="center">Aucune commande</TableCell>
                  </TableRow>
                ) : (
                  commands.map((cmd) => (
                    <TableRow key={cmd.id}>
                      <TableCell>{cmd.id}</TableCell>
                      <TableCell>{cmd.propertyId}</TableCell>
                      <TableCell>
                        <Chip
                          label={cmd.commandType}
                          color={commandTypeColor(cmd.commandType)}
                          size="small"
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
