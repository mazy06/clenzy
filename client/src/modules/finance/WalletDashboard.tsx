import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  alpha,
} from '@mui/material';
import {
  AccountBalanceWallet,
  TrendingUp,
  Lock,
  Business,
} from '../../icons';
import { walletApi } from '../../services/api/walletApi';
import { useCurrency } from '../../hooks/useCurrency';
import { Money } from '../../components/Money';
import type { WalletDto, LedgerEntryDto } from '../../types/payment';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import PagePagination from '../../components/PagePagination';

// Accents = palette Clenzy validée (ESCROW : mauve désaturé validé planning #9A7FA3)
const WALLET_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  PLATFORM: { label: 'Plateforme', icon: <Business size={16} strokeWidth={1.75} />, color: '#6B8A9A' },
  OWNER: { label: 'Propriétaire', icon: <TrendingUp size={16} strokeWidth={1.75} />, color: '#4A9B8E' },
  CONCIERGE: { label: 'Conciergerie', icon: <AccountBalanceWallet size={16} strokeWidth={1.75} />, color: '#D4A574' },
  ESCROW: { label: 'Séquestre', icon: <Lock size={16} strokeWidth={1.75} />, color: '#9A7FA3' },
};

// Neutre (ADJUSTMENT) : pas de token sémantique dédié — repli var(--muted)
const REF_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  PAYMENT: { label: 'Paiement', color: '#6B8A9A' },
  SPLIT: { label: 'Répartition', color: '#7BA3C2' },
  ESCROW_HOLD: { label: 'Séquestre', color: '#D4A574' },
  ESCROW_RELEASE: { label: 'Libération', color: '#4A9B8E' },
  REFUND: { label: 'Remboursement', color: '#C97A7A' },
  PAYOUT: { label: 'Versement', color: '#4A9B8E' },
  ADJUSTMENT: { label: 'Ajustement', color: 'var(--muted)' },
};

/** Chip -soft : texte couleur + fond soft (pilule/typo via thème global MuiChip).
 *  color-mix accepte hex ET var(--token). */
const softChipSx = (c: string) => ({
  backgroundColor: `color-mix(in srgb, ${c} 12%, transparent)`,
  color: c,
});

/** Montants : display tabular-nums (jamais proportional) */
const moneySx = {
  fontFamily: 'var(--font-display)',
  fontVariantNumeric: 'tabular-nums',
};

const ENTRY_TYPE_TOKENS: Record<string, string> = {
  CREDIT: 'var(--ok)',
  DEBIT: 'var(--err)',
};

interface WalletDashboardProps {
  embedded?: boolean;
}

export default function WalletDashboard({ embedded = false }: WalletDashboardProps) {
  const [wallets, setWallets] = useState<WalletDto[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<WalletDto | null>(null);
  const [entries, setEntries] = useState<LedgerEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalEntries, setTotalEntries] = useState(0);
  const { currency } = useCurrency();

  useEffect(() => {
    loadWallets();
  }, []);

  useEffect(() => {
    if (selectedWallet) {
      loadEntries(selectedWallet.id, page);
    }
  }, [selectedWallet, page]);

  const loadWallets = async () => {
    try {
      setLoading(true);
      let data = await walletApi.getWallets();

      // Auto-initialize wallets if none exist (backfill from existing payments)
      if (data.length === 0) {
        try {
          await walletApi.initialize();
          data = await walletApi.getWallets();
        } catch (initError) {
          console.warn('Wallet initialization failed (may lack permissions):', initError);
        }
      }

      setWallets(data);
      if (data.length > 0) setSelectedWallet(data[0]);
    } catch (error) {
      console.error('Failed to load wallets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEntries = async (walletId: number, pageNum: number) => {
    try {
      setEntriesLoading(true);
      const response = await walletApi.getEntries(walletId, pageNum, 10);
      setEntries(response.content);
      setTotalEntries(response.totalElements);
    } catch (error) {
      console.error('Failed to load entries:', error);
      setEntries([]);
    } finally {
      setEntriesLoading(false);
    }
  };

  if (loading) {
    // Skeletons : 4 tuiles + panneau historique (cartes hairline plates)
    return (
      <div>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Card className="gap-0 py-0 p-3 border-[var(--line)]">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Skeleton variant="rounded" width={26} height={26} />
                  <Skeleton variant="text" width="50%" height={16} />
                </div>
                <Skeleton variant="text" width="60%" height={28} />
                <Skeleton variant="text" width="30%" height={14} />
              </Card>
            </Grid>
          ))}
        </Grid>
        <Card className="gap-0 py-0 mt-4 p-3 border-[var(--line)]">
          <Skeleton variant="text" width="25%" height={20} sx={{ mb: 1.5 }} />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={36} sx={{ borderRadius: 1, mb: 1 }} />
          ))}
        </Card>
      </div>
    );
  }

  return (
    <div>
      {!embedded && (
        <PageHeader title="Portefeuilles" subtitle="Vue d'ensemble des portefeuilles et transactions" iconBadge={<AccountBalanceWallet />} backPath="/dashboard" />
      )}

      {wallets.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={<AccountBalanceWallet />}
            title="Aucun portefeuille trouvé"
            description="Les portefeuilles seront créés automatiquement lors du premier paiement."
          />
        </div>
      ) : (
        <>
          {/* Wallet summary cards */}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {wallets.map((wallet) => {
              const typeInfo = WALLET_TYPE_LABELS[wallet.walletType] || WALLET_TYPE_LABELS.PLATFORM;
              const isSelected = selectedWallet?.id === wallet.id;

              return (
                <Grid item xs={12} sm={6} md={3} key={wallet.id}>
                  {/* Tuile sélectionnable : carte hairline plate, sélection = bordure accent + ring accent-soft */}
                  <Paper
                    variant="outlined"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') { setSelectedWallet(wallet); setPage(0); }
                    }}
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-lg)',
                      bgcolor: 'var(--card)',
                      boxShadow: isSelected ? '0 0 0 3px var(--accent-soft)' : 'none',
                      borderColor: isSelected ? 'var(--accent)' : 'var(--line)',
                      transition: 'border-color .14s, box-shadow .14s',
                      '&:hover': { borderColor: isSelected ? 'var(--accent)' : 'var(--line-2)' },
                      '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
                      '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                    }}
                    onClick={() => { setSelectedWallet(wallet); setPage(0); }}
                  >
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Box
                        sx={{
                          width: 26, height: 26, borderRadius: 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: typeInfo.color,
                          bgcolor: alpha(typeInfo.color, 0.12),
                          flexShrink: 0,
                        }}
                      >
                        {typeInfo.icon}
                      </Box>
                      <p className="cn-text-body1 text-[10.5px] font-bold text-[var(--faint)] uppercase tracking-[0.05em]">
                        {typeInfo.label}
                      </p>
                    </Box>
                    <Typography
                      sx={{
                        ...moneySx,
                        fontSize: '1.1875rem',
                        fontWeight: 600,
                        letterSpacing: '-0.025em',
                        color: 'var(--ink)',
                        lineHeight: 1.1,
                      }}
                    >
                      <Money value={wallet.balance} from={wallet.currency} />
                    </Typography>
                    <span className="cn-text-caption text-[var(--muted)]">
                      {wallet.currency}
                    </span>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>

          {/* Ledger entries table */}
          {selectedWallet && (
            <Card className="gap-0 py-0 mt-4 border-[var(--line)] overflow-hidden">
              <Box p={2} display="flex" justifyContent="space-between" alignItems="center">
                <p className="cn-text-body1 font-[var(--font-display)] text-[16px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
                  Historique — {WALLET_TYPE_LABELS[selectedWallet.walletType]?.label}
                </p>
              </Box>

              {entriesLoading ? (
                <div className="px-3 pb-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} variant="rectangular" height={32} sx={{ borderRadius: 1, mb: 1 }} />
                  ))}
                </div>
              ) : entries.length === 0 ? (
                <div className="px-3 pb-3">
                  <EmptyState
                    icon={<AccountBalanceWallet />}
                    title="Aucune transaction"
                    variant="transparent"
                  />
                </div>
              ) : (
                <>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Référence</TableCell>
                          <TableCell align="right">Montant</TableCell>
                          <TableCell align="right">Solde</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {entries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell sx={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                              {new Date(entry.createdAt).toLocaleDateString('fr-FR', {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </TableCell>
                            <TableCell>{entry.description}</TableCell>
                            <TableCell>
                              <Chip
                                label={entry.entryType}
                                size="small"
                                sx={softChipSx(ENTRY_TYPE_TOKENS[entry.entryType] ?? 'var(--muted)')}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={REF_TYPE_LABELS[entry.referenceType]?.label ?? entry.referenceType}
                                size="small"
                                sx={softChipSx(REF_TYPE_LABELS[entry.referenceType]?.color ?? 'var(--muted)')}
                              />
                            </TableCell>
                            <TableCell align="right">
                              {/* Montant signé : display tabular-nums, ok/err */}
                              <Typography
                                sx={{
                                  ...moneySx,
                                  fontWeight: 600,
                                  fontSize: '12.5px',
                                  color: entry.entryType === 'CREDIT' ? 'var(--ok)' : 'var(--err)',
                                }}
                              >
                                {entry.entryType === 'CREDIT' ? '+' : '-'}
                                <Money value={entry.amount} from={entry.currency} />
                              </Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ ...moneySx, color: 'var(--ink)' }}>
                              <Money value={entry.balanceAfter} from={entry.currency} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <PagePagination
                    count={totalEntries}
                    page={page}
                    onPageChange={(newPage) => setPage(newPage)}
                    rowsPerPage={10}
                  />
                </>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
