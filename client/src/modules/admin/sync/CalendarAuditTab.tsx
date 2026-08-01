import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AlertDescription } from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Skeleton, TextField } from '@mui/material';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui';
import { syncAdminApi, CalendarCommand, CalendarConflict } from '../../../services/api/syncAdminApi';
import { useSyncAdminHeader } from '../SyncAdminPage';
import PagePagination from '../../../components/PagePagination';
import StatusChip, { type ToneTokens } from '../../../components/StatusChip';

// Types de commande → tokens sémantiques (chips -soft : texte couleur + fond -soft)
const COMMAND_TOKEN: Record<string, ToneTokens> = {
  BOOK: { color: 'var(--ok)', bg: 'var(--ok-soft)' },
  CANCEL: { color: 'var(--err)', bg: 'var(--err-soft)' },
  BLOCK: { color: 'var(--warn)', bg: 'var(--warn-soft)' },
  UNBLOCK: { color: 'var(--info)', bg: 'var(--info-soft)' },
  UPDATE_PRICE: { color: 'var(--accent)', bg: 'var(--accent-soft)' },
};

const NEUTRAL_TOKEN: ToneTokens = { color: 'var(--muted)', bg: 'var(--hover)' };

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

  const handleChangePage = (newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (rows: number) => {
    setRowsPerPage(rows);
    setPage(0);
  };

  return (
    <div>
      {/* Conflicts Alert */}
      {conflicts.length > 0 && (
        <Alert variant="warning" className="mb-4">
          <TriangleAlert />
          <AlertDescription><h6 className="cn-text-subtitle2 mb-[0.35em]">
            {conflicts.length} conflit(s) calendrier detecte(s)
          </h6><Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Property ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Organization</TableHead>
              </TableRow>
            </TableHeader>
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
          </Table></AlertDescription>
        </Alert>
      )}

      {error && <Alert variant="destructive" className="mb-3">
        <TriangleAlert />
        <AlertDescription>{error}</AlertDescription>
      </Alert>}

      {loading ? (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={36} sx={{ borderRadius: '9px' }} />
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-[14px] border border-solid border-[var(--line)] bg-[var(--card)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Property ID</TableHead>
                  <TableHead>Command Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Reservation ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Executed At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commands.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-[var(--muted)] py-[18px]">
                      Aucune commande
                    </TableCell>
                  </TableRow>
                ) : (
                  commands.map((cmd) => (
                    <TableRow key={cmd.id}>
                      <TableCell className="tabular-nums">{cmd.id}</TableCell>
                      <TableCell className="tabular-nums">{cmd.propertyId}</TableCell>
                      <TableCell>
                        <StatusChip
                          label={cmd.commandType}
                          tokens={COMMAND_TOKEN[cmd.commandType] ?? NEUTRAL_TOKEN}
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
          </div>
          <PagePagination
            count={totalElements}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[10, 20, 50]}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </>
      )}
    </div>
  );
};

export default CalendarAuditTab;
