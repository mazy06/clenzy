import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
  alpha,
} from '@mui/material';
import {
  People as PeopleIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { guestsApi } from '../../services/api';
import type { GuestListDto } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import { SPACING } from '../../theme/spacing';
import { useCurrency } from '../../hooks/useCurrency';

// ─── Constants ──────────────────────────────────────────────────────────────

const CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
} as const;

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50];

const CHANNEL_OPTIONS = ['', 'DIRECT', 'AIRBNB', 'BOOKING', 'VRBO', 'ICAL', 'OTHER'] as const;

const CHANNEL_LABELS: Record<string, string> = {
  DIRECT: 'Direct',
  AIRBNB: 'Airbnb',
  BOOKING: 'Booking',
  VRBO: 'VRBO',
  ICAL: 'iCal',
  OTHER: 'Autre',
};

const CHANNEL_COLORS: Record<string, 'default' | 'primary' | 'error' | 'warning' | 'info' | 'success' | 'secondary'> = {
  DIRECT: 'primary',
  AIRBNB: 'error',
  BOOKING: 'info',
  VRBO: 'secondary',
  ICAL: 'warning',
  OTHER: 'default',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Component ──────────────────────────────────────────────────────────────

interface GuestsListPageProps {
  embedded?: boolean;
  actionsContainer?: HTMLElement | null;
}

const GuestsListPage: React.FC<GuestsListPageProps> = ({ embedded = false }) => {
  const { user } = useAuth();
  const isSuperAdmin = user?.platformRole === 'SUPER_ADMIN' || user?.platformRole === 'SUPER_MANAGER';
  const { convertAndFormat } = useCurrency();

  // ── Filters ─────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState('');

  // ── Pagination ──────────────────────────────────────────────────────
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // ── Data fetching ───────────────────────────────────────────────────
  const { data: guests = [], isLoading, isError, error } = useQuery({
    queryKey: ['guests-list'],
    queryFn: () => guestsApi.list(),
    staleTime: 30_000,
  });

  // ── Client-side filtering ───────────────────────────────────────────
  const filteredGuests = useMemo(() => {
    let result = guests;

    if (searchQuery.length >= 2) {
      const lower = searchQuery.toLowerCase();
      result = result.filter((g) => {
        const fullName = (g.fullName || '').toLowerCase();
        const email = (g.email || '').toLowerCase();
        const phone = (g.phone || '').toLowerCase();
        return fullName.includes(lower) || email.includes(lower) || phone.includes(lower);
      });
    }

    if (channelFilter) {
      result = result.filter((g) => g.channel === channelFilter);
    }

    return result;
  }, [guests, searchQuery, channelFilter]);

  const paginatedGuests = filteredGuests.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
  );

  // ── Reset page on filter change ─────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(0);
  };

  const handleChannelChange = (value: string) => {
    setChannelFilter(value);
    setPage(0);
  };

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: embedded ? 0 : SPACING.PAGE_PADDING }}>
      {!embedded && (
        <PageHeader
          title="Voyageurs"
          subtitle={`${filteredGuests.length} voyageur${filteredGuests.length !== 1 ? 's' : ''}`}
          backPath="/dashboard"
          showBackButton={false}
        />
      )}

      {/* Filters */}
      <Paper sx={{ ...CARD_SX, p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            label="Rechercher"
            placeholder="Nom, email, telephone..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 260, flex: 1 }}
          />
          <TextField
            select
            label="Canal"
            value={channelFilter}
            onChange={(e) => handleChannelChange(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">Tous les canaux</MenuItem>
            {CHANNEL_OPTIONS.filter(Boolean).map((ch) => (
              <MenuItem key={ch} value={ch}>
                {CHANNEL_LABELS[ch] || ch}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Paper>

      {/* Loading / Error */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error instanceof Error ? error.message : 'Erreur lors du chargement des voyageurs'}
        </Alert>
      )}

      {/* Table */}
      {!isLoading && !isError && (
        <Paper sx={CARD_SX}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.78rem' }}>Nom</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.78rem' }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.78rem' }}>Telephone</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.78rem' }}>Canal</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.78rem' }} align="center">Sejours</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.78rem' }} align="right">Depense</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.78rem' }}>Cree le</TableCell>
                  {isSuperAdmin && (
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.78rem' }}>Organisation</TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedGuests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isSuperAdmin ? 8 : 7} align="center" sx={{ py: 4 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <PeopleIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
                        <Typography color="text.secondary" variant="body2">
                          {searchQuery || channelFilter
                            ? 'Aucun voyageur ne correspond aux filtres'
                            : 'Aucun voyageur enregistre'}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedGuests.map((guest) => (
                    <TableRow
                      key={guest.id}
                      hover
                      sx={{ '&:last-child td': { borderBottom: 0 } }}
                    >
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.82rem' }}>
                          {guest.fullName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                          {guest.email || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                          {guest.phone || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {guest.channel ? (
                          <Chip
                            label={CHANNEL_LABELS[guest.channel] || guest.channel}
                            color={CHANNEL_COLORS[guest.channel] || 'default'}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.68rem', fontWeight: 600, height: 22 }}
                          />
                        ) : (
                          <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.8rem' }}>
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={guest.totalStays ?? 0}
                          size="small"
                          sx={(theme) => ({
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            height: 22,
                            minWidth: 28,
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                            color: 'primary.main',
                          })}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          {guest.totalSpent ? convertAndFormat(guest.totalSpent, 'EUR') : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                          {formatDate(guest.createdAt)}
                        </Typography>
                      </TableCell>
                      {isSuperAdmin && (
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                            {guest.organizationName || '-'}
                          </Typography>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredGuests.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
            labelRowsPerPage="Par page"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
          />
        </Paper>
      )}
    </Box>
  );
};

export default GuestsListPage;
