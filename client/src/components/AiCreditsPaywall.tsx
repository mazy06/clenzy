import { useEffect, useState } from 'react';
import { Dialog, DialogContent, Box, Button, CircularProgress, IconButton } from '@mui/material';
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 3, pt: 2.5, pb: 1 }}>
        <Box sx={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: '10px', bgcolor: 'var(--accent-soft)', color: 'var(--accent)', flexShrink: 0 }}>
          <Wallet size={18} strokeWidth={2} />
        </Box>
        <Box sx={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--ink)' }}>
          {title ?? 'Crédits IA insuffisants'}
        </Box>
        <IconButton onClick={handleClose} size="small" aria-label="Fermer" disabled={busy} sx={{ color: 'var(--muted)' }}><X size={18} /></IconButton>
      </Box>

      <DialogContent sx={{ pt: 0.5, px: 3, pb: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', lineHeight: 1.55 }}>
          {message ?? "Cette génération dépasse votre solde de crédits IA. Rechargez pour continuer — le surplus consommé est facturé au réel."}
        </Box>

        {balance != null && (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, alignSelf: 'flex-start', px: 1.25, py: 0.75, borderRadius: 'var(--radius-md)', bgcolor: 'var(--field)', border: '1px solid var(--line)', fontSize: 'var(--text-2xs)', color: 'var(--body)' }}>
            Solde actuel : <b style={{ fontVariantNumeric: 'tabular-nums' }}>{toCredits(balance)} crédits</b>
          </Box>
        )}

        {packs === null ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}><CircularProgress size={22} sx={{ color: 'var(--accent)' }} /></Box>
        ) : packs.length === 0 ? (
          <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>Aucun pack disponible pour le moment.</Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `repeat(${Math.min(packs.length, 3)}, 1fr)` }, gap: 1.25 }}>
            {packs.map((p) => {
              const active = p.key === selected;
              return (
                <Box key={p.key} component="button" type="button" onClick={() => setSelected(p.key)} disabled={busy}
                  sx={{
                    position: 'relative', textAlign: 'left', cursor: busy ? 'default' : 'pointer', p: 1.5,
                    borderRadius: 'var(--radius-md)', border: '1.5px solid', borderColor: active ? 'var(--accent)' : 'var(--line)',
                    bgcolor: active ? 'var(--accent-soft)' : 'var(--card, #fff)',
                    transition: 'border-color 150ms ease, background 150ms ease',
                    '&:hover': { borderColor: 'var(--accent)' },
                  }}>
                  {active && <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'grid', placeItems: 'center', width: 18, height: 18, borderRadius: '50%', bgcolor: 'var(--accent)', color: 'var(--on-accent)' }}><Check size={12} strokeWidth={3} /></Box>}
                  <Box sx={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{toCredits(p.millicredits)}</Box>
                  <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)', mb: 1 }}>crédits IA</Box>
                  <Box sx={{ fontSize: 'var(--text-md)', fontWeight: 700, color: active ? 'var(--accent)' : 'var(--body)', fontVariantNumeric: 'tabular-nums' }}>{euro(p.priceCents)}</Box>
                </Box>
              );
            })}
          </Box>
        )}

        {error && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.25, borderRadius: 'var(--radius-md)', bgcolor: 'var(--err-soft)', color: 'var(--err)', fontSize: 'var(--text-sm)' }}>
            <AlertTriangle size={16} strokeWidth={2} style={{ flexShrink: 0 }} /> {error}
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 0.5 }}>
          <Button onClick={handleClose} disabled={busy} sx={{ textTransform: 'none', color: 'var(--muted)' }}>Annuler</Button>
          <Button variant="contained" disableElevation onClick={handleBuy} disabled={!selected || busy}
            startIcon={busy ? <CircularProgress size={15} color="inherit" /> : <Sparkles size={16} strokeWidth={2} />}
            endIcon={!busy ? <ArrowRight size={16} strokeWidth={2} /> : undefined}
            sx={{ textTransform: 'none' }}>
            {busy ? 'Ouverture du paiement…' : 'Recharger & continuer'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
