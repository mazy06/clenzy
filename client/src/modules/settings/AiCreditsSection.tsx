import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '../../utils/cn';
import { Badge, Button } from '../../components/ui';
import { Alert, AlertDescription } from '../../components/ui';
import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { Card, Skeleton } from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import { Coins, History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  aiCreditsApi,
  toCredits,
  type CreditBalance,
  type CreditLedgerLine,
  type CreditPack,
} from '../../services/api/aiCreditsApi';
import AgentRunReplayDialog from './AgentRunReplayDialog';

/**
 * Tons de la jauge de solde. Classes ecrites en clair : Tailwind emet ses
 * utilities a la compilation, une classe construite a l'execution n'existerait
 * pas. Le chiffre est du TEXTE (jeton `-ink`, contraste AA) ; l'icone est
 * decorative (teinte vive).
 */
const GAUGE_TEXT_CLASS = {
  empty: 'text-destructive-ink',
  low: 'text-warning-ink',
  ok: 'text-success-ink',
} as const;

const GAUGE_ICON_CLASS = {
  empty: 'text-destructive',
  low: 'text-warning',
  ok: 'text-success',
} as const;

/**
 * Crédits IA (campagne T-08) : solde par poches, packs de recharge Stripe et
 * historique du ledger. Rendu dans Paramètres > IA > Consommation, au-dessus de
 * la vue tokens. Les seuils 80/95/100 % ne sont pas calculables sans dotation
 * de référence côté front : la jauge colore selon le solde restant absolu.
 */
export default function AiCreditsSection() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [ledger, setLedger] = useState<CreditLedgerLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replayRunId, setReplayRunId] = useState<string | null>(null);

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
  const gaugeTone = useMemo<keyof typeof GAUGE_TEXT_CLASS>(() => {
    if (totalCredits <= 0) return 'empty';
    if (totalCredits < 50) return 'low';
    return 'ok';
  }, [totalCredits]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2 mb-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-[72px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 mb-3">
      {topupOutcome === 'success' && (
        <Alert variant="success">
          <CircleCheck />
          <AlertDescription>{t('aiCredits.topupSuccess', 'Paiement confirmé — vos crédits seront visibles dans quelques instants.')}</AlertDescription>
        </Alert>
      )}
      {topupOutcome === 'cancelled' && (
        <Alert variant="info">
          <Info />
          <AlertDescription>{t('aiCredits.topupCancelled', 'Rechargement annulé.')}</AlertDescription>
        </Alert>
      )}
      {error && <Alert variant="warning">
        <TriangleAlert />
        <AlertDescription>{error}</AlertDescription>
      </Alert>}

      {/* Solde + poches */}
      <Card className="gap-0 py-0 p-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {/* Icone decorative : teinte vive, portee par `currentColor`. */}
            <span className={cn('inline-flex', GAUGE_ICON_CLASS[gaugeTone])}>
              <Coins size={20} aria-hidden />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">
                {t('aiCredits.balanceTitle', 'Crédits IA disponibles')}
              </p>
              <h5 className={cn('text-sm font-semibold tracking-tight tabular-nums leading-[1.2]', GAUGE_TEXT_CLASS[gaugeTone])}>
                {balance ? toCredits(balance.totalMillicredits) : '0'}
              </h5>
            </div>
          </div>
          <div className="flex gap-1 flex-wrap">
            {(balance?.pockets ?? []).map((pocket, idx) => (
              <Badge variant="outline" className="tabular-nums" key={`${pocket.source}-${idx}`}>{t(`aiCredits.pocket.${pocket.source}`, pocket.source) + ' · '
                  + toCredits(pocket.remainingMillicredits) + ' · '
                  + t('aiCredits.expires', 'expire le') + ' '
                  + new Date(pocket.expiresAt).toLocaleDateString()}</Badge>
            ))}
            {(balance?.pockets ?? []).length === 0 && (
              <span className="text-xs text-muted-foreground">
                {t('aiCredits.noPockets', 'Aucune poche active — rechargez ou attendez votre prochaine dotation mensuelle.')}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Packs de recharge */}
      <Card className="gap-0 py-0 p-2.5">
        <h6 className="text-xs font-medium mb-1.5">
          {t('aiCredits.topupTitle', 'Recharger (crédits valables 12 mois)')}
        </h6>
        <div className="flex gap-1.5 flex-wrap">
          {packs.map((pack) => (
            // Tous les packs se valent : aucun ne prend l'encre pleine.
            <Button
              key={pack.key}
              variant="outline"
              size="sm"
              className="tabular-nums"
              disabled={buying !== null}
              onClick={() => handleBuy(pack.key)}
            >
              {toCredits(pack.millicredits)} {t('aiCredits.credits', 'crédits')} —{' '}
              {(pack.priceCents / 100).toLocaleString(undefined, { style: 'currency', currency: 'EUR' })}
            </Button>
          ))}
        </div>
      </Card>

      {/* Historique ledger */}
      {ledger.length > 0 && (
        <Card className="gap-0 py-0 p-2.5">
          <h6 className="text-xs font-medium mb-1.5">
            {t('aiCredits.ledgerTitle', 'Derniers mouvements')}
          </h6>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('aiCredits.ledger.date', 'Date')}</TableHead>
                <TableHead>{t('aiCredits.ledger.type', 'Type')}</TableHead>
                <TableHead>{t('aiCredits.ledger.agent', 'Agent')}</TableHead>
                <TableHead className="text-end">{t('aiCredits.ledger.amount', 'Crédits')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.slice(0, 10).map((line, idx) => {
                const replayable = Boolean(line.runId);
                return (
                  <TableRow
                    key={idx}
                    onClick={replayable ? () => setReplayRunId(line.runId) : undefined}
                    className={replayable ? 'cursor-pointer' : 'cursor-default'}
                    title={replayable ? t('aiCredits.ledger.replayHint', 'Voir le replay du run') : undefined}
                  >
                    <TableCell className="whitespace-nowrap">
                      {new Date(line.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{t(`aiCredits.entry.${line.entryType}`, line.entryType)}</TableCell>
                    <TableCell>
                      {line.agent}{line.model ? ` · ${line.model}` : ''}
                      {replayable && (
                        <History size={13} className="ms-1.5 inline-block align-middle text-muted-foreground" aria-hidden />
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-end tabular-nums',
                        line.millicredits >= 0 ? 'text-success-ink' : 'text-foreground',
                      )}
                    >
                      {line.millicredits >= 0 ? '+' : ''}{toCredits(line.millicredits)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Grand Livre d'Autonomie (X3) : replay du run d'une ligne du ledger. */}
      <AgentRunReplayDialog
        runId={replayRunId}
        open={replayRunId !== null}
        onClose={() => setReplayRunId(null)}
      />
    </div>
  );
}
