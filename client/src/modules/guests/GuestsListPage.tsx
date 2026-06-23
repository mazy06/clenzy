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
  Skeleton,
  Alert,
} from '@mui/material';
import {
  People as PeopleIcon,
} from '../../icons';
import { useQuery } from '@tanstack/react-query';
import { guestsApi } from '../../services/api';
import type { GuestListDto } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { SPACING } from '../../theme/spacing';
import { Money } from '../../components/Money';

// ─── Constants ──────────────────────────────────────────────────────────────

// Carte hairline plate (pattern .pd-card — tokens, r14, aucune ombre au repos).
const CARD_SX = {
  border: '1px solid var(--line)',
  bgcolor: 'var(--card)',
  boxShadow: 'none',
  borderRadius: '14px',
} as const;

// Entêtes de table : overline 10.5 --faint uppercase (pattern baseline tableaux).
const TABLE_HEAD_SX = {
  '& th': {
    fontWeight: 700,
    fontSize: '10.5px',
    letterSpacing: '.05em',
    textTransform: 'uppercase',
    color: 'var(--faint)',
    borderBottom: '1px solid var(--line)',
    whiteSpace: 'nowrap',
  },
} as const;

const PAGINATION_SX = {
  borderTop: '1px solid var(--line)',
  '& .MuiTablePagination-displayedRows, & .MuiTablePagination-selectLabel': {
    fontSize: '11.5px',
    fontWeight: 600,
    color: 'var(--muted)',
    fontVariantNumeric: 'tabular-nums',
  },
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

// Canaux → tokens (--airbnb/--booking/--direct) ; repli sémantique pour les autres.
const CHANNEL_TOKEN: Record<string, { fg: string; bg: string }> = {
  DIRECT: { fg: 'var(--direct-ink)', bg: 'var(--direct-soft)' },
  AIRBNB: { fg: 'var(--airbnb-ink)', bg: 'var(--airbnb-soft)' },
  BOOKING: { fg: 'var(--booking-ink)', bg: 'var(--booking-soft)' },
  VRBO: { fg: 'var(--info)', bg: 'var(--info-soft)' },
  ICAL: { fg: 'var(--warn)', bg: 'var(--warn-soft)' },
  OTHER: { fg: 'var(--muted)', bg: 'var(--hover)' },
};

// Palette avatar déterministe (pattern validé messagerie — copie locale du pattern).
const AVATAR_COLORS = ['#5F7E8C', '#C28A52', '#7BA3C2', '#4A9B8E', '#9A7FA3', '#4A6B9A'];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts.map((w) => w[0]).slice(0, 2).join('') || '?').toUpperCase();
}

// ─── Component ──────────────────────────────────────────────────────────────

interface GuestsListPageProps {
  embedded?: boolean;
  actionsContainer?: HTMLElement | null;
}

const GuestsListPage: React.FC<GuestsListPageProps> = ({ embedded = false }) => {
  const { user } = useAuth();
  const isSuperAdmin = user?.platformRole === 'SUPER_ADMIN' || user?.platformRole === 'SUPER_MANAGER';

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
          iconBadge={<PeopleIcon />}
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

      {/* Loading skeletons */}
      {isLoading && (
        <Paper sx={{ ...CARD_SX, p: 2 }}>
          {[...Array(6)].map((_, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
              <Skeleton variant="rounded" width={34} height={34} sx={{ borderRadius: '13px' }} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="32%" height={18} />
                <Skeleton variant="text" width="48%" height={14} />
              </Box>
              <Skeleton variant="rounded" width={64} height={22} sx={{ borderRadius: 999 }} />
            </Box>
          ))}
        </Paper>
      )}

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error instanceof Error ? error.message : 'Erreur lors du chargement des voyageurs'}
        </Alert>
      )}

      {/* Empty state */}
      {!isLoading && !isError && filteredGuests.length === 0 && (
        <EmptyState
          icon={<PeopleIcon />}
          title={searchQuery || channelFilter ? 'Aucun voyageur ne correspond aux filtres' : 'Aucun voyageur enregistre'}
          description={searchQuery || channelFilter
            ? 'Essayez d\'élargir la recherche ou de retirer le filtre canal.'
            : 'Les voyageurs apparaissent ici dès leur première réservation.'}
        />
      )}

      {/* Table */}
      {!isLoading && !isError && filteredGuests.length > 0 && (
        <Paper sx={CARD_SX}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={TABLE_HEAD_SX}>
                  <TableCell>Nom</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Telephone</TableCell>
                  <TableCell>Canal</TableCell>
                  <TableCell align="center">Sejours</TableCell>
                  <TableCell align="right">Depense</TableCell>
                  <TableCell>Cree le</TableCell>
                  {isSuperAdmin && (
                    <TableCell>Organisation</TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedGuests.map((guest) => (
                  <TableRow
                    key={guest.id}
                    hover
                    sx={{ '&:last-child td': { borderBottom: 0 } }}
                  >
                    <TableCell>
                      {/* Avatar initiales display r13 (densité table → 34) + nom */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        <Box
                          sx={{
                            width: 34,
                            height: 34,
                            borderRadius: '13px',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 600,
                            fontSize: 12.5,
                            color: '#fff',
                            bgcolor: avatarColor(guest.fullName || '?'),
                          }}
                        >
                          {initialsOf(guest.fullName || '?')}
                        </Box>
                        <Typography sx={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                          {guest.fullName}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                        {guest.email || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '12.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {guest.phone || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {guest.channel ? (
                        (() => {
                          const tk = CHANNEL_TOKEN[guest.channel] ?? CHANNEL_TOKEN.OTHER;
                          return (
                            <Chip
                              label={CHANNEL_LABELS[guest.channel] || guest.channel}
                              size="small"
                              sx={{ color: tk.fg, bgcolor: tk.bg, border: 'none' }}
                            />
                          );
                        })()
                      ) : (
                        <Typography sx={{ fontSize: '12.5px', color: 'var(--faint)' }}>
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={guest.totalStays ?? 0}
                        size="small"
                        sx={{
                          minWidth: 28,
                          color: 'var(--accent)',
                          bgcolor: 'var(--accent-soft)',
                          border: 'none',
                          fontFamily: 'var(--font-display)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>
                        {guest.totalSpent ? <Money value={guest.totalSpent} from="EUR" /> : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '12px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatDate(guest.createdAt)}
                      </Typography>
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell>
                        <Typography sx={{ fontSize: '12px', color: 'var(--muted)' }}>
                          {guest.organizationName || '-'}
                        </Typography>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
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
            sx={PAGINATION_SX}
          />
        </Paper>
      )}
    </Box>
  );
};

export default GuestsListPage;
