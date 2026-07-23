import { useNavigate } from 'react-router-dom';
import { SparklesIcon } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui';

/**
 * Baitly — remaster de components/AiCreditsPaywall.tsx (MUI).
 * Paywall crédits IA : solde restant + CTA vers la boutique.
 */
export interface AiCreditsPaywallProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  balanceMillicredits?: number | null;
}

export default function AiCreditsPaywall({
  open,
  onClose,
  title = 'Crédits IA épuisés',
  message = "Cette action nécessite des crédits IA. Rechargez votre solde pour continuer d'utiliser l'assistant et les générations.",
  balanceMillicredits,
}: AiCreditsPaywallProps) {
  const navigate = useNavigate();
  const credits =
    balanceMillicredits != null ? Math.max(0, balanceMillicredits) / 1000 : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <SparklesIcon className="size-5" />
          </span>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        {credits != null && (
          <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Solde actuel :{' '}
            <span className="font-semibold text-foreground tabular-nums">
              {credits.toLocaleString('fr-FR')} crédits
            </span>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Plus tard
          </Button>
          <Button
            onClick={() => {
              onClose();
              navigate('/shop?tab=ai');
            }}
          >
            <SparklesIcon /> Recharger
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
