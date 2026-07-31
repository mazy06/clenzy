import React, { useState, useEffect } from 'react';
import StatusChip from '../../components/StatusChip';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, MenuItem, Chip, Skeleton } from '@mui/material';
import {
  People as PeopleIcon,
} from '../../icons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { guestsApi } from '../../services/api/guestsApi';
import type { GuestListDto } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { SPACING } from '../../theme/spacing';
import { Money } from '../../components/Money';
import PagePagination from '../../components/PagePagination';

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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');

  // ── Pagination (serveur) ────────────────────────────────────────────
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Debounce 300 ms du champ recherche : la requete serveur ne part qu'une
  // fois la saisie stabilisee ; retour page 0 a chaque nouveau terme.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(0);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchQuery]);

  // Meme seuil que le backend : < 2 caracteres = pas de filtre search.
  const effectiveSearch = debouncedSearch.length >= 2 ? debouncedSearch : '';

  // ── Data fetching (pagination serveur) ──────────────────────────────
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['guests-list', page, rowsPerPage, effectiveSearch, channelFilter],
    queryFn: () => guestsApi.listPage({
      page,
      size: rowsPerPage,
      search: effectiveSearch || undefined,
      channel: channelFilter || undefined,
    }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const guests = data?.content ?? [];
  const totalElements = data?.totalElements ?? 0;

  // ── Reset page on filter change ─────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearchQuery(value); // le retour page 0 est gere par le debounce
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
          subtitle={`${totalElements} voyageur${totalElements !== 1 ? 's' : ''}`}
          iconBadge={<PeopleIcon />}
          backPath="/dashboard"
          showBackButton={false}
        />
      )}

      {/* Filters */}
      <Paper sx={{ ...CARD_SX, p: 2, mb: 2 }}>
        <div className="flex gap-3 flex-wrap">
          <TextField
            label="Rechercher"
            placeholder="Nom, email..."
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
        </div>
      </Paper>

      {/* Loading skeletons */}
      {isLoading && (
        <Paper sx={{ ...CARD_SX, p: 2 }}>
          {[...Array(6)].map((_, i) => (
            <div className="flex items-center gap-2 py-1.5" key={i}>
              <Skeleton variant="rounded" width={34} height={34} sx={{ borderRadius: '13px' }} />
              <div className="flex-1">
                <Skeleton variant="text" width="32%" height={18} />
                <Skeleton variant="text" width="48%" height={14} />
              </div>
              <Skeleton variant="rounded" width={64} height={22} sx={{ borderRadius: 999 }} />
            </div>
          ))}
        </Paper>
      )}

      {isError && (
        <Alert variant="destructive" className="mb-3">
          <TriangleAlert />
          <AlertDescription>{error instanceof Error ? error.message : 'Erreur lors du chargement des voyageurs'}</AlertDescription>
        </Alert>
      )}

      {/* Empty state */}
      {!isLoading && !isError && guests.length === 0 && (
        <EmptyState
          icon={<PeopleIcon />}
          title={searchQuery || channelFilter ? 'Aucun voyageur ne correspond aux filtres' : 'Aucun voyageur enregistre'}
          description={searchQuery || channelFilter
            ? 'Essayez d\'élargir la recherche ou de retirer le filtre canal.'
            : 'Les voyageurs apparaissent ici dès leur première réservation.'}
        />
      )}

      {/* Table */}
      {!isLoading && !isError && guests.length > 0 && (
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
                {guests.map((guest) => (
                  <TableRow
                    key={guest.id}
                    hover
                    sx={{ '&:last-child td': { borderBottom: 0 } }}
                  >
                    <TableCell>
                      {/* Avatar initiales display r13 (densité table → 34) + nom */}
                      <div className="flex items-center gap-2">
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
                        <p className="cn-text-body1 text-[13px] font-semibold text-[var(--ink)]">
                          {guest.fullName}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="cn-text-body1 text-[12.5px] text-[var(--muted)]">
                        {guest.email || '-'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="cn-text-body1 text-[12.5px] text-[var(--muted)] tabular-nums">
                        {guest.phone || '-'}
                      </p>
                    </TableCell>
                    <TableCell>
                      {guest.channel ? (
                        (() => {
                          const tk = CHANNEL_TOKEN[guest.channel] ?? CHANNEL_TOKEN.OTHER;
                          return (
                            <StatusChip tokens={{ color: tk.fg, bg: tk.bg }} label={CHANNEL_LABELS[guest.channel] || guest.channel} />
                          );
                        })()
                      ) : (
                        <p className="cn-text-body1 text-[12.5px] text-[var(--faint)]">
                          -
                        </p>
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
                      <p className="cn-text-body1 text-[12.5px] font-semibold text-[var(--ink)] font-[var(--font-display)] tabular-nums">
                        {guest.totalSpent ? <Money value={guest.totalSpent} from="EUR" /> : '-'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="cn-text-body1 text-[12px] text-[var(--muted)] tabular-nums">
                        {formatDate(guest.createdAt)}
                      </p>
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell>
                        <p className="cn-text-body1 text-[12px] text-[var(--muted)]">
                          {guest.organizationName || '-'}
                        </p>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <PagePagination
            count={totalElements}
            page={page}
            onPageChange={(p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
            onRowsPerPageChange={(rows) => {
              setRowsPerPage(rows);
              setPage(0);
            }}
          />
        </Paper>
      )}
    </Box>
  );
};

export default GuestsListPage;
