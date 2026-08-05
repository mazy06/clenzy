/**
 * Channex Price Drifts Dialog — Phase 3 OTA pricing (sync continue) + audit O1.
 *
 * <p>Liste les drifts de prix actifs (Baitly ↔ OTA) detectes par le
 * {@code ChannexRatesReconciliationScheduler} et permet a l'admin de les
 * resoudre en 1 clic :</p>
 * <ul>
 *   <li><b>KEEP_CLENZY</b> : on conserve le prix Baitly, push au prochain cycle ecrasera Channex</li>
 *   <li><b>KEEP_OTA</b>    : on cree un {@code RateOverride(source="OTA:RESOLVED")}
 *       avec le prix OTA → PriceEngine resoudra cette date avec ce prix</li>
 *   <li><b>DISMISSED</b>   : on ignore l'ecart (cas de difference attendue)</li>
 * </ul>
 *
 * <p>Optionnellement scope sur une property specifique via {@code propertyId}.
 * Sans propertyId : montre TOUS les drifts actifs de l'organisation.</p>
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import StatusChip from '../../../components/StatusChip';
import { cn } from '../../../utils/cn';
import { Badge, Button } from '../../../components/ui';
import { Spinner } from '../../../components/ui';
import {
  Alert,
  AlertAction,
  AlertDescription,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import {
  X,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

import { channexApi } from '../../../services/api/channexApi';
import type {
  ChannexPriceDriftDto,
  ChannexPriceDriftResolution,
} from '../../../services/api/channexApi';

interface ChannexPriceDriftsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Si fourni, ne montre que les drifts de cette property. Sinon : tous. */
  propertyId?: number;
  /** Callback apres resolution d'un drift (pour rafraichir le parent). */
  onDriftResolved?: () => void;
}

const RESOLUTION_LABEL: Record<ChannexPriceDriftResolution, string> = {
  KEEP_CLENZY: 'Garder Baitly',
  KEEP_OTA: 'Garder OTA',
  DISMISSED: 'Ignorer',
};

/**
 * Trois arbitrages de meme poids → trois boutons `outline`, differencies par
 * leur encre. L'encre est du TEXTE : `-ink` et non la teinte vive (§2.4).
 */
const RESOLUTION_CLASS: Record<ChannexPriceDriftResolution, string> = {
  KEEP_CLENZY: 'border-primary/50 text-primary',
  KEEP_OTA: 'border-warning/50 text-warning-ink',
  DISMISSED: 'border-border text-muted-foreground',
};

function formatPct(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "a l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours} h`;
    return `il y a ${Math.floor(hours / 24)} j`;
  } catch {
    return iso;
  }
}

function DriftRow({
  drift,
  busyResolution,
  onResolve,
}: {
  drift: ChannexPriceDriftDto;
  busyResolution: ChannexPriceDriftResolution | null;
  onResolve: (resolution: ChannexPriceDriftResolution) => void;
}) {
  const clenzyHigher = drift.clenzyPrice > drift.otaPrice;
  const TrendIcon = clenzyHigher ? TrendingUp : TrendingDown;
  // Icone → teinte vive ; puce → fond `-soft` + encre `-ink` (§2.4). L'ancien
  // `${trendColor}22` concatenait un alpha sur un `var()` : sans effet.
  const trendIconClass = clenzyHigher ? 'text-success' : 'text-destructive';
  const trendTokens = clenzyHigher
    ? { color: 'var(--bui-success-ink)', bg: 'var(--bui-success-soft)' }
    : { color: 'var(--bui-destructive-ink)', bg: 'var(--bui-destructive-soft)' };
  return (
    <Card size="sm">
      <CardContent>
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn('shrink-0', trendIconClass)}>
          <TrendIcon size={18} strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1 flex-wrap">
            <p className="text-xs font-semibold text-foreground tabular-nums">
              {drift.driftDate}
            </p>
            <span className="text-xs text-muted-foreground opacity-60 tabular-nums">
              · property #{drift.clenzyPropertyId}
            </span>
            <span className="text-xs text-muted-foreground opacity-60 ms-auto tabular-nums">
              {formatRelative(drift.detectedAt)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant="secondary" className="h-[22px] text-xs font-semibold tabular-nums bg-primary-soft text-primary">{`Baitly ${drift.clenzyPrice}${drift.currency}`}</Badge>
            <span className="text-xs text-muted-foreground opacity-60">vs</span>
            <Badge variant="warning" className="h-[22px] text-xs font-semibold tabular-nums">{`OTA ${drift.otaPrice}${drift.currency}`}</Badge>
            <StatusChip tokens={trendTokens} label={formatPct(drift.diffPercent)} className="text-2xs font-mono tabular-nums" />
          </div>
        </div>
      </div>

      {/* Boutons d'action */}
      <div className="flex flex-row gap-1.5 mt-[7.5px]">
        {(['KEEP_CLENZY', 'KEEP_OTA', 'DISMISSED'] as ChannexPriceDriftResolution[]).map((r) => {
          const isBusy = busyResolution === r;
          const anyBusy = busyResolution !== null;
          return (
            <Button
              key={r}
              size="sm"
              variant="outline"
              disabled={anyBusy}
              onClick={() => onResolve(r)}
              className={cn('flex-1 text-xs', RESOLUTION_CLASS[r])}
            >
              {isBusy ? (
                <Spinner className="size-3" />
              ) : r === 'KEEP_CLENZY' || r === 'KEEP_OTA' ? (
                <CheckCircle2 size={12} />
              ) : (
                <X size={12} />
              )}
              {RESOLUTION_LABEL[r]}
            </Button>
          );
        })}
      </div>
      </CardContent>
    </Card>
  );
}

export default function ChannexPriceDriftsDialog({
  open,
  onClose,
  propertyId,
  onDriftResolved,
}: ChannexPriceDriftsDialogProps) {
  const [drifts, setDrifts] = useState<ChannexPriceDriftDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyResolutions, setBusyResolutions] = useState<Map<number, ChannexPriceDriftResolution>>(new Map());

  const fetchDrifts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = propertyId != null
        ? await channexApi.listPriceDriftsForProperty(propertyId)
        : await channexApi.listPriceDrifts();
      setDrifts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement des drifts');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    if (open) {
      void fetchDrifts();
    } else {
      setDrifts([]);
      setError(null);
      setBusyResolutions(new Map());
    }
  }, [open, fetchDrifts]);

  const handleResolve = async (drift: ChannexPriceDriftDto, resolution: ChannexPriceDriftResolution) => {
    setBusyResolutions((m) => {
      const next = new Map(m);
      next.set(drift.id, resolution);
      return next;
    });
    try {
      await channexApi.resolvePriceDrift(drift.id, resolution);
      // Retire le drift de la liste (il est resolu → plus actif)
      setDrifts((curr) => curr.filter((d) => d.id !== drift.id));
      onDriftResolved?.();
    } catch (err) {
      setError(err instanceof Error
        ? `Resolution KO : ${err.message}`
        : 'Resolution KO');
    } finally {
      setBusyResolutions((m) => {
        const next = new Map(m);
        next.delete(drift.id);
        return next;
      });
    }
  };

  const grouped = useMemo(() => {
    if (propertyId != null) return { all: drifts };
    const byProp = new Map<number, ChannexPriceDriftDto[]>();
    for (const d of drifts) {
      const arr = byProp.get(d.clenzyPropertyId) ?? [];
      arr.push(d);
      byProp.set(d.clenzyPropertyId, arr);
    }
    const result: Record<string, ChannexPriceDriftDto[]> = {};
    for (const [pid, arr] of byProp.entries()) {
      result[`Propriete #${pid}`] = arr;
    }
    return result;
  }, [drifts, propertyId]);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        {/* La croix de fermeture est fournie par DialogContent : `pe-14` reserve sa place. */}
        <DialogHeader className="flex-row items-start gap-1.5 pe-14">
          <div className="size-9 rounded-lg bg-warning-soft text-warning flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-base font-semibold tracking-tight text-balance leading-[1.3]">
              Conflits de prix Baitly ↔ Channex
            </DialogTitle>
            <DialogDescription className="text-xs block mt-0.5 tabular-nums">
              {drifts.length === 0 && !loading
                ? 'Aucun conflit actif'
                : `${drifts.length} drift${drifts.length > 1 ? 's' : ''} en attente de résolution${propertyId ? ' pour cette propriete' : ''}`}
            </DialogDescription>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Un bouton desactive n'emet pas d'evenement de survol : l'enveloppe
                  porte le declencheur a sa place. */}
              <span className="inline-flex shrink-0">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Rafraichir"
                  disabled={loading}
                  onClick={() => void fetchDrifts()}
                >
                  {loading ? <Spinner className="size-3.5" /> : <RefreshCw size={14} />}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">Rafraichir</TooltipContent>
          </Tooltip>
        </DialogHeader>

        <div>
          {loading && drifts.length === 0 && (
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-[100px] rounded-lg" />
              <Skeleton className="h-[100px] rounded-lg" />
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mb-2">
              <AlertTriangle />
              <AlertDescription>{error}</AlertDescription>
              <AlertAction>
                <Button variant="ghost" size="sm" onClick={() => void fetchDrifts()}>
                  Reessayer
                </Button>
              </AlertAction>
            </Alert>
          )}

          {!loading && drifts.length === 0 && !error && (
            <Empty className="py-6">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-success-soft text-success">
                  <CheckCircle2 strokeWidth={2} />
                </EmptyMedia>
                <EmptyDescription>
                  Tous les prix sont alignes entre Baitly et Channex.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {drifts.length > 0 && (
            <div className="flex flex-col gap-[7.5px]">
              {Object.entries(grouped).map(([groupLabel, groupDrifts]) => (
                <div key={groupLabel}>
                  {propertyId == null && (
                    <span className="block mb-[4.5px] text-2xs font-semibold uppercase tracking-wide text-muted-foreground tabular-nums">
                      {groupLabel} · {groupDrifts.length} drift{groupDrifts.length > 1 ? 's' : ''}
                    </span>
                  )}
                  <div className="flex flex-col gap-1.5">
                    {groupDrifts.map((d) => (
                      <DriftRow
                        key={d.id}
                        drift={d}
                        busyResolution={busyResolutions.get(d.id) ?? null}
                        onResolve={(r) => void handleResolve(d, r)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
