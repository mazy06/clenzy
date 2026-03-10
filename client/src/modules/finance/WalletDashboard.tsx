import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  AccountBalanceWallet,
  TrendingUp,
  Lock,
  Business,
} from '@mui/icons-material';
import { walletApi } from '../../services/api/walletApi';
import { useCurrency } from '../../hooks/useCurrency';
import { formatCurrency } from '../../utils/currencyUtils';
import type { WalletDto, LedgerEntryDto } from '../../types/payment';
import PageHeader from '../../components/PageHeader';

const WALLET_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  PLATFORM: { label: 'Plateforme', icon: <Business />, color: '#1976d2' },
  OWNER: { label: 'Propriétaire', icon: <TrendingUp />, color: '#2e7d32' },
  CONCIERGE: { label: 'Conciergerie', icon: <AccountBalanceWallet />, color: '#ed6c02' },
  ESCROW: { label: 'Séquestre', icon: <Lock />, color: '#9c27b0' },
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
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {!embedded && (
        <PageHeader title="Portefeuilles" subtitle="Vue d'ensemble des portefeuilles et transactions" backPath="/dashboard" />
      )}

      {wallets.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          Aucun portefeuille trouvé. Les portefeuilles seront créés automatiquement lors du premier paiement.
        </Alert>
      ) : (
        <>
          {/* Wallet summary cards */}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {wallets.map((wallet) => {
              const typeInfo = WALLET_TYPE_LABELS[wallet.walletType] || WALLET_TYPE_LABELS.PLATFORM;
              const isSelected = selectedWallet?.id === wallet.id;

              return (
                <Grid item xs={12} sm={6} md={3} key={wallet.id}>
                  <Paper
                    variant={isSelected ? 'elevation' : 'outlined'}
                    elevation={isSelected ? 3 : 0}
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      borderColor: isSelected ? typeInfo.color : undefined,
                      borderWidth: isSelected ? 2 : 1,
                      '&:hover': { borderColor: typeInfo.color },
                    }}
                    onClick={() => { setSelectedWallet(wallet); setPage(0); }}
                  >
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Box sx={{ color: typeInfo.color }}>{typeInfo.icon}</Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        {typeInfo.label}
                      </Typography>
                    </Box>
                    <Typography variant="h5" fontWeight={700}>
                      {formatCurrency(wallet.balance, wallet.currency)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {wallet.currency}
                    </Typography>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>

          {/* Ledger entries table */}
          {selectedWallet && (
            <Paper variant="outlined" sx={{ mt: 3 }}>
              <Box p={2} display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">
                  Historique — {WALLET_TYPE_LABELS[selectedWallet.walletType]?.label}
                </Typography>
              </Box>

              {entriesLoading ? (
                <Box display="flex" justifyContent="center" p={4}>
                  <CircularProgress size={24} />
                </Box>
              ) : entries.length === 0 ? (
                <Box p={3}>
                  <Typography color="text.secondary" align="center">
                    Aucune transaction
                  </Typography>
                </Box>
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
                            <TableCell>
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
                                color={entry.entryType === 'CREDIT' ? 'success' : 'error'}
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" color="text.secondary">
                                {entry.referenceType}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography
                                fontWeight={600}
                                color={entry.entryType === 'CREDIT' ? 'success.main' : 'error.main'}
                              >
                                {entry.entryType === 'CREDIT' ? '+' : '-'}
                                {formatCurrency(entry.amount, entry.currency)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(entry.balanceAfter, entry.currency)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    component="div"
                    count={totalEntries}
                    page={page}
                    onPageChange={(_, newPage) => setPage(newPage)}
                    rowsPerPage={10}
                    rowsPerPageOptions={[10]}
                    labelDisplayedRows={({ from, to, count }) =>
                      `${from}-${to} sur ${count}`
                    }
                  />
                </>
              )}
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}
