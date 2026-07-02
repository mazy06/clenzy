import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import { Coins } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  aiCreditsApi,
  toCredits,
  type CreditBalance,
  type CreditLedgerLine,
  type CreditPack,
} from '../../services/api/aiCreditsApi';

/**
 * Crédits IA (campagne T-08) : solde par poches, packs de recharge Stripe et
 * historique du ledger. Rendu dans Paramètres > IA > Consommation, au-dessus de
 * la vue tokens. Les seuils 80/95/100 % ne sont pas calculables sans dotation
 * de référence côté front : la jauge colore selon le solde restant absolu.
 */
export default function AiCreditsSection() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [searchParams] = useSearchParams();

  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [ledger, setLedger] = useState<CreditLedgerLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const topupOutcome = searchParams.get('topup'); // success | cancelled | null

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([aiCreditsApi.getBalance(), aiCreditsApi.getPacks(), aiCreditsApi.getLedger()])
      .then(([b, p, l]) => {
        setBalance(b);
        setPacks(p);
        setLedger(l);
        setError(null);
      })
      .catch(() => setError(t('aiCredits.loadError', 'Impossible de charger les crédits IA.')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleBuy = useCallback(
    (packKey: string) => {
      setBuying(packKey);
      aiCreditsApi
        .createTopUp(packKey)
        .then(({ checkoutUrl }) => {
          window.location.href = checkoutUrl;
        })
        .catch(() => {
          setError(t('aiCredits.topupError', 'Impossible de créer la session de paiement.'));
          setBuying(null);
        });
    },
    [t],
  );

  const totalCredits = balance ? balance.totalMillicredits / 1000 : 0;
  const gaugeColor = useMemo(() => {
    if (totalCredits <= 0) return theme.palette.error.main;
    if (totalCredits < 50) return '#D4A574';
    return '#4A9B8E';
  }, [totalCredits, theme.palette.error.main]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
        <Skeleton variant="rounded" height={96} />
        <Skeleton variant="rounded" height={72} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
      {topupOutcome === 'success' && (
        <Alert severity="success">
          {t('aiCredits.topupSuccess', 'Paiement confirmé — vos crédits seront visibles dans quelques instants.')}
        </Alert>
      )}
      {topupOutcome === 'cancelled' && (
        <Alert severity="info">{t('aiCredits.topupCancelled', 'Rechargement annulé.')}</Alert>
      )}
      {error && <Alert severity="warning">{error}</Alert>}

      {/* Solde + poches */}
      <Paper variant="outlined" sx={{ p: 1.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Coins size={20} color={gaugeColor} aria-hidden />
            <Box>
              <Typography variant="body2" color="text.secondary">
                {t('aiCredits.balanceTitle', 'Crédits IA disponibles')}
              </Typography>
              <Typography
                variant="h5"
                sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: gaugeColor, lineHeight: 1.2 }}
              >
                {balance ? toCredits(balance.totalMillicredits) : '0'}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {(balance?.pockets ?? []).map((pocket, idx) => (
              <Chip
                key={`${pocket.source}-${idx}`}
                size="small"
                variant="outlined"
                label={t(`aiCredits.pocket.${pocket.source}`, pocket.source) + ' · '
                  + toCredits(pocket.remainingMillicredits) + ' · '
                  + t('aiCredits.expires', 'expire le') + ' '
                  + new Date(pocket.expiresAt).toLocaleDateString()}
                sx={{ fontVariantNumeric: 'tabular-nums' }}
              />
            ))}
            {(balance?.pockets ?? []).length === 0 && (
              <Typography variant="caption" color="text.secondary">
                {t('aiCredits.noPockets', 'Aucune poche active — rechargez ou attendez votre prochaine dotation mensuelle.')}
              </Typography>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Packs de recharge */}
      <Paper variant="outlined" sx={{ p: 1.75 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t('aiCredits.topupTitle', 'Recharger (crédits valables 12 mois)')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {packs.map((pack) => (
            <Button
              key={pack.key}
              variant="outlined"
              size="small"
              disabled={buying !== null}
              onClick={() => handleBuy(pack.key)}
              sx={{ fontVariantNumeric: 'tabular-nums', textTransform: 'none' }}
            >
              {toCredits(pack.millicredits)} {t('aiCredits.credits', 'crédits')} —{' '}
              {(pack.priceCents / 100).toLocaleString(undefined, { style: 'currency', currency: 'EUR' })}
            </Button>
          ))}
        </Box>
      </Paper>

      {/* Historique ledger */}
      {ledger.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1.75 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t('aiCredits.ledgerTitle', 'Derniers mouvements')}
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('aiCredits.ledger.date', 'Date')}</TableCell>
                <TableCell>{t('aiCredits.ledger.type', 'Type')}</TableCell>
                <TableCell>{t('aiCredits.ledger.agent', 'Agent')}</TableCell>
                <TableCell align="right">{t('aiCredits.ledger.amount', 'Crédits')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ledger.slice(0, 10).map((line, idx) => (
                <TableRow key={idx} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {new Date(line.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{t(`aiCredits.entry.${line.entryType}`, line.entryType)}</TableCell>
                  <TableCell>{line.agent}{line.model ? ` · ${line.model}` : ''}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontVariantNumeric: 'tabular-nums',
                      color: line.millicredits >= 0 ? '#4A9B8E' : 'text.primary',
                    }}
                  >
                    {line.millicredits >= 0 ? '+' : ''}{toCredits(line.millicredits)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
