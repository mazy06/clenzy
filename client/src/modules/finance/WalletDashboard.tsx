import React, { useState, useEffect } from 'react';
import StatusChip from '../../components/StatusChip';
import { Card, Skeleton } from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import { cn } from '../../utils/cn';
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
import StatTile from '../../components/baitly/StatTile';
import EmptyState from '../../components/EmptyState';
import PagePagination from '../../components/PagePagination';

// Accents = palette Baitly validée (ESCROW : mauve désaturé, propre à cet écran)
const WALLET_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  PLATFORM: { label: 'Plateforme', icon: <Business size={16} strokeWidth={1.75} />, color: '#6B8A9A' },
  OWNER: { label: 'Propriétaire', icon: <TrendingUp size={16} strokeWidth={1.75} />, color: '#4A9B8E' },
  CONCIERGE: { label: 'Conciergerie', icon: <AccountBalanceWallet size={16} strokeWidth={1.75} />, color: '#D4A574' },
  ESCROW: { label: 'Séquestre', icon: <Lock size={16} strokeWidth={1.75} />, color: '#9A7FA3' },
};

// Neutre (ADJUSTMENT) : pas de token sémantique dédié — repli muted-foreground
const REF_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  PAYMENT: { label: 'Paiement', color: '#6B8A9A' },
  SPLIT: { label: 'Répartition', color: '#7BA3C2' },
  ESCROW_HOLD: { label: 'Séquestre', color: '#D4A574' },
  ESCROW_RELEASE: { label: 'Libération', color: '#4A9B8E' },
  REFUND: { label: 'Remboursement', color: '#C97A7A' },
  PAYOUT: { label: 'Versement', color: '#4A9B8E' },
  ADJUSTMENT: { label: 'Ajustement', color: 'var(--bui-muted-foreground)' },
};

/** Montants : display tabular-nums (jamais proportional) */
const MONEY_CLASS = 'font-[family-name:var(--font-display)] tabular-nums';

/** Encre du chip de sens : `-ink`, seule variante qui passe AA sur son fond doux. */
const ENTRY_TYPE_TOKENS: Record<string, string> = {
  CREDIT: 'var(--bui-success-ink)',
  DEBIT: 'var(--bui-destructive-ink)',
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
        <div className="grid grid-cols-12 gap-3 mt-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3" key={i}>
              <Card className="gap-0 py-0 p-3 border-border">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Skeleton className="size-[26px] rounded-lg" />
                  <Skeleton className="h-4 w-1/2 rounded" />
                </div>
                <Skeleton className="h-7 w-3/5 rounded" />
                <Skeleton className="h-3.5 w-[30%] rounded" />
              </Card>
            </div>
          ))}
        </div>
        <Card className="gap-0 py-0 mt-4 p-3 border-border">
          <Skeleton className="h-5 w-1/4 rounded mb-2.5" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-lg mb-1.5" />
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
          <div className="grid grid-cols-12 gap-3 mt-1.5">
            {wallets.map((wallet) => {
              const typeInfo = WALLET_TYPE_LABELS[wallet.walletType] || WALLET_TYPE_LABELS.PLATFORM;
              const isSelected = selectedWallet?.id === wallet.id;

              return (
                <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-3" key={wallet.id}>
                  {/* Tuile KPI selectionnable : primitive StatTile — un vrai
                      <button>, dont le focus, Entree et Espace sont natifs.
                      La selection se dit par le fond (§5), pas par un liseré. */}
                  <StatTile
                    icon={(
                      <span
                        className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-md"
                        style={{ color: typeInfo.color, backgroundColor: `color-mix(in srgb, ${typeInfo.color} 12%, transparent)` }}
                      >
                        {typeInfo.icon}
                      </span>
                    )}
                    label={typeInfo.label}
                    value={<Money value={wallet.balance} from={wallet.currency} />}
                    hint={wallet.currency}
                    onClick={() => { setSelectedWallet(wallet); setPage(0); }}
                    className={cn(
                      'h-full',
                      isSelected && 'border-primary bg-primary-soft hover:bg-primary-soft',
                    )}
                  />
                </div>
              );
            })}
          </div>

          {/* Ledger entries table */}
          {selectedWallet && (
            <Card className="gap-0 py-0 mt-4 border-border overflow-hidden">
              <div className="p-3 flex justify-between items-center">
                <p className="font-[family-name:var(--font-display)] text-base font-semibold tracking-tight text-foreground">
                  Historique — {WALLET_TYPE_LABELS[selectedWallet.walletType]?.label}
                </p>
              </div>

              {entriesLoading ? (
                <div className="px-3 pb-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 rounded-lg mb-1.5" />
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Référence</TableHead>
                          <TableHead className="text-end">Montant</TableHead>
                          <TableHead className="text-end">Solde</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-muted-foreground tabular-nums">
                              {new Date(entry.createdAt).toLocaleDateString('fr-FR', {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </TableCell>
                            <TableCell>{entry.description}</TableCell>
                            <TableCell>
                              <StatusChip color={ENTRY_TYPE_TOKENS[entry.entryType] ?? 'var(--bui-muted-foreground)'} label={entry.entryType} />
                            </TableCell>
                            <TableCell>
                              <StatusChip color={REF_TYPE_LABELS[entry.referenceType]?.color ?? 'var(--bui-muted-foreground)'} label={REF_TYPE_LABELS[entry.referenceType]?.label ?? entry.referenceType} />
                            </TableCell>
                            <TableCell className="text-end">
                              {/* Montant signé : display tabular-nums, encre `-ink` (AA) */}
                              <p
                                className={cn(
                                  MONEY_CLASS,
                                  'text-[12.5px] font-semibold',
                                  entry.entryType === 'CREDIT' ? 'text-success-ink' : 'text-destructive-ink',
                                )}
                              >
                                {entry.entryType === 'CREDIT' ? '+' : '-'}
                                <Money value={entry.amount} from={entry.currency} />
                              </p>
                            </TableCell>
                            {/* chaine litterale : tailwind-merge rangerait font-[…] et font-semibold dans le meme groupe */}
                            <TableCell className="font-[family-name:var(--font-display)] tabular-nums text-end text-foreground">
                              <Money value={entry.balanceAfter} from={entry.currency} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
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
