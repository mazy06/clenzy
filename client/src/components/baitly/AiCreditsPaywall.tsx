import { useNavigate } from 'react-router-dom';
import { SparklesIcon } from '../../icons/glyphs';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui';
import { activeIntlLocale } from '../../utils/activeLocale';
import { useTranslation } from '../../hooks/useTranslation';

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
  title,
  message,
  balanceMillicredits,
}: AiCreditsPaywallProps) {
  const { t } = useTranslation();
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
          <DialogTitle>{title ?? t('aiCredits.paywall.title')}</DialogTitle>
          <DialogDescription>{message ?? t('aiCredits.paywall.message')}</DialogDescription>
        </DialogHeader>
        {credits != null && (
          <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Solde actuel :{' '}
            <span className="font-semibold text-foreground tabular-nums">
              {credits.toLocaleString(activeIntlLocale())} crédits
            </span>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.later')}
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
