import React, { useState, useEffect } from 'react';
import StatusChip from '../../components/StatusChip';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Skeleton } from '../../components/ui';
import { cn } from '../../utils/cn';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import { Button } from '../../components/ui';
import FilterChipRow from '../../components/baitly/FilterChipRow';
import GuestAvatar from '../../components/baitly/GuestAvatar';
import ShowcaseEmpty from '../../components/baitly/ShowcaseEmpty';
import { useScreenSearch } from '../../components/ScreenChrome';
import { useNavigate } from 'react-router-dom';
import {
  People as PeopleIcon,
} from '../../icons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { guestsApi } from '../../services/api/guestsApi';
import type { GuestListDto } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { Money } from '../../components/Money';
import PagePagination from '../../components/PagePagination';

// ─── Constants ──────────────────────────────────────────────────────────────

// Carte hairline plate (pattern .pd-card — tokens, r14, aucune ombre au repos).
const CARD_CLS = 'border border-solid border-[var(--line)] bg-[var(--card)] shadow-none rounded-[14px]';

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

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Etiquette de segment derivee de la ligne — presentation seule, aux criteres
 * objectifs : « Fidèle » a partir du deuxieme sejour, « Récent » si la fiche a
 * moins de trente jours. Pas de « VIP » : aucun seuil defendable dans les
 * donnees de la liste.
 */
function segmentOf(guest: GuestListDto): { tone: 'ok' | 'info'; label: string } | null {
  if ((guest.totalStays ?? 0) >= 2) return { tone: 'ok', label: 'Fidèle' };
  if (guest.createdAt && Date.now() - new Date(guest.createdAt).getTime() < 30 * 86_400_000) {
    return { tone: 'info', label: 'Récent' };
  }
  return null;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface GuestsListPageProps {
  embedded?: boolean;
  actionsContainer?: HTMLElement | null;
}

const GuestsListPage: React.FC<GuestsListPageProps> = ({ embedded = false }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  // La recherche vit dans le champ UNIQUE du header (useScreenSearch), comme
  // la projection le dessine — l'ecran ne dessine plus la sienne.
  useScreenSearch(searchQuery, handleSearchChange, 'Nom, email…');

  // ── Render ──────────────────────────────────────────────────────────
  // Padding de page : SPACING.PAGE_PADDING (2) = 12px avec theme.spacing = 6.
  return (
    <div className={embedded ? 'p-0' : 'p-3'}>
      {!embedded && (
        <PageHeader
          title="Voyageurs"
          subtitle={`${totalElements} voyageur${totalElements !== 1 ? 's' : ''}`}
          iconBadge={<PeopleIcon />}
          backPath="/dashboard"
          showBackButton={false}
        />
      )}

      {/* ─── Chips de canal (rangee de la projection) — filtre SERVEUR.
          Pas de comptes : la pagination est serveur et l'API ne renvoie pas
          d'agregat par canal ; un compte de la page courante mentirait. */}
      <FilterChipRow
        className="mb-3"
        allLabel="Tous les canaux"
        value={channelFilter}
        onChange={handleChannelChange}
        options={CHANNEL_OPTIONS.filter(Boolean).map((ch) => ({
          value: ch,
          label: CHANNEL_LABELS[ch] || ch,
          color: CHANNEL_TOKEN[ch]?.fg ?? 'var(--muted)',
        }))}
      />

      {/* Loading skeletons */}
      {isLoading && (
        <div className={cn(CARD_CLS, 'p-3')}>
          {[...Array(6)].map((_, i) => (
            <div className="flex items-center gap-2 py-1.5" key={i}>
              <Skeleton className="w-[34px] h-[34px] rounded-[13px] shrink-0" />
              <div className="flex-1">
                <Skeleton className="w-[32%] h-[18px]" />
                <Skeleton className="w-[48%] h-[14px] mt-1" />
              </div>
              <Skeleton className="w-16 h-[22px] rounded-full shrink-0" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <Alert variant="destructive" className="mb-3">
          <TriangleAlert />
          <AlertDescription>{error instanceof Error ? error.message : 'Erreur lors du chargement des voyageurs'}</AlertDescription>
        </Alert>
      )}

      {/* Empty state */}
      {!isLoading && !isError && guests.length === 0 && (
        searchQuery || channelFilter ? (
          <EmptyState
            icon={<PeopleIcon />}
            title="Aucun voyageur ne correspond aux filtres"
            description={'Essayez d\'élargir la recherche ou de retirer le filtre canal.'}
          />
        ) : (
          // Compte sans aucun voyageur : l'etat vide riche de la galerie —
          // les fiches naissent des reservations, on y oriente.
          <ShowcaseEmpty
            eyebrow={{ icon: <PeopleIcon size={14} strokeWidth={1.75} />, label: 'Voyageurs' }}
            title="Chaque voyageur, son historique et ses préférences au même endroit"
            description="Les fiches se créent toutes seules à partir des réservations, quel que soit le canal d’origine."
            action={
              <Button onClick={() => navigate('/reservations')}>
                Importer mes réservations
              </Button>
            }
          />
        )
      )}

      {/* Table */}
      {!isLoading && !isError && guests.length > 0 && (
        <div className={CARD_CLS}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Telephone</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-end">Sejours</TableHead>
                  <TableHead className="text-end">Valeur vie</TableHead>
                  <TableHead>Cree le</TableHead>
                  {isSuperAdmin && (
                    <TableHead>Organisation</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {guests.map((guest) => (
                  <TableRow key={guest.id}>
                    <TableCell>
                      {/* Cellule Guest de la projection : avatar, nom + segment,
                          email en dessous — la colonne Email disparait, la
                          donnee reste. */}
                      <span className="flex items-center gap-2.5">
                        <GuestAvatar name={guest.fullName || '?'} size={28} />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-[13px] font-medium text-foreground">{guest.fullName}</span>
                            {(() => {
                              const seg = segmentOf(guest);
                              return seg ? <StatusChip tone={seg.tone} label={seg.label} size="sm" /> : null;
                            })()}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">{guest.email || '-'}</span>
                        </span>
                      </span>
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
                          // Chip a point de la projection : la couleur de
                          // marque teinte point et pastel.
                          return (
                            <StatusChip color={tk.fg} label={CHANNEL_LABELS[guest.channel] || guest.channel} dot size="sm" />
                          );
                        })()
                      ) : (
                        <p className="cn-text-body1 text-[12.5px] text-[var(--faint)]">
                          -
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {guest.totalStays ?? 0}
                    </TableCell>
                    <TableCell className="text-end">
                      <p className="cn-text-body1 text-[12.5px] font-medium text-[var(--ink)] tabular-nums">
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
          </div>
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
        </div>
      )}
    </div>
  );
};

export default GuestsListPage;
