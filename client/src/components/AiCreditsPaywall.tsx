import { useEffect, useState, type CSSProperties } from 'react';
import { cn } from '../utils/cn';
import { Alert, AlertDescription, Button, Dialog, DialogContent, DialogHeader, DialogTitle, Spinner } from './ui';
import { Sparkles, X, Wallet, AlertTriangle, ArrowRight, Check } from 'lucide-react';
import { aiCreditsApi, toCredits, type CreditPack } from '../services/api/aiCreditsApi';

/**
 * Paywall de rachat de crédits IA (T-07). Affiché quand une opération IA coûteuse est bloquée faute de
 * solde (HTTP 402 AI_CREDITS_INSUFFICIENT — ou 429 quota mensuel). Liste les packs configurés serveur et
 * ouvre le Stripe Checkout hébergé (`aiCreditsApi.createTopUp`). Le crédit effectif arrive au webhook
 * `checkout.session.completed` ; l'utilisateur revient et relance sa génération.
 */
export interface AiCreditsPaywallProps {
  open: boolean;
  onClose: () => void;
  /** Titre custom (défaut : « Crédits IA insuffisants »). */
  title?: string;
  /** Message custom sous le titre. */
  message?: string;
  /** Solde connu (millicredits) — évite un aller-retour ; sinon rechargé. */
  balanceMillicredits?: number | null;
}

const euro = (cents: number) => (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'EUR' });

export default function AiCreditsPaywall({ open, onClose, title, message, balanceMillicredits }: AiCreditsPaywallProps) {
  const [packs, setPacks] = useState<CreditPack[] | null>(null);
  // Le solde affiche est derive : prop connue > solde recharge en arriere-plan.
  const [fetchedBalance, setFetchedBalance] = useState<number | null>(null);
  const balance = balanceMillicredits ?? fetchedBalance;
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    aiCreditsApi.getPacks()
      .then((p) => { setPacks(p); setSelected(p[Math.min(1, p.length - 1)]?.key ?? p[0]?.key ?? null); })
      .catch(() => setPacks([]));
    if (balanceMillicredits == null) {
      aiCreditsApi.getBalance().then((b) => setFetchedBalance(b.totalMillicredits)).catch(() => {});
    }
  }, [open, balanceMillicredits]);

  // Purge l'erreur a la fermeture (event handler, pas d'effet de sync).
  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleBuy = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { checkoutUrl } = await aiCreditsApi.createTopUp(selected);
      window.location.href = checkoutUrl; // Stripe Checkout hébergé
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'ouvrir le paiement. Réessayez.");
      setBusy(false);
    }
  };

  return (
    // maxWidth="sm" + fullWidth MUI = pleine largeur plafonnee a 600 px.
    // `showCloseButton={false}` : la croix doit pouvoir etre desactivee pendant
    // l'ouverture du paiement, ce que la croix integree du primitif ne permet pas.
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) handleClose(); }}>
      <DialogContent showCloseButton={false} className="w-full sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="grid place-items-center w-[34px] h-[34px] rounded-lg bg-primary-soft text-primary shrink-0">
              <Wallet size={18} strokeWidth={2} />
            </span>
            <DialogTitle className="flex-1 font-[family-name:var(--font-display)] text-base font-semibold tracking-tight text-foreground">
              {title ?? 'Crédits IA insuffisants'}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleClose}
              aria-label="Fermer"
              disabled={busy}
              className="text-muted-foreground"
            >
              <X size={18} />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3">
        <div className="text-sm text-muted-foreground leading-[1.55]">
          {message ?? "Cette génération dépasse votre solde de crédits IA. Rechargez pour continuer — le surplus consommé est facturé au réel."}
        </div>

        {balance != null && (
          <div className="inline-flex items-center gap-1 self-start px-2 py-1 rounded-lg bg-field border border-border text-2xs text-foreground">
            Solde actuel : <b className="tabular-nums">{toCredits(balance)} crédits</b>
          </div>
        )}

        {packs === null ? (
          <div className="grid place-items-center py-[18px]"><Spinner className="size-[22px] text-primary" /></div>
        ) : packs.length === 0 ? (
          <div className="text-sm text-muted-foreground">Aucun pack disponible pour le moment.</div>
        ) : (
          // Le gabarit depend du nombre de packs (execution) : custom property,
          // la rupture sm (600px MUI) reste une variante statique.
          <div
            className="grid grid-cols-[1fr] min-[600px]:grid-cols-[var(--packs-cols)] gap-[7.5px]"
            style={{ '--packs-cols': `repeat(${Math.min(packs.length, 3)}, 1fr)` } as CSSProperties}
          >
            {packs.map((p) => {
              const active = p.key === selected;
              return (
                <button className={cn('relative text-start p-[9px] rounded-lg border-[1.5px] border-solid hover:border-primary', busy ? 'cursor-default' : 'cursor-pointer', active ? 'border-primary' : 'border-border', active ? 'bg-primary-soft' : 'bg-card')} style={{ transition: 'border-color 150ms ease, background 150ms ease' }} key={p.key} type="button" onClick={() => setSelected(p.key)} disabled={busy}>
                  {active && <div className="absolute top-[8px] end-[8px] grid place-items-center w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground"><Check size={12} strokeWidth={3} /></div>}
                  <div className="text-base font-bold text-foreground tabular-nums">{toCredits(p.millicredits)}</div>
                  <div className="text-2xs text-muted-foreground mb-1.5">crédits IA</div>
                  <div className={cn('text-sm font-bold tabular-nums', active ? 'text-primary' : 'text-foreground')}>{euro(p.priceCents)}</div>
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="items-center">
            <AlertTriangle strokeWidth={2} />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-1.5 pt-0.5">
          <Button variant="ghost" onClick={handleClose} disabled={busy} className="text-muted-foreground">Annuler</Button>
          <Button onClick={handleBuy} disabled={!selected || busy}>
            {busy ? <Spinner className="size-[15px]" /> : <Sparkles strokeWidth={2} />}
            {busy ? 'Ouverture du paiement…' : 'Recharger & continuer'}
            {!busy && <ArrowRight strokeWidth={2} />}
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
