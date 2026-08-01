import { useEffect, useState } from 'react';
import { cn } from '../utils/cn';
import { Spinner } from './ui';
import { Dialog, DialogContent, Box, Button, IconButton } from '@mui/material';
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
    <Dialog open={open} onClose={busy ? undefined : handleClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 'var(--radius-lg)' } }}>
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-1.5">
        <div className="grid place-items-[center] w-[34px] h-[34px] rounded-[10px] bg-[var(--accent-soft)] text-[var(--accent)] shrink-0">
          <Wallet size={18} strokeWidth={2} />
        </div>
        <div className="flex-1 font-[var(--font-display)] text-[var(--text-lg)] font-[var(--fw-bold)] text-[var(--ink)]">
          {title ?? 'Crédits IA insuffisants'}
        </div>
        <IconButton onClick={handleClose} size="small" aria-label="Fermer" disabled={busy} sx={{ color: 'var(--muted)' }}><X size={18} /></IconButton>
      </div>

      <DialogContent sx={{ pt: 0.5, px: 3, pb: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div className="text-[var(--text-sm)] text-[var(--muted)] leading-[1.55]">
          {message ?? "Cette génération dépasse votre solde de crédits IA. Rechargez pour continuer — le surplus consommé est facturé au réel."}
        </div>

        {balance != null && (
          <div className="inline-flex items-center gap-1 self-start px-2 py-1 rounded-[var(--radius-md)] bg-[var(--field)] border border-[var(--line)] text-[var(--text-2xs)] text-[var(--body)]">
            Solde actuel : <b style={{ fontVariantNumeric: 'tabular-nums' }}>{toCredits(balance)} crédits</b>
          </div>
        )}

        {packs === null ? (
          <div className="grid place-items-[center] py-[18px]"><Spinner className="size-[22px] text-[var(--accent)]" /></div>
        ) : packs.length === 0 ? (
          <div className="text-[var(--text-sm)] text-[var(--muted)]">Aucun pack disponible pour le moment.</div>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `repeat(${Math.min(packs.length, 3)}, 1fr)` }, gap: 1.25 }}>
            {packs.map((p) => {
              const active = p.key === selected;
              return (
                <button className={cn('relative text-start p-[9px] rounded-[var(--radius-md)] border-[1.5px] border-solid hover:border-[var(--accent)]', busy ? 'cursor-default' : 'cursor-pointer', active ? 'border-[var(--accent)]' : 'border-[var(--line)]', active ? 'bg-[var(--accent-soft)]' : 'bg-[var(--card,_#fff)]')} style={{ transition: 'border-color 150ms ease, background 150ms ease' }} key={p.key} type="button" onClick={() => setSelected(p.key)} disabled={busy}>
                  {active && <div className="absolute top-[8px] end-[8px] grid place-items-[center] w-[18px] h-[18px] rounded-[50%] bg-[var(--accent)] text-[var(--on-accent)]"><Check size={12} strokeWidth={3} /></div>}
                  <div className="text-[var(--text-lg)] font-bold text-[var(--ink)] tabular-nums">{toCredits(p.millicredits)}</div>
                  <div className="text-[var(--text-2xs)] text-[var(--muted)] mb-1.5">crédits IA</div>
                  <div className={cn('text-[var(--text-md)] font-bold tabular-nums', active ? 'text-[var(--accent)]' : 'text-[var(--body)]')}>{euro(p.priceCents)}</div>
                </button>
              );
            })}
          </Box>
        )}

        {error && (
          <div className="flex items-center gap-1.5 p-2 rounded-[var(--radius-md)] bg-[var(--err-soft)] text-[var(--err)] text-[var(--text-sm)]">
            <AlertTriangle size={16} strokeWidth={2} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        <div className="flex justify-end gap-1.5 pt-0.5">
          <Button onClick={handleClose} disabled={busy} sx={{ textTransform: 'none', color: 'var(--muted)' }}>Annuler</Button>
          <Button variant="contained" disableElevation onClick={handleBuy} disabled={!selected || busy}
            startIcon={busy ? <Spinner className="size-[15px]" /> : <Sparkles size={16} strokeWidth={2} />}
            endIcon={!busy ? <ArrowRight size={16} strokeWidth={2} /> : undefined}
            sx={{ textTransform: 'none' }}>
            {busy ? 'Ouverture du paiement…' : 'Recharger & continuer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
